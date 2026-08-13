import { Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { AppDashboardLiveStatus } from "@/components/app/app-dashboard-live-status";
import {
  formatCurrency,
  type DashboardRecentTransaction,
} from "@/lib/supabase/dashboard";

type AppDashboardHomeProps = {
  userName: string;
  currentDateLabel: string;
  currentTimeLabel: string;
  businessDayProgress: number;
  salesToday: number;
  transactionsToday: number;
  customersToday: number;
  needsReviewCount: number;
  recentTransactions: DashboardRecentTransaction[];
};

export function AppDashboardHome({
  userName,
  currentDateLabel,
  currentTimeLabel,
  businessDayProgress,
  salesToday,
  transactionsToday,
  customersToday,
  needsReviewCount,
  recentTransactions,
}: AppDashboardHomeProps) {
  const summaryCards = [
    {
      label: "Sales",
      value: formatCurrency(salesToday),
      icon: Wallet,
    },
    {
      label: "Tx",
      value: String(transactionsToday),
      icon: Receipt,
    },
    {
      label: "Customers",
      value: String(customersToday),
      icon: Users,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E89BFF]/20 via-[#E89BFF]/10 to-transparent px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[1rem] border border-black/10 bg-white p-5 shadow-[0_22px_60px_rgba(18,18,18,0.06)] sm:p-6 lg:p-8">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#E89BFF]/18 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-[#9FC3FF]/12 blur-3xl" />

          <div className="relative">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">

            <h1 className="text-4xl font-black leading-[0.92] tracking-[-0.06em] text-slate-950 sm:text-5xl">
                Good morning,
                <br />
                {userName}
              </h1>
            <AppDashboardLiveStatus
                initialDateLabel={currentDateLabel}
                initialTimeLabel={currentTimeLabel}
                initialBusinessDayProgress={businessDayProgress}
              />
            </div>

            
              

            <div className="mt-12">
              <div className="flex items-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500 whitespace-nowrap">
                  Today so far
                </p>
                <div className="ml-4 h-0.5 flex-1 bg-gradient-to-r from-[#dddddd] to-transparent" />
              </div>
              

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {summaryCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <div
                      key={card.label}
                      className="rounded-[0.8rem] border border-black/10 bg-gray-100 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-3xl font-black tracking-[-0.04em] text-slate-950">
                          {card.value}
                        </p>
                        <div className="rounded-full bg-white p-2 text-slate-700">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-medium text-slate-500">
                        {card.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/app/transactions/new"
                prefetch
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#E89BFF] hover:text-[#121212]"
              >
                Add Transaction
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-900 transition-colors hover:border-[#E89BFF] hover:bg-[#fbf4ff]"
              >
                <Receipt className="h-4 w-4" />
                Scan Receipt
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(300px,0.48fr)]">
          <div className="rounded-[0.9rem] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(18,18,18,0.05)] sm:p-6">
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              Recent Transactions
            </h2>

            {recentTransactions.length === 0 ? (
              <div className="mt-5 rounded-[0.75rem] border border-dashed border-black/10 bg-[#fbf7f3] px-4 py-6 text-sm text-slate-500">
                No transactions yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-4 rounded-[0.75rem] border border-black/10 bg-[#fbf7f3] px-4 py-4 transition-colors hover:border-[#E89BFF]/40 hover:bg-[#fbf4ff]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {transaction.customerName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {transaction.paymentMethodCode.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-950">
                        {formatCurrency(transaction.amount)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {transaction.timeLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[0.9rem] border border-black/10 bg-white p-5 shadow-[0_18px_40px_rgba(18,18,18,0.05)] sm:p-6">
            <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950">
              Needs Attention
            </h2>

            <div className="mt-5 rounded-[0.8rem] border border-[#E89BFF]/40 bg-[#fbf4ff] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white p-2 text-[#121212]">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {needsReviewCount} transaction{needsReviewCount === 1 ? "" : "s"} need review
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Confirm pricing and incomplete entries before final save.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
