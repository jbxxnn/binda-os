"use server";

import { redirect } from "next/navigation";
import { getCurrentBusinessMembership } from "@/lib/supabase/onboarding";

export type CreateBusinessState = {
  error: string | null;
};

const defaultPaymentMethods = [
  { code: "cash", label: "Cash" },
  { code: "transfer", label: "Transfer" },
  { code: "pos", label: "POS" },
  { code: "card", label: "Card" },
  { code: "other", label: "Other" },
];

export async function createBusinessAction(
  _previousState: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const businessType = String(formData.get("businessType") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();

  if (!businessName || !businessType || !country || !currency) {
    return { error: "Fill in every business field before continuing." };
  }

  const { supabase, user, membership } = await getCurrentBusinessMembership();

  if (!user) {
    return { error: "You need to sign in before creating a business." };
  }

  if (membership?.businessId) {
    redirect("/app");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({
      name: businessName,
      business_type: businessType,
      country,
      currency,
      timezone: country === "Nigeria" ? "Africa/Lagos" : "UTC",
      owner_user_id: user.id,
    })
    .select("id")
    .single();

  if (businessError || !business) {
    return {
      error:
        businessError?.message ?? "We could not create your business right now.",
    };
  }

  const businessId = business.id as string;

  const { error: membershipError } = await supabase.from("business_users").insert({
    business_id: businessId,
    user_id: user.id,
    role: "owner",
  });

  if (membershipError) {
    return {
      error:
        membershipError.message ??
        "Your business was created, but owner access could not be assigned.",
    };
  }

  const { error: paymentMethodError } = await supabase
    .from("payment_methods")
    .insert(
      defaultPaymentMethods.map((method) => ({
        business_id: businessId,
        code: method.code,
        label: method.label,
      })),
    );

  if (paymentMethodError) {
    return {
      error:
        paymentMethodError.message ??
        "Your business was created, but default payment methods could not be seeded.",
    };
  }

  redirect("/app");
}
