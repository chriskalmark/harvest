"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Timer, X } from "lucide-react";
import DagFoto from "@/components/ugeplan/DagFoto";
import {
  EMPTY_FILTERS,
  filterRecipes,
  groupRecipes,
  hasActiveFilters,
  ingredientCountLabel,
  mainIngredientFacets,
  missingPortionsNote,
  QUICK_MINUTES,
  type PickerFilters,
} from "@/lib/catalog/picker";
import type { PickerCatalog, PickerRecipe } from "@/lib/catalog/types";
import type { KatalogOmfang } from "@/lib/hooks/useWeekPlanCatalog";
import { formatMinutes } from "@/lib/weekPlan/view";

function OmfangKnap({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktiv}
      onClick={onClick}
      className={`min-h-[44px] flex-1 rounded-full px-3 text-[0.85rem] font-bold transition active:scale-95 ${
        aktiv
          ? "bg-[var(--field-green)] text-[var(--field-ink)]"
          : "bg-[var(--tint-stone)] text-[var(--text-muted)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Retvælgeren: bladr i opskrifterne og vælg én.
 *
 * To omfang, og ugens kasser er standard: ~50 retter frem for kataloget på
 * 137. Ikke fordi resten er utilgængelig, men fordi ugens kasse er det man
 * som regel er ude efter. Knappen "Alle opskrifter" står øverst, før
 * søgefeltet -- søger man forgæves i 49 retter, er det første man skal se,
 * at der findes flere.
 *
 * Femoghalvtreds retter er mange på en telefon, og hele komponenten er
 * bygget omkring netop det. Tre greb gør bunken overkommelig:
 *
 *   1. HOVEDINGREDIENSEN ER RYGRADEN. Skagenfood mærker hver ret med Fisk,
 *      Gris, Okse, Fjerkræ, Skaldyr eller Grøntsager. Uden filter står
 *      retterne i de seks afsnit; med ét tryk på en chip er man nede på
 *      15-26. Det er den inddeling man selv tænker i, når man skal
 *      bestemme sig for en aften.
 *   2. SØGNINGEN GÅR OGSÅ PÅ INGREDIENSERNE, ikke kun titlen. "quinoa" og
 *      "kartofler" er lige så gyldige indgange som "laks", og de står
 *      sjældent i rettens navn.
 *   3. FØRSTE RET I HVERT AFSNIT FYLDER MEST. Listen er sorteret på tid, så
 *      den store er afsnittets hurtigste. Størrelsen fortæller altså noget;
 *      den er ikke pynt.
 *
 * Filtrene bliver stående øverst, mens listen ruller under dem -- ellers
 * skulle man rulle 50 rækker tilbage for at skifte mening.
 *
 * Ét tryk vælger retten. Det er DagArks beslutning, og den gælder her:
 * en aftensmad skal ikke skrives under to gange.
 */
export default function KatalogVaelger({
  catalog,
  isLoading,
  error,
  isSaving,
  dayPortions,
  chosenRecipeId,
  omfang,
  onOmfang,
  onReload,
  onPick,
}: {
  catalog: PickerCatalog | null;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  /** "uge" = ugens ~50 kasseretter. "alle" = hele kataloget. */
  omfang: KatalogOmfang;
  onOmfang: (omfang: KatalogOmfang) => void;
  /** Dagens portionsantal -- til at sige fra, når retten ikke kan laves til det. */
  dayPortions: number;
  chosenRecipeId: number | null;
  onReload: () => void;
  onPick: (recipe: PickerRecipe) => void;
}) {
  const [filters, setFilters] = useState<PickerFilters>(EMPTY_FILTERS);
  const [queryDraft, setQueryDraft] = useState("");

  // Et anslag maa ikke koste et gennemløb af 50 retter.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setFilters((current) => ({ ...current, query: queryDraft })),
      160,
    );
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  const recipes = useMemo(() => catalog?.recipes ?? [], [catalog]);
  const visible = useMemo(
    () => filterRecipes(recipes, filters),
    [recipes, filters],
  );
  const facets = useMemo(
    () => mainIngredientFacets(recipes, filters),
    [recipes, filters],
  );
  const sections = useMemo(() => groupRecipes(visible), [visible]);

  const filtered = hasActiveFilters(filters);
  const trimmedQuery = filters.query.trim();

  function reset() {
    setFilters(EMPTY_FILTERS);
    setQueryDraft("");
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-harvest-terracotta/30 bg-harvest-terracotta/10 px-4 py-3">
        <p className="text-[0.9rem] font-medium text-[var(--harvest-terracotta-ink)]">
          {error}
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-2 min-h-[44px] text-[0.9rem] font-semibold text-[var(--harvest-green-ink)]"
        >
          Prøv igen
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filtrene bliver staaende, mens retterne ruller under dem.
          -mt-4/pt-4 er ikke pynt: rulleflasken i DagArk har pt-4, og
          position:sticky haefter paa POLSTRINGSKASSEN. Med top-0 og uden det
          her stod barren 16px nede, og retterne rullede synligt gennem
          baandet over soegefeltet -- en stribe madfoto i begge temaer.
          Barren daekker nu sin egen polstring. */}
      <div className="sticky top-0 z-10 -mx-5 -mt-4 bg-[var(--surface-1)] px-5 pb-3 pt-4">
        {/*
          Ugens kasse er standard, fordi det er den friske uge -- men den
          maa ikke vaere et faengsel. Kataloget rummer tre ugers retter, og
          vil man have onsdagens ret fra ugen foer, skal den kunne naas.
          Derfor staar valget OEVERST, foer soegefeltet: soeger man forgaeves
          i 49 retter, er det foerste man skal se, at der findes 137.
        */}
        <div role="tablist" aria-label="Hvor mange retter" className="mb-2.5 flex gap-1.5">
          <OmfangKnap
            aktiv={omfang === "uge"}
            onClick={() => onOmfang("uge")}
          >
            Ugens kasser
          </OmfangKnap>
          <OmfangKnap
            aktiv={omfang === "alle"}
            onClick={() => onOmfang("alle")}
          >
            Alle opskrifter
          </OmfangKnap>
        </div>

        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="search"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Søg på ret eller ingrediens"
            aria-label="Søg i kataloget"
            className="min-h-[44px] w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--tint-stone)] py-3 pl-11 pr-11 text-base text-[var(--foreground)] outline-none transition focus:border-harvest-green focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
          {queryDraft ? (
            <button
              type="button"
              onClick={() => setQueryDraft("")}
              aria-label="Ryd søgningen"
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition active:scale-90"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>

        {/* Tid og hovedingrediens er to forskellige spørgsmaal. De deler
            raekke for at spare højde, men er skilt ad af en streg, og
            tids-chippen baerer et ur, saa de ikke ligner hinandens naboer. */}
        <div className="-mx-5 mt-2 flex items-center gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip
            active={filters.maxMinutes !== null}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                maxMinutes: current.maxMinutes === null ? QUICK_MINUTES : null,
              }))
            }
          >
            <Timer size={14} aria-hidden="true" />
            Under {QUICK_MINUTES} min
          </Chip>

          <span
            aria-hidden="true"
            className="h-6 w-px shrink-0 bg-[var(--border-subtle)]"
          />

          <Chip
            active={filters.mainIngredient === null}
            onClick={() =>
              setFilters((current) => ({ ...current, mainIngredient: null }))
            }
          >
            Alle
          </Chip>
          {facets.map((facet) => (
            <Chip
              key={facet.value}
              active={filters.mainIngredient === facet.value}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  mainIngredient:
                    current.mainIngredient === facet.value ? null : facet.value,
                }))
              }
            >
              {facet.value}
              <span className="tabular-nums opacity-70">{facet.count}</span>
            </Chip>
          ))}
        </div>

        <p className="mt-1 text-[0.8rem] text-[var(--text-muted)]">
          {isLoading
            ? "Henter retterne"
            : filtered
              ? `${visible.length} af ${recipes.length} retter`
              : catalog?.scope === "uge"
                ? `${recipes.length} retter i ugens kasser`
                : `${recipes.length} retter i kataloget`}
        </p>
      </div>

      {catalog?.notice ? (
        <p className="mb-3 rounded-2xl bg-[var(--tint-gold)] px-4 py-3 text-[0.85rem] leading-[1.45] text-[var(--harvest-gold-ink)]">
          {catalog.notice}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-harvest-green" />
        </div>
      ) : recipes.length === 0 ? (
        <p className="py-8 text-center text-[0.95rem] text-[var(--text-muted)]">
          Kataloget er tomt. Importér en uge fra Skagenfood først.
        </p>
      ) : visible.length === 0 ? (
        <div className="py-8">
          <p className="text-center text-[0.95rem] text-[var(--text-muted)]">
            {trimmedQuery
              ? `Ingen retter matcher “${trimmedQuery}”.`
              : "Ingen retter matcher filtrene."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mx-auto mt-3 block min-h-[44px] rounded-2xl border border-[var(--border-subtle)] px-5 text-[0.9rem] font-semibold text-[var(--foreground)] transition active:scale-[0.98]"
          >
            Ryd søgning og filtre
          </button>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.key}>
            {/* Overskriften er overflødig, naar chippen allerede siger hvad
                man kigger paa. Saa staar den ikke der. */}
            {filters.mainIngredient === null ? (
              <h3 className="pb-2 pt-4 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[var(--harvest-green-ink)]">
                {section.label}
              </h3>
            ) : null}
            <ul>
              {section.recipes.map((recipe, index) => (
                <RetRaekke
                  key={recipe.recipeId}
                  recipe={recipe}
                  lead={index === 0}
                  chosen={chosenRecipeId === recipe.recipeId}
                  disabled={isSaving}
                  portionsNote={missingPortionsNote(recipe, dayPortions)}
                  onPick={() => onPick(recipe)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Chip({
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
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[0.85rem] font-semibold transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
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
 * Én ret. lead er afsnittets første -- den hurtigste -- og fylder mere.
 * Begge former er over 44px høje; hele raekken er trykmaalet.
 */
function RetRaekke({
  recipe,
  lead,
  chosen,
  disabled,
  portionsNote,
  onPick,
}: {
  recipe: PickerRecipe;
  lead: boolean;
  chosen: boolean;
  disabled: boolean;
  portionsNote: string | null;
  onPick: () => void;
}) {
  const time = formatMinutes(recipe.totalMinutes) ?? "Tid ikke oplyst";

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className={`flex w-full items-center gap-3 rounded-2xl border-b border-[var(--border-subtle)] px-1 text-left transition last:border-b-0 active:scale-[0.99] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
          lead ? "py-4" : "py-3"
        } ${chosen ? "bg-[var(--tint-green)]" : ""}`}
      >
        <DagFoto
          slotKind="catalog"
          imageUrl={recipe.imageUrl}
          title={recipe.name}
          size={lead ? 84 : 52}
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block break-words font-serif leading-[1.2] tracking-[-0.015em] ${
              lead ? "text-[1.2rem] font-bold" : "text-[1rem] font-semibold"
            }`}
          >
            {recipe.name}
          </span>

          {lead ? (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--field-green)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--field-ink)]">
                {time}
              </span>
              <span className="rounded-full bg-[var(--tint-green)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--harvest-green-ink)]">
                {ingredientCountLabel(recipe.ingredientCount)}
              </span>
            </span>
          ) : (
            <span className="mt-0.5 block text-[0.8rem] text-[var(--text-muted)]">
              {time} · {ingredientCountLabel(recipe.ingredientCount)}
            </span>
          )}

          {chosen ? (
            <span className="mt-1 block text-[0.8rem] font-semibold text-[var(--harvest-green-ink)]">
              Valgt
            </span>
          ) : null}
          {portionsNote ? (
            <span className="mt-1 block text-[0.8rem] font-medium text-[var(--harvest-terracotta-ink)]">
              {portionsNote}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
