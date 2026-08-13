"use client";

import { AppSidebar } from "@/components/app/app-sidebar";
import { useAppSession } from "@/components/app/app-session-provider";
import { AppTopbar } from "@/components/app/app-topbar";

function AppWorkspaceShell({ children }: { children: React.ReactNode }) {
  const { businessName, userName } = useAppSession();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="flex min-h-screen flex-col">
        <div className="border-b border-black/10 bg-white px-4 py-4 md:hidden">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#121212]">
            Binda Salon OS
          </span>
        </div>
        <AppTopbar businessName={businessName} userName={userName} />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function AppWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppWorkspaceShell>{children}</AppWorkspaceShell>;
}
