"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Indkøbsliste } from "@/lib/weekPlan/indkoeb";

/**
 * Ugens indkøbsliste set fra skærmen.
 *
 * Én ting adskiller den fra useWeekPlan: fluebenene sættes MED DET SAMME.
 * Man står i Netto med en pose i den ene hånd og telefonen i den anden, og
 * en afkrydsning der venter på et svar fra serveren, føles som en fejl.
 * Derfor holdes trykket lokalt med det samme, og serveren skriver bagefter.
 *
 * Fejler skrivningen, ruller fluebenet tilbage og fejlen bliver sagt højt.
 * Der er ingen tavs uenighed mellem det man ser og det der står i basen.
 */

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
}

export interface UgensIndkøbSvar {
  weekStart: string;
  weekLabel: string;
  liste: Indkøbsliste;
}

async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers:
      init?.body === undefined
        ? init?.headers
        : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.data === undefined) {
    throw new Error(
      payload?.error ??
        `Serveren svarede ${response.status}. Prøv igen om et øjeblik.`,
    );
  }
  return payload.data;
}

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Noget gik galt. Prøv igen om et øjeblik.";
}

interface Keyed<T> {
  key: string;
  value: T;
}

export interface IndkøbController {
  indkøb: UgensIndkøbSvar | null;
  isLoading: boolean;
  loadError: string | null;
  saveError: string | null;
  /** Fluebenene som skærmen skal tegne dem -- lokale tryk vinder. */
  erAfkrydset: (key: string) => boolean;
  antalKlaret: number;
  toggle: (key: string, checked: boolean) => void;
  nulstil: () => Promise<void>;
  reload: () => void;
}

export function useUgensIndkøb(weekStart: string): IndkøbController {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Keyed<UgensIndkøbSvar> | null>(null);
  const [failed, setFailed] = useState<Keyed<string> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * Tryk der endnu ikke er bekræftet af serveren.
   *
   * De bærer den nøgle de blev trykket på, præcis som det hentede. Skifter
   * man uge, passer nøglen ikke længere, og fluebenene tælles ikke med --
   * uden at der skal ryddes op i en effekt.
   */
  const [lokale, setLokale] = useState<Keyed<Record<string, boolean>>>({
    key: "",
    value: {},
  });

  const key = `${weekStart}#${attempt}`;

  useEffect(() => {
    let cancelled = false;

    callApi<{ indkøb: UgensIndkøbSvar }>(
      `/api/ugeplan/indkoeb?uge=${encodeURIComponent(weekStart)}`,
    )
      .then((data) => {
        if (!cancelled) setLoaded({ key, value: data.indkøb });
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailed({ key, value: messageOf(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [key, weekStart]);

  const indkøb = loaded?.key === key ? loaded.value : null;
  const loadError = failed?.key === key ? failed.value : null;
  const isLoading = indkøb === null && loadError === null;

  const serverAfkrydset = useMemo(() => {
    const sæt = new Set<string>();
    if (!indkøb) return sæt;
    for (const afsnit of indkøb.liste.afsnit) {
      for (const vare of afsnit.varer) if (vare.checked) sæt.add(vare.key);
    }
    for (const vare of indkøb.liste.skabet) {
      if (vare.checked) sæt.add(vare.key);
    }
    return sæt;
  }, [indkøb]);

  const ventende = useMemo(
    () => (lokale.key === key ? lokale.value : {}),
    [key, lokale],
  );

  const erAfkrydset = useCallback(
    (varenøgle: string) =>
      ventende[varenøgle] ?? serverAfkrydset.has(varenøgle),
    [ventende, serverAfkrydset],
  );

  const antalKlaret = useMemo(() => {
    if (!indkøb) return 0;
    return indkøb.liste.afsnit
      .flatMap((afsnit) => afsnit.varer)
      .filter((vare) => erAfkrydset(vare.key)).length;
  }, [indkøb, erAfkrydset]);

  /**
   * Slipper ét ventende tryk, fordi serveren nu har svaret på netop det.
   *
   * Andre varer der stadig venter, bliver stående -- ellers ville et hurtigt
   * tryk på vare nummer to hoppe tilbage, mens vare nummer et blev gemt.
   */
  const slip = useCallback((varenøgle: string) => {
    setLokale((forrige) => {
      if (!(varenøgle in forrige.value)) return forrige;
      const resten = { ...forrige.value };
      delete resten[varenøgle];
      return { key: forrige.key, value: resten };
    });
  }, []);

  const toggle = useCallback(
    (varenøgle: string, checked: boolean) => {
      setLokale((forrige) => ({
        key,
        value:
          forrige.key === key
            ? { ...forrige.value, [varenøgle]: checked }
            : { [varenøgle]: checked },
      }));
      setSaveError(null);

      void callApi<{ indkøb: UgensIndkøbSvar }>("/api/ugeplan/indkoeb", {
        method: "POST",
        body: JSON.stringify({
          uge: weekStart,
          varer: [varenøgle],
          afkrydset: checked,
        }),
      })
        .then((data) => {
          setLoaded({ key, value: data.indkøb });
          slip(varenøgle);
        })
        .catch((error: unknown) => {
          setSaveError(messageOf(error));
          slip(varenøgle);
        });
    },
    [key, slip, weekStart],
  );

  const nulstil = useCallback(async () => {
    setSaveError(null);
    try {
      const data = await callApi<{ indkøb: UgensIndkøbSvar }>(
        "/api/ugeplan/indkoeb",
        {
          method: "POST",
          body: JSON.stringify({ uge: weekStart, nulstil: true }),
        },
      );
      setLokale({ key, value: {} });
      setLoaded({ key, value: data.indkøb });
    } catch (error) {
      setSaveError(messageOf(error));
    }
  }, [key, weekStart]);

  return useMemo(
    () => ({
      indkøb,
      isLoading,
      loadError,
      saveError,
      erAfkrydset,
      antalKlaret,
      toggle,
      nulstil,
      reload: () => setAttempt((count) => count + 1),
    }),
    [
      antalKlaret,
      erAfkrydset,
      indkøb,
      isLoading,
      loadError,
      nulstil,
      saveError,
      toggle,
    ],
  );
}
