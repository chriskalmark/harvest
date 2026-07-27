"use client";

import { useMealPlan } from "@/lib/MealPlanProvider";
import { useTheme } from "@/lib/useTheme";
import { formatWeekRangeDanish } from "@/lib/weekRange";

export default function Header() {
  const { plan } = useMealPlan();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between gap-[18px] px-4 pb-7 pt-6">
      <div className="flex min-w-0 items-center gap-[18px]">
        <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[var(--tint-green)] shadow-[var(--shadow-card)]">
          <svg
            className="h-[58%] w-[58%] overflow-visible"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <g
              className="origin-center animate-[spin_28s_linear_infinite]"
              stroke="var(--harvest-gold)"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <line x1="24" y1="3" x2="24" y2="9" />
              <line x1="24" y1="39" x2="24" y2="45" />
              <line x1="3" y1="24" x2="9" y2="24" />
              <line x1="39" y1="24" x2="45" y2="24" />
              <line x1="9.5" y1="9.5" x2="13.5" y2="13.5" />
              <line x1="34.5" y1="34.5" x2="38.5" y2="38.5" />
              <line x1="38.5" y1="9.5" x2="34.5" y2="13.5" />
              <line x1="13.5" y1="34.5" x2="9.5" y2="38.5" />
            </g>
            <circle
              cx="24"
              cy="24"
              r="9"
              fill="var(--harvest-gold)"
              className="animate-[pulse_4s_ease-in-out_infinite]"
            />
          </svg>
        </div>

        <div className="min-w-0">
          <h1 className="font-serif text-[1.55rem] font-bold leading-none text-harvest-green">
            Harvest
          </h1>
          <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {plan?.weekRange
              ? formatWeekRangeDanish(plan.weekRange)
              : "Venter på første menu"}
          </p>
        </div>
      </div>

      <button
        onClick={toggleTheme}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] shadow-sm transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-label="Skift mellem lyst og mørkt tema"
      >
        {isDark === null ? null : isDark ? (
          // Sun icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--harvest-gold)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        ) : (
          // Moon icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--harvest-green)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </button>
    </header>
  );
}
