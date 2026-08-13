import Link from "next/link";
import { Suspense } from "react";
import {
  AuthNotice,
  authSecondaryLinkClassName,
  AuthShell,
} from "@/components/auth/auth-shell";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthNotice tone="error">
      {params?.error
        ? `Code error: ${params.error}`
        : "An unspecified authentication error occurred."}
    </AuthNotice>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <AuthShell
      badge="Auth Error"
      title="Something interrupted the auth flow"
      description="Try the action again."
    >
      <div className="space-y-5">
        <Suspense>
          <ErrorContent searchParams={searchParams} />
        </Suspense>

        <p className="text-center text-sm text-[#121212]/62">
          Try again from{" "}
          <Link href="/auth/login" className={authSecondaryLinkClassName}>
            sign in
          </Link>{" "}
          or{" "}
          <Link href="/auth/sign-up" className={authSecondaryLinkClassName}>
            create account
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
