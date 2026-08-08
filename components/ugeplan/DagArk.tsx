"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Minus, Plus, Trash2, X } from "lucide-react";
import DagFoto from "@/components/ugeplan/DagFoto";
import KatalogVaelger from "@/components/ugeplan/KatalogVaelger";
import { useWeekPlanCatalog } from "@/lib/hooks/useWeekPlanCatalog";
import { dayHeading, formatMinutes, portionsLabel } from "@/lib/weekPlan/view";
import {
  MAX_PORTIONS,
  MAX_TITLE_LENGTH,
  MIN_PORTIONS,
  mondayOf,
} from "@/lib/weekPlan/week";
import type { WeekPlanDay } from "@/lib/weekPlan/types";
import { inputClass } from "@/lib/uiClasses";

/**
 * Alt man kan gøre ved én aften, samlet i ét ark.
 *
 * Vælg fra kataloget, skriv sin egen ret, ret portionsantallet, ryd dagen.
 * At vaelge en ret sker med ét tryk -- ingen "bekraeft"-knap bagefter. Man
 * staar med telefonen i haanden, og en aftensmad er ikke en beslutning der
 * skal underskrives to gange.
 */

type Fane = "katalog" | "selv";

export default function DagArk({
  day,
  isSaving,
  saveError,
  onClose,
  onPickRecipe,
  onSaveManual,
  onClear,
  onSetPortions,
}: {
  day: WeekPlanDay;
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onPickRecipe: (recipeId: number) => Promise<boolean>;
  onSaveManual: (title: string) => Promise<boolean>;
  onClear: () => Promise<boolean>;
  onSetPortions: (portions: number) => Promise<boolean>;
}) {
  const [fane, setFane] = useState<Fane>(
    day.slotKind === "manual" ? "selv" : "katalog",
  );
  const [manualTitle, setManualTitle] = useState(day.manualTitle ?? "");

  // Vaelgeren viser den uge dagen ligger i -- ugens egne ~50 retter, ikke
  // hele kataloget. Ugen udledes af datoen, saa den ikke skal traades
  // gennem endnu et prop-lag.
  const catalog = useWeekPlanCatalog(mondayOf(day.date), fane === "katalog");

  // Baggrunden maa ikke rulle med, naar man ruller i listen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const empty = day.slotKind === "empty";
  const trimmedTitle = manualTitle.trim();
  const manualUnchanged = trimmedTitle === (day.manualTitle ?? "").trim();

  async function pick(recipeId: number) {
    if (await onPickRecipe(recipeId)) onClose();
  }

  async function saveManual() {
    if (!trimmedTitle) return;
    if (await onSaveManual(trimmedTitle)) onClose();
  }

  async function clearDay() {
    if (await onClear()) onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Luk"
        onClick={onClose}
        className="absolute inset-0 bg-[oklch(0.2_0.03_152_/_0.5)]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dagark-overskrift"
        className="relative mx-auto flex max-h-[92vh] w-full max-w-md flex-col rounded-t-[32px] bg-[var(--surface-1)] shadow-[var(--shadow-elevated)]"
      >
        <div className="shrink-0 rounded-t-[32px] border-b border-[var(--border-subtle)] px-5 pb-4 pt-3">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-subtle)]"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--harvest-green-ink)]">
                Aftensmad
              </p>
              <h2
                id="dagark-overskrift"
                className="mt-1 font-serif text-[1.4rem] font-extrabold leading-[1.1] tracking-[-0.02em]"
              >
                {dayHeading(day)}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Luk"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tint-stone)] text-[var(--text-muted)] transition active:scale-90"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4">
          {saveError ? (
            <p
              role="alert"
              className="mb-4 rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-3 text-[0.9rem] font-medium text-[var(--harvest-terracotta-ink)]"
            >
              {saveError}
            </p>
          ) : null}

          {empty ? (
            <p className="mb-5 text-[0.95rem] leading-[1.5] text-[var(--text-muted)]">
              Der er ikke lagt noget på {day.dayName.toLowerCase()} endnu. Vælg
              en ret fra kataloget, eller skriv jeres egen.
            </p>
          ) : (
            <div className="mb-5">
              <ValgtRet day={day} />

              <button
                type="button"
                onClick={() => void clearDay()}
                disabled={isSaving}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--border-subtle)] px-4 text-[0.9rem] font-semibold text-[var(--harvest-terracotta-ink)] transition active:scale-[0.98] disabled:opacity-50"
              >
                <Trash2 size={16} strokeWidth={2.2} />
                Ryd {day.dayName.toLowerCase()}
              </button>
            </div>
          )}

          <PortionsRaekke
            portions={day.portions}
            disabled={isSaving}
            onChange={onSetPortions}
          />

          <div
            role="tablist"
            aria-label="Sådan fylder du dagen"
            className="mb-4 mt-6 flex gap-1.5"
          >
            <FaneKnap
              active={fane === "katalog"}
              onClick={() => setFane("katalog")}
            >
              Fra kataloget
            </FaneKnap>
            <FaneKnap active={fane === "selv"} onClick={() => setFane("selv")}>
              Skriv selv
            </FaneKnap>
          </div>

          {fane === "katalog" ? (
            <KatalogVaelger
              catalog={catalog.catalog}
              isLoading={catalog.isLoading}
              error={catalog.error}
              isSaving={isSaving}
              dayPortions={day.portions}
              chosenRecipeId={day.recipe?.recipeId ?? null}
              onReload={catalog.reload}
              onPick={(recipe) => void pick(recipe.recipeId)}
            />
          ) : (
            <div>
              <label
                htmlFor="dagark-egen-ret"
                className="block text-[0.9rem] font-semibold text-[var(--foreground)]"
              >
                Hvad laver I?
              </label>
              <input
                id="dagark-egen-ret"
                value={manualTitle}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) => setManualTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveManual();
                }}
                placeholder="Lasagne"
                className={`${inputClass} mt-2 min-h-[44px]`}
              />
              <p className="mt-2 text-[0.85rem] text-[var(--text-muted)]">
                Et navn er nok. Resten husker I selv.
              </p>
              <button
                type="button"
                disabled={isSaving || !trimmedTitle || manualUnchanged}
                onClick={() => void saveManual()}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[22px] bg-harvest-green px-4 text-[0.95rem] font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Gemmer
                  </>
                ) : (
                  `Læg på ${day.dayName.toLowerCase()}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Retten der ligger paa dagen.
 *
 * Er det en katalogopskrift, er hele blokken et link ind til den -- samme
 * loefte som paa ugeplanens raekke: trykker man paa navnet, faar man
 * opskriften. En egen ret er bare et navn, saa der er intet at gaa ind i.
 */
function ValgtRet({ day }: { day: WeekPlanDay }) {
  const recipeId =
    day.slotKind === "catalog" ? (day.recipe?.recipeId ?? null) : null;

  const foto = (
    <DagFoto
      slotKind={day.slotKind}
      imageUrl={day.recipe?.imageUrl ?? null}
      title={day.title}
      size={64}
    />
  );

  if (recipeId === null) {
    return (
      <div className="flex items-center gap-4">
        {foto}
        <div className="min-w-0">
          <p className="break-words font-serif text-[1.15rem] font-bold leading-[1.2] tracking-[-0.015em]">
            {day.title}
          </p>
          <p className="mt-1 text-[0.85rem] text-[var(--text-muted)]">
            Jeres egen ret
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/opskrift/${recipeId}`}
      aria-label={`Se opskriften ${day.title}`}
      className="flex items-center gap-4 rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] active:scale-[0.99]"
    >
      {foto}
      <div className="min-w-0">
        <p className="break-words font-serif text-[1.15rem] font-bold leading-[1.2] tracking-[-0.015em]">
          {day.title}
        </p>
        <span className="mt-1 flex items-center gap-1 text-[0.85rem] font-semibold text-[var(--harvest-green-ink)]">
          Se opskriften
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
          <span className="font-normal text-[var(--text-muted)]">
            {formatMinutes(day.recipe?.totalMinutes ?? null)}
          </span>
        </span>
      </div>
    </Link>
  );
}

function FaneKnap({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-[44px] flex-1 rounded-full px-3 text-[0.85rem] font-bold transition ${
        active
          ? "bg-[var(--field-green)] text-[var(--field-ink)]"
          : "bg-[var(--tint-stone)] text-[var(--text-muted)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Portionsantallet hoerer til dagen, ikke til retten. Skifter man ret paa en
 * dag hvor der skal vaere fire, skal der stadig vaere fire -- derfor staar
 * taelleren her og ikke inde ved den enkelte opskrift.
 */
function PortionsRaekke({
  portions,
  disabled,
  onChange,
}: {
  portions: number;
  disabled: boolean;
  onChange: (portions: number) => Promise<boolean>;
}) {
  return (
    <div className="flex items-center justify-between rounded-[20px] bg-[var(--tint-stone)] px-4 py-2">
      <span className="text-[0.9rem] font-semibold">Portioner</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Én portion færre"
          disabled={disabled || portions <= MIN_PORTIONS}
          onClick={() => void onChange(portions - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--harvest-green-ink)] transition active:scale-90 disabled:opacity-35"
        >
          <Minus size={18} strokeWidth={2.4} />
        </button>
        <span
          aria-live="polite"
          className="min-w-[68px] text-center font-serif text-[1.05rem] font-bold"
        >
          {portionsLabel(portions)}
        </span>
        <button
          type="button"
          aria-label="Én portion mere"
          disabled={disabled || portions >= MAX_PORTIONS}
          onClick={() => void onChange(portions + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--harvest-green-ink)] transition active:scale-90 disabled:opacity-35"
        >
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
