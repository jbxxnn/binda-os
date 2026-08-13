import { createClient } from "@/lib/supabase/server";

type DashboardSummary = {
  salesToday: number;
  transactionsToday: number;
  customersToday: number;
  needsReviewCount: number;
};

export type DashboardRecentTransaction = {
  id: string;
  customerName: string;
  amount: number;
  timeLabel: string;
  paymentMethodCode: string;
};

export type TransactionEntryStaffOption = {
  id: string;
  name: string;
};

export type TransactionEntryServiceOption = {
  id: string;
  name: string;
  expectedPrice: number;
};

export type TransactionEntryPaymentMethodOption = {
  id: string;
  code: string;
  label: string;
};

export type TransactionComposerCustomerOption = {
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  lastVisitLabel: string;
  usualStaffName: string | null;
};

export type TransactionEntryOptions = {
  staff: TransactionEntryStaffOption[];
  recentStaff: TransactionEntryStaffOption[];
  services: TransactionEntryServiceOption[];
  recentServices: TransactionEntryServiceOption[];
  paymentMethods: TransactionEntryPaymentMethodOption[];
  customers: TransactionComposerCustomerOption[];
};

export type DashboardHomeData = DashboardSummary & {
  recentTransactions: DashboardRecentTransaction[];
  currentDateLabel: string;
  currentTimeLabel: string;
  businessDayProgress: number;
};

function getLagosDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getTodayDateString() {
  const { year, month, day } = getLagosDateParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getCurrentDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

function getCurrentTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getBusinessDayProgress(date = new Date()) {
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(timeParts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(timeParts.find((part) => part.type === "minute")?.value ?? 0);
  const currentMinutes = hour * 60 + minute;

  // Assumed operational window for now.
  const dayStartMinutes = 8 * 60;
  const dayEndMinutes = 20 * 60;
  const businessWindow = dayEndMinutes - dayStartMinutes;
  const elapsed = Math.min(
    Math.max(currentMinutes - dayStartMinutes, 0),
    businessWindow,
  );

  return Math.round((elapsed / businessWindow) * 100);
}

export async function getDashboardHomeData(
  businessId: string,
): Promise<DashboardHomeData> {
  const supabase = await createClient();
  const today = getTodayDateString();

  const [
    salesResult,
    transactionCountResult,
    customerCountResult,
    needsReviewResult,
    recentTransactionsResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("final_total")
      .eq("business_id", businessId)
      .eq("transaction_date", today),
    supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("transaction_date", today),
    supabase
      .from("transactions")
      .select("customer_name")
      .eq("business_id", businessId)
      .eq("transaction_date", today)
      .not("customer_name", "is", null),
    supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("review_status", ["draft", "needs_review"]),
    supabase
      .from("transactions")
      .select(
        "id, customer_name, final_total, created_at, transaction_date, payment_method_code",
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (salesResult.error) throw salesResult.error;
  if (transactionCountResult.error) throw transactionCountResult.error;
  if (customerCountResult.error) throw customerCountResult.error;
  if (needsReviewResult.error) throw needsReviewResult.error;
  if (recentTransactionsResult.error) throw recentTransactionsResult.error;

  const salesToday = (salesResult.data ?? []).reduce((total, row) => {
    return total + Number(row.final_total ?? 0);
  }, 0);

  const uniqueCustomers = new Set(
    (customerCountResult.data ?? [])
      .map((row) => String(row.customer_name ?? "").trim())
      .filter(Boolean),
  );

  const recentTransactions: DashboardRecentTransaction[] = (
    recentTransactionsResult.data ?? []
  ).map((row) => ({
    id: row.id as string,
    customerName: String(row.customer_name ?? "Walk-in customer"),
    amount: Number(row.final_total ?? 0),
    paymentMethodCode: String(row.payment_method_code ?? "payment"),
    timeLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(String(row.created_at))),
  }));

  return {
    salesToday,
    transactionsToday: transactionCountResult.count ?? 0,
    customersToday: uniqueCustomers.size,
    needsReviewCount: needsReviewResult.count ?? 0,
    recentTransactions,
    currentDateLabel: getCurrentDateLabel(),
    currentTimeLabel: getCurrentTimeLabel(),
    businessDayProgress: getBusinessDayProgress(),
  };
}

export async function getTransactionEntryOptions(
  businessId: string,
): Promise<TransactionEntryOptions> {
  const supabase = await createClient();

  const [
    staffResult,
    servicesResult,
    paymentMethodsResult,
    customerHistoryResult,
    transactionIdsResult,
  ] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("services")
      .select("id, name, expected_price_min, expected_price_max")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("payment_methods")
      .select("id, code, label")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("label"),
    supabase
      .from("transactions")
      .select("customer_name, customer_phone, transaction_date, staff_id, staff:staff_id(name)")
      .eq("business_id", businessId)
      .not("customer_name", "is", null)
      .order("transaction_date", { ascending: false })
      .limit(150),
    supabase
      .from("transactions")
      .select("id")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (paymentMethodsResult.error) throw paymentMethodsResult.error;
  if (customerHistoryResult.error) throw customerHistoryResult.error;
  if (transactionIdsResult.error) throw transactionIdsResult.error;

  const transactionIds = (transactionIdsResult.data ?? [])
    .map((row) => String(row.id))
    .filter(Boolean);

  const serviceUsageResult =
    transactionIds.length > 0
      ? await supabase
          .from("transaction_items")
          .select("service_id")
          .in("transaction_id", transactionIds)
          .not("service_id", "is", null)
          .limit(200)
      : { data: [], error: null };

  if (serviceUsageResult.error) throw serviceUsageResult.error;

  const staff = (staffResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
  }));

  const services = (servicesResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    expectedPrice: Number(
      row.expected_price_max ?? row.expected_price_min ?? 0,
    ),
  }));

  const staffUsageCounts = new Map<string, number>();
  const serviceUsageCounts = new Map<string, number>();

  for (const row of customerHistoryResult.data ?? []) {
    if (row.staff_id) {
      const key = String(row.staff_id);
      staffUsageCounts.set(key, (staffUsageCounts.get(key) ?? 0) + 1);
    }
  }

  for (const row of serviceUsageResult.data ?? []) {
    if (row.service_id) {
      const key = String(row.service_id);
      serviceUsageCounts.set(key, (serviceUsageCounts.get(key) ?? 0) + 1);
    }
  }

  const customerMap = new Map<string, TransactionComposerCustomerOption>();

  for (const row of customerHistoryResult.data ?? []) {
    const name = String(row.customer_name ?? "").trim();

    if (!name) {
      continue;
    }

    const phone = String(row.customer_phone ?? "").trim();
    const key = `${name.toLowerCase()}::${phone}`;
    const lastVisitDate = String(row.transaction_date);
    const staffRelation = Array.isArray(row.staff) ? row.staff[0] : row.staff;
    const usualStaffName =
      staffRelation && typeof staffRelation === "object" && "name" in staffRelation
        ? String(staffRelation.name ?? "")
        : "";

    const existing = customerMap.get(key);

    if (!existing) {
      customerMap.set(key, {
        id: key,
        name,
        phone,
        visitCount: 1,
        lastVisitLabel: formatRelativeVisitLabel(lastVisitDate),
        usualStaffName: usualStaffName || null,
      });
      continue;
    }

    existing.visitCount += 1;
  }

  return {
    staff,
    recentStaff: [...staff].sort((left, right) => {
      const leftCount = staffUsageCounts.get(left.id) ?? 0;
      const rightCount = staffUsageCounts.get(right.id) ?? 0;
      return rightCount - leftCount || left.name.localeCompare(right.name);
    }).slice(0, 4),
    services,
    recentServices: [...services].sort((left, right) => {
      const leftCount = serviceUsageCounts.get(left.id) ?? 0;
      const rightCount = serviceUsageCounts.get(right.id) ?? 0;
      return rightCount - leftCount || left.name.localeCompare(right.name);
    }).slice(0, 6),
    paymentMethods: (paymentMethodsResult.data ?? []).map((row) => ({
      id: String(row.id),
      code: String(row.code),
      label: String(row.label),
    })),
    customers: [...customerMap.values()]
      .sort((left, right) => right.visitCount - left.visitCount)
      .slice(0, 20),
  };
}

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

export function formatCurrency(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
