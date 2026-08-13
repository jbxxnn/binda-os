"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getQueueDepth,
  getReferenceCatalog,
  listTransactions,
  saveTransaction,
} from "@/lib/offline/db";
import { syncOfflineData } from "@/lib/offline/sync";
import type {
  LocalTransaction,
  ReferenceCatalog,
  SyncSummary,
  TransactionFormState,
} from "@/lib/offline/types";

const createEmptyItem = () => ({
  serviceId: "",
  quantity: "1",
  unitPrice: "",
});

const today = new Date().toISOString().slice(0, 10);

const initialForm: TransactionFormState = {
  transactionDate: today,
  staffId: "",
  paymentMethod: "cash",
  customerName: "",
  customerPhone: "",
  notes: "",
  items: [createEmptyItem()],
};

export function OfflineTransactionWorkspace() {
  const [catalog, setCatalog] = useState<ReferenceCatalog | null>(null);
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [form, setForm] = useState<TransactionFormState>(initialForm);
  const [isOnline, setIsOnline] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueDepth, setQueueDepth] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const [nextCatalog, nextTransactions, nextQueueDepth] = await Promise.all([
          getReferenceCatalog(),
          listTransactions(),
          getQueueDepth(),
        ]);

        if (!active) {
          return;
        }

        setCatalog(nextCatalog);
        setTransactions(nextTransactions);
        setQueueDepth(nextQueueDepth);
        setForm((current) => ({
          ...current,
          staffId: current.staffId || nextCatalog.staff[0]?.id || "",
          paymentMethod:
            current.paymentMethod || nextCatalog.paymentMethods[0]?.code || "",
          items: current.items.map((item, index) =>
            index === 0 && !item.serviceId
              ? {
                  ...item,
                  serviceId: nextCatalog.services[0]?.id || "",
                }
              : item,
          ),
        }));
      } catch {
        if (active) {
          setError("Could not load the local workspace.");
        }
      }
    }

    loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  const totalAmount = form.items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    return sum + quantity * unitPrice;
  }, 0);

  async function refreshTransactions() {
    const [nextTransactions, nextQueueDepth, nextCatalog] = await Promise.all([
      listTransactions(),
      getQueueDepth(),
      getReferenceCatalog(),
    ]);
    setTransactions(nextTransactions);
    setQueueDepth(nextQueueDepth);
    setCatalog(nextCatalog);
  }

  function formatSyncSummary(summary: SyncSummary) {
    if (summary.skipped) {
      return summary.reason ?? "Sync was skipped.";
    }

    if (summary.failedTransactions > 0) {
      return `Synced ${summary.syncedTransactions} transaction(s). ${summary.failedTransactions} failed.`;
    }

    if (summary.syncedTransactions > 0) {
      return `Synced ${summary.syncedTransactions} transaction(s) successfully.`;
    }

    if (summary.pulledReferenceData) {
      return "Reference data refreshed. No pending transactions to push.";
    }

    return "Sync finished with no changes.";
  }

  async function handleSync() {
    if (!isOnline) {
      setSyncMessage("Sync is unavailable while the device is offline.");
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const summary = await syncOfflineData();
      await refreshTransactions();
      setSyncMessage(formatSyncSummary(summary));
    } catch (syncError) {
      setSyncMessage(
        syncError instanceof Error
          ? syncError.message
          : "Sync failed. Check the remote schema and business membership setup.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!catalog) {
      return;
    }

    if (!form.staffId || !form.paymentMethod || totalAmount <= 0) {
      setError(
        "Add a staff member, at least one priced service, and a payment method.",
      );
      return;
    }

    const validItems = form.items.filter(
      (item) => item.serviceId && Number(item.unitPrice) > 0,
    );

    if (validItems.length === 0) {
      setError("Add at least one service line with a price.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveTransaction({
        transactionDate: form.transactionDate,
        staffId: form.staffId,
        customerName: form.customerName.trim() || null,
        customerPhone: form.customerPhone.trim() || null,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim() || null,
        finalTotal: totalAmount,
        items: validItems.map((item) => ({
          serviceId: item.serviceId,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
        })),
      });

      await refreshTransactions();
      if (isOnline) {
        void handleSync();
      }

      setForm({
        ...initialForm,
        transactionDate: form.transactionDate,
        staffId: form.staffId,
        paymentMethod: form.paymentMethod,
        items: [
          {
            ...createEmptyItem(),
            serviceId: catalog.services[0]?.id || "",
          },
        ],
      });
    } catch {
      setError("Local save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateItem(
    index: number,
    field: "serviceId" | "quantity" | "unitPrice",
    value: string,
  ) {
    setForm((current) => {
      const nextItems = [...current.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...current, items: nextItems };
    });
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...createEmptyItem(),
          serviceId: catalog?.services[0]?.id || "",
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [
              {
                ...createEmptyItem(),
                serviceId: catalog?.services[0]?.id || "",
              },
            ]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-32 lg:gap-6 lg:pb-8">
      <section className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <Card className="rounded-[1.75rem] border-black/10 bg-white/85 shadow-none">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Entry mode
              </p>
              <p className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">
                Manual first, offline ready
              </p>
            </div>
            <Badge
              className={
                isOnline
                  ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 hover:bg-emerald-100"
                  : "rounded-full bg-amber-100 px-3 py-1 text-amber-900 hover:bg-amber-100"
              }
            >
              {isOnline ? "Online" : "Offline"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/10 bg-[#1d1b1a] text-slate-50 shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200">
              Today
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
              {transactions.length}
            </p>
            <p className="text-sm text-slate-300">local records</p>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/10 bg-white/85 shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Pending sync
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
              {queueDepth}
            </p>
            <p className="text-sm text-slate-500">records waiting</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card className="overflow-hidden rounded-[2rem] border-black/10 bg-white/90 shadow-none">
            <CardHeader className="space-y-3 border-b border-black/5 bg-[#fff9f4] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Main workflow
                  </p>
                  <CardTitle className="mt-1 text-2xl tracking-[-0.03em]">
                    Log transaction
                  </CardTitle>
                </div>
                <Badge className="rounded-full bg-slate-950 px-3 py-1 text-white hover:bg-slate-950">
                  Step 1
                </Badge>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Keep this screen fast enough for front desk use on a phone. No
                live fetch is required to complete a normal entry.
              </p>
              {syncMessage ? (
                <div className="rounded-[1.25rem] border border-black/8 bg-white/80 px-4 py-3 text-sm text-slate-600">
                  {syncMessage}
                </div>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-6 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="transaction-date" className="text-sm">
                    Date
                  </Label>
                  <Input
                    id="transaction-date"
                    type="date"
                    className="h-12 rounded-2xl text-base"
                    value={form.transactionDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        transactionDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="staff" className="text-sm">
                    Staff
                  </Label>
                  <select
                    id="staff"
                    value={form.staffId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        staffId: event.target.value,
                      }))
                    }
                    className="flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-base"
                  >
                    <option value="">Select staff</option>
                    {catalog?.staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Services</Label>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Step 2
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-full px-4"
                    onClick={addItem}
                  >
                    Add line
                  </Button>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div
                      key={`${index}-${item.serviceId}`}
                      className="space-y-3 rounded-[1.5rem] border border-black/8 bg-[#f8f4ef] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          Line {index + 1}
                        </p>
                        {form.items.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 rounded-full px-3 text-slate-600"
                            onClick={() => removeItem(index)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>

                      <select
                        value={item.serviceId}
                        onChange={(event) =>
                          updateItem(index, "serviceId", event.target.value)
                        }
                        className="flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-base"
                      >
                        <option value="">Select service</option>
                        {catalog?.services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label className="text-sm">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            className="h-12 rounded-2xl text-base"
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(index, "quantity", event.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-sm">Unit price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            className="h-12 rounded-2xl text-base"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateItem(index, "unitPrice", event.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-black/8 bg-[#fff9f4] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Payment and customer
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Step 3
                    </p>
                  </div>
                  <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    ₦{totalAmount.toLocaleString()}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="payment-method" className="text-sm">
                      Payment method
                    </Label>
                    <select
                      id="payment-method"
                      value={form.paymentMethod}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          paymentMethod: event.target.value,
                        }))
                      }
                      className="flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-base"
                    >
                      {catalog?.paymentMethods.map((method) => (
                        <option key={method.code} value={method.code}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="customer-name" className="text-sm">
                      Customer name
                    </Label>
                    <Input
                      id="customer-name"
                      placeholder="Optional"
                      className="h-12 rounded-2xl text-base"
                      value={form.customerName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          customerName: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="customer-phone" className="text-sm">
                      Customer phone
                    </Label>
                    <Input
                      id="customer-phone"
                      inputMode="tel"
                      placeholder="Optional"
                      className="h-12 rounded-2xl text-base"
                      value={form.customerPhone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          customerPhone: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes" className="text-sm">
                      Note
                    </Label>
                    <Input
                      id="notes"
                      placeholder="Optional"
                      className="h-12 rounded-2xl text-base"
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 z-20 rounded-[1.75rem] border border-black/10 bg-white/95 p-3 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Ready to save
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                  ₦{totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full px-4 text-base"
                  disabled={!isOnline || isSyncing}
                  onClick={() => void handleSync()}
                >
                  {isSyncing ? "Syncing..." : "Sync"}
                </Button>
                <Button
                  type="submit"
                  className="h-12 min-w-[160px] rounded-full px-6 text-base"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving locally..." : "Save transaction"}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Save now on device. Sync comes when the connection is available.
            </p>
          </div>
        </form>

        <div className="space-y-5">
          <Card className="rounded-[2rem] border-black/10 bg-white/90 shadow-none">
            <CardHeader className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl tracking-[-0.02em]">
                  Local ledger
                </CardTitle>
                <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                  {transactions.length} saved
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
              {transactions.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[#f8f4ef] p-5 text-sm text-slate-500">
                  No local transactions yet. Save one to verify the mobile
                  offline flow.
                </div>
              ) : (
                transactions.map((transaction) => (
                  <div
                    key={transaction.localId}
                    className="rounded-[1.5rem] border border-black/8 bg-[#f8f4ef] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {transaction.primaryServiceName}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                          {transaction.transactionDate}
                        </p>
                      </div>
                      <Badge
                        className={
                          transaction.syncStatus === "synced"
                            ? "rounded-full bg-emerald-100 text-emerald-900 hover:bg-emerald-100"
                            : transaction.syncStatus === "sync_failed"
                              ? "rounded-full bg-red-100 text-red-900 hover:bg-red-100"
                              : "rounded-full bg-amber-100 text-amber-900 hover:bg-amber-100"
                        }
                      >
                        {transaction.syncStatus === "synced"
                          ? "Synced"
                          : transaction.syncStatus === "sync_failed"
                            ? "Sync failed"
                            : "Pending sync"}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                      <span>{transaction.staffName}</span>
                      <span className="font-semibold text-slate-900">
                        ₦{transaction.finalTotal.toLocaleString()}
                      </span>
                    </div>
                    {transaction.syncError ? (
                      <p className="mt-3 text-xs leading-5 text-red-600">
                        {transaction.syncError}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-black/10 bg-[#1d1b1a] text-slate-50 shadow-none">
            <CardHeader className="p-4 sm:p-5">
              <CardTitle className="text-xl tracking-[-0.02em]">
                Cache status
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 text-sm text-slate-300 sm:p-5 sm:pt-0">
            <p>{catalog?.staff.length ?? 0} staff records cached locally.</p>
            <p>{catalog?.services.length ?? 0} services cached locally.</p>
            <p>
              {catalog?.paymentMethods.length ?? 0} payment methods cached
              locally.
            </p>
            <p className="text-slate-400">
              Source: {catalog?.source ?? "seed"}.
              {catalog?.refreshedAt
                ? ` Last refresh ${new Date(catalog.refreshedAt).toLocaleString()}.`
                : " Remote refresh has not happened yet."}
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
