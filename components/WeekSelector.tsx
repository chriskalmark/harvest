"use client";

import { WeekOption } from "@/lib/types";
import { getWeekStartDateOnly, toSortValueFromDateOnly } from "@/lib/weekRange";

interface WeekSelectorProps {
  weeks: WeekOption[];
  selectedWeekRange: string | null;
  onChange: (weekRange: string) => void;
  compact?: boolean;
}

export default function WeekSelector({
  weeks,
  selectedWeekRange,
  onChange,
  compact = false,
}: WeekSelectorProps) {
  if (!weeks.length) {
    if (compact) {
      return null;
    }
    return (
      <label className={compact ? "" : "mb-4 block"}>
        {!compact && (
          <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-harvest-terracotta">
            Uge
          </span>
        )}
        <div
          className={`rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3 shadow-[0_8px_24px_rgba(77,65,45,0.08)] animate-pulse dark:border-[var(--card-border)] dark:bg-[var(--card-border)] dark:shadow-[0_8px_24px_rgba(45,90,39,0.06)]`}
        >
          <div className="h-5 w-full rounded bg-[var(--tint-stone)]" />
        </div>
      </label>
    );
  }

  // Determine the default week: if nothing selected, use current week; otherwise use selected
  const displayValue = (() => {
    if (selectedWeekRange) return selectedWeekRange;
    const currentSortValue = toSortValueFromDateOnly(getWeekStartDateOnly());
    return (
      weeks.find((w) => w.sortValue === currentSortValue)?.weekRange ??
      weeks[0]?.weekRange ??
      ""
    );
  })();

  return (
    <label className={compact ? "" : "mb-4 block"}>
      {!compact && (
        <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-harvest-terracotta">
          Uge
        </span>
      )}
      <div
        className={`rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-2 shadow-[0_8px_24px_rgba(77,65,45,0.08)] dark:border-[var(--card-border)] dark:bg-[var(--card-border)] dark:shadow-[0_8px_24px_rgba(45,90,39,0.06)] ${compact ? "py-2" : "py-3"}`}
      >
        <select
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full min-h-11 bg-transparent text-sm font-semibold text-harvest-green outline-none"
        >
          {weeks.map((week) => (
            <option key={week.id} value={week.weekRange}>
              {week.displayLabel}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
