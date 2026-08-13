"use client";

import {
  AuthField,
  AuthNotice,
  authInputClassName,
  authPrimaryButtonClassName,
  authSecondaryLinkClassName,
  AuthShell,
} from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      badge={success ? "Check Email" : "Reset Password"}
      title={success ? "Check your inbox" : "Reset your password"}
      description={
        success
          ? "Your reset link is on the way."
          : "Enter your email to get a reset link."
      }
    >
      {success ? (
        <div className="space-y-5">
          <AuthNotice tone="success">
            If you registered with email and password, a reset email has been
            sent. Open the link there to choose a new password.
          </AuthNotice>
          <p className="text-center text-sm text-[#121212]/62">
            Ready to go back?{" "}
            <Link href="/auth/login" className={authSecondaryLinkClassName}>
              Return to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleForgotPassword} className="space-y-5">
          <AuthField htmlFor="email" label="Email">
            <Input
              id="email"
              type="email"
              placeholder="owner@hairven.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClassName}
            />
          </AuthField>

          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

          <Button
            type="submit"
            className={authPrimaryButtonClassName}
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>

          <p className="text-center text-sm text-[#121212]/62">
            Already remember it?{" "}
            <Link href="/auth/login" className={authSecondaryLinkClassName}>
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
