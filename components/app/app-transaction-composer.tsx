"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useAppSession } from "@/components/app/app-session-provider";
import {
  getReferenceCatalog,
  listTransactions,
  saveStaffDefinition,
  saveTransaction as persistTransaction,
  saveServiceDefinition,
} from "@/lib/offline/db";
import { syncOfflineData } from "@/lib/offline/sync";
import type {
  ReferenceCatalog,
  ReferenceCustomer,
  StoredTransactionRecord,
} from "@/lib/offline/types";
import {
  type TransactionComposerCustomerOption,
  type TransactionEntryOptions,
} from "@/lib/supabase/dashboard";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cash02Icon } from "@hugeicons/core-free-icons";

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

type SheetType =
  | "staff"
  | "service"
  | "new-customer"
  | "new-staff"
  | "new-service"
  | "discount"
  | "edit-service"
  | null;
type SaveSuccessState = {
  localId: string;
  total: number;
  customerLabel: string;
  customerVisitLabel: string | null;
  staffName: string;
  paymentCode: string;
};

type DuplicateCandidate = {
  localId: string;
  customerLabel: string;
  serviceLabel: string;
  amount: number;
  staffName: string;
  createdAtLabel: string;
  minutesAgo: number;
};

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

function getCustomerIdentityKey(name: string, phone: string) {
  return `${name.trim().toLowerCase()}::${phone.trim()}`;
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
  const customerIdentityMap = new Map<string, string>();
  const customerStaffCounts = new Map<string, Map<string, number>>();

  for (const customer of catalog.customers ?? []) {
    const referenceCustomer = customer as ReferenceCustomer;
    const phone = String(referenceCustomer.phone ?? "").trim();
    const identityKey = getCustomerIdentityKey(referenceCustomer.name, phone);

    customerMap.set(referenceCustomer.id, {
      id: referenceCustomer.id,
      name: referenceCustomer.name,
      phone,
      visitCount: 0,
      lastVisitLabel: "No recorded visits yet",
      usualStaffName: null,
    });
    customerIdentityMap.set(identityKey, referenceCustomer.id);
  }

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
    const identityKey = getCustomerIdentityKey(name, phone);
    const key =
      transaction.customerId ??
      customerIdentityMap.get(identityKey) ??
      identityKey;

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

    if (!customerIdentityMap.has(identityKey)) {
      customerIdentityMap.set(identityKey, key);
    }

    const customer = customerMap.get(key);

    if (!customer) {
      continue;
    }

    customer.visitCount += 1;
    customer.lastVisitLabel = formatRelativeVisitLabel(
      transaction.transactionDate || transaction.createdAt,
    );

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
      .filter((customer) => Boolean(customer.name.trim()))
      .sort((left, right) => right.visitCount - left.visitCount)
      .slice(0, 20),
  };
}

function useComposerOptions() {
  const [options, setOptions] = useState<TransactionEntryOptions>(EMPTY_OPTIONS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadOptions() {
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

    void loadOptions();

    async function refreshInBackground() {
      try {
        await syncOfflineData();
        await loadOptions();
      } catch {
        // Keep the local-first experience intact when remote refresh fails.
      }
    }

    void refreshInBackground();

    return () => {
      isActive = false;
    };
  }, []);

  async function reloadOptions() {
    const [catalog, transactions] = await Promise.all([
      getReferenceCatalog(),
      listTransactions(),
    ]);
    setOptions(buildComposerOptions(catalog, transactions));
  }

  return { options, isHydrated, reloadOptions };
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

function getServiceSignature(items: Array<{
  serviceId: string;
  quantity: number;
  unitPrice: number;
}>) {
  return [...items]
    .map((item) => `${item.serviceId}:${item.quantity}:${item.unitPrice}`)
    .sort()
    .join("|");
}

function findPossibleDuplicate(
  transactions: StoredTransactionRecord[],
  candidate: {
    customerLabel: string;
    staffId: string;
    totalAmount: number;
    items: Array<{
      serviceId: string;
      quantity: number;
      unitPrice: number;
    }>;
  },
) {
  const candidateSignature = getServiceSignature(candidate.items);
  const now = Date.now();

  return transactions.find((transaction) => {
    const minutesAgo = Math.floor(
      (now - new Date(transaction.createdAt).getTime()) / (1000 * 60),
    );

    if (minutesAgo < 0 || minutesAgo > 10) {
      return false;
    }

    const transactionSignature = getServiceSignature(
      transaction.items.map((item) => ({
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    );

    const transactionCustomer = String(transaction.customerName ?? "Walk-in customer");

    return (
      transaction.staffId === candidate.staffId &&
      Number(transaction.finalTotal ?? 0) === candidate.totalAmount &&
      transactionCustomer === candidate.customerLabel &&
      transactionSignature === candidateSignature
    );
  });
}

export function AppTransactionComposer() {
  useAppSession();
  const { options, isHydrated, reloadOptions } = useComposerOptions();
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const staffSectionRef = useRef<HTMLElement | null>(null);
  const servicesSectionRef = useRef<HTMLElement | null>(null);
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
  const [newStaffName, setNewStaffName] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountDraft, setDiscountDraft] = useState("");
  const [lineItems, setLineItems] = useState<ServiceLineItem[]>([]);
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    staff?: string;
    services?: string;
    payment?: string;
    save?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<SaveSuccessState | null>(null);
  const [allLocalTransactions, setAllLocalTransactions] = useState<StoredTransactionRecord[]>([]);
  const [duplicateCandidate, setDuplicateCandidate] = useState<DuplicateCandidate | null>(
    null,
  );

  useEffect(() => {
    setSelectedPaymentCode(
      (current) => current || options.paymentMethods[0]?.code || "",
    );
  }, [options.paymentMethods]);

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
  const netTotal = Math.max(0, totalAmount - discountAmount);
  const canSave =
    lineItems.length > 0 &&
    netTotal > 0 &&
    Boolean(selectedStaffId) &&
    Boolean(selectedPaymentCode) &&
    !isSaving;
  function resetComposer(keepPayment = true) {
    setCustomerQuery("");
    setSelectedCustomer(null);
    setNotes("");
    setNotesOpen(false);
    setSheet(null);
    setServiceSearch("");
    setStaffSearch("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewStaffName("");
    setNewServiceName("");
    setNewServicePrice("");
    setDiscountAmount(0);
    setDiscountDraft("");
    setLineItems([]);
    setEditingLineItemId(null);
    setErrors({});
    setSaveSuccess(null);
    setDuplicateCandidate(null);
    setSelectedStaffId("");

    if (!keepPayment) {
      setSelectedPaymentCode(options.paymentMethods[0]?.code ?? "");
    }

    requestAnimationFrame(() => {
      customerInputRef.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  useEffect(() => {
    let isActive = true;

    async function loadAllLocalTransactions() {
      try {
        const transactions = await listTransactions();

        if (!isActive) {
          return;
        }

        setAllLocalTransactions(transactions);
      } catch {
        if (isActive) {
          setAllLocalTransactions([]);
        }
      }
    }

    void loadAllLocalTransactions();

    return () => {
      isActive = false;
    };
  }, []);

  function openStaffSheet() {
    setStaffSearch("");
    setSheet("staff");
  }

  function openNewStaffSheet() {
    setNewStaffName("");
    setSheet("new-staff");
  }

  function openServiceSheet() {
    setServiceSearch("");
    setSheet("service");
  }

  function openNewServiceSheet() {
    setNewServiceName("");
    setNewServicePrice("");
    setSheet("new-service");
  }

  // function openDiscountSheet() {
  //   setDiscountDraft(discountAmount > 0 ? String(discountAmount) : "");
  //   setSheet("discount");
  // }

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

  function clearSelectedStaff() {
    setSelectedStaffId("");
    setErrors((current) => ({ ...current, staff: undefined }));
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

  async function createAndUseStaff() {
    const name = newStaffName.trim();

    if (!name) {
      return;
    }

    const staffMember = await saveStaffDefinition({ name });
    await reloadOptions();
    setSelectedStaffId(staffMember.id);
    setLineItems((current) =>
      current.map((item) => ({
        ...item,
        staffId: item.staffId || staffMember.id,
      })),
    );
    setNewStaffName("");
    setSheet(null);
    void syncOfflineData();
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

  async function createAndUseService() {
    const name = newServiceName.trim();
    const expectedPrice = Math.max(0, Number(newServicePrice) || 0);

    if (!name || expectedPrice <= 0) {
      return;
    }

    const service = await saveServiceDefinition({
      name,
      expectedPrice,
    });

    const activeStaffId = selectedStaffId || options.staff[0]?.id || "";

    setSelectedStaffId(activeStaffId);
    setLineItems((current) => [
      ...current,
      createLineItem(service.id, expectedPrice, activeStaffId),
    ]);
    setErrors((current) => ({ ...current, services: undefined }));
    setSheet(null);
    setNewServiceName("");
    setNewServicePrice("");
    await reloadOptions();
    setSelectedStaffId(activeStaffId);
    void syncOfflineData();
  }

  function applyDiscount() {
    setDiscountAmount(Math.max(0, Number(discountDraft) || 0));
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

  async function saveTransaction(allowDuplicate = false) {
    const nextErrors: {
      staff?: string;
      services?: string;
      payment?: string;
      save?: string;
    } = {};

    if (!selectedStaffId) {
      nextErrors.staff = "Select who handled this transaction.";
    }

    if (lineItems.length === 0) {
      nextErrors.services = "Add at least one service.";
    }

    if (lineItems.some((item) => item.unitPrice <= 0 || item.quantity <= 0)) {
      nextErrors.services = "Each service must have a valid price and quantity.";
    }

    if (!selectedPaymentCode) {
      nextErrors.payment = "Select how this transaction was paid.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.staff) {
        staffSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (nextErrors.services) {
        servicesSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (nextErrors.payment) {
        servicesSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }

    const selectedStaff = options.staff.find((entry) => entry.id === selectedStaffId);

    if (!selectedStaff || !selectedPaymentCode) {
      setErrors({
        save: "Transaction details are incomplete. Refresh local data and try again.",
      });
      return;
    }

    const customerLabel =
      selectedCustomer?.kind === "existing"
        ? selectedCustomer.customer.name
        : selectedCustomer?.kind === "new"
          ? selectedCustomer.name
          : "Walk-in customer";

    const duplicateMatch =
      !allowDuplicate &&
      findPossibleDuplicate(allLocalTransactions, {
        customerLabel,
        staffId: selectedStaffId,
        totalAmount: netTotal,
        items: lineItems.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

    if (duplicateMatch) {
      const minutesAgo = Math.max(
        1,
        Math.floor((Date.now() - new Date(duplicateMatch.createdAt).getTime()) / (1000 * 60)),
      );

      setDuplicateCandidate({
        localId: duplicateMatch.localId,
        customerLabel,
        serviceLabel: duplicateMatch.primaryServiceName,
        amount: Number(duplicateMatch.finalTotal ?? 0),
        staffName: duplicateMatch.staffName,
        createdAtLabel: formatTimeLabel(duplicateMatch.createdAt),
        minutesAgo,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSaving(true);

    try {
      const record = await persistTransaction({
        transactionDate: getTodayDateString(),
        staffId: selectedStaffId,
        staffName: selectedStaff.name,
        paymentMethod: selectedPaymentCode,
        customerKind: selectedCustomer?.kind === "walk-in" ? "walk_in" : "named",
        customerId:
          selectedCustomer?.kind === "existing"
            ? selectedCustomer.customer.id
            : null,
        customerName:
          selectedCustomer?.kind === "existing"
            ? selectedCustomer.customer.name
            : selectedCustomer?.kind === "new"
              ? selectedCustomer.name
              : null,
        customerPhone:
          selectedCustomer?.kind === "existing"
            ? selectedCustomer.customer.phone || null
            : selectedCustomer?.kind === "new"
              ? selectedCustomer.phone || null
              : null,
        notes: notes.trim() || null,
        subtotal: totalAmount,
        discountTotal: discountAmount,
        transactionStatus: "confirmed",
        finalTotal: netTotal,
        items: lineItems.map((item) => ({
          type: "service",
          serviceId: item.serviceId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          staffId: item.staffId,
          staffName:
            options.staff.find((staffMember) => staffMember.id === item.staffId)?.name ??
            null,
          notes: item.notes || null,
        })),
        payments: [
          {
            amount: netTotal,
            method: selectedPaymentCode,
            status: "completed",
          },
        ],
      });

      await reloadOptions();

      void syncOfflineData();

      const customerVisitLabel =
        selectedCustomer?.kind === "existing"
          ? `${selectedCustomer.customer.visitCount + 1}${getOrdinalSuffix(
              selectedCustomer.customer.visitCount + 1,
            )} recorded visit`
          : selectedCustomer?.kind === "new"
            ? "1st recorded visit"
            : null;

      setSaveSuccess({
        localId: record.localId,
        total: netTotal,
        customerLabel,
        customerVisitLabel,
        staffName: selectedStaff.name,
        paymentCode: selectedPaymentCode,
      });
      setDuplicateCandidate(null);
      setErrors({});
      setAllLocalTransactions((current) => [record, ...current]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors({
        save: "Could not save this transaction locally. Try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const selectedStaff = options.staff.find((entry) => entry.id === selectedStaffId);
  const quickSelectStaff = options.recentStaff.slice(0, 7);
  const quickSelectServices = options.recentServices.slice(0, 7);
  const visibleRecentStaff = options.recentStaff.filter((entry) =>
    filteredStaff.some((candidate) => candidate.id === entry.id),
  );
  const visibleRecentServices = options.recentServices.filter((entry) =>
    filteredServices.some((candidate) => candidate.id === entry.id),
  );

  if (saveSuccess) {
    return (
      <div className="min-h-screen bg-[#f5eee6] px-4 py-6 text-slate-950 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
              Transaction saved
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-slate-950">
              {formatCurrency(saveSuccess.total)}
            </h1>
            <p className="mt-3 text-base text-slate-600">
              added to today&apos;s sales
            </p>

            <div className="mt-8 space-y-5 border-t border-black/10 pt-6">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {saveSuccess.customerLabel}
                </p>
                {saveSuccess.customerVisitLabel ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {saveSuccess.customerVisitLabel}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {saveSuccess.staffName}
                </p>
                <p className="mt-1 text-sm text-slate-500">activity updated</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => resetComposer(true)}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212]"
              >
                Add another
              </button>
              <Link
                href={`/app/transactions/${saveSuccess.localId}`}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
              >
                View transaction
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-8">
        <div className="min-h-screen bg-white ">
          {/* <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f5eee6]/95 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  if (
                    (Boolean(customerQuery.trim()) ||
                      Boolean(selectedCustomer) ||
                      lineItems.length > 0 ||
                      Boolean(notes.trim())) &&
                    !window.confirm("Discard this transaction?")
                  ) {
                    return;
                  }

                  window.location.href = "/app";
                }}
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
          </header> */}

          <div className="px-4 pb-32 pt-6 sm:px-6 ">
            <div className="pb-6">
              {!isHydrated ? (
                <p className="text-sm text-slate-500">
                  Opening from local data...
                </p>
              ) : null}
            </div>

            {duplicateCandidate ? (
              <section className="border-b border-black/10 py-6">
                <div className="rounded-[0.9rem] border border-[#E89BFF]/45 bg-[#fbf4ff] p-4">
                  <p className="font-semibold text-slate-950">Possible duplicate</p>
                  <p className="mt-2 text-sm text-slate-600">
                    A similar transaction was recorded {duplicateCandidate.minutesAgo} minute
                    {duplicateCandidate.minutesAgo === 1 ? "" : "s"} ago.
                  </p>
                  <div className="mt-3 text-sm text-slate-600">
                    <p>{duplicateCandidate.customerLabel}</p>
                    <p>{duplicateCandidate.serviceLabel}</p>
                    <p>
                      {formatCurrency(duplicateCandidate.amount)} · {duplicateCandidate.staffName} ·{" "}
                      {duplicateCandidate.createdAtLabel}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/app/transactions/${duplicateCandidate.localId}`}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
                    >
                      View existing
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        void saveTransaction(true);
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212]"
                    >
                      Save anyway
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="border-b border-black/10 py-6 rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
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
                      className="font-semibold text-slate-950 transition-colors bg-[#E89BFF] hover:text-[#121212] rounded-full px-4 py-2"
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

            <section ref={staffSectionRef} className="border-b border-black/10 py-6 mt-4 rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    Staff
                  </p>
                  {selectedStaff ? (
                    <p className="mt-4 text-[1.25rem] font-semibold text-slate-950">
                      {selectedStaff.name}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Select staff</p>
                  )}
                  {errors.staff ? (
                    <p className="mt-2 text-sm text-[#b42318]">{errors.staff}</p>
                  ) : null}
                </div>
                {selectedStaff ? (
                  <button
                    type="button"
                    onClick={clearSelectedStaff}
                    className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
                  >
                    Change
                  </button>
                ) : null}
              </div>
              {quickSelectStaff.length > 0 ? (
                <div className="mt-8 flex flex-wrap gap-2 border-t border-black/10 pt-4">
                  {quickSelectStaff.map((staffMember) => {
                    const active = staffMember.id === selectedStaffId;

                    return (
                      <button
                        key={staffMember.id}
                        type="button"
                        onClick={() => selectStaff(staffMember.id)}
                        className={`rounded-[0.7rem] border px-2 py-0.5 text-sm font-medium transition-colors ${
                          active
                            ? "border-[#121212] bg-[#121212] text-white"
                            : "border-black/10 bg-[#E89BFF] text-slate-700 hover:border-[#121212] hover:text-white hover:bg-[#121212]"
                        }`}
                      >
                        {staffMember.name}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={openStaffSheet}
                    className="rounded-[0.7rem] border border-black/10 bg-white px-2 py-0.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
                  >
                    + View More
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={openStaffSheet}
                    className="rounded-[0.7rem] border border-black/10 bg-white px-2 py-0.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
                  >
                    More staff
                  </button>
                </div>
              )}
            </section>

            <section
              ref={servicesSectionRef}
              className="mt-4 border-b border-black/10 py-6 rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]" 
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Services
              </p>
              <div className="mt-4 space-y-2">
                {lineItemsWithDetails.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border border-black/5 gap-4 bg-[#f9f9f9] p-2 pl-4 hover:bg-[#f5f5f5] rounded-[0.3rem]">
                    <button
                      type="button"
                      onClick={() => openEditService(item.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-base font-semibold text-slate-950">
                        {item.serviceName}
                      </p>
                      <div className="flex gap-4">
                      <p className="text-xs text-slate-500">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Handled by {item.staffName}
                      </p>
                      </div>
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
              {quickSelectServices.length > 0 ? (
                <div className="mt-12 flex flex-wrap gap-2 border-t border-black/10 pt-4">
                  {quickSelectServices.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => addService(service.id)}
                      className="rounded-[0.7rem] border border-black/10 bg-[#E89BFF] px-2 py-0.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#121212] hover:text-white hover:bg-[#121212]"
                    >
                      {service.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={openServiceSheet}
                    className="rounded-[0.7rem] border border-black/10 bg-white px-2 py-0.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
                  >
                    + More services
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={openServiceSheet}
                    className="rounded-[0.7rem] border border-black/10 bg-white px-2 py-0.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
                  >
                    + More services
                  </button>
                </div>
              )}
              {/* <button
                type="button"
                onClick={openDiscountSheet}
                className="mt-3 block text-sm text-slate-500 transition-colors hover:text-slate-950"
              >
                {discountAmount > 0 ? `Discount ${formatCurrency(discountAmount)}` : "+ Add discount"}
              </button> */}
              {errors.services ? (
                <p className="mt-2 text-sm text-[#b42318]">{errors.services}</p>
              ) : null}
            </section>

            <section className="mt-4 border-b border-black/10 py-6 rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
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
                      className={`flex flex-col items-center justify-center rounded-[0.3rem] border px-4 py-2 text-xs font-medium transition-colors ${
                        active
                          ? "border-[#E89BFF] bg-[#E89BFF] text-[#121212]"
                          : "border-black/10 bg-white text-slate-600 hover:border-[#E89BFF]"
                      }`}
                    >
                      <HugeiconsIcon icon={Cash02Icon} size={12} />
                      {paymentMethod.label}
                    </button>
                  );
                })}
              </div>
              {errors.payment ? (
                <p className="mt-2 text-sm text-[#b42318]">{errors.payment}</p>
              ) : null}
            </section>

            <section className="mt-4 border-b border-black/10 py-6 lg:hidden rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Total
              </p>
              <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950">
                {formatCurrency(netTotal)}
              </p>
              {discountAmount > 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  Subtotal {formatCurrency(totalAmount)} · Discount {formatCurrency(discountAmount)}
                </p>
              ) : null}
            </section>

            <section className="mt-4 py-6 rounded-[1rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(18,18,18,0.06)]">
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
              {errors.save ? (
                <p className="mt-4 text-sm text-[#b42318]">{errors.save}</p>
              ) : null}
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
                {formatCurrency(netTotal)}
              </p>
              {discountAmount > 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  Subtotal {formatCurrency(totalAmount)} · Discount {formatCurrency(discountAmount)}
                </p>
              ) : null}
            </div>

          <button
            type="button"
            onClick={() => {
              void saveTransaction();
            }}
            disabled={!canSave}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
          >
            {isSaving ? "Saving..." : "Save transaction"}
          </button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white px-4 py-4 shadow-[0_-10px_30px_rgba(18,18,18,0.08)] lg:hidden">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-slate-500">Total {formatCurrency(netTotal)}</p>
          <button
            type="button"
            onClick={() => {
              void saveTransaction();
            }}
            disabled={!canSave}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
          >
            {isSaving ? "Saving..." : "Save transaction"}
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

                  <button
                    type="button"
                    onClick={openNewStaffSheet}
                    className="mt-5 text-sm font-semibold text-slate-950 transition-colors hover:text-[#a65bd3]"
                  >
                    + Create new staff
                  </button>
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

                  <button
                    type="button"
                    onClick={openNewServiceSheet}
                    className="mt-5 text-sm font-semibold text-slate-950 transition-colors hover:text-[#a65bd3]"
                  >
                    + Create new service
                  </button>
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
                        inputMode="tel"
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

              {sheet === "new-staff" ? (
                <>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    New staff
                  </h2>
                  <div className="mt-5">
                    <label className="text-sm font-medium text-slate-700">Name</label>
                    <input
                      value={newStaffName}
                      onChange={(event) => setNewStaffName(event.target.value)}
                      className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void createAndUseStaff();
                    }}
                    disabled={!newStaffName.trim()}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Add and use
                  </button>
                </>
              ) : null}

              {sheet === "new-service" ? (
                <>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    New service
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Name</label>
                      <input
                        value={newServiceName}
                        onChange={(event) => setNewServiceName(event.target.value)}
                        className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Price</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={newServicePrice}
                        onChange={(event) => setNewServicePrice(event.target.value)}
                        className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void createAndUseService();
                    }}
                    disabled={!newServiceName.trim() || Number(newServicePrice) <= 0}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Add and use
                  </button>
                </>
              ) : null}

              {sheet === "discount" ? (
                <>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    Add discount
                  </h2>
                  <div className="mt-5">
                    <label className="text-sm font-medium text-slate-700">Amount</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={discountDraft}
                      onChange={(event) => setDiscountDraft(event.target.value)}
                      className="mt-2 w-full rounded-[0.9rem] border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyDiscount}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white"
                  >
                    Apply discount
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

function getOrdinalSuffix(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "st";
  }

  if (mod10 === 2 && mod100 !== 12) {
    return "nd";
  }

  if (mod10 === 3 && mod100 !== 13) {
    return "rd";
  }

  return "th";
}
