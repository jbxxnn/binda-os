import { AppDashboardHome } from "@/components/app/app-dashboard-home";
import { getDashboardHomeData } from "@/lib/supabase/dashboard";
import { getCurrentBusinessContext } from "@/lib/supabase/onboarding";

export default async function AppHomePage() {
  const { business, user } = await getCurrentBusinessContext();
  const dashboardData = business
    ? await getDashboardHomeData(business.id)
    : {
        salesToday: 0,
        transactionsToday: 0,
        customersToday: 0,
        needsReviewCount: 0,
        recentTransactions: [],
        currentDateLabel: "Wednesday, 12 Aug",
        currentTimeLabel: "12:00 PM",
        businessDayProgress: 0,
      };

  return (
    <AppDashboardHome
      userName={user?.displayName ?? "Owner"}
      currentDateLabel={dashboardData.currentDateLabel}
      currentTimeLabel={dashboardData.currentTimeLabel}
      businessDayProgress={dashboardData.businessDayProgress}
      salesToday={dashboardData.salesToday}
      transactionsToday={dashboardData.transactionsToday}
      customersToday={dashboardData.customersToday}
      needsReviewCount={dashboardData.needsReviewCount}
      recentTransactions={dashboardData.recentTransactions}
    />
  );
}
