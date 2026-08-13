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
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Home", icon: Home, href: "/app", active: true },
  { label: "Transactions", icon: ClipboardList, href: "/app", active: false },
  { label: "Customers", icon: Users, href: "/app", active: false },
  { label: "Services", icon: Scissors, href: "/app", active: false },
  { label: "Staff", icon: ShieldUser, href: "/app", active: false },
  { label: "Reports", icon: FileBarChart2, href: "/app", active: false },
  { label: "Settings", icon: Settings, href: "/app", active: false },
] as const;

export function AppSidebar() {
  return (
    <aside className="flex h-full min-h-screen w-full flex-col border-r border-white/8 bg-[#121212] text-white">
      <div className="sticky top-0 flex h-screen flex-col px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
        <Link
          href="/app"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-white"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#E89BFF]" />
          Binda Salon OS
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
                  item.active
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
