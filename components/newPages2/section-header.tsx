interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.9rem]">{title}</h2>
      <p className="max-w-3xl text-sm leading-7 text-slate-400">{description}</p>
    </div>
  );
}
