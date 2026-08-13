"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTransaction, listTransactions } from "@/lib/offline/db";
import { deleteStoredTransaction, syncOfflineData } from "@/lib/offline/sync";
import type { StoredTransactionRecord } from "@/lib/offline/types";

type AppTransactionDetailProps = {
  localId: string;
};

function formatCurrency(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTimeLabel(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(dateString));
}

function getSyncBadge(transaction: StoredTransactionRecord) {
  if (transaction.syncStatus === "sync_failed") {
    return {
      label: "Sync failed",
      className: "border-[#f7c4c0] bg-[#fff2f0] text-[#b42318]",
    };
  }

  if (transaction.syncStatus === "pending_sync" || transaction.syncStatus === "local_only") {
    return {
      label: "Pending sync",
      className: "border-[#E89BFF]/40 bg-[#fbf4ff] text-slate-900",
    };
  }

  return {
    label: "Synced",
    className: "border-[#cfe8d7] bg-[#eef8f1] text-[#067647]",
  };
}

export function AppTransactionDetail({ localId }: AppTransactionDetailProps) {
  const router = useRouter();
  const [transaction, setTransaction] = useState<StoredTransactionRecord | null>(null);
  const [relatedTransactions, setRelatedTransactions] = useState<StoredTransactionRecord[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const customerHistory = useMemo(() => {
    if (!transaction?.customerName && !transaction?.customerPhone) {
      return [];
    }

    return relatedTransactions
      .filter((item) => item.localId !== transaction?.localId)
      .filter((item) => {
        const sameCustomerId =
          transaction?.customerId && item.customerId
            ? item.customerId === transaction.customerId
            : false;
        const sameName =
          String(item.customerName ?? "").trim().toLowerCase() ===
          String(transaction?.customerName ?? "").trim().toLowerCase();
        const samePhone =
          String(item.customerPhone ?? "").trim() ===
          String(transaction?.customerPhone ?? "").trim();

        return sameCustomerId || (sameName && samePhone);
      })
      .slice(0, 5);
  }, [relatedTransactions, transaction]);

  useEffect(() => {
    let isActive = true;

    async function loadTransaction() {
      try {
        const [record, transactions] = await Promise.all([
          getTransaction(localId),
          listTransactions(),
        ]);

        if (!isActive) {
          return;
        }

        setTransaction(record);
        setRelatedTransactions(transactions);
      } finally {
        if (isActive) {
          setIsHydrated(true);
        }
      }
    }

    void loadTransaction();

    return () => {
      isActive = false;
    };
  }, [localId]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#f5eee6] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-4xl rounded-[1rem] border border-black/10 bg-white p-6 text-sm text-slate-500 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
          Loading transaction...
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-[#f5eee6] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-4xl rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Transactions
          </p>
          <p className="mt-4 text-lg font-semibold text-slate-950">
            Transaction not found.
          </p>
          <Link
            href="/app/transactions"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to transactions
          </Link>
        </div>
      </div>
    );
  }

  const badge = getSyncBadge(transaction);
  const customerVisitCount = customerHistory.length + (transaction.customerKind === "named" ? 1 : 0);

  async function retrySync() {
    setIsRetryingSync(true);

    try {
      await syncOfflineData();
      const [record, transactions] = await Promise.all([
        getTransaction(localId),
        listTransactions(),
      ]);
      setTransaction(record);
      setRelatedTransactions(transactions);
    } finally {
      setIsRetryingSync(false);
    }
  }

  async function handleDelete() {
    if (!transaction) {
      return;
    }

    const confirmed = window.confirm(
      transaction.remoteId
        ? "Delete this transaction from this device and the database?"
        : "Delete this local transaction?",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteStoredTransaction(transaction.localId);
      router.push("/app/transactions");
      router.refresh();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Could not delete this transaction right now.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5eee6] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/app/transactions"
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to transactions
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
            <div className="border-b border-black/10 pb-6">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Transaction
                </p>
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-slate-950">
                {formatCurrency(transaction.finalTotal)}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {formatDateTimeLabel(transaction.createdAt)}
              </p>
            </div>

            <section className="border-b border-black/10 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Customer
              </p>
              <p className="mt-3 text-base font-semibold text-slate-950">
                {transaction.customerName ?? "Walk-in customer"}
              </p>
              {transaction.customerPhone ? (
                <p className="mt-1 text-sm text-slate-500">{transaction.customerPhone}</p>
              ) : null}
              {transaction.customerKind === "named" ? (
                <p className="mt-2 text-sm text-slate-500">
                  {customerVisitCount} recorded visit{customerVisitCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </section>

            <section className="border-b border-black/10 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Staff
              </p>
              <p className="mt-3 text-base font-semibold text-slate-950">
                {transaction.staffName}
              </p>
            </section>

            <section className="border-b border-black/10 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Services
              </p>
              <div className="mt-4 space-y-4">
                {transaction.items.map((item) => (
                  <div
                    key={item.localId}
                    className="flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {item.serviceLabelRaw}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                      {item.staffName ? (
                        <p className="mt-1 text-sm text-slate-500">
                          Handled by {item.staffName}
                        </p>
                      ) : null}
                      {item.notes ? (
                        <p className="mt-1 text-sm text-slate-500">{item.notes}</p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-b border-black/10 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Payment
              </p>
              <div className="mt-4 space-y-3">
                {transaction.payments.map((payment) => (
                  <div
                    key={payment.localId}
                    className="flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {payment.method.toUpperCase()}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {payment.status}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Notes
              </p>
              <p className="mt-3 text-sm text-slate-600">
                {transaction.notes || "No note added."}
              </p>
            </section>
          </div>

          <aside className="rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)] lg:sticky lg:top-28 lg:h-fit">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Sync
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-950">{badge.label}</p>
            {transaction.syncError ? (
              <p className="mt-2 text-sm text-[#b42318]">{transaction.syncError}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {transaction.syncStatus === "synced"
                  ? "This transaction has synced successfully."
                  : "This transaction is stored locally and will sync when possible."}
              </p>
            )}

            {transaction.syncStatus !== "synced" ? (
              <button
                type="button"
                onClick={() => {
                  void retrySync();
                }}
                disabled={isRetryingSync}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isRetryingSync ? "Retrying..." : "Retry sync"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void handleDelete();
              }}
              disabled={isDeleting}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-[#f1b3ad] bg-[#fff2f0] px-4 py-2 text-sm font-semibold text-[#b42318] transition-colors hover:bg-[#ffe3df] disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isDeleting ? "Deleting..." : "Delete transaction"}
            </button>
            {deleteError ? (
              <p className="mt-2 text-sm text-[#b42318]">{deleteError}</p>
            ) : null}

            <div className="mt-6 border-t border-black/10 pt-6">
              <p className="text-sm text-slate-500">Transaction ID</p>
              <p className="mt-2 break-all text-sm font-medium text-slate-950">
                {transaction.localId}
              </p>
            </div>

            {customerHistory.length > 0 ? (
              <div className="mt-6 border-t border-black/10 pt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Customer history
                </p>
                <div className="mt-4 space-y-3">
                  {customerHistory.map((item) => (
                    <Link
                      key={item.localId}
                      href={`/app/transactions/${item.localId}`}
                      className="block rounded-[0.85rem] border border-black/10 bg-[#fbf7f3] px-3 py-3 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {item.primaryServiceName}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDateTimeLabel(item.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatCurrency(item.finalTotal)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
