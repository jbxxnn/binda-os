// import { ChevronDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react"; 
import { UserAiIcon } from "@hugeicons/core-free-icons";

type AppTopbarProps = {
  businessName: string;
  userName: string;
};

export function AppTopbar({ businessName, userName }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white backdrop-blur shadow-[0_12px_30px_rgba(18,18,18,0.04)]">
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 bg-white px-5 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
              Binda
            </span>
            <div className="h-6 w-px bg-black/10" />
            <span className="text-sm font-semibold text-slate-900">
              {businessName}
            </span>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#fbf4ff] px-2.5 py-2.5 text-sm font-semibold text-slate-900"
          >
            {/* {userName} */}
            {/* <ChevronDown className="h-4 w-4" /> */}
            <HugeiconsIcon
              icon={UserAiIcon}
              size={16}
              color="currentColor"
              strokeWidth={1}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
