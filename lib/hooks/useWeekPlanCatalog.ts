"use client";

import { useEffect, useMemo, useState } from "react";
import type { PickerCatalog } from "@/lib/catalog/types";

/**
 * Skagenfood-kataloget til retvælgeren, for én uge ad gangen.
 *
 * To valg er værd at kende:
 *
 *   1. HELE UGEN HENTES I ÉT KALD. Ugen er ~50 opskriftskort, ikke 50 hele
 *      opskrifter, og de fylder under 40 kB. Til gengæld sker al søgning og
 *      filtrering i skærmen, øjeblikkeligt -- et tastetryk koster aldrig en
 *      netværkstur, heller ikke i et køkken med daarligt wifi.
 *   2. SVARET BLIVER LIGGENDE, per uge. Aabner man arket for tirsdag, lukker
 *      og aabner det for onsdag, staar listen der med det samme -- ikke en
 *      spinner til. Kataloget skifter kun naar en ny uge importeres.
 */

const cache = new Map<string, PickerCatalog>();
const inFlight = new Map<string, Promise<PickerCatalog>>();

async function fetchCatalog(week: string): Promise<PickerCatalog> {
  const params = new URLSearchParams({ uge: week, omfang: "uge" });
  const response = await fetch(`/api/katalog/opskrifter?${params.toString()}`, {
    cache: "no-store",
  });

  let payload: {
    data?: { katalog?: PickerCatalog };
    error?: string;
  } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.data?.katalog) {
    throw new Error(
      payload?.error ??
        "Kunne ikke hente opskrifterne. Tjek forbindelsen, og prøv igen.",
    );
  }
  return payload.data.katalog;
}

function loadCatalog(week: string, force: boolean): Promise<PickerCatalog> {
  if (force) {
    cache.delete(week);
    inFlight.delete(week);
  }

  const cached = cache.get(week);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(week);
  if (pending) return pending;

  // To dage aabnet hurtigt efter hinanden deler ét kald.
  const request = fetchCatalog(week)
    .then((catalog) => {
      cache.set(week, catalog);
      return catalog;
    })
    .finally(() => {
      inFlight.delete(week);
    });
  inFlight.set(week, request);
  return request;
}

interface Keyed<T> {
  key: string;
  value: T;
}

export interface CatalogController {
  catalog: PickerCatalog | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * week er mandagens dato (ÅÅÅÅ-MM-DD). enabled er der, fordi kataloget
 * først skal hentes naar vaelgeren aabnes -- ugeplanens egen skaerm har
 * ingen brug for 50 opskriftskort.
 *
 * Svaret gemmes sammen med den nøgle det blev hentet paa (ugen plus et
 * forsøgsnummer). Derfor er "henter" et regnestykke og ikke en tilstand der
 * skal saettes: staar der hverken svar eller fejl paa den nøgle vaelgeren
 * spørger om, er der ikke hentet endnu. Det gør samtidig et sent svar paa
 * uge 33 harmløst, hvis arket i mellemtiden er aabnet paa uge 34 -- nøglen
 * passer ikke, og svaret bliver ikke vist.
 */
export function useWeekPlanCatalog(
  week: string,
  enabled: boolean,
): CatalogController {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Keyed<PickerCatalog> | null>(() => {
    const cached = cache.get(week);
    return cached ? { key: `${week}#0`, value: cached } : null;
  });
  const [failed, setFailed] = useState<Keyed<string> | null>(null);

  const key = `${week}#${attempt}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadCatalog(week, attempt > 0)
      .then((catalog) => {
        if (!cancelled) setLoaded({ key, value: catalog });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setFailed({
            key,
            value:
              caught instanceof Error
                ? caught.message
                : "Kunne ikke hente opskrifterne.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, enabled, key, week]);

  const catalog = loaded?.key === key ? loaded.value : null;
  const error = failed?.key === key ? failed.value : null;

  return useMemo(
    () => ({
      catalog,
      isLoading: enabled && catalog === null && error === null,
      error,
      reload: () => setAttempt((count) => count + 1),
    }),
    [catalog, enabled, error],
  );
}
