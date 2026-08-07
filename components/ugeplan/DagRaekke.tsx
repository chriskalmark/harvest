"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import DagFoto from "@/components/ugeplan/DagFoto";
import {
  daySubtitle,
  dayTitle,
  formatDayDate,
  isPast,
  isToday,
} from "@/lib/weekPlan/view";
import type { WeekPlanDay } from "@/lib/weekPlan/types";

/**
 * Én af ugens syv aftener.
 *
 * "lead" er den store: i dag, eller mandag naar i dag ligger uden for ugen.
 * Resten er taettere raekker. Stoerrelsen fortaeller hvad der er vigtigst --
 * derfor er det en varieret liste og ikke syv ens kort i et gitter.
 *
 * Hele raekken er knappen. Man rammer den med tommelfingeren uden at sigte,
 * og de tomme dage er lige saa trykbare som de fyldte -- det er jo dem man
 * skal ind i.
 */
export default function DagRaekke({
  day,
  variant,
  isSaving = false,
  onOpen,
}: {
  day: WeekPlanDay;
  variant: "lead" | "compact";
  isSaving?: boolean;
  onOpen: () => void;
}) {
  const lead = variant === "lead";
  const empty = day.slotKind === "empty";
  const today = isToday(day.date);
  const past = isPast(day.date);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${day.dayName} ${formatDayDate(day.date)} — ${dayTitle(day)}`}
      className={`flex w-full items-center gap-4 border-b border-[var(--border-subtle)] text-left transition last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] active:scale-[0.995] ${
        lead ? "py-5" : "py-4"
      }`}
    >
      <DagFoto
        slotKind={day.slotKind}
        imageUrl={day.recipe?.imageUrl ?? null}
        title={day.title}
        size={lead ? 104 : 60}
        priority={lead}
      />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
              past
                ? "text-[var(--text-muted)]"
                : "text-[var(--harvest-green-ink)]"
            }`}
          >
            {day.dayName}
          </span>
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {formatDayDate(day.date)}
          </span>
          {today ? (
            <span className="rounded-full bg-[var(--tint-gold)] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--harvest-gold-ink)]">
              I dag
            </span>
          ) : null}
        </span>

        <span
          className={`mt-1 block break-words font-serif font-bold leading-[1.15] tracking-[-0.015em] ${
            lead ? "text-[1.32rem]" : "text-[1.02rem]"
          } ${empty ? "text-[var(--harvest-green-ink)]" : "text-[var(--foreground)]"}`}
        >
          {dayTitle(day)}
        </span>

        <span
          className={`mt-1 block text-[var(--text-muted)] ${
            lead ? "text-[0.86rem] leading-[1.45]" : "text-[0.8rem]"
          }`}
        >
          {daySubtitle(day)}
        </span>
      </span>

      <span className="ml-auto flex h-11 w-8 shrink-0 items-center justify-center text-[var(--text-muted)]">
        {isSaving ? (
          <Loader2 size={18} className="animate-spin text-harvest-green" />
        ) : (
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
