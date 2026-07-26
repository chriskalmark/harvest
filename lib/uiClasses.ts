export const sectionLabelClass =
  "text-[10px] font-bold uppercase tracking-[0.2em] text-harvest-green";

export const sectionLabelMutedClass =
  "text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]";

export const sectionLabelColorClass = {
  green: "text-[10px] font-bold uppercase tracking-[0.2em] text-harvest-green",
  terracotta: "text-[10px] font-bold uppercase tracking-[0.2em] text-harvest-terracotta",
  purple: "text-[10px] font-bold uppercase tracking-[0.2em] text-harvest-purple",
} as const;

export const cardClass =
  "rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-[var(--shadow-card)]";

export const cardInteractiveClass =
  `${cardClass} transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]`;

export const inputClass =
  "w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--tint-stone)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-harvest-green focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

export const buildPillClassByLabel: Record<string, string> = {
  Protein:
    "rounded-full bg-[var(--c-pro-tint)] text-[var(--c-pro)] border border-[var(--c-pro)]/30 font-semibold",
  Base:
    "rounded-full bg-[var(--c-carb-tint)] text-[var(--c-carb)] border border-[var(--c-carb)]/30",
  Veg:
    "rounded-full bg-[var(--c-pro-tint)] text-[var(--c-pro)] border border-[var(--c-pro)]/30",
  Engine:
    "rounded-full bg-[var(--c-fat-tint)] text-[var(--c-fat)] border border-[var(--c-fat)]/30 font-semibold",
};
