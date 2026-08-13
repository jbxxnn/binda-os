"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/components/app/app-session-provider";
import { getReferenceCatalog, listTransactions } from "@/lib/offline/db";
import { syncOfflineData } from "@/lib/offline/sync";
import type { ReferenceCatalog, StoredTransactionRecord } from "@/lib/offline/types";
import {
  type TransactionComposerCustomerOption,
  type TransactionEntryOptions,
} from "@/lib/supabase/dashboard";

type SelectedCustomer =
  | {
      kind: "existing";
      customer: TransactionComposerCustomerOption;
    }
  | {
      kind: "walk-in";
    }
  | {
      kind: "new";
      name: string;
      phone: string;
    };

type ServiceLineItem = {
  id: string;
  serviceId: string;
  unitPrice: number;
  quantity: number;
  staffId: string;
  notes: string;
};

type SheetType = "staff" | "service" | "new-customer" | "edit-service" | null;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function createLineItem(
  serviceId: string,
  unitPrice: number,
  staffId: string,
): ServiceLineItem {
  return {
    id: crypto.randomUUID(),
    serviceId,
    unitPrice,
    quantity: 1,
    staffId,
    notes: "",
  };
}

const EMPTY_OPTIONS: TransactionEntryOptions = {
  staff: [],
  recentStaff: [],
  services: [],
  recentServices: [],
  paymentMethods: [],
  customers: [],
};

function formatRelativeVisitLabel(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays < 7) {
    return "Last visit this week";
  }

  if (diffDays < 14) {
    return "Last visit 1 week ago";
  }

  if (diffDays < 31) {
    return `Last visit ${Math.floor(diffDays / 7)} weeks ago`;
  }

  return `Last visit ${Math.floor(diffDays / 30)} months ago`;
}

function buildComposerOptions(
  catalog: ReferenceCatalog,
  transactions: StoredTransactionRecord[],
): TransactionEntryOptions {
  const staff = catalog.staff
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      name: item.name,
    }));

  const services = catalog.services
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      name: item.name,
      expectedPrice: Number(item.expectedPrice ?? 0),
    }));

  const paymentMethods = catalog.paymentMethods
    .filter((item) => item.active !== false)
    .map((item) => ({
      id: item.id ?? item.code,
      code: item.code,
      label: item.label,
    }));

  const staffUsageCounts = new Map<string, number>();
  const serviceUsageCounts = new Map<string, number>();
  const customerMap = new Map<string, TransactionComposerCustomerOption>();
  const customerStaffCounts = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    if (transaction.staffId) {
      staffUsageCounts.set(
        transaction.staffId,
        (staffUsageCounts.get(transaction.staffId) ?? 0) + 1,
      );
    }

    for (const item of transaction.items) {
      if (item.serviceId) {
        serviceUsageCounts.set(
          item.serviceId,
          (serviceUsageCounts.get(item.serviceId) ?? 0) + 1,
        );
      }
    }

    const name = String(transaction.customerName ?? "").trim();
    if (!name) {
      continue;
    }

    const phone = String(transaction.customerPhone ?? "").trim();
    const key = `${name.toLowerCase()}::${phone}`;

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        id: key,
        name,
        phone,
        visitCount: 0,
        lastVisitLabel: formatRelativeVisitLabel(
          transaction.transactionDate || transaction.createdAt,
        ),
        usualStaffName: null,
      });
    }

    const customer = customerMap.get(key);

    if (!customer) {
      continue;
    }

    customer.visitCount += 1;

    if (transaction.staffName) {
      const counts = customerStaffCounts.get(key) ?? new Map<string, number>();
      counts.set(
        transaction.staffName,
        (counts.get(transaction.staffName) ?? 0) + 1,
      );
      customerStaffCounts.set(key, counts);
    }
  }

  for (const [key, customer] of customerMap.entries()) {
    const counts = customerStaffCounts.get(key);
    if (!counts) {
      continue;
    }

    const usualStaffName = [...counts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0];

    customer.usualStaffName = usualStaffName ?? null;
  }

  return {
    staff,
    recentStaff: [...staff]
      .sort((left, right) => {
        const leftCount = staffUsageCounts.get(left.id) ?? 0;
        const rightCount = staffUsageCounts.get(right.id) ?? 0;
        return rightCount - leftCount || left.name.localeCompare(right.name);
      })
      .slice(0, 4),
    services,
    recentServices: [...services]
      .sort((left, right) => {
        const leftCount = serviceUsageCounts.get(left.id) ?? 0;
        const rightCount = serviceUsageCounts.get(right.id) ?? 0;
        return rightCount - leftCount || left.name.localeCompare(right.name);
      })
      .slice(0, 6),
    paymentMethods,
    customers: [...customerMap.values()]
      .sort((left, right) => right.visitCount - left.visitCount)
      .slice(0, 20),
  };
}

function useComposerOptions() {
  const [options, setOptions] = useState<TransactionEntryOptions>(EMPTY_OPTIONS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadLocalFirst() {
      try {
        const [catalog, transactions] = await Promise.all([
          getReferenceCatalog(),
          listTransactions(),
        ]);

        if (!isActive) {
          return;
        }

        setOptions(buildComposerOptions(catalog, transactions));
        setIsHydrated(true);
      } catch {
        if (isActive) {
          setIsHydrated(true);
        }
      }
    }

    void loadLocalFirst();

    async function refreshInBackground() {
      try {
        await syncOfflineData();
        const [catalog, transactions] = await Promise.all([
          getReferenceCatalog(),
          listTransactions(),
        ]);

        if (!isActive) {
          return;
        }

        setOptions(buildComposerOptions(catalog, transactions));
      } catch {
        // Keep the local-first experience intact when remote refresh fails.
      }
    }

    void refreshInBackground();

    return () => {
      isActive = false;
    };
  }, []);

  return { options, isHydrated };
}

export function AppTransactionComposer() {
  const router = useRouter();
  const { businessName, userName } = useAppSession();
  const { options, isHydrated } = useComposerOptions();
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(
    null,
  );
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedPaymentCode, setSelectedPaymentCode] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetType>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [lineItems, setLineItems] = useState<ServiceLineItem[]>([]);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ staff?: string; services?: string }>({});

  useEffect(() => {
    setSelectedStaffId((current) => current || options.staff[0]?.id || "");
    setSelectedPaymentCode(
      (current) => current || options.paymentMethods[0]?.code || "",
    );
  }, [options.paymentMethods, options.staff]);

  useEffect(() => {
    customerInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!sheet) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sheet]);

  const customerResults = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return options.customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(query) ||
        customer.phone.replace(/\s+/g, "").includes(query.replace(/\s+/g, ""))
      );
    });
  }, [customerQuery, options.customers]);

  const filteredStaff = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    if (!query) {
      return options.staff;
    }

    return options.staff.filter((staffMember) =>
      staffMember.name.toLowerCase().includes(query),
    );
  }, [options.staff, staffSearch]);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) {
      return options.services;
    }

    return options.services.filter((service) =>
      service.name.toLowerCase().includes(query),
    );
  }, [options.services, serviceSearch]);

  const lineItemsWithDetails = useMemo(() => {
    return lineItems.map((item) => {
      const service = options.services.find((entry) => entry.id === item.serviceId);
      const staffMember = options.staff.find((entry) => entry.id === item.staffId);
      const lineTotal = item.unitPrice * item.quantity;

      return {
        ...item,
        serviceName: service?.name ?? "Service",
        staffName: staffMember?.name ?? "Unassigned",
        lineTotal,
      };
    });
  }, [lineItems, options.services, options.staff]);

  const editingLineItem =
    lineItemsWithDetails.find((item) => item.id === editingLineItemId) ?? null;

  const totalAmount = lineItemsWithDetails.reduce(
    (sum, item) => sum + item.lineTotal,
    0,
  );
  const canSave =
    lineItems.length > 0 && totalAmount > 0 && Boolean(selectedStaffId) && Boolean(selectedPaymentCode);
  const isDirty =
    Boolean(customerQuery.trim()) ||
    Boolean(selectedCustomer) ||
    lineItems.length > 0 ||
    Boolean(notes.trim());

  function closeComposer() {
    if (isDirty && !window.confirm("Discard this transaction?")) {
      return;
    }

    router.push("/app");
  }

  function openStaffSheet() {
    setStaffSearch("");
    setSheet("staff");
  }

  function openServiceSheet() {
    setServiceSearch("");
    setSheet("service");
  }

  function selectCustomer(customer: TransactionComposerCustomerOption) {
    setSelectedCustomer({ kind: "existing", customer });
    setCustomerQuery("");
  }

  function useWalkIn() {
    setSelectedCustomer({ kind: "walk-in" });
    setCustomerQuery("");
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery("");
    requestAnimationFrame(() => customerInputRef.current?.focus());
  }

  function selectStaff(staffId: string) {
    setSelectedStaffId(staffId);
    setErrors((current) => ({ ...current, staff: undefined }));
    setLineItems((current) =>
      current.map((item) =>
        item.staffId ? item : { ...item, staffId },
      ),
    );
    setSheet(null);
  }

  function addService(serviceId: string) {
    const service = options.services.find((entry) => entry.id === serviceId);
    if (!service) {
      return;
    }

    setLineItems((current) => [
      ...current,
      createLineItem(service.id, service.expectedPrice, selectedStaffId),
    ]);
    setErrors((current) => ({ ...current, services: undefined }));
    setSheet(null);
  }

  function openEditService(lineItemId: string) {
    setEditingLineItemId(lineItemId);
    setSheet("edit-service");
  }

  function updateLineItem(
    lineItemId: string,
    updater: (current: ServiceLineItem) => ServiceLineItem,
  ) {
    setLineItems((current) =>
      current.map((item) => (item.id === lineItemId ? updater(item) : item)),
    );
  }

  function removeLineItem(lineItemId: string) {
    setLineItems((current) => current.filter((item) => item.id !== lineItemId));
    if (editingLineItemId === lineItemId) {
      setSheet(null);
      setEditingLineItemId(null);
    }
  }

  function createNewCustomer() {
    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();

    if (!name) {
      return;
    }

    setSelectedCustomer({
      kind: "new",
      name,
      phone,
    });
    setNewCustomerName("");
    setNewCustomerPhone("");
    setSheet(null);
  }

  function saveTransaction() {
    const nextErrors: { staff?: string; services?: string } = {};

    if (!selectedStaffId) {
      nextErrors.staff = "Select who handled this transaction.";
    }

    if (lineItems.length === 0) {
      nextErrors.services = "Add at least one service.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }
  }

  const selectedStaff = options.staff.find((entry) => entry.id === selectedStaffId);
  const visibleRecentStaff = options.recentStaff.filter((entry) =>
    filteredStaff.some((candidate) => candidate.id === entry.id),
  );
  const visibleRecentServices = options.recentServices.filter((entry) =>
    filteredServices.some((candidate) => candidate.id === entry.id),
  );

  return (
    <div className="min-h-screen bg-[#f5eee6] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-8">
        <div className="min-h-screen bg-[#f5eee6]">
          <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f5eee6]/95 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={closeComposer}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-950"
                aria-label="Close transaction composer"
              >
                <X className="h-5 w-5" />
              </button>
              <h1 className="text-base font-semibold tracking-[-0.03em]">
                Add transaction
              </h1>
              <span className="w-10" aria-hidden="true" />
            </div>
          </header>

          <div className="px-4 pb-32 pt-6 sm:px-6">
            <div className="border-b border-black/10 pb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {businessName}
              </p>
              <p className="mt-3 text-3xl font-black leading-[0.92] tracking-[-0.05em] text-slate-950">
                Welcome, {userName}
              </p>
              {!isHydrated ? (
                <p className="mt-3 text-sm text-slate-500">
                  Opening from local data...
                </p>
              ) : null}
            </div>

            <section className="border-b border-black/10 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Customer
              </p>

              {selectedCustomer ? (
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-950">
                      {selectedCustomer.kind === "walk-in"
                        ? "Walk-in customer"
                        : selectedCustomer.kind === "new"
                          ? selectedCustomer.name
                          : selectedCustomer.customer.name}
                    </p>
                    {selectedCustomer.kind === "existing" ? (
                      <>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedCustomer.customer.phone || "No phone saved"}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {selectedCustomer.customer.visitCount} visits ·{" "}
                          {selectedCustomer.customer.lastVisitLabel}
                        </p>
                        {selectedCustomer.customer.usualStaffName ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Usually served by{" "}
                            {selectedCustomer.customer.usualStaffName}
                          </p>
                        ) : null}
                      </>
                    ) : selectedCustomer.kind === "new" ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedCustomer.phone || "Phone not provided"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <label className="mt-4 flex items-center gap-3 rounded-[0.9rem] border border-black/10 bg-white px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      ref={customerInputRef}
                      value={customerQuery}
                      onChange={(event) => setCustomerQuery(event.target.value)}
                      placeholder="Search name or phone"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>

                  {customerQuery.trim() ? (
                    <div className="mt-3 space-y-2">
                      {customerResults.length > 0 ? (
                        customerResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => selectCustomer(customer)}
                            className="block w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-4 text-left transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
                          >
                            <p className="text-sm font-semibold text-slate-950">
                              {customer.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {customer.phone}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                              {customer.visitCount} visits · {customer.lastVisitLabel}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          No matching customer yet.
                        </p>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setSheet("new-customer")}
                      className="font-semibold text-slate-950 transition-colors hover:text-[#a65bd3]"
                    >
                      + New customer
                    </button>
                    <button
                      type="button"
                      onClick={useWalkIn}
                      className="text-slate-500 transition-colors hover:text-slate-950"
                    >
                      Use walk-in
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="border-b border-black/10 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    Staff
                  </p>
                  {selectedStaff ? (
                    <p className="mt-4 text-base font-semibold text-slate-950">
                      {selectedStaff.name}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Select staff</p>
                  )}
                  {errors.staff ? (
                    <p className="mt-2 text-sm text-[#b42318]">{errors.staff}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={openStaffSheet}
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
                >
                  {selectedStaff ? "Change" : "Select"}
                </button>
              </div>
            </section>

            <section className="border-b border-black/10 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Services
              </p>
              <div className="mt-4 space-y-4">
                {lineItemsWithDetails.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => openEditService(item.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-base font-semibold text-slate-950">
                        {item.serviceName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Handled by {item.staffName}
                      </p>
                    </button>
                    <div className="flex items-start gap-3">
                      <p className="pt-0.5 text-sm font-semibold text-slate-950">
                        {formatCurrency(item.lineTotal)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="text-slate-500 transition-colors hover:text-slate-950"
                        aria-label="Remove service"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={openServiceSheet}
                className="mt-4 text-sm font-semibold text-slate-950 transition-colors hover:text-[#a65bd3]"
              >
                + Add service
              </button>
              {errors.services ? (
                <p className="mt-2 text-sm text-[#b42318]">{errors.services}</p>
              ) : null}
            </section>

            <section className="border-b border-black/10 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Payment
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {options.paymentMethods.map((paymentMethod) => {
                  const active = selectedPaymentCode === paymentMethod.code;

                  return (
                    <button
                      key={paymentMethod.id}
                      type="button"
                      onClick={() => setSelectedPaymentCode(paymentMethod.code)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "border-[#E89BFF] bg-[#E89BFF] text-[#121212]"
                          : "border-black/10 bg-white text-slate-600 hover:border-[#E89BFF]"
                      }`}
                    >
                      {paymentMethod.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="border-b border-black/10 py-6 lg:hidden">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Total
              </p>
              <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
                {formatCurrency(totalAmount)}
              </p>
            </section>

            <section className="py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Notes
              </p>
              {notesOpen ? (
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Add a note..."
                  className="mt-4 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setNotesOpen(true)}
                  className="mt-4 text-sm text-slate-500 transition-colors hover:text-slate-950"
                >
                  + Add note
                </button>
              )}
            </section>
          </div>
        </div>

        <aside className="hidden lg:block lg:py-8">
          <div className="sticky top-28 rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Transaction
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-950">
              {selectedCustomer?.kind === "existing"
                ? selectedCustomer.customer.name
                : selectedCustomer?.kind === "new"
                  ? selectedCustomer.name
                  : selectedCustomer?.kind === "walk-in"
                    ? "Walk-in customer"
                    : "No customer selected"}
            </p>

            <div className="mt-6 space-y-4 border-t border-black/10 pt-6">
              {lineItemsWithDetails.length === 0 ? (
                <p className="text-sm text-slate-500">No services added yet.</p>
              ) : (
                lineItemsWithDetails.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {item.serviceName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t border-black/10 pt-6">
              <p className="text-sm text-slate-500">Payment</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {options.paymentMethods.find((item) => item.code === selectedPaymentCode)
                  ?.label ?? "Not selected"}
              </p>
            </div>

            <div className="mt-6 border-t border-black/10 pt-6">
              <p className="text-sm text-slate-500">Total</p>
              <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            <button
              type="button"
              onClick={saveTransaction}
              disabled={!canSave}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
            >
              Save transaction
            </button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(18,18,18,0.08)] lg:hidden">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-slate-500">Total {formatCurrency(totalAmount)}</p>
          <button
            type="button"
            onClick={saveTransaction}
            disabled={!canSave}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
          >
            Save transaction
          </button>
        </div>
      </div>

      {sheet ? (
        <div
          className="fixed inset-0 z-30 bg-[#121212]/40"
          onClick={() => setSheet(null)}
        >
          <div className="absolute inset-x-0 bottom-0 rounded-t-[1rem] border border-black/10 bg-[#f5eee6] px-4 pb-6 pt-4 shadow-[0_-24px_60px_rgba(18,18,18,0.18)] sm:mx-auto sm:max-w-lg">
            <div
              className="mx-auto h-1.5 w-14 rounded-full bg-black/10"
              aria-hidden="true"
            />

            <div
              className="mt-5"
              onClick={(event) => event.stopPropagation()}
            >
              {sheet === "staff" ? (
                <>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    Select staff
                  </h2>
                  <label className="mt-4 flex items-center gap-3 rounded-[0.9rem] border border-black/10 bg-white px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={staffSearch}
                      onChange={(event) => setStaffSearch(event.target.value)}
                      placeholder="Search staff"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>

                  {visibleRecentStaff.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-slate-500">Recent</p>
                      <div className="mt-3 space-y-2">
                        {visibleRecentStaff.map((staffMember) => (
                          <button
                            key={staffMember.id}
                            type="button"
                            onClick={() => selectStaff(staffMember.id)}
                            className="block w-full rounded-[0.9rem] bg-white px-4 py-3 text-left text-sm font-medium text-slate-950"
                          >
                            {staffMember.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-500">All staff</p>
                    <div className="mt-3 space-y-2">
                      {filteredStaff.map((staffMember) => (
                        <button
                          key={staffMember.id}
                          type="button"
                          onClick={() => selectStaff(staffMember.id)}
                          className="block w-full rounded-[0.9rem] bg-white px-4 py-3 text-left text-sm font-medium text-slate-950"
                        >
                          {staffMember.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {sheet === "service" ? (
                <>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    Add service
                  </h2>
                  <label className="mt-4 flex items-center gap-3 rounded-[0.9rem] border border-black/10 bg-white px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={serviceSearch}
                      onChange={(event) => setServiceSearch(event.target.value)}
                      placeholder="Search services"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>

                  {visibleRecentServices.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-slate-500">Recent</p>
                      <div className="mt-3 space-y-2">
                        {visibleRecentServices.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => addService(service.id)}
                            className="flex w-full items-center justify-between rounded-[0.9rem] bg-white px-4 py-3 text-left"
                          >
                            <span className="text-sm font-medium text-slate-950">
                              {service.name}
                            </span>
                            <span className="text-sm text-slate-500">
                              {formatCurrency(service.expectedPrice)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-500">All services</p>
                    <div className="mt-3 space-y-2">
                      {filteredServices.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => addService(service.id)}
                          className="flex w-full items-center justify-between rounded-[0.9rem] bg-white px-4 py-3 text-left"
                        >
                          <span className="text-sm font-medium text-slate-950">
                            {service.name}
                          </span>
                          <span className="text-sm text-slate-500">
                            {formatCurrency(service.expectedPrice)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {sheet === "new-customer" ? (
                <>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    New customer
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Name</label>
                      <input
                        value={newCustomerName}
                        onChange={(event) => setNewCustomerName(event.target.value)}
                        className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Phone</label>
                      <input
                        value={newCustomerPhone}
                        onChange={(event) => setNewCustomerPhone(event.target.value)}
                        placeholder="Phone helps Binda recognize returning customers."
                        className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={createNewCustomer}
                    disabled={!newCustomerName.trim()}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Add customer
                  </button>
                </>
              ) : null}

              {sheet === "edit-service" && editingLineItem ? (
                <>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    {editingLineItem.serviceName}
                  </h2>
                  <div className="mt-5 space-y-5">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Price</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editingLineItem.unitPrice}
                        onChange={(event) =>
                          updateLineItem(editingLineItem.id, (current) => ({
                            ...current,
                            unitPrice: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Quantity</label>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateLineItem(editingLineItem.id, (current) => ({
                              ...current,
                              quantity: Math.max(1, current.quantity - 1),
                            }))
                          }
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-lg"
                        >
                          -
                        </button>
                        <div className="min-w-12 text-center text-base font-semibold">
                          {editingLineItem.quantity}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateLineItem(editingLineItem.id, (current) => ({
                              ...current,
                              quantity: current.quantity + 1,
                            }))
                          }
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-lg"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Staff</label>
                      <div className="relative mt-2">
                        <select
                          value={editingLineItem.staffId}
                          onChange={(event) =>
                            updateLineItem(editingLineItem.id, (current) => ({
                              ...current,
                              staffId: event.target.value,
                            }))
                          }
                          className="w-full appearance-none rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                        >
                          {options.staff.map((staffMember) => (
                            <option key={staffMember.id} value={staffMember.id}>
                              {staffMember.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Notes</label>
                      <textarea
                        value={editingLineItem.notes}
                        onChange={(event) =>
                          updateLineItem(editingLineItem.id, (current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        rows={3}
                        className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheet(null)}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white"
                  >
                    Done
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
