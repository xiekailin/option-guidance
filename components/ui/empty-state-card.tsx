import type { LucideIcon } from "lucide-react";

interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tips?: string[];
  tone?: "default" | "info";
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  tips = [],
  tone = "default",
}: EmptyStateCardProps) {
  const toneClass =
    tone === "info"
      ? {
          wrap: "border-cyan-400/15 bg-cyan-400/[0.06]",
          icon: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
          title: "text-cyan-100",
        }
      : {
          wrap: "border-white/10 bg-white/[0.04]",
          icon: "border-white/10 bg-white/[0.05] text-slate-300",
          title: "text-white",
        };

  return (
    <div role="status" aria-live="polite" className={`mt-5 rounded-[28px] border p-6 sm:p-8 ${toneClass.wrap}`}>
      <div className="mx-auto max-w-2xl text-center">
        <div className={`mx-auto flex size-12 items-center justify-center rounded-[18px] border ${toneClass.icon}`}>
          <Icon className="size-5" />
        </div>
        <h3 className={`mt-4 text-lg font-semibold tracking-tight ${toneClass.title}`}>{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-400">{description}</p>
        {tips.length > 0 ? (
          <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
            {tips.map((tip) => (
              <div key={tip} className="rounded-[20px] border border-white/8 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-slate-300">
                {tip}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
