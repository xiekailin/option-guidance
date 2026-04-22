"use client";

import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";

export type TerminalSectionKey = "overview" | "scenarios" | "strategies" | "checklist" | "workflow" | "mistakes" | "about";

export interface TerminalNavItem {
  key: TerminalSectionKey;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  href: `#${TerminalSectionKey}`;
}

interface NavProps {
  navItems: TerminalNavItem[];
  activeSection: TerminalSectionKey;
  visitedSections?: TerminalSectionKey[];
  onNavigate: (section: TerminalSectionKey, event: MouseEvent<HTMLAnchorElement>) => void;
}

export function TerminalSidebar({ navItems, activeSection, visitedSections = [], onNavigate }: NavProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

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

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      const root = rootRef.current;
      if (!(root instanceof HTMLElement) || !(document.activeElement instanceof HTMLElement) || !root.contains(document.activeElement)) {
        return;
      }

      clearTimers();
      setIsExpanded(false);
      const fallbackTarget = activeLinkRef.current ?? document.activeElement;
      if (fallbackTarget instanceof HTMLElement) {
        fallbackTarget.focus();
      }
    };

    document.addEventListener("keydown", handleEscape, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleEscape, { capture: true });
      clearTimers();
    };
  }, []);

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
    <aside className="hidden lg:fixed lg:left-[max(1rem,calc((100vw-1600px)/2+1.35rem))] lg:top-1/2 lg:z-50 lg:block lg:-translate-y-1/2">
      <div
        ref={rootRef}
        onMouseEnter={openSoon}
        onMouseLeave={closeSoon}
        onFocusCapture={openNow}
        onBlurCapture={handleBlur}
        className="relative"
      >
        <nav aria-label="2.0 页面导航" className="relative">
          <div className="panel-surface relative z-20 w-[76px] overflow-hidden rounded-[28px] border-white/8 shadow-[0_12px_28px_-18px_rgba(2,6,23,0.82)]">
            <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/20 to-transparent" />
            <div className="space-y-2 px-2 py-2.5">
              {navItems.map((item) => {
                const isActive = item.key === activeSection;
                const isVisited = visitedSections.includes(item.key);
                return (
                  <a
                    key={item.key}
                    ref={isActive ? activeLinkRef : undefined}
                    href={item.href}
                    onClick={(event) => onNavigate(item.key, event)}
                    aria-current={isActive ? "location" : undefined}
                    aria-label={item.label}
                    className={`group relative flex h-[68px] items-center justify-center overflow-hidden rounded-[20px] border transition-[border-color,background-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                      isActive
                        ? "border-cyan-400/28 bg-[linear-gradient(180deg,rgba(18,50,70,0.9),rgba(9,24,36,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_18px_-14px_rgba(34,211,238,0.45)]"
                        : "border-white/6 bg-[linear-gradient(180deg,rgba(7,13,25,0.96),rgba(5,10,18,0.9))] hover:border-cyan-400/14 hover:bg-[linear-gradient(180deg,rgba(11,22,38,0.96),rgba(8,16,28,0.92))]"
                    }`}
                  >
                    <div className={`pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-cyan-300 transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30"}`} />
                    <span
                      data-visited={isVisited && !isActive ? "true" : undefined}
                      className={`relative flex size-12 items-center justify-center rounded-[18px] border transition-[border-color,background-color,color,transform] duration-150 ${
                        isActive
                          ? "border-cyan-300/22 bg-cyan-400/10 text-cyan-100 scale-105"
                          : isVisited
                            ? "border-white/10 bg-white/[0.045] text-slate-200"
                            : "border-white/7 bg-slate-950/55 text-slate-500 group-hover:border-cyan-400/14 group-hover:bg-cyan-400/[0.04] group-hover:text-slate-200 group-hover:scale-105"
                      }`}
                    >
                      {item.icon}
                      {isVisited && !isActive ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-cyan-200/75" /> : null}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          <div
            aria-hidden="true"
            className={`panel-surface-strong pointer-events-none absolute left-[76px] top-0 z-10 w-[132px] rounded-[26px] border-white/10 shadow-[0_18px_42px_-24px_rgba(2,6,23,0.82)] transition-[opacity,transform] duration-180 ${
              isExpanded ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"
            }`}
          >
            <div className="pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-cyan-200/18 to-transparent" />
            <div className="space-y-2 px-3 py-2.5 pl-4">
              {navItems.map((item) => {
                const isActive = item.key === activeSection;
                const isVisited = visitedSections.includes(item.key);
                return (
                  <div
                    key={item.key}
                    className={`flex h-[68px] items-center rounded-[18px] px-3 text-[12px] font-medium tracking-[0.03em] transition-[background-color,color,transform] duration-150 ${
                      isActive
                        ? "bg-[linear-gradient(180deg,rgba(17,49,67,0.46),rgba(8,21,33,0.18))] text-cyan-50"
                        : "text-slate-300/88"
                    }`}
                  >
                    <span className="transition-transform duration-150">{item.label}</span>
                    {isVisited && !isActive ? <span className="ml-auto size-1.5 rounded-full bg-cyan-200/75" /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}

export function TerminalTabs({ navItems, activeSection, visitedSections = [], onNavigate }: NavProps) {
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
    <div className="sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 lg:hidden">
      <nav
        ref={navRef}
        aria-label="2.0 页面导航"
        className="panel-surface flex gap-2 overflow-x-auto rounded-[24px] p-2 shadow-[0_10px_24px_-16px_rgba(2,6,23,0.8)]"
      >
        {navItems.map((item) => {
          const isActive = item.key === activeSection;
          const isVisited = visitedSections.includes(item.key);
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={(event) => onNavigate(item.key, event)}
              aria-current={isActive ? "location" : undefined}
              data-visited={isVisited && !isActive ? "true" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-[18px] border px-4 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16] ${
                isActive
                  ? "border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,211,238,0.08))] text-cyan-100 shadow-[0_6px_20px_-6px_rgba(34,211,238,0.3)]"
                  : "border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
            >
              <span className={isActive ? "text-cyan-200" : isVisited ? "text-slate-300" : "text-slate-500"}>{item.icon}</span>
              <span className="sm:hidden">{item.shortLabel}</span>
              {isVisited && !isActive ? <span className="size-1.5 rounded-full bg-cyan-200/75" /> : null}
              <span className="hidden sm:inline">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
