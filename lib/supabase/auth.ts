import type { NextResponse } from "next/server";

type SupabaseAuthErrorLike = {
  message?: string;
  name?: string;
  status?: number;
  code?: string;
};

const RECOVERABLE_AUTH_MESSAGES = [
  "User from sub claim in JWT does not exist",
  "invalid claim: missing sub",
  "Auth session missing",
];

export function isRecoverableAuthSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as SupabaseAuthErrorLike;
  const message = authError.message ?? "";

  return (
    (authError.name === "AuthApiError" ||
      authError.name === "AuthSessionMissingError") &&
    RECOVERABLE_AUTH_MESSAGES.some((candidate) => message.includes(candidate))
  );
}

export function clearSupabaseAuthCookies(response: NextResponse) {
  for (const { name } of response.cookies.getAll()) {
    if (!name.startsWith("sb-") || !name.includes("-auth-token")) {
      continue;
    }

    response.cookies.set(name, "", {
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });
  }
}
