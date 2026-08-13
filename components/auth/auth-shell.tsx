"use client";

import Link from "next/link";
import { ArrowLeft, 
  // Sparkles
 } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
};

export function AuthShell({
  badge,
  title,
  description,
  children,
  className,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-[#E89BFF]/8 to-white text-[#121212]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#121212]/60 transition-colors hover:border-[#E89BFF] hover:text-[#121212]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          {/* <div className="inline-flex items-center gap-2 rounded-full bg-[#E89BFF] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#121212]">
            <Sparkles className="h-3.5 w-3.5" />
            Binda Salon OS
          </div> */}
        </div>

        <section className="flex flex-1 items-center justify-center py-8 lg:py-12">
          <div
            className={cn(
              "w-full max-w-lg rounded-2xl border-2 border-black/10 bg-gradient-to-br from-[#E89BFF]/20 via-[#E89BFF]/10 to-transparent p-5 shadow-[0_20px_60px_rgba(18,18,18,0.08)] sm:p-6 lg:p-8",
              className,
            )}
          >
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#121212]/45">
                {badge}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#121212] sm:text-[2.15rem]">
                {title}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#121212]/62 sm:text-[15px]">
                {description}
              </p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthField({
  children,
  label,
  htmlFor,
  action,
}: {
  children: React.ReactNode;
  label: string;
  htmlFor: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#121212]/55"
        >
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

export const authInputClassName =
  "h-14 rounded-[1.1rem] border border-black/10 bg-white px-4 text-[15px] text-[#121212] shadow-none placeholder:text-[#121212]/35 focus-visible:ring-2 focus-visible:ring-[#E89BFF] focus-visible:ring-offset-0";

export const authPrimaryButtonClassName =
  "h-14 w-full rounded-full bg-[#121212] px-6 text-sm font-bold tracking-[0.16em] text-white uppercase transition-colors hover:bg-[#E89BFF] hover:text-[#121212]";

export const authSecondaryLinkClassName =
  "font-semibold text-[#121212] underline decoration-[#E89BFF] underline-offset-4 transition-colors hover:text-[#E89BFF]";

export function AuthNotice({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.1rem] border px-4 py-3 text-sm leading-6",
        tone === "error" &&
          "border-red-200 bg-red-50 text-red-700",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "default" &&
          "border-black/10 bg-black/[0.03] text-[#121212]/65",
      )}
    >
      {children}
    </div>
  );
}
