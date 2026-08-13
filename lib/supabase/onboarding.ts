import { isRecoverableAuthSessionError } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type BusinessMembership = {
  businessId: string;
  role: string;
};

export type CurrentBusinessContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: {
    id: string;
    email: string | null;
    displayName: string;
  } | null;
  membership: BusinessMembership | null;
  business: {
    id: string;
    name: string;
  } | null;
};

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  let user = null;

  try {
    const {
      data: { user: authenticatedUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isRecoverableAuthSessionError(error)) {
        return { supabase, user: null };
      }

      throw error;
    }

    user = authenticatedUser;
  } catch (error) {
    if (isRecoverableAuthSessionError(error)) {
      return { supabase, user: null };
    }

    throw error;
  }

  return { supabase, user };
}

export async function getCurrentBusinessMembership() {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return {
      supabase,
      user: null,
      membership: null,
    };
  }

  const { data, error } = await supabase
    .from("business_users")
    .select("business_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    supabase,
    user,
    membership: data
      ? {
          businessId: data.business_id as string,
          role: data.role as string,
        }
      : null,
  };
}

export async function getCurrentBusinessContext(): Promise<CurrentBusinessContext> {
  const { supabase, user, membership } = await getCurrentBusinessMembership();

  if (!user) {
    return {
      supabase,
      user: null,
      membership: null,
      business: null,
    };
  }

  const displayName =
    String(user.user_metadata?.full_name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "Owner";

  if (!membership?.businessId) {
    return {
      supabase,
      user: {
        id: user.id,
        email: user.email ?? null,
        displayName,
      },
      membership,
      business: null,
    };
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", membership.businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName,
    },
    membership,
    business: business
      ? {
          id: business.id as string,
          name: business.name as string,
        }
      : null,
  };
}
