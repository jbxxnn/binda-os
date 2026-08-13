"use client";

import {
  ClipboardList,
  FileBarChart2,
  Home,
  Sparkles,
  Scissors,
  Settings,
  ShieldUser,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Home", icon: Home, href: "/app" },
  { label: "Transactions", icon: ClipboardList, href: "/app/transactions" },
  { label: "Customers", icon: Users, href: "/app/customers", active: false },
  { label: "Services", icon: Scissors, href: "/app/services", active: false },
  { label: "Staff", icon: ShieldUser, href: "/app/staff", active: false },
  { label: "Reports", icon: FileBarChart2, href: "/app/reports", active: false },
  { label: "Settings", icon: Settings, href: "/app/settings", active: false },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full min-h-screen w-full flex-col border-r border-white/8 bg-[#121212] text-white">
      <div className="sticky top-0 flex h-screen flex-col px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
        <Link
          href="/app"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-white"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#E89BFF]" />
          {/* Binda Salon OS */}
        </Link>

        <nav className="mt-8 grid gap-2">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[0.7rem] px-3 py-3 text-sm font-medium transition-colors",
                  pathname === item.href ||
                    (item.href !== "/app" && pathname.startsWith(`${item.href}/`))
                    ? "bg-[#E89BFF] text-[#121212]"
                    : "text-white/62 hover:bg-white/6 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
