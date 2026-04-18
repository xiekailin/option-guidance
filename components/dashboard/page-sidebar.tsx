"use client";

import { memo } from "react";
import { BarChart3, Activity, GitCompareArrows, LineChart, ShieldAlert, Sparkles } from "lucide-react";

export type TabKey = "market" | "recommendations" | "calculator" | "comparison" | "volatility" | "risk";

interface NavItem {
  key: TabKey;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { key: "market", label: "市场概览", shortLabel: "市场", icon: <LineChart className="size-4" /> },
  { key: "recommendations", label: "策略推荐", shortLabel: "推荐", icon: <Sparkles className="size-4" /> },
  { key: "calculator", label: "损益计算", shortLabel: "损益", icon: <BarChart3 className="size-4" /> },
  { key: "comparison", label: "策略对比", shortLabel: "对比", icon: <GitCompareArrows className="size-4" /> },
  { key: "volatility", label: "波动率", shortLabel: "波动率", icon: <Activity className="size-4" /> },
  { key: "risk", label: "风险提示", shortLabel: "风险", icon: <ShieldAlert className="size-4" /> },
];

export { navItems };

export const PageSidebar = memo(function PageSidebar({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (tab: TabKey) => void }) {
  return (
    <aside className="hidden w-60 shrink-0 xl:block">
      <nav aria-label="页面功能导航" role="tablist" className="panel-surface sticky top-6 overflow-hidden rounded-[30px] p-4">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <div className="relative px-2 pb-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/75">功能导航</p>
          <p className="mt-3 text-sm font-medium text-white">作战面板</p>
          <p className="mt-1 text-xs leading-6 text-slate-400">从市场到推荐、再到损益和风险，顺着看一轮最省脑力。</p>
        </div>
        <div className="space-y-1.5">
          {navItems.map((item, index) => {
            const isActive = item.key === activeTab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                className={`group flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                  isActive
                    ? "border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,211,238,0.07))] text-white shadow-[0_6px_20px_-6px_rgba(34,211,238,0.3)]"
                    : "border-transparent bg-white/[0.02] text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-2xl border transition ${
                    isActive
                      ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-slate-950/60 text-slate-500 group-hover:border-white/15 group-hover:text-slate-200"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-1 block text-[11px] uppercase tracking-[0.28em] text-slate-500 transition group-hover:text-slate-400">
                    0{index + 1}
                  </span>
                </span>
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
    <nav aria-label="页面功能标签" role="tablist" className="panel-surface flex gap-2 overflow-x-auto rounded-[24px] p-2 xl:hidden">
      {navItems.map((item) => {
        const isActive = item.key === activeTab;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            className={`flex shrink-0 items-center gap-2 rounded-[18px] border px-4 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
              isActive
                ? "border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,211,238,0.08))] text-cyan-100 shadow-[0_6px_20px_-6px_rgba(34,211,238,0.3)]"
                : "border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200"
            }`}
          >
            <span className={isActive ? "text-cyan-200" : "text-slate-500"}>{item.icon}</span>
            <span className="sm:hidden">{item.shortLabel}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
});
