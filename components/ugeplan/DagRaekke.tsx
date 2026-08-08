"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Pencil } from "lucide-react";
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
 * Raekken har to former, og hvilken der bruges afgoeres af om aftenen har en
 * opskrift man kan slaa op:
 *
 *   Katalogret -- raekken er et LINK til opskriften. Naar retten er valgt, er
 *   det den man vil ind i: "hvad laver vi i aften, vis mig fremgangsmaaden".
 *   At skifte ret er sjaeldnere og faar derfor sin egen blyantsknap til hoejre.
 *
 *   Tom aften eller egen ret -- hele raekken er stadig knappen der aabner
 *   dagens ark. Der er ingen opskrift at gaa ind i, saa der er intet at linke
 *   til, og saa skal trykket foere hen hvor man kan vaelge en.
 *
 * Et <a> maa ikke ligge inde i et <button>, saa de to former deler indholdet
 * gennem DagIndhold i stedet for at pakke det ene ind i det andet.
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
  const padding = lead ? "py-5" : "py-4";
  const rowClass = `flex w-full items-center gap-4 border-b border-[var(--border-subtle)] text-left last:border-b-0 ${padding}`;
  const focusClass =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)]";

  const recipeId =
    day.slotKind === "catalog" ? (day.recipe?.recipeId ?? null) : null;
  const dayLabel = `${day.dayName} ${formatDayDate(day.date)}`;

  if (recipeId === null) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${dayLabel} — ${dayTitle(day)}`}
        className={`${rowClass} ${focusClass} transition active:scale-[0.995]`}
      >
        <DagIndhold day={day} lead={lead} />
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

  return (
    <div className={rowClass}>
      <Link
        href={`/opskrift/${recipeId}`}
        aria-label={`Se opskriften ${dayTitle(day)} — ${dayLabel}`}
        className={`flex min-w-0 flex-1 items-center gap-4 ${focusClass} rounded-2xl transition active:scale-[0.995]`}
      >
        <DagIndhold day={day} lead={lead} />
      </Link>

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Skift ret ${day.dayName.toLowerCase()} ${formatDayDate(day.date)}`}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tint-stone)] text-[var(--harvest-green-ink)] ${focusClass} transition active:scale-90`}
      >
        {isSaving ? (
          <Loader2 size={17} className="animate-spin text-harvest-green" />
        ) : (
          <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * Foto, ugedag, ret og underlinje. Præcis det samme uanset om raekken er et
 * link eller en knap -- ellers ville de to former langsomt drive fra hinanden.
 */
function DagIndhold({ day, lead }: { day: WeekPlanDay; lead: boolean }) {
  const empty = day.slotKind === "empty";
  const today = isToday(day.date);
  const past = isPast(day.date);

  return (
    <>
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
    </>
  );
}
