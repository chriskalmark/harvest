"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import DagArk from "@/components/ugeplan/DagArk";
import DagRaekke from "@/components/ugeplan/DagRaekke";
import { useWeekPlan } from "@/lib/hooks/useUgeplan";
import { buildHref } from "@/lib/urlState";
import type { WeekPlan } from "@/lib/weekPlan/types";
import {
  leadWeekday,
  relativeWeekName,
  shiftWeek,
  weekHeadline,
  weekNumberLabel,
  weekRangeLabel,
  weekSummary,
} from "@/lib/weekPlan/view";
import {
  mondayOf,
  normalizeWeekStart,
  todayDateOnly,
} from "@/lib/weekPlan/week";

/**
 * Ugeplanen: mandag til søndag, én aftensmad pr. dag.
 *
 * Skærmen holder ugen i adressen (?uge=ÅÅÅÅ-MM-DD), saa et genindlæs, en
 * bogmaerke eller et delt link lander samme sted. Er der intet i adressen,
 * er det indeværende uge -- det er den man staar i.
 *
 * Den grønne flade er --field-green og ikke --harvest-green: hvid tekst paa
 * den lyse grønne rammer kun 3,48:1 og falder for AA under 24px.
 */
export default function UgeplanSkaerm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  // En ugyldig ?uge= skal ikke vaelte skaermen -- den lander bare paa denne uge.
  const weekStart = useMemo(() => {
    const raw = searchParams.get("uge");
    try {
      return normalizeWeekStart(raw);
    } catch {
      return mondayOf(todayDateOnly());
    }
  }, [searchParams]);

  const plan = useWeekPlan(weekStart);
  const [openWeekday, setOpenWeekday] = useState<number | null>(null);

  const goToWeek = useCallback(
    (monday: string) => {
      setOpenWeekday(null);
      router.replace(buildHref(pathname, queryString, { uge: monday }), {
        scroll: false,
      });
    },
    [pathname, queryString, router],
  );

  const openDay = plan.weekPlan?.days.find(
    (day) => day.weekday === openWeekday,
  );

  return (
    <main className="pb-10">
      <UgeHero
        weekStart={weekStart}
        weekPlan={plan.weekPlan}
        onGoToWeek={goToWeek}
      />

      <section className="relative -mt-5 rounded-[34px] bg-[var(--surface-1)] px-4 pb-6 pt-5">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--harvest-green-ink)]">
          Aftensmad
        </h2>

        {plan.loadError ? (
          <div className="rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-4">
            <p
              role="alert"
              className="text-[0.95rem] font-medium text-[var(--harvest-terracotta-ink)]"
            >
              {plan.loadError}
            </p>
            <button
              type="button"
              onClick={plan.reload}
              className="mt-2 min-h-[44px] text-[0.95rem] font-semibold text-[var(--harvest-green-ink)]"
            >
              Prøv igen
            </button>
          </div>
        ) : plan.isLoading || !plan.weekPlan ? (
          <UgeSkelet />
        ) : (
          <DagListe
            weekPlan={plan.weekPlan}
            savingWeekday={plan.savingWeekday}
            onOpenDay={setOpenWeekday}
          />
        )}
      </section>

      {openDay ? (
        <DagArk
          day={openDay}
          isSaving={plan.savingWeekday !== null}
          saveError={plan.saveError}
          onClose={() => {
            plan.clearSaveError();
            setOpenWeekday(null);
          }}
          onPickRecipe={(recipeId) => plan.setRecipe(openDay.weekday, recipeId)}
          onSaveManual={(title) => plan.setManualDish(openDay.weekday, title)}
          onClear={() => plan.clearDay(openDay.weekday)}
          onSetPortions={(portions) =>
            plan.setPortions(openDay.weekday, portions)
          }
        />
      ) : null}
    </main>
  );
}

function UgeHero({
  weekStart,
  weekPlan,
  onGoToWeek,
}: {
  weekStart: string;
  weekPlan: WeekPlan | null;
  onGoToWeek: (monday: string) => void;
}) {
  // Overskriften venter paa tallene, saa den ikke naar at sige "Ugen ligger
  // åben" i det halve sekund det tager at hente en uge der er fuld.
  const planned = weekPlan?.plannedDays ?? null;
  const headline = weekHeadline(planned ?? 0);
  const relative = relativeWeekName(weekStart);
  const isThisWeek = relative === "Denne uge";

  return (
    <div className="rounded-[34px] bg-[var(--field-green)] px-5 pb-9 pt-3 text-[var(--field-ink)]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Forrige uge"
          onClick={() => onGoToWeek(shiftWeek(weekStart, -1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[oklch(1_0_0_/_0.16)] transition active:scale-90"
        >
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>

        <div className="min-w-0 text-center">
          <p className="font-serif text-[1.1rem] font-bold leading-none">
            {weekNumberLabel(weekStart)}
          </p>
          <p className="mt-1.5 truncate text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--field-ink-soft)]">
            {relative ?? weekRangeLabel(weekStart)}
          </p>
        </div>

        <button
          type="button"
          aria-label="Næste uge"
          onClick={() => onGoToWeek(shiftWeek(weekStart, 1))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[oklch(1_0_0_/_0.16)] transition active:scale-90"
        >
          <ChevronRight size={20} strokeWidth={2.4} />
        </button>
      </div>

      <h1 className="mt-6 font-serif text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em]">
        {headline.line1}
        <br />
        {headline.line2}
      </h1>

      <p className="mt-3 text-[0.9rem] font-medium text-[var(--field-ink-soft)]">
        {planned === null ? weekRangeLabel(weekStart) : weekSummary(planned)}
      </p>

      {isThisWeek ? null : (
        <button
          type="button"
          onClick={() => onGoToWeek(mondayOf(todayDateOnly()))}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--field-line)] px-4 text-[0.85rem] font-semibold"
        >
          <RotateCcw size={15} strokeWidth={2.4} aria-hidden="true" />
          Tilbage til denne uge
        </button>
      )}
    </div>
  );
}

/**
 * De syv aftener, mandag til søndag.
 *
 * Én af dem fylder mere: i dag, naar i dag ligger i ugen, ellers mandag. Den
 * bliver STAAENDE paa sin plads i ugen -- den bliver ikke trukket op i toppen.
 * En uge man skal kunne overskue er mandag til søndag; havde torsdag ligget
 * øverst, ville rækkefølgen holde op med at være en uge. Størrelsen fortæller
 * hvad der er vigtigst, rækkefølgen fortæller hvornår.
 */
function DagListe({
  weekPlan,
  savingWeekday,
  onOpenDay,
}: {
  weekPlan: WeekPlan;
  savingWeekday: number | null;
  onOpenDay: (weekday: number) => void;
}) {
  const lead = leadWeekday(weekPlan);

  return (
    <>
      {weekPlan.days.map((day) => (
        <DagRaekke
          key={day.weekday}
          day={day}
          variant={day.weekday === lead ? "lead" : "compact"}
          isSaving={savingWeekday === day.weekday}
          onOpen={() => onOpenDay(day.weekday)}
        />
      ))}
    </>
  );
}

/** Ugen har altid syv pladser -- ogsaa mens den hentes. */
function UgeSkelet() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Henter ugen …</span>
      <div className="flex items-center gap-4 pb-5 pt-1">
        <div className="h-[104px] w-[104px] shrink-0 animate-pulse rounded-full bg-[var(--tint-stone)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--tint-stone)]" />
          <div className="h-5 w-4/5 animate-pulse rounded bg-[var(--tint-stone)]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--tint-stone)]" />
        </div>
      </div>
      {[2, 3, 4, 5, 6, 7].map((weekday) => (
        <div
          key={weekday}
          className="flex items-center gap-4 border-t border-[var(--border-subtle)] py-4"
        >
          <div className="h-[60px] w-[60px] shrink-0 animate-pulse rounded-full bg-[var(--tint-stone)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--tint-stone)]" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-[var(--tint-stone)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
