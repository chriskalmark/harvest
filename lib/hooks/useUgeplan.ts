"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeekPlan } from "@/lib/weekPlan/types";

/**
 * Ugeplanen set fra skærmen.
 *
 * Alle skrivninger svarer med HELE ugen bagefter -- derfor gætter denne hook
 * aldrig paa hvordan ugen ser ud nu. Den saetter simpelthen det svaret siger.
 * Ingen optimistisk opdatering, ingen genlaesning bagefter: én tur til
 * serveren, og skærmen viser det databasen faktisk indeholder.
 *
 * Det hentede gemmes sammen med den nøgle det blev hentet paa (ugen plus et
 * forsøgsnummer). Derfor er "henter" et regnestykke og ikke en tilstand der
 * skal saettes: staar der ikke et svar paa den nøgle skærmen spørger om, er
 * der ikke hentet endnu. Skifter man hurtigt frem og tilbage mellem to uger,
 * kan et langsomt svar paa uge 33 ikke lande oven paa uge 34 -- nøglen passer
 * ikke, og svaret bliver ikke vist.
 */

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
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

export interface WeekPlanController {
  weekPlan: WeekPlan | null;
  isLoading: boolean;
  loadError: string | null;
  /** Ugedagen der lige nu bliver gemt, eller null. */
  savingWeekday: number | null;
  saveError: string | null;
  clearSaveError: () => void;
  setRecipe: (weekday: number, recipeId: number) => Promise<boolean>;
  setManualDish: (weekday: number, title: string) => Promise<boolean>;
  clearDay: (weekday: number) => Promise<boolean>;
  setPortions: (weekday: number, portions: number) => Promise<boolean>;
  reload: () => void;
}

export function useWeekPlan(weekStart: string): WeekPlanController {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Keyed<WeekPlan> | null>(null);
  const [failed, setFailed] = useState<Keyed<string> | null>(null);
  const [savingWeekday, setSavingWeekday] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const key = `${weekStart}#${attempt}`;

  useEffect(() => {
    let cancelled = false;

    callApi<{ weekPlan: WeekPlan }>(
      `/api/ugeplan?uge=${encodeURIComponent(weekStart)}`,
    )
      .then((data) => {
        if (!cancelled) setLoaded({ key, value: data.weekPlan });
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailed({ key, value: messageOf(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [key, weekStart]);

  const weekPlan = loaded?.key === key ? loaded.value : null;
  const loadError = failed?.key === key ? failed.value : null;
  const isLoading = weekPlan === null && loadError === null;

  const mutate = useCallback(
    async (
      weekday: number,
      url: string,
      method: "PUT" | "POST",
      body: Record<string, unknown>,
    ): Promise<boolean> => {
      setSavingWeekday(weekday);
      setSaveError(null);
      try {
        const data = await callApi<{ weekPlan: WeekPlan }>(url, {
          method,
          body: JSON.stringify({ uge: weekStart, dag: weekday, ...body }),
        });
        // Svaret gaelder den uge der stod paa kaldet. Er skærmen naaet videre
        // til en anden uge imens, passer nøglen ikke, og svaret vises ikke.
        setLoaded({ key, value: data.weekPlan });
        return true;
      } catch (error) {
        setSaveError(messageOf(error));
        return false;
      } finally {
        setSavingWeekday(null);
      }
    },
    [key, weekStart],
  );

  return useMemo(
    () => ({
      weekPlan,
      isLoading,
      loadError,
      savingWeekday,
      saveError,
      clearSaveError: () => setSaveError(null),
      setRecipe: (weekday: number, recipeId: number) =>
        mutate(weekday, "/api/ugeplan/dag/opskrift", "PUT", {
          opskriftId: recipeId,
        }),
      setManualDish: (weekday: number, title: string) =>
        mutate(weekday, "/api/ugeplan/dag/manuel", "PUT", { navn: title }),
      clearDay: (weekday: number) =>
        mutate(weekday, "/api/ugeplan/dag/ryd", "POST", {}),
      setPortions: (weekday: number, portions: number) =>
        mutate(weekday, "/api/ugeplan/dag/portioner", "PUT", {
          portioner: portions,
        }),
      reload: () => setAttempt((count) => count + 1),
    }),
    [isLoading, loadError, mutate, saveError, savingWeekday, weekPlan],
  );
}
