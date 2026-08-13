import { createClient } from "@/lib/supabase/client";
import { isRecoverableAuthSessionError } from "@/lib/supabase/auth";
import {
  getPendingQueueItems,
  getReferenceCatalog,
  getTransaction,
  markTransactionSyncFailed,
  markTransactionSyncPending,
  markTransactionSynced,
  replaceReferenceCatalog,
  setTransactionBusinessId,
} from "@/lib/offline/db";
import type { ReferenceCatalog, SyncSummary } from "@/lib/offline/types";
import { hasEnvVars } from "@/lib/utils";

type BusinessMembership = {
  business_id: string;
  role: string;
};

type RemoteReferenceRow = {
  id: string;
  name: string;
  active: boolean;
};

type RemotePaymentMethodRow = {
  id: string;
  code: string;
  label: string;
  active: boolean;
};

async function resolveBusinessMembership() {
  const supabase = createClient();
  let data:
    | {
        user: { id: string } | null;
      }
    | undefined;

  try {
    const response = await supabase.auth.getUser();
    data = response.data as { user: { id: string } | null };

    if (response.error) {
      if (isRecoverableAuthSessionError(response.error)) {
        return {
          supabase,
          userId: null,
          membership: null,
        };
      }

      throw response.error;
    }
  } catch (error) {
    if (isRecoverableAuthSessionError(error)) {
      return {
        supabase,
        userId: null,
        membership: null,
      };
    }
    throw error;
  }

  if (!data?.user) {
    return {
      supabase,
      userId: null,
      membership: null,
    };
  }

  const membershipResponse = await supabase
    .from("business_users")
    .select("business_id, role")
    .limit(1)
    .maybeSingle();

  if (membershipResponse.error) {
    throw membershipResponse.error;
  }

  return {
    supabase,
    userId: data.user.id,
    membership: membershipResponse.data as BusinessMembership | null,
  };
}

async function pullReferenceCatalog(
  businessId: string,
): Promise<ReferenceCatalog> {
  const supabase = createClient();
  const [staffResult, servicesResult, paymentMethodsResult] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, active")
      .eq("business_id", businessId)
      .order("name"),
    supabase
      .from("services")
      .select("id, name, active, expected_price_min, expected_price_max")
      .eq("business_id", businessId)
      .order("name"),
    supabase
      .from("payment_methods")
      .select("id, code, label, active")
      .eq("business_id", businessId)
      .order("label"),
  ]);

  if (staffResult.error) {
    throw staffResult.error;
  }

  if (servicesResult.error) {
    throw servicesResult.error;
  }

  if (paymentMethodsResult.error) {
    throw paymentMethodsResult.error;
  }

  return {
    staff: (staffResult.data ?? []) as RemoteReferenceRow[],
    services: (servicesResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      active: Boolean(row.active),
      expectedPrice: Number(
        (row as { expected_price_max?: number | null }).expected_price_max ??
          (row as { expected_price_min?: number | null }).expected_price_min ??
          0,
      ),
    })),
    paymentMethods: (paymentMethodsResult.data ?? []) as RemotePaymentMethodRow[],
    businessId,
    refreshedAt: new Date().toISOString(),
    source: "remote",
  };
}

export async function syncOfflineData(): Promise<SyncSummary> {
  if (!hasEnvVars) {
    return {
      businessId: null,
      pulledReferenceData: false,
      syncedTransactions: 0,
      failedTransactions: 0,
      skipped: true,
      reason: "Supabase environment variables are not configured.",
    };
  }

  const { membership, supabase, userId } = await resolveBusinessMembership();

  if (!userId) {
    return {
      businessId: null,
      pulledReferenceData: false,
      syncedTransactions: 0,
      failedTransactions: 0,
      skipped: true,
      reason: "No authenticated user session was available for sync.",
    };
  }

  if (!membership?.business_id) {
    return {
      businessId: null,
      pulledReferenceData: false,
      syncedTransactions: 0,
      failedTransactions: 0,
      skipped: true,
      reason: "No business membership exists yet for this account.",
    };
  }

  const businessId = membership.business_id;
  const queueItems = await getPendingQueueItems();
  const currentCatalog = await getReferenceCatalog();
  const remoteCatalog = await pullReferenceCatalog(businessId);

  await replaceReferenceCatalog({
    ...currentCatalog,
    ...remoteCatalog,
  });

  let syncedTransactions = 0;
  let failedTransactions = 0;

  for (const queueItem of queueItems) {
    if (queueItem.entityType !== "transaction") {
      continue;
    }

    const transaction = await getTransaction(queueItem.entityLocalId);

    if (!transaction) {
      continue;
    }

    try {
      await markTransactionSyncPending(transaction.localId);

      if (!transaction.businessId) {
        await setTransactionBusinessId(transaction.localId, businessId);
      }

      const transactionPayload = {
        business_id: businessId,
        client_generated_id: transaction.clientGeneratedId,
        staff_id: transaction.staffId,
        created_by_user_id: userId,
        transaction_date: transaction.transactionDate,
        customer_name: transaction.customerName,
        customer_phone: transaction.customerPhone,
        payment_method_code: transaction.paymentMethod,
        final_total: transaction.finalTotal,
        entry_source: transaction.entrySource,
        review_status: transaction.reviewStatus,
        device_created_at: transaction.createdAt,
      };

      const transactionResult = await supabase
        .from("transactions")
        .upsert(transactionPayload, {
          onConflict: "business_id,client_generated_id",
        })
        .select("id")
        .single();

      if (transactionResult.error) {
        throw transactionResult.error;
      }

      const remoteId = (transactionResult.data as { id: string }).id;

      const deleteItemsResult = await supabase
        .from("transaction_items")
        .delete()
        .eq("transaction_id", remoteId);

      if (deleteItemsResult.error) {
        throw deleteItemsResult.error;
      }

      const itemPayload = transaction.items.map((item) => ({
        transaction_id: remoteId,
        service_id: item.serviceId,
        service_label_raw: item.serviceLabelRaw,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        staff_id: transaction.staffId,
      }));

      if (itemPayload.length > 0) {
        const itemInsertResult = await supabase
          .from("transaction_items")
          .insert(itemPayload);

        if (itemInsertResult.error) {
          throw itemInsertResult.error;
        }
      }

      await markTransactionSynced(transaction.localId, remoteId);
      syncedTransactions += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transaction sync failed.";
      await markTransactionSyncFailed(transaction.localId, message);
      failedTransactions += 1;
    }
  }

  return {
    businessId,
    pulledReferenceData: true,
    syncedTransactions,
    failedTransactions,
    skipped: false,
  };
}
