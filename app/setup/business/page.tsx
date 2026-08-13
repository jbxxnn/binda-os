import { redirect } from "next/navigation";
import { CreateBusinessForm } from "@/components/onboarding/create-business-form";
import { getCurrentBusinessMembership } from "@/lib/supabase/onboarding";

export const dynamic = "force-dynamic";

export default async function SetupBusinessPage() {
  const { user, membership } = await getCurrentBusinessMembership();

  if (!user) {
    redirect("/auth/login");
  }

  if (membership?.businessId) {
    redirect("/app");
  }

  return <CreateBusinessForm />;
}
