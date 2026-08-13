import { createClient } from "@/lib/supabase/client";
import { isRecoverableAuthSessionError } from "@/lib/supabase/auth";
import {
  getPendingQueueItems,
  getReferenceCatalog,
  getTransaction,
  markTransactionSyncFailed,
  markTransactionSyncPending,
  markTransactionSynced,
  markQueueItemFailed,
  removeQueueItem,
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

type RemoteCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
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
  const [staffResult, servicesResult, paymentMethodsResult, customersResult] =
    await Promise.all([
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
    supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(250),
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

  if (customersResult.error) {
    throw customersResult.error;
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
    customers: (customersResult.data ?? []).map((row) => ({
      id: String((row as RemoteCustomerRow).id),
      name: String((row as RemoteCustomerRow).name),
      phone: (row as RemoteCustomerRow).phone,
      email: (row as RemoteCustomerRow).email,
    })),
    businessId,
    refreshedAt: new Date().toISOString(),
    source: "remote",
  };
}

async function resolveRemoteCustomerId(
  businessId: string,
  transaction: NonNullable<Awaited<ReturnType<typeof getTransaction>>>,
) {
  if (transaction.customerKind !== "named") {
    return null;
  }

  if (transaction.customerId) {
    return transaction.customerId;
  }

  const customerName = String(transaction.customerName ?? "").trim();
  const customerPhone = String(transaction.customerPhone ?? "").trim();

  if (!customerName && !customerPhone) {
    return null;
  }

  const supabase = createClient();

  let existingCustomerQuery = supabase
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("name", customerName || "Customer");

  existingCustomerQuery = customerPhone
    ? existingCustomerQuery.eq("phone", customerPhone)
    : existingCustomerQuery.is("phone", null);

  const existingCustomerResult = await existingCustomerQuery.limit(1).maybeSingle();

  if (existingCustomerResult.error) {
    throw existingCustomerResult.error;
  }

  if (existingCustomerResult.data?.id) {
    return String(existingCustomerResult.data.id);
  }

  const createCustomerResult = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      name: customerName || "Customer",
      phone: customerPhone || null,
    })
    .select("id")
    .single();

  if (createCustomerResult.error) {
    throw createCustomerResult.error;
  }

  return String((createCustomerResult.data as { id: string }).id);
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

  const orderedQueueItems = [...queueItems].sort((left, right) => {
    if (left.entityType === right.entityType) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.entityType === "service" ? -1 : 1;
  });

  for (const queueItem of orderedQueueItems) {
    if (queueItem.entityType === "service") {
      const catalog = await getReferenceCatalog();
      const service = catalog.services.find((item) => item.id === queueItem.entityLocalId);

      if (!service) {
        await removeQueueItem(queueItem.id);
        continue;
      }

      try {
        const serviceResult = await supabase.from("services").upsert(
          {
            id: service.id,
            business_id: businessId,
            name: service.name,
            active: service.active,
            expected_price_min: service.expectedPrice ?? 0,
            expected_price_max: service.expectedPrice ?? 0,
          },
          {
            onConflict: "id",
          },
        );

        if (serviceResult.error) {
          throw serviceResult.error;
        }

        await replaceReferenceCatalog({
          ...catalog,
          services: catalog.services.map((item) =>
            item.id === service.id ? { ...item, localOnly: false } : item,
          ),
        });
        await removeQueueItem(queueItem.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Service sync failed.";
        await markQueueItemFailed(queueItem.id, message);
      }

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

      const customerId = await resolveRemoteCustomerId(businessId, transaction);
      const primaryPayment = transaction.payments[0];

      const transactionPayload = {
        business_id: businessId,
        client_generated_id: transaction.clientGeneratedId,
        customer_id: customerId,
        staff_id: transaction.staffId,
        created_by_user_id: userId,
        transaction_date: transaction.transactionDate,
        status: transaction.transactionStatus,
        subtotal: transaction.subtotal,
        discount_total: transaction.discountTotal,
        customer_name: transaction.customerName,
        customer_phone: transaction.customerPhone,
        payment_method_code: primaryPayment?.method ?? transaction.paymentMethod,
        notes: transaction.notes,
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
        item_type: item.type,
        service_id: item.serviceId,
        service_label_raw: item.serviceLabelRaw,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        staff_id: item.staffId ?? transaction.staffId,
        notes: item.notes,
      }));

      if (itemPayload.length > 0) {
        const itemInsertResult = await supabase
          .from("transaction_items")
          .insert(itemPayload);

        if (itemInsertResult.error) {
          throw itemInsertResult.error;
        }
      }

      const deletePaymentsResult = await supabase
        .from("payments")
        .delete()
        .eq("transaction_id", remoteId);

      if (deletePaymentsResult.error) {
        throw deletePaymentsResult.error;
      }

      if (transaction.payments.length > 0) {
        const paymentInsertResult = await supabase.from("payments").insert(
          transaction.payments.map((payment) => ({
            transaction_id: remoteId,
            client_payment_id: payment.localId,
            amount: payment.amount,
            method: payment.method,
            status: payment.status,
            reference: payment.reference,
          })),
        );

        if (paymentInsertResult.error) {
          throw paymentInsertResult.error;
        }
      }

      if (transaction.auditEvents.length > 0) {
        const auditInsertResult = await supabase
          .from("transaction_audit_events")
          .upsert(
            transaction.auditEvents.map((event) => ({
              transaction_id: remoteId,
              client_event_id: event.localId,
              event_type: event.type,
              actor_user_id: userId,
              source: event.source,
              occurred_at: event.createdAt,
            })),
            {
              onConflict: "client_event_id",
            },
          );

        if (auditInsertResult.error) {
          throw auditInsertResult.error;
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
