"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Lightbulb,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import PhotoPlaceholder from "@/components/PhotoPlaceholder";
import { useKeepAwake } from "@/lib/hooks/useKeepAwake";
import {
  buildRecipeView,
  portionsLabel,
  resolvePortions,
  shiftPortions,
} from "@/lib/recipe/view";
import {
  getPortionPreference,
  getServerPortionPreference,
  subscribePortionPreference,
  writePortionPreference,
} from "@/lib/recipe/portionPreference";
import type { CatalogRecipe } from "@/lib/skagenfood/types";
import {
  grundopskrifterI,
  type Grundopskrift,
} from "@/lib/weekPlan/grundopskrifter";

/**
 * Opskriften ved komfuret.
 *
 * Den bliver laest paa ca. en meters afstand, med telefonen liggende paa
 * bordpladen og fedtede fingre. Derfor: store bogstaver hele vejen ned, ingen
 * graa 12px-tekst, trykmaal paa 44px, og kun to ting man kan komme til at
 * trykke paa -- portionsantallet og "trin klaret".
 *
 * Alle maengder kommer faerdigskrevne fra Skagenfood for 1-5 portioner. Vi
 * ganger ikke selv; vi vaelger den linje der passer til antallet.
 */

export default function RecipeScreen({ recipe }: { recipe: CatalogRecipe }) {
  // Husstandens portionsantal ligger uden for React (localStorage), saa det
  // laeses som en butik: serveren tegner standarden (2 personer), browseren
  // retter til med det gemte tal, og skiftet sker uden en ekstra tegning.
  const preference = useSyncExternalStore(
    subscribePortionPreference,
    getPortionPreference,
    getServerPortionPreference,
  );
  const portions = resolvePortions(recipe.portionOptions, preference);

  const [doneSteps, setDoneSteps] = useState<Set<number>>(() => new Set());
  const keepAwake = useKeepAwake();

  const changePortions = useCallback(
    (direction: 1 | -1) => {
      const next = shiftPortions(recipe.portionOptions, portions, direction);
      if (next !== portions) writePortionPreference(next);
    },
    [portions, recipe.portionOptions],
  );

  const view = useMemo(
    () => buildRecipeView(recipe, portions),
    [recipe, portions],
  );

  const toggleStep = useCallback((number: number) => {
    setDoneSteps((current) => {
      const next = new Set(current);
      if (next.has(number)) {
        next.delete(number);
      } else {
        next.add(number);
      }
      return next;
    });
  }, []);

  const options = [...new Set(recipe.portionOptions)].sort((a, b) => a - b);
  const canGoDown = options.length > 0 && view.portions > options[0];
  const canGoUp =
    options.length > 0 && view.portions < options[options.length - 1];
  const doneCount = doneSteps.size;

  return (
    <main>
      {/* Grøn flade. --field-green, ikke --harvest-green: hvid tekst på den
          lyse grøn når kun 3,48:1, og alt herinde er tekst. */}
      <div className="relative rounded-[34px] bg-[var(--field-green)] px-4 pb-20 pt-4">
        <Link
          href="/opskrifter"
          className="relative -my-3 inline-flex items-center gap-1.5 py-3 text-sm font-semibold text-[var(--field-ink-soft)] transition-colors hover:text-[var(--field-ink)] before:absolute before:inset-x-[-8px] before:inset-y-0 before:content-['']"
        >
          <ArrowLeft size={16} />
          Opskrifter
        </Link>
      </div>

      {/* Hvid plade — fotoet bryder sømmen mellem flade og plade.
          Bundpolstringen dækker den plads, layoutet reserverer til ugevælger
          + fane­række (se app/layout.tsx). Uden den stod der et tomt grønt
          bånd under den sidste linje, fordi opskriften ikke viser
          ugevælgeren. Den negative margen holder sidens højde uændret. */}
      <div className="relative -mt-8 rounded-[34px] bg-[var(--surface-1)] pt-24 pb-[calc(2rem+170px+env(safe-area-inset-bottom))] -mb-[calc(170px+env(safe-area-inset-bottom))]">
        <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-[58%] justify-center">
          <PhotoPlaceholder
            imageUrl={recipe.imageUrl}
            size={168}
            label="Foto på vej"
            priority
            className="border-[5px] border-[var(--surface-1)] shadow-[0_14px_34px_-8px_oklch(0.35_0.05_150_/_0.35)]"
          />
        </div>

        <div className="px-4">
          <h1 className="font-serif text-[2rem] font-extrabold leading-[1.08] tracking-[-0.025em] text-[var(--foreground)]">
            {recipe.name}
          </h1>

          {/* Type og hovedingrediens står her og ikke oppe i den grønne
              flade: dér ville fotoet ligge hen over dem. */}
          {view.kind || view.mainIngredient ? (
            <p className="mt-3 text-[0.95rem] text-[var(--text-muted)]">
              {[view.kind, view.mainIngredient].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <FactRow
            timeLabel={view.timeLabel}
            nutrition={view.headlineNutrition}
            portions={view.portions}
            canGoDown={canGoDown}
            canGoUp={canGoUp}
            onChange={changePortions}
          />

          <SetOut view={view} />

          <div className="mt-9 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2 className="font-serif text-[1.5rem] font-extrabold leading-none tracking-[-0.02em] text-[var(--foreground)]">
              Sådan gør du
            </h2>
            <p
              className="text-[0.95rem] font-semibold text-[var(--text-muted)]"
              aria-live="polite"
            >
              {doneCount} af {view.steps.length} trin klaret
            </p>
          </div>

          {keepAwake.isSupported ? (
            <button
              type="button"
              onClick={() => void keepAwake.toggle()}
              aria-pressed={keepAwake.isEnabled}
              className={`mt-4 flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[0.95rem] font-semibold transition ${
                keepAwake.isEnabled
                  ? "bg-[var(--tint-green)] text-[var(--harvest-green-ink)]"
                  : "bg-[var(--tint-stone)] text-[var(--text-muted)]"
              }`}
            >
              <Lightbulb size={18} />
              {keepAwake.isEnabled
                ? "Skærmen bliver tændt, mens du laver mad"
                : "Hold skærmen tændt"}
            </button>
          ) : null}

          <ol className="mt-2">
            {view.steps.map((step, index) => (
              <StepRow
                key={step.number}
                step={step}
                isDone={doneSteps.has(step.number)}
                isLast={index === view.steps.length - 1}
                onToggle={() => toggleStep(step.number)}
              />
            ))}
          </ol>

          {doneCount > 0 ? (
            <button
              type="button"
              onClick={() => setDoneSteps(new Set())}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--border-subtle)] px-4 py-3 text-[0.95rem] font-semibold text-[var(--harvest-green-ink)] transition active:scale-[0.99]"
            >
              <RotateCcw size={16} />
              Start forfra
            </button>
          ) : null}

          {view.nutrition.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Næringsindhold pr. portion
              </h2>
              {/* Én kolonne, ikke to: "heraf mættede fedtsyrer" brækker
                  tallet fra sin enhed, når rækken kun er en halv skærm bred. */}
              <dl className="mt-3">
                {view.nutrition.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 border-b border-[var(--border-subtle)] py-2.5"
                  >
                    <dt className="text-[0.95rem] text-[var(--text-muted)]">
                      {row.label}
                    </dt>
                    <dd className="font-serif text-[1rem] font-bold text-[var(--foreground)]">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <p className="mt-8 text-[0.9rem] leading-relaxed text-[var(--text-muted)]">
            {view.author ? `Opskrift af ${view.author}. ` : ""}
            Hentet fra Skagenfood.
          </p>

          {view.sourceUrl ? (
            <a
              href={view.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--border-subtle)] px-4 py-3 text-[0.95rem] font-semibold text-[var(--harvest-green-ink)] transition active:scale-[0.99]"
            >
              <ExternalLink size={16} />
              Se den hos Skagenfood
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function FactRow({
  timeLabel,
  nutrition,
  portions,
  canGoDown,
  canGoUp,
  onChange,
}: {
  timeLabel: string | null;
  nutrition: Array<{ label: string; value: string }>;
  portions: number;
  canGoDown: boolean;
  canGoUp: boolean;
  onChange: (direction: 1 | -1) => void;
}) {
  const facts = [
    ...(timeLabel ? [{ value: timeLabel, label: "i alt" }] : []),
    ...nutrition.map((row) => ({
      value: row.value,
      label: row.label.toLowerCase(),
    })),
  ];

  return (
    <div className="mt-5 border-b border-[var(--border-subtle)] pb-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {facts.map((fact) => (
          <div key={fact.label}>
            <span className="block font-serif text-[1.35rem] font-bold leading-[1.1] text-[var(--foreground)]">
              {fact.value}
            </span>
            <span className="text-[0.8rem] font-medium text-[var(--text-muted)]">
              {fact.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-full bg-[var(--tint-stone)] py-1.5 pl-2 pr-2">
        <button
          type="button"
          onClick={() => onChange(-1)}
          disabled={!canGoDown}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--harvest-green-ink)] transition active:scale-90 disabled:opacity-35"
          aria-label="Færre portioner"
        >
          <Minus size={20} />
        </button>
        <span
          className="font-serif text-[1.15rem] font-bold text-[var(--foreground)]"
          aria-live="polite"
        >
          Mængder til {portionsLabel(portions)}
        </span>
        <button
          type="button"
          onClick={() => onChange(1)}
          disabled={!canGoUp}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--harvest-green-ink)] transition active:scale-90 disabled:opacity-35"
          aria-label="Flere portioner"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

function SetOut({ view }: { view: ReturnType<typeof buildRecipeView> }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-[1.5rem] font-extrabold leading-none tracking-[-0.02em] text-[var(--foreground)]">
        Sæt frem
      </h2>

      {view.sections.map((section, index) => (
        <div key={section.title ?? `hoved-${index}`} className="mt-5">
          {section.title ? (
            <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--harvest-green-ink)]">
              {section.title}
            </h3>
          ) : null}
          <ul>
            {section.items.map((item, itemIndex) => (
              <li
                key={`${item.name}-${itemIndex}`}
                className="flex items-baseline gap-3 border-b border-[var(--border-subtle)] py-3 last:border-b-0"
              >
                <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--harvest-green-bright)]" />
                <span className="text-[1.15rem] leading-[1.45] text-[var(--foreground)]">
                  {item.line ?? item.name}
                </span>
                {item.allergenic ? (
                  <span className="ml-auto shrink-0 rounded-full bg-[var(--tint-gold)] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--harvest-gold-ink)]">
                    Allergen
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {view.pantryItems.length > 0 ? (
        <ChipBlock
          title="Du skal selv have"
          items={view.pantryItems}
          tone="gold"
        />
      ) : null}

      {view.equipment.length > 0 ? (
        <ChipBlock title="Redskaber" items={view.equipment} tone="stone" />
      ) : null}

      {/*
        Halvfabrikata fra Skagenfoods kasse.

        Opskriften siger "tilsæt mørbradgryde", fordi den ligger færdig i
        kassen. Handler man i Netto, findes den ikke -- og uden det her
        stod man ved komfuret og manglede halvdelen af retten.
      */}
      {grundopskrifterI(
        view.sections.flatMap((afsnit) => afsnit.items.map((i) => i.name)),
      ).map((grund) => (
        <Grundafsnit key={grund.navn} grund={grund} />
      ))}
    </section>
  );
}

/**
 * "Sådan laver du mørbradgryden."
 *
 * Står ÅBEN, ikke bag et tryk. Er man nået til den her ret, mangler man
 * den her opskrift -- at gemme den bag en knap ville betyde, at man
 * opdagede den, når kødet allerede lå på panden.
 */
function Grundafsnit({ grund }: { grund: Grundopskrift }) {
  const købes = grund.slags === "køb-færdig";

  return (
    <div className="mt-6 rounded-[24px] bg-[var(--tint-green)] px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--harvest-green-ink)]">
        {købes ? "Kan købes færdig" : "Den laver I selv"}
      </p>
      <h3 className="mt-1 font-serif text-[1.2rem] font-bold leading-[1.2] tracking-[-0.015em] text-[var(--foreground)]">
        {grund.visningsnavn}
      </h3>

      {grund.note ? (
        <p className="mt-2 text-[0.88rem] leading-[1.5] text-[var(--foreground)]">
          {grund.note}
        </p>
      ) : null}

      {grund.ingredienser.length > 0 ? (
        <p className="mt-3 text-[0.88rem] leading-[1.5] text-[var(--foreground)]">
          <span className="font-semibold">Pr. person: </span>
          {grund.ingredienser
            .map((i) => `${formatérTal(i.mængde)} ${i.enhed} ${i.navn}`)
            .join(", ")}
        </p>
      ) : null}

      <ol className="mt-3 space-y-2">
        {grund.fremgangsmåde.map((trin, nummer) => (
          <li
            key={trin}
            className="flex gap-2.5 text-[0.95rem] leading-[1.5] text-[var(--foreground)]"
          >
            <span className="shrink-0 font-serif font-bold text-[var(--harvest-green-ink)]">
              {nummer + 1}.
            </span>
            <span>{trin}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Dansk komma, og ingen ",0" hængende bagefter. */
function formatérTal(tal: number): string {
  return String(Math.round(tal * 100) / 100).replace(".", ",");
}

function ChipBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "gold" | "stone";
}) {
  const chipClass =
    tone === "gold"
      ? "bg-[var(--tint-gold)] text-[var(--harvest-gold-ink)]"
      : "bg-[var(--tint-stone)] text-[var(--foreground)]";

  return (
    <div className="mt-6">
      <h3 className="mb-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {title}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-full px-3.5 py-2 text-[1rem] font-semibold ${chipClass}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepRow({
  step,
  isDone,
  isLast,
  onToggle,
}: {
  step: ReturnType<typeof buildRecipeView>["steps"][number];
  isDone: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  const inkClass = isDone
    ? "text-[var(--text-muted)]"
    : "text-[var(--foreground)]";

  return (
    <li className="relative">
      {/* Tråden mellem trinnene. Ren linje, ikke pynt: den viser at
          tidsstemplerne hører til den samme tidslinje. */}
      {!isLast ? (
        <span
          aria-hidden="true"
          className="absolute left-[21px] top-14 bottom-2 w-px bg-[var(--border-subtle)]"
        />
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isDone}
        className="flex w-full gap-4 border-b border-[var(--border-subtle)] py-5 text-left transition active:scale-[0.995]"
      >
        <span
          className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-[1.35rem] font-extrabold leading-none transition ${
            isDone
              ? "bg-[var(--harvest-green-deep)] text-white"
              : "bg-[var(--tint-green)] text-[var(--harvest-green-ink)]"
          }`}
        >
          {isDone ? <Check size={22} strokeWidth={3} /> : step.number}
        </span>

        {/* Et klaret trin dæmpes med --text-muted og ikke med opacity:
            opacity 0,6 på brødteksten måler 4,2:1 mod pladen og falder
            dermed for AA. --text-muted rammer 8,8:1 og ser stadig
            afsluttet ud. */}
        <span className="min-w-0 flex-1">
          {step.timeLabel ? (
            <span className="block text-[0.85rem] font-black uppercase tracking-[0.16em] text-[var(--harvest-green-ink)]">
              {step.timeLabel}
            </span>
          ) : null}

          {step.title ? (
            <span
              className={`mt-1 block font-serif text-[1.3rem] font-bold leading-[1.15] tracking-[-0.015em] ${inkClass}`}
            >
              {step.title}
            </span>
          ) : null}

          {step.paragraphs.map((paragraph, index) => (
            <span
              key={index}
              className={`mt-2 block max-w-[34ch] text-[1.2rem] leading-[1.55] ${inkClass}`}
            >
              {paragraph}
            </span>
          ))}

          {step.ingredients.length > 0 ? (
            <span className="mt-3 flex flex-wrap gap-2">
              {step.ingredients.map((line) => (
                <span
                  key={line}
                  className="rounded-full bg-[var(--tint-green)] px-3 py-1.5 text-[0.95rem] font-semibold text-[var(--harvest-green-ink)]"
                >
                  {line}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
