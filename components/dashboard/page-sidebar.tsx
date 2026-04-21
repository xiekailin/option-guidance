"use client";

import { memo, useEffect, useRef, type Dispatch, type FocusEvent, type MouseEvent, type ReactNode, type SetStateAction } from "react";
import { BarChart3, Activity, CalendarDays, GitCompareArrows, Layers, LineChart, ShieldAlert, Sparkles } from "lucide-react";

export type SectionKey = "market" | "recommendations" | "calculator" | "comparison" | "volatility" | "panorama" | "calendar" | "risk";

interface NavItem {
  key: SectionKey;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  href: `#${SectionKey}`;
}

const navItems: NavItem[] = [
  { key: "market", label: "市场概览", shortLabel: "市场", icon: <LineChart className="size-4" />, href: "#market" },
  { key: "recommendations", label: "策略推荐", shortLabel: "推荐", icon: <Sparkles className="size-4" />, href: "#recommendations" },
  { key: "calculator", label: "损益计算", shortLabel: "损益", icon: <BarChart3 className="size-4" />, href: "#calculator" },
  { key: "comparison", label: "策略对比", shortLabel: "对比", icon: <GitCompareArrows className="size-4" />, href: "#comparison" },
  { key: "volatility", label: "波动率", shortLabel: "波动率", icon: <Activity className="size-4" />, href: "#volatility" },
  { key: "panorama", label: "期权全景", shortLabel: "全景", icon: <Layers className="size-4" />, href: "#panorama" },
  { key: "calendar", label: "到期日历", shortLabel: "日历", icon: <CalendarDays className="size-4" />, href: "#calendar" },
  { key: "risk", label: "风险提示", shortLabel: "风险", icon: <ShieldAlert className="size-4" />, href: "#risk" },
];

export { navItems };

interface SectionNavProps {
  activeSection: SectionKey;
  onNavigate: (section: SectionKey, event: MouseEvent<HTMLAnchorElement>) => void;
}

interface PageSidebarProps extends SectionNavProps {
  isExpanded: boolean;
  setIsExpanded: Dispatch<SetStateAction<boolean>>;
}

export const PageSidebar = memo(function PageSidebar({ activeSection, onNavigate, isExpanded, setIsExpanded }: PageSidebarProps) {
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearTimers(), []);

  const openSoon = () => {
    if (isExpanded) {
      return;
    }
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current == null) {
      openTimerRef.current = window.setTimeout(() => {
        setIsExpanded(true);
        openTimerRef.current = null;
      }, 170);
    }
  };

  const openNow = () => {
    clearTimers();
    setIsExpanded(true);
  };

  const closeSoon = () => {
    if (!isExpanded) {
      clearTimers();
      return;
    }
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      closeTimerRef.current = null;
    }, 180);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    closeSoon();
  };

  return (
    <aside className="hidden xl:fixed xl:left-[max(1rem,calc((100vw-1440px)/2+2rem))] xl:top-1/2 xl:z-50 xl:block xl:-translate-y-1/2">
      <div onMouseEnter={openSoon} onMouseLeave={closeSoon} onFocusCapture={openNow} onBlurCapture={handleBlur} className="relative">
        <nav aria-label="页面功能导航" className="relative">
          <div className="panel-surface relative z-10 overflow-hidden rounded-[26px] border-white/8 shadow-[0_10px_24px_-18px_rgba(2,6,23,0.82)]">
            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/20 to-transparent" />
            <div className="space-y-2 px-2 py-2.5">
              {navItems.map((item) => {
                const isActive = item.key === activeSection;
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    onClick={(event) => onNavigate(item.key, event)}
                    aria-current={isActive ? "location" : undefined}
                    aria-label={item.label}
                    className={`group relative flex items-center overflow-hidden rounded-[20px] border py-2.5 transition-[border-color,background-color,box-shadow,padding-right] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                      isExpanded ? "pr-3" : "pr-0"
                    } ${
                      isActive
                        ? "border-cyan-400/28 bg-[linear-gradient(180deg,rgba(18,50,70,0.9),rgba(9,24,36,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_18px_-14px_rgba(34,211,238,0.45)]"
                        : "border-white/6 bg-[linear-gradient(180deg,rgba(7,13,25,0.96),rgba(5,10,18,0.9))] hover:border-cyan-400/14 hover:bg-[linear-gradient(180deg,rgba(11,22,38,0.96),rgba(8,16,28,0.92))]"
                    }`}
                  >
                    <div className={`pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-cyan-300 transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30"}`} />
                    <span className="flex w-[70px] shrink-0 justify-center">
                      <span
                        className={`relative flex size-12 items-center justify-center rounded-[18px] border transition-[border-color,background-color,color,transform] duration-150 ${
                          isActive
                            ? "border-cyan-300/22 bg-cyan-400/10 text-cyan-100"
                            : "border-white/7 bg-slate-950/55 text-slate-500 group-hover:border-cyan-400/14 group-hover:bg-cyan-400/[0.04] group-hover:text-slate-200"
                        }`}
                      >
                        <span className={`transition-transform duration-150 ${isActive ? "scale-105" : "group-hover:scale-105"}`}>{item.icon}</span>
                      </span>
                    </span>
                    <span
                      aria-hidden={!isExpanded}
                      className="min-w-0 overflow-hidden whitespace-nowrap text-[13px] font-medium tracking-[0.02em] text-slate-200 transition-[opacity,max-width,transform] duration-180"
                      style={{
                        maxWidth: isExpanded ? 108 : 0,
                        opacity: isExpanded ? 1 : 0,
                        transform: `translateX(${isExpanded ? 0 : -8}px)`,
                      }}
                    >
                      {item.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
});

export const PageTabs = memo(function PageTabs({ activeSection, onNavigate }: SectionNavProps) {
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement || navElement.offsetParent === null) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const activeLink = navElement.querySelector<HTMLAnchorElement>(`a[href="#${activeSection}"]`);
      if (!activeLink) {
        return;
      }

      const targetLeft = activeLink.offsetLeft - (navElement.clientWidth - activeLink.clientWidth) / 2;
      navElement.scrollTo({ left: Math.max(targetLeft, 0), behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSection]);

  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 xl:hidden">
      <nav
        ref={navRef}
        aria-label="页面功能导航"
        className="panel-surface flex gap-2 overflow-x-auto rounded-[24px] p-2 shadow-[0_10px_24px_-16px_rgba(2,6,23,0.8)]"
      >
        {navItems.map((item) => {
          const isActive = item.key === activeSection;
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={(event) => onNavigate(item.key, event)}
              aria-current={isActive ? "location" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-[18px] border px-4 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                isActive
                  ? "border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,211,238,0.08))] text-cyan-100 shadow-[0_6px_20px_-6px_rgba(34,211,238,0.3)]"
                  : "border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
            >
              <span className={isActive ? "text-cyan-200" : "text-slate-500"}>{item.icon}</span>
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
});
