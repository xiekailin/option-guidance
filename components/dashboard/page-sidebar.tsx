"use client";

import { memo } from "react";
import { BarChart3, Activity, GitCompareArrows, ShieldAlert, Sparkles } from "lucide-react";

export type TabKey = "recommendations" | "calculator" | "comparison" | "volatility" | "risk";

interface NavItem {
  key: TabKey;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { key: "recommendations", label: "策略推荐", shortLabel: "推荐", icon: <Sparkles className="size-4" /> },
  { key: "calculator", label: "损益计算", shortLabel: "损益", icon: <BarChart3 className="size-4" /> },
  { key: "comparison", label: "策略对比", shortLabel: "对比", icon: <GitCompareArrows className="size-4" /> },
  { key: "volatility", label: "波动率", shortLabel: "波动率", icon: <Activity className="size-4" /> },
  { key: "risk", label: "风险提示", shortLabel: "风险", icon: <ShieldAlert className="size-4" /> },
];

export { navItems };

export const PageSidebar = memo(function PageSidebar({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <aside className="hidden w-52 shrink-0 xl:block">
      <nav className="sticky top-6 rounded-2xl border border-white/8 bg-slate-950/75 p-3 shadow-lg shadow-black/10">
        <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">功能导航</p>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.key === activeTab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-cyan-400/15 text-cyan-200 font-medium"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                }`}
              >
                <span className={isActive ? "text-cyan-400" : ""}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
});

export const PageTabs = memo(function PageTabs({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto xl:hidden">
      {navItems.map((item) => {
        const isActive = item.key === activeTab;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition ${
              isActive
                ? "bg-cyan-400/15 text-cyan-200"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
            }`}
          >
            {item.icon}
            <span className="sm:hidden">{item.shortLabel}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
});
