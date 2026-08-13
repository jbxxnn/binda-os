"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { type TransactionEntryOptions } from "@/lib/supabase/dashboard";

type AppTransactionEntryModalProps = {
  businessName: string;
  userName: string;
  options: TransactionEntryOptions;
};

type ServiceLineItem = {
  id: string;
  serviceId: string;
};

function createLineItem(serviceId: string): ServiceLineItem {
  return {
    id: crypto.randomUUID(),
    serviceId,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AppTransactionEntryModal({
  options,
}: AppTransactionEntryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedPaymentCode, setSelectedPaymentCode] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceLineItems, setServiceLineItems] = useState<ServiceLineItem[]>([]);

  const defaultServiceId = options.services[0]?.id ?? "";

  useEffect(() => {
    setSelectedStaffId((current) => current || options.staff[0]?.id || "");
    setSelectedPaymentCode(
      (current) => current || options.paymentMethods[0]?.code || "",
    );
    setServiceLineItems((current) =>
      current.length > 0 || !defaultServiceId ? current : [createLineItem(defaultServiceId)],
    );
  }, [defaultServiceId, options.paymentMethods, options.staff]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const selectedServices = useMemo(() => {
    return serviceLineItems.map((lineItem) => {
      const service = options.services.find(
        (option) => option.id === lineItem.serviceId,
      );

      return {
        ...lineItem,
        name: service?.name ?? "Select service",
        price: service?.expectedPrice ?? 0,
      };
    });
  }, [options.services, serviceLineItems]);

  const totalAmount = selectedServices.reduce((sum, item) => sum + item.price, 0);

  function resetForm() {
    setCustomerQuery("");
    setSelectedStaffId(options.staff[0]?.id ?? "");
    setSelectedPaymentCode(options.paymentMethods[0]?.code ?? "");
    setNotes("");
    setServiceLineItems(defaultServiceId ? [createLineItem(defaultServiceId)] : []);
  }

  function handleOpen() {
    resetForm();
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  function addServiceLine() {
    if (!defaultServiceId) {
      return;
    }

    setServiceLineItems((current) => [...current, createLineItem(defaultServiceId)]);
  }

  function updateServiceLine(lineItemId: string, serviceId: string) {
    setServiceLineItems((current) =>
      current.map((lineItem) =>
        lineItem.id === lineItemId ? { ...lineItem, serviceId } : lineItem,
      ),
    );
  }

  function removeServiceLine(lineItemId: string) {
    setServiceLineItems((current) =>
      current.length === 1
        ? current
        : current.filter((lineItem) => lineItem.id !== lineItemId),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212]"
      >
        <Plus className="h-4 w-4" />
        Add Transaction
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#121212]/45 p-3 sm:items-center sm:p-6"
          onClick={handleClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm overflow-hidden rounded-[1rem] border border-black/10 bg-[#f5eee6] shadow-[0_28px_80px_rgba(18,18,18,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid grid-cols-[40px_1fr_40px] items-center px-4 py-4">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-900"
                aria-label="Close transaction modal"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="text-center text-base font-semibold tracking-[-0.03em] text-slate-950">
                Add transaction
              </h2>
              <span aria-hidden="true" />
            </div>

            <div className="max-h-[85vh] overflow-y-auto px-4 pb-5">
              <section>
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Customer
                </p>
                <label className="mt-3 flex items-center gap-3 rounded-[0.85rem] border border-black/10 bg-white px-4 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    placeholder="Search name or phone"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <button
                    type="button"
                    className="font-semibold text-slate-950 transition-colors hover:text-[#a65bd3]"
                  >
                    + New customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerQuery("Walk-in")}
                    className="text-slate-500 transition-colors hover:text-slate-950"
                  >
                    Use walk-in
                  </button>
                </div>
              </section>

              <section className="mt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Staff
                </p>
                <div className="relative mt-3">
                  <select
                    value={selectedStaffId}
                    onChange={(event) => setSelectedStaffId(event.target.value)}
                    className="w-full appearance-none rounded-[0.85rem] border border-black/10 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none"
                  >
                    {options.staff.length === 0 ? (
                      <option value="">No staff added yet</option>
                    ) : null}
                    {options.staff.map((staffMember) => (
                      <option key={staffMember.id} value={staffMember.id}>
                        {staffMember.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </section>

              <section className="mt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Services
                </p>
                <div className="mt-3 space-y-3">
                  {selectedServices.length === 0 ? (
                    <div className="rounded-[0.85rem] border border-dashed border-black/10 bg-white/60 px-4 py-4 text-sm text-slate-500">
                      Add services to start a transaction.
                    </div>
                  ) : (
                    selectedServices.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[0.85rem] border border-black/10 bg-white px-4 py-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="relative">
                              <select
                                value={item.serviceId}
                                onChange={(event) =>
                                  updateServiceLine(item.id, event.target.value)
                                }
                                className="w-full appearance-none bg-transparent pr-8 text-base font-semibold text-slate-950 outline-none"
                              >
                                {options.services.map((service) => (
                                  <option key={service.id} value={service.id}>
                                    {service.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              {formatCurrency(item.price)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeServiceLine(item.id)}
                            disabled={selectedServices.length === 1}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-[#fbf4ff] hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Remove service"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={addServiceLine}
                  disabled={!defaultServiceId}
                  className="mt-3 text-sm font-semibold text-slate-950 transition-colors hover:text-[#a65bd3] disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  + Add service
                </button>
              </section>

              <section className="mt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Payment
                </p>
                <div className="mt-3 space-y-2">
                  {options.paymentMethods.map((paymentMethod) => {
                    const isSelected = selectedPaymentCode === paymentMethod.code;

                    return (
                      <button
                        key={paymentMethod.id}
                        type="button"
                        onClick={() => setSelectedPaymentCode(paymentMethod.code)}
                        className="flex w-full items-center justify-between rounded-[0.85rem] border border-black/10 bg-white px-4 py-3 text-left transition-colors hover:border-[#E89BFF]"
                      >
                        <span className="text-sm font-medium text-slate-950">
                          {paymentMethod.label}
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-[0.3rem] border ${
                            isSelected
                              ? "border-[#E89BFF] bg-[#E89BFF] text-slate-950"
                              : "border-black/15 bg-transparent"
                          }`}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Total
                </p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">
                  {formatCurrency(totalAmount)}
                </p>
              </section>

              <section className="mt-6">
                <label className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mt-3 w-full resize-none rounded-[0.85rem] border border-black/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  placeholder="Add any quick context for this transaction"
                />
              </section>

              <button
                type="button"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212]"
              >
                Save transaction
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
