"use client";

/**
 * Husstandens portionsantal, husket paa tvaers af opskrifter.
 *
 * De er to i huset. At skulle trykke "2 personer" frem paa hver eneste
 * opskrift er den slags gentagelse en privat app ikke boer bede om. Tallet
 * gemmes derfor ét sted for hele appen -- ikke pr. opskrift -- og bliver
 * afstemt med den enkelte opskrifts egne muligheder, naar den aabnes
 * (resolvePortions i lib/recipe/view.ts).
 *
 * Kun tal mellem 1 og 5 accepteres: det er de portionsstoerrelser Skagenfood
 * overhovedet skriver maengder for.
 */

const STORAGE_KEY = "harvest-portioner";
const MIN_PORTIONS = 1;
const MAX_PORTIONS = 5;

function readStorage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isInteger(value)) return null;
    if (value < MIN_PORTIONS || value > MAX_PORTIONS) return null;
    return value;
  } catch {
    return null;
  }
}

// Praeferencen er en lille butik uden for React, saa skaermen kan laese den
// med useSyncExternalStore. Det er den vej, hvor serveren tegner standarden og
// browseren retter til bagefter -- uden en effekt der saetter state og udloeser
// en ekstra tegning.
const listeners = new Set<() => void>();
let cached: number | null = null;
let cacheLoaded = false;

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribePortionPreference(listener: () => void): () => void {
  listeners.add(listener);

  // Skifter tallet i en anden fane, skal denne fane foelge med.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cacheLoaded = false;
    notify();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

/** Browserens svar. Cachet, fordi React spoerger flere gange pr. tegning. */
export function getPortionPreference(): number | null {
  if (!cacheLoaded) {
    cached = readStorage();
    cacheLoaded = true;
  }
  return cached;
}

/** Serveren kender ikke husstandens vane -- den tegner standarden. */
export function getServerPortionPreference(): number | null {
  return null;
}

export function writePortionPreference(portions: number): void {
  if (!Number.isInteger(portions)) return;
  if (portions < MIN_PORTIONS || portions > MAX_PORTIONS) return;

  cached = portions;
  cacheLoaded = true;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(portions));
    } catch {
      // Lageret er fuldt eller slaaet fra. Skaermen virker stadig i denne omgang.
    }
  }

  notify();
}
