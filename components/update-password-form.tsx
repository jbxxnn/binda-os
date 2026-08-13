"use client";

import {
  AuthField,
  AuthNotice,
  authInputClassName,
  authPrimaryButtonClassName,
  AuthShell,
} from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
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
      badge="New Password"
      title="Choose a fresh password"
      description="Set your new password."
    >
      <form onSubmit={handleForgotPassword} className="space-y-5">
        <AuthField htmlFor="password" label="New password">
          <Input
            id="password"
            type="password"
            placeholder="Enter new password"
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
          {isLoading ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </AuthShell>
  );
}
