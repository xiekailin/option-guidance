"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-4 sm:px-4 sm:py-8" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div className="fixed inset-0 bg-slate-950/82" onClick={onClose} />

      <div className="panel-surface-strong relative z-10 my-auto w-full max-w-5xl overflow-hidden rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-200/75">策略说明</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[16px] border border-white/10 p-2 text-slate-400 transition hover:border-cyan-400/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
