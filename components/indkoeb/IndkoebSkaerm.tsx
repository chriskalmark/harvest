"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  UtensilsCrossed,
} from "lucide-react";
import { useUgensIndkøb } from "@/lib/hooks/useUgensIndkoeb";
import { buildHref } from "@/lib/urlState";
import { indkøbHeadline, indkøbSummary } from "@/lib/weekPlan/indkoebView";
import {
  relativeWeekName,
  shiftWeek,
  weekNumberLabel,
  weekRangeLabel,
} from "@/lib/weekPlan/view";
import {
  mondayOf,
  normalizeWeekStart,
  todayDateOnly,
} from "@/lib/weekPlan/week";
import type { IndkøbsVare } from "@/lib/weekPlan/indkoeb";

/**
 * Ugens indkøb.
 *
 * Listen er ugeplanen, regnet om til varer. Derfor kan man ikke tilføje
 * eller slette noget her -- man ændrer ugen, og listen følger med. Det er
 * også derfor tomme uger ikke siger "ingen varer", men peger på ugeplanen.
 *
 * Ugen står i adressen (?uge=ÅÅÅÅ-MM-DD), præcis som på ugeplanen, så de to
 * skærme kan følges ad og et link kan deles.
 */
export default function IndkoebSkaerm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [skjulKlaret, setSkjulKlaret] = useState(false);

  const weekStart = useMemo(() => {
    const rå = searchParams.get("uge");
    try {
      return normalizeWeekStart(rå);
    } catch {
      return mondayOf(todayDateOnly());
    }
  }, [searchParams]);

  const indkøb = useUgensIndkøb(weekStart);

  const goToWeek = useCallback(
    (monday: string) => {
      router.replace(buildHref(pathname, queryString, { uge: monday }), {
        scroll: false,
      });
    },
    [pathname, queryString, router],
  );

  const liste = indkøb.indkøb?.liste ?? null;

  return (
    <main className="pb-10">
      <IndkøbHero
        weekStart={weekStart}
        liste={liste}
        antalKlaret={indkøb.antalKlaret}
        onGoToWeek={goToWeek}
      />

      <section className="relative -mt-5 rounded-[34px] bg-[var(--surface-1)] px-4 pb-6 pt-5">
        {indkøb.loadError ? (
          <Fejl besked={indkøb.loadError} onIgen={indkøb.reload} />
        ) : indkøb.isLoading || !liste ? (
          <ListeSkelet />
        ) : liste.antalVarer === 0 && liste.egneRetter.length === 0 ? (
          <TomListe weekStart={weekStart} harAftener={liste.antalAftener > 0} />
        ) : (
          <>
            {indkøb.saveError ? (
              <p
                role="alert"
                className="mb-4 rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-3 text-[0.9rem] font-medium text-[var(--harvest-terracotta-ink)]"
              >
                {indkøb.saveError}
              </p>
            ) : null}

            <Værktøjslinje
              skjulKlaret={skjulKlaret}
              onSkjulKlaret={() => setSkjulKlaret((vis) => !vis)}
              antalKlaret={indkøb.antalKlaret}
              onNulstil={() => void indkøb.nulstil()}
            />

            {liste.afsnit.map((afsnit) => {
              const varer = skjulKlaret
                ? afsnit.varer.filter((vare) => !indkøb.erAfkrydset(vare.key))
                : afsnit.varer;
              if (varer.length === 0) return null;

              return (
                <div key={afsnit.zone} className="mb-7">
                  <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--harvest-green-ink)]">
                    {afsnit.zone}
                  </h2>
                  {varer.map((vare) => (
                    <VareRække
                      key={vare.key}
                      vare={vare}
                      checked={indkøb.erAfkrydset(vare.key)}
                      onToggle={indkøb.toggle}
                    />
                  ))}
                </div>
              );
            })}

            {liste.egneRetter.length > 0 ? (
              <EgneRetter retter={liste.egneRetter} weekStart={weekStart} />
            ) : null}

            {liste.skabet.length > 0 ? (
              <Skabet
                varer={liste.skabet}
                erAfkrydset={indkøb.erAfkrydset}
                onToggle={indkøb.toggle}
              />
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function IndkøbHero({
  weekStart,
  liste,
  antalKlaret,
  onGoToWeek,
}: {
  weekStart: string;
  liste: { antalVarer: number; antalAftener: number } | null;
  antalKlaret: number;
  onGoToWeek: (monday: string) => void;
}) {
  // Overskriften venter paa tallene, saa den ikke naar at sige "ingen retter"
  // i det halve sekund det tager at hente en fuld uge.
  const headline = indkøbHeadline(
    liste?.antalVarer ?? 0,
    antalKlaret,
    liste?.antalAftener ?? 0,
  );
  const relativ = relativeWeekName(weekStart);
  const erDenneUge = relativ === "Denne uge";

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
            {relativ ?? weekRangeLabel(weekStart)}
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

      {/*
        aria-live paa BEGGE linjer.
        Krydser man en vare af, aendrer overskriften sig fra "26 varer at
        hente" til "25 varer tilbage" -- men uden det her sagde
        oplaesningen ingenting, saa man ikke kunne hoere om trykket virkede.
        "polite" og ikke "assertive": det maa gerne vente til saetningen er
        laest faerdig, det haster ikke.
      */}
      <h1
        aria-live="polite"
        className="mt-6 font-serif text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em]"
      >
        {headline.line1}
        <br />
        {headline.line2}
      </h1>

      <p
        aria-live="polite"
        className="mt-3 text-[0.9rem] font-medium text-[var(--field-ink-soft)]"
      >
        {liste
          ? indkøbSummary(liste.antalVarer, antalKlaret, liste.antalAftener)
          : weekRangeLabel(weekStart)}
      </p>

      {erDenneUge ? null : (
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
 * Én vare.
 *
 * Hele rækken er knappen -- man rammer den med tommelfingeren uden at sigte,
 * mens den anden hånd holder en indkøbskurv. Fluebenet er 28px, men det man
 * trykker på, er hele linjen.
 */
function VareRække({
  vare,
  checked,
  onToggle,
}: {
  vare: IndkøbsVare;
  checked: boolean;
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onToggle(vare.key, !checked)}
      className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] py-3 text-left transition last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] active:scale-[0.995]"
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          checked
            ? "border-harvest-green bg-harvest-green text-white"
            : "border-[var(--border-subtle)] bg-transparent"
        }`}
      >
        {checked ? <Check size={15} strokeWidth={3} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block break-words text-[1.02rem] font-semibold leading-[1.25] ${
            checked
              ? "text-[var(--text-muted)] line-through"
              : "text-[var(--foreground)]"
          }`}
        >
          {vare.navn}
        </span>
        {vare.tilDage ? (
          <span className="mt-0.5 block text-[0.78rem] text-[var(--text-muted)]">
            til {vare.tilDage}
          </span>
        ) : null}
      </span>

      {vare.mængde ? (
        <span
          className={`shrink-0 font-serif text-[1rem] font-bold tabular-nums ${
            checked
              ? "text-[var(--text-muted)]"
              : "text-[var(--harvest-green-ink)]"
          }`}
        >
          {vare.mængde}
        </span>
      ) : null}
    </button>
  );
}

function Værktøjslinje({
  skjulKlaret,
  onSkjulKlaret,
  antalKlaret,
  onNulstil,
}: {
  skjulKlaret: boolean;
  onSkjulKlaret: () => void;
  antalKlaret: number;
  onNulstil: () => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={skjulKlaret}
        onClick={onSkjulKlaret}
        className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-[0.85rem] font-bold transition active:scale-95 ${
          skjulKlaret
            ? "bg-[var(--field-green)] text-[var(--field-ink)]"
            : "bg-[var(--tint-stone)] text-[var(--text-muted)]"
        }`}
      >
        {skjulKlaret ? "Vis alt" : "Skjul klaret"}
      </button>

      {antalKlaret > 0 ? (
        <button
          type="button"
          onClick={onNulstil}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--tint-stone)] px-4 text-[0.85rem] font-bold text-[var(--text-muted)] transition active:scale-95"
        >
          <RotateCcw size={14} strokeWidth={2.4} aria-hidden="true" />
          Ryd flueben
        </button>
      ) : null}
    </div>
  );
}

/**
 * Aftener man selv har skrevet ind.
 *
 * "Lasagne" er et navn, ikke en opskrift, så der er ingen varer at regne ud.
 * At lade den forsvinde helt ville være værre end at sige det højt: man ville
 * stå i Netto og have glemt fredag.
 */
function EgneRetter({
  retter,
  weekStart,
}: {
  retter: { weekday: number; dayName: string; title: string }[];
  weekStart: string;
}) {
  return (
    <div className="mb-7 rounded-[24px] bg-[var(--tint-gold)] px-4 py-4">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--harvest-gold-ink)]">
        Jeres egne retter
      </h2>
      <p className="mt-2 text-[0.9rem] leading-[1.5] text-[var(--foreground)]">
        {retter.length === 1
          ? "Der er ingen opskrift bag den her, så varerne skal I selv huske:"
          : "Der er ingen opskrifter bag dem her, så varerne skal I selv huske:"}
      </p>
      <ul className="mt-2 space-y-1">
        {retter.map((ret) => (
          <li
            key={ret.weekday}
            className="font-serif text-[1.05rem] font-bold text-[var(--foreground)]"
          >
            {ret.dayName}: {ret.title}
          </li>
        ))}
      </ul>
      <Link
        href={`/?uge=${encodeURIComponent(weekStart)}`}
        className="mt-3 inline-flex min-h-[44px] items-center text-[0.9rem] font-semibold text-[var(--harvest-gold-ink)] underline underline-offset-4"
      >
        Se ugeplanen
      </Link>
    </div>
  );
}

/** "Du skal selv have" -- en huskeliste, ikke en indkøbsseddel. */
function Skabet({
  varer,
  erAfkrydset,
  onToggle,
}: {
  varer: IndkøbsVare[];
  erAfkrydset: (key: string) => boolean;
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <div className="mb-2">
      <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Tjek skabet
      </h2>
      <p className="mb-2 text-[0.85rem] leading-[1.45] text-[var(--text-muted)]">
        Opskrifterne regner med at I har det her i forvejen.
      </p>
      {varer.map((vare) => (
        <VareRække
          key={vare.key}
          vare={vare}
          checked={erAfkrydset(vare.key)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function TomListe({
  weekStart,
  harAftener,
}: {
  weekStart: string;
  harAftener: boolean;
}) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--tint-green)] text-[var(--harvest-green-ink)]">
        <UtensilsCrossed size={26} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p className="font-serif text-[1.25rem] font-bold leading-[1.2] text-[var(--foreground)]">
        {harAftener ? "Ingen varer at hente" : "Ugen ligger åben"}
      </p>
      <p className="mx-auto mt-2 max-w-[30ch] text-[0.95rem] leading-[1.5] text-[var(--text-muted)]">
        {harAftener
          ? "Retterne på ugen kræver ikke noget I skal købe."
          : "Læg retter på ugeplanen, så regner vi ud hvad I skal handle."}
      </p>
      <Link
        href={`/?uge=${encodeURIComponent(weekStart)}`}
        className="mt-5 inline-flex min-h-[48px] items-center rounded-[22px] bg-harvest-green px-5 text-[0.95rem] font-semibold text-white transition active:scale-[0.98]"
      >
        Gå til ugeplanen
      </Link>
    </div>
  );
}

function Fejl({ besked, onIgen }: { besked: string; onIgen: () => void }) {
  return (
    <div className="rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-4">
      <p
        role="alert"
        className="text-[0.95rem] font-medium text-[var(--harvest-terracotta-ink)]"
      >
        {besked}
      </p>
      <button
        type="button"
        onClick={onIgen}
        className="mt-2 min-h-[44px] text-[0.95rem] font-semibold text-[var(--harvest-green-ink)]"
      >
        Prøv igen
      </button>
    </div>
  );
}

function ListeSkelet() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Henter indkøbslisten …</span>
      <div className="mb-5 h-11 w-32 animate-pulse rounded-full bg-[var(--tint-stone)]" />
      {[1, 2, 3].map((afsnit) => (
        <div key={afsnit} className="mb-7">
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-[var(--tint-stone)]" />
          {[1, 2, 3].map((række) => (
            <div
              key={række}
              className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-3"
            >
              <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[var(--tint-stone)]" />
              <div className="h-4 flex-1 animate-pulse rounded bg-[var(--tint-stone)]" />
              <div className="h-4 w-12 animate-pulse rounded bg-[var(--tint-stone)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
