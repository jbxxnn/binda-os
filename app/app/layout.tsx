import { AppSessionProvider } from "@/components/app/app-session-provider";
import { getCurrentBusinessContext } from "@/lib/supabase/onboarding";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, membership, business } = await getCurrentBusinessContext();

  if (!user) {
    redirect("/auth/login");
  }

  if (!membership?.businessId) {
    redirect("/setup/business");
  }

  return (
    <AppSessionProvider
      businessId={business?.id ?? null}
      businessName={business?.name ?? "Your Business"}
      userName={user?.displayName ?? "Owner"}
    >
      <main className="min-h-screen bg-[#f5eee6] text-slate-950">{children}</main>
    </AppSessionProvider>
  );
}
