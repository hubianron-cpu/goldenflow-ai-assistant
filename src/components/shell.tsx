"use client";

import { Bot, BriefcaseBusiness, LayoutDashboard, ListChecks, LogOut, MessageCircle, SlidersHorizontal, UsersRound } from "lucide-react";

export type AppTab = "setup" | "simulator" | "dashboard" | "conversations" | "leads" | "followups" | "control";

type ShellProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

const navItems = [
  { id: "setup", label: "הגדרות", icon: BriefcaseBusiness },
  { id: "simulator", label: "סימולטור", icon: MessageCircle },
  { id: "dashboard", label: "דשבורד", icon: LayoutDashboard },
  { id: "conversations", label: "שיחות", icon: Bot },
  { id: "leads", label: "לידים", icon: UsersRound },
  { id: "followups", label: "פולואפים", icon: ListChecks },
  { id: "control", label: "בקרה", icon: SlidersHorizontal }
] satisfies { id: AppTab; label: string; icon: typeof Bot }[];

export function Shell({ activeTab, onTabChange, onLogout, children }: ShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">GoldenFlow</p>
            <h1 className="text-xl font-bold text-ink sm:text-2xl">AI Assistant</h1>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-semibold text-ink transition hover:border-gold"
          >
            <LogOut size={18} />
            יציאה
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                  isActive ? "bg-ink text-white" : "bg-white text-ink hover:bg-black/5"
                }`}
                title={item.label}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
