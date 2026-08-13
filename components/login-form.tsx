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
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push("/app");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Sign In"
      title="Access your workspace"
      description="Sign in to continue."
    >
      <form onSubmit={handleLogin} className="space-y-5">
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

        <AuthField
          htmlFor="password"
          label="Password"
          action={
            <Link
              href="/auth/forgot-password"
              className="text-xs font-semibold text-[#121212]/60 transition-colors hover:text-[#E89BFF]"
            >
              Forgot password?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClassName}
          />
        </AuthField>

        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

        <Button
          type="submit"
          className={authPrimaryButtonClassName}
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>

        <p className="text-center text-sm text-[#121212]/62">
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className={authSecondaryLinkClassName}>
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
