"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { listTransactions } from "@/lib/offline/db";
import type { StoredTransactionRecord } from "@/lib/offline/types";

type TransactionFilter = "today" | "needs_review" | "all";

function formatCurrency(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "08";
  const day = parts.find((part) => part.type === "day")?.value ?? "13";

  return `${year}-${month}-${day}`;
}

function formatTimeLabel(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
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

export function AppTransactionsList() {
  const [transactions, setTransactions] = useState<StoredTransactionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>("today");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadTransactions() {
      try {
        const records = await listTransactions();

        if (!isActive) {
          return;
        }

        setTransactions(records);
      } finally {
        if (isActive) {
          setIsHydrated(true);
        }
      }
    }

    void loadTransactions();

    return () => {
      isActive = false;
    };
  }, []);

  const today = getTodayDateString();
  const summary = useMemo(() => {
    const pending = transactions.filter(
      (transaction) =>
        transaction.syncStatus === "pending_sync" ||
        transaction.syncStatus === "local_only",
    ).length;
    const failed = transactions.filter(
      (transaction) => transaction.syncStatus === "sync_failed",
    ).length;
    const synced = transactions.filter(
      (transaction) => transaction.syncStatus === "synced",
    ).length;

    return { pending, failed, synced };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesFilter =
        activeFilter === "all"
          ? true
          : activeFilter === "today"
            ? transaction.transactionDate === today
            : transaction.syncStatus === "sync_failed";

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        transaction.customerName ?? "walk-in customer",
        transaction.customerPhone ?? "",
        transaction.primaryServiceName,
        transaction.staffName,
        transaction.paymentMethod,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeFilter, searchQuery, today, transactions]);

  return (
    <div className="min-h-screen bg-[#f5eee6] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[1rem] border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(18,18,18,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Transactions
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
                Transaction history
              </h1>
            </div>

            <Link
              href="/app/transactions/new"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212]"
            >
              Add transaction
            </Link>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex w-full items-center gap-3 rounded-[0.9rem] border border-black/10 bg-[#fbf7f3] px-4 py-3 sm:max-w-md">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search customer, phone, service..."
                className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {[
                { value: "today", label: "Today" },
                { value: "needs_review", label: "Needs review" },
                { value: "all", label: "All" },
              ].map((filter) => {
                const active = activeFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value as TransactionFilter)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-[#E89BFF] bg-[#E89BFF] text-[#121212]"
                        : "border-black/10 bg-white text-slate-600 hover:border-[#E89BFF]"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Pending sync", value: summary.pending },
              { label: "Sync failed", value: summary.failed },
              { label: "Synced", value: summary.synced },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[0.85rem] border border-black/10 bg-[#fbf7f3] px-4 py-4"
              >
                <p className="text-2xl font-black tracking-[-0.04em] text-slate-950">
                  {item.value}
                </p>
                <p className="mt-2 text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>

          {!isHydrated ? (
            <div className="mt-8 rounded-[0.9rem] border border-dashed border-black/10 bg-[#fbf7f3] px-4 py-6 text-sm text-slate-500">
              Loading local transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="mt-8 rounded-[0.9rem] border border-dashed border-black/10 bg-[#fbf7f3] px-4 py-6 text-sm text-slate-500">
              No transactions found for this view yet.
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {filteredTransactions.map((transaction) => {
                const badge = getSyncBadge(transaction);

                return (
                  <Link
                    key={transaction.localId}
                    href={`/app/transactions/${transaction.localId}`}
                    className="block rounded-[0.9rem] border border-black/10 bg-[#fbf7f3] px-4 py-4 transition-colors hover:border-[#E89BFF]/40 hover:bg-[#fbf4ff]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {transaction.customerName ?? "Walk-in customer"}
                          </p>
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {transaction.primaryServiceName}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {transaction.staffName} · {transaction.paymentMethod.toUpperCase()}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-slate-950">
                          {formatCurrency(transaction.finalTotal)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatTimeLabel(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
