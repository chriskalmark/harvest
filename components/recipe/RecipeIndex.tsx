"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import PhotoPlaceholder from "@/components/PhotoPlaceholder";
import { formatTotalMinutes, matchesRecipeSearch } from "@/lib/recipe/view";
import type { RecipeCard } from "@/lib/recipe/types";

/**
 * Katalogets 93 opskrifter som én liste.
 *
 * Rytme frem for gitter: den foerste ret er stor, resten er raekker. Det er
 * ikke pynt -- det er forskellen paa en liste man laeser og et skabelongitter
 * man scroller forbi.
 *
 * Soegningen sker i skaermen. Hele kataloget er allerede hentet, saa hvert
 * bogstav filtrerer oejeblikkeligt uden et eneste kald.
 */

export default function RecipeIndex({ recipes }: { recipes: RecipeCard[] }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(
    () => recipes.filter((card) => matchesRecipeSearch(card, query)),
    [recipes, query],
  );

  const [lead, ...rest] = matches;

  return (
    <main>
      <div className="rounded-[34px] bg-[var(--field-green)] px-4 pb-16 pt-5">
        <h1 className="font-serif text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] text-[var(--field-ink)]">
          Opskrifter
        </h1>
        <p className="mt-2 text-[0.95rem] text-[var(--field-ink-soft)]">
          {recipes.length} retter fra Skagenfood, med mængder til 1–5 personer.
        </p>
      </div>

      <div className="relative -mt-8 rounded-[34px] bg-[var(--surface-1)] px-4 pb-8 pt-6">
        <label className="relative block">
          <span className="sr-only">Søg i opskrifterne</span>
          <Search
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søg — fx laks, vegetar, karry"
            className="min-h-[48px] w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--tint-stone)] py-3 pl-12 pr-4 text-[1.05rem] text-[var(--foreground)] outline-none transition focus:border-harvest-green focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
        </label>

        <p className="mt-3 text-[0.9rem] font-semibold text-[var(--text-muted)]">
          {matches.length === recipes.length
            ? `Alle ${recipes.length} retter`
            : `${matches.length} af ${recipes.length} retter`}
        </p>

        {matches.length === 0 ? (
          <p className="mt-8 text-[1.1rem] leading-relaxed text-[var(--foreground)]">
            Ingen retter matcher “{query}”. Prøv et enkelt ord — fx “kylling”
            eller “vegetar”.
          </p>
        ) : null}

        {lead ? <LeadCard card={lead} /> : null}

        <ul>
          {rest.map((card) => (
            <RecipeRow key={card.recipeId} card={card} />
          ))}
        </ul>
      </div>
    </main>
  );
}

function metaLine(card: RecipeCard): string {
  const time = formatTotalMinutes(card.totalMinutes);
  return [card.kind, time ? `${time}` : null, `${card.stepCount} trin`]
    .filter(Boolean)
    .join(" · ");
}

function LeadCard({ card }: { card: RecipeCard }) {
  return (
    <Link
      href={`/opskrift/${card.recipeId}`}
      className="mt-6 flex items-center gap-4 border-b border-[var(--border-subtle)] pb-6 transition active:scale-[0.99]"
    >
      <PhotoPlaceholder imageUrl={card.imageUrl} size={112} priority />
      <span className="min-w-0">
        <span className="block font-serif text-[1.35rem] font-bold leading-[1.15] tracking-[-0.015em] text-[var(--foreground)]">
          {card.name}
        </span>
        <span className="mt-1.5 block text-[0.95rem] text-[var(--text-muted)]">
          {metaLine(card)}
        </span>
      </span>
    </Link>
  );
}

function RecipeRow({ card }: { card: RecipeCard }) {
  return (
    <li>
      <Link
        href={`/opskrift/${card.recipeId}`}
        className="flex min-h-[76px] items-center gap-4 border-b border-[var(--border-subtle)] py-4 transition active:scale-[0.99]"
      >
        <PhotoPlaceholder imageUrl={card.imageUrl} size={64} />
        <span className="min-w-0">
          <span className="block font-serif text-[1.08rem] font-semibold leading-[1.2] text-[var(--foreground)]">
            {card.name}
          </span>
          <span className="mt-1 block text-[0.9rem] text-[var(--text-muted)]">
            {metaLine(card)}
          </span>
        </span>
      </Link>
    </li>
  );
}
