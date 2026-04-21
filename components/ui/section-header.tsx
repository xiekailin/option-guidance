import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export function SectionHeader({ icon: Icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      {Icon ? (
        <div className="flex size-10 items-center justify-center rounded-[16px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
          <Icon className="size-5" />
        </div>
      ) : null}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        {description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
      </div>
    </div>
  );
}
