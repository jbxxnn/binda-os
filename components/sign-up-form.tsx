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

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/setup/business`,
        },
      });
      if (error) throw error;
      router.push(data.session ? "/setup/business" : "/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Create Account"
      title="Start with your owner account"
      description="Create your account."
    >
      <form onSubmit={handleSignUp} className="space-y-5">
        <AuthField htmlFor="name" label="Name">
          <Input
            id="name"
            type="text"
            placeholder="Jane Okafor"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={authInputClassName}
          />
        </AuthField>

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

        <AuthField htmlFor="password" label="Password">
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClassName}
          />
        </AuthField>

        <AuthField htmlFor="repeat-password" label="Repeat password">
          <Input
            id="repeat-password"
            type="password"
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            className={authInputClassName}
          />
        </AuthField>

        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

        <Button
          type="submit"
          className={authPrimaryButtonClassName}
          disabled={isLoading}
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>

        <p className="text-center text-sm text-[#121212]/62">
          Already have an account?{" "}
          <Link href="/auth/login" className={authSecondaryLinkClassName}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
