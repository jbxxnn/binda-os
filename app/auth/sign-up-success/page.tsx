import Link from "next/link";
import {
  AuthNotice,
  authSecondaryLinkClassName,
  AuthShell,
} from "@/components/auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      badge="Check Email"
      title="Your account is almost ready"
      description="Confirm your email to continue."
    >
      <div className="space-y-5">
        <AuthNotice tone="success">
          Check your inbox for the confirmation link. After confirmation, the
          next screen should be business creation.
        </AuthNotice>

        <p className="text-sm leading-6 text-[#121212]/62">
          Some environments sign the user in immediately. If that already
          happened, you can continue now.
        </p>

        <p className="text-center text-sm text-[#121212]/62">
          Want to continue?{" "}
          <Link href="/auth/login" className={authSecondaryLinkClassName}>
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
