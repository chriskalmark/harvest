"use client";

import { useEffect, useMemo, useState } from "react";
import type { PickerCatalog } from "@/lib/catalog/types";

export type KatalogOmfang = "uge" | "alle";

/**
 * Skagenfood-kataloget til retvælgeren.
 *
 * To omfang: ugens egne ~50 retter, eller hele kataloget på 137. Ugen er
 * standard, fordi det er den friske kasse -- men den må ikke være et
 * fængsel. Vil man have onsdagens ret fra ugen før, skal den kunne nås.
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

async function fetchCatalog(
  week: string,
  omfang: KatalogOmfang,
): Promise<PickerCatalog> {
  const params =
    omfang === "alle"
      ? new URLSearchParams({ omfang: "alle" })
      : new URLSearchParams({ uge: week, omfang: "uge" });
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

/**
 * Hele kataloget er det samme uanset hvilken uge man staar i, saa det
 * gemmes under én noegle -- ikke én per uge.
 */
function cacheNøgle(week: string, omfang: KatalogOmfang): string {
  return omfang === "alle" ? "alle" : `uge:${week}`;
}

function loadCatalog(
  week: string,
  omfang: KatalogOmfang,
  force: boolean,
): Promise<PickerCatalog> {
  const nøgle = cacheNøgle(week, omfang);

  if (force) {
    cache.delete(nøgle);
    inFlight.delete(nøgle);
  }

  const cached = cache.get(nøgle);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(nøgle);
  if (pending) return pending;

  // To dage aabnet hurtigt efter hinanden deler ét kald.
  const request = fetchCatalog(week, omfang)
    .then((catalog) => {
      cache.set(nøgle, catalog);
      return catalog;
    })
    .finally(() => {
      inFlight.delete(nøgle);
    });
  inFlight.set(nøgle, request);
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
  omfang: KatalogOmfang = "uge",
): CatalogController {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Keyed<PickerCatalog> | null>(() => {
    const cached = cache.get(cacheNøgle(week, omfang));
    return cached ? { key: `${week}|${omfang}#0`, value: cached } : null;
  });
  const [failed, setFailed] = useState<Keyed<string> | null>(null);

  const key = `${week}|${omfang}#${attempt}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadCatalog(week, omfang, attempt > 0)
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
  }, [attempt, enabled, key, omfang, week]);

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
