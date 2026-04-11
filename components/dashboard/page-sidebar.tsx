"use client";

import { BarChart3, Activity, GitCompareArrows, ShieldAlert, Sparkles } from "lucide-react";

export type TabKey = "recommendations" | "calculator" | "comparison" | "volatility" | "risk";

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { key: "recommendations", label: "策略推荐", icon: <Sparkles className="size-4" /> },
  { key: "calculator", label: "损益计算", icon: <BarChart3 className="size-4" /> },
  { key: "comparison", label: "策略对比", icon: <GitCompareArrows className="size-4" /> },
  { key: "volatility", label: "波动率", icon: <Activity className="size-4" /> },
  { key: "risk", label: "风险提示", icon: <ShieldAlert className="size-4" /> },
];

export { navItems };

export function PageSidebar({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <nav className="sticky top-8 space-y-1">
        {navItems.map((item) => {
          const isActive = item.key === activeTab;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                  : "text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function PageTabs({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 xl:hidden">
      {navItems.map((item) => {
        const isActive = item.key === activeTab;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${
              isActive
                ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
