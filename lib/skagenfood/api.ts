import { SkagenfoodImportError } from "@/lib/skagenfood/normalize";
import type {
  WireRecipe,
  WireRecipeSearchResponse,
  WireWeeklyPackagesResponse,
} from "@/lib/skagenfood/types";

/**
 * Netværkslaget mod Skagenfood.
 *
 * Deres gateway kræver hverken nøgle, login eller cookie, men svarer uden
 * access-control-allow-origin. Alle kald skal derfor ske server-side — det er
 * derfor henteren er et script og ikke noget browseren kan gøre.
 *
 * To ruter til den fulde opskrift:
 *   1. /api/recipes/search med den præcise titel, match på id.
 *   (Opskriftssidens window.__NUXT__ blev tidligere brugt som reserve. Den
 *    vej er fjernet: den kraevede at koere fremmed JavaScript fra sitet.)
 *
 * Rute 1 er billigst, men deres søgeindeks er ikke komplet: 2 af 50 retter i
 * uge 33/2026 gav 0 hits (id 16377 og id 15609, hvis titel oven i købet er
 * afkortet med "..."). Rute 2 rammer altid, fordi ugesvaret giver os den
 * præcise sti. Derfor: søg først, fald tilbage til siden, fejl højlydt hvis
 * begge slår fejl.
 */

const GATEWAY = "https://gateway.skagenfood.dk";

/** MåltidsKasser. De to andre sektioner har en anden form og ingen ugeopskrifter. */
export const MEAL_BOX_SECTION_ID = 9000997;

const DEFAULT_TIMEOUT_MS = 60_000;
const WEEK_TIMEOUT_MS = 180_000; // Ugesvaret er 7,5 MB.
const MAX_ATTEMPTS = 3;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Skagenfoods gateway er ServiceStack, og den forhandler indhold på Accept.
 * Nævner man text/html med i listen, svarer den med en 2,6 MB HTML-side i
 * stedet for JSON — og med status 200. Derfor er Accept snæver her, og derfor
 * tjekker vi content-type i stedet for kun at stole på statuskoden.
 */
const JSON_ACCEPT = "application/json";

async function fetchText(
  url: string,
  what: string,
  options: { accept: string; expect: "json" | "html"; timeoutMs?: number },
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: options.accept },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (options.expect === "json" && !contentType.includes("json")) {
        throw new Error(
          `svarede med content-type "${contentType}" i stedet for JSON (status ${response.status})`,
        );
      }

      const body = await response.text();
      if (!body) {
        throw new Error("tomt svar");
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 1_000);
      }
    }
  }

  throw new SkagenfoodImportError(
    `Kunne ikke hente ${what} fra Skagenfood efter ${MAX_ATTEMPTS} forsøg (${url}): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function fetchJson<T>(
  url: string,
  what: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const body = await fetchText(url, what, {
    accept: JSON_ACCEPT,
    expect: "json",
    timeoutMs,
  });
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new SkagenfoodImportError(
      `Skagenfood svarede med noget der ikke er JSON for ${what} (${url}).`,
    );
  }
}

/** Alle måltidskasser og alle tre uger i ét kald. */
export async function fetchWeeklyPackages(): Promise<WireWeeklyPackagesResponse> {
  const url =
    `${GATEWAY}/api/headless/weekly-content/sections/GetSubscriptionPackagesBySectionIds` +
    `?sectionIds=${MEAL_BOX_SECTION_ID}`;
  return fetchJson<WireWeeklyPackagesResponse>(
    url,
    "ugens måltidskasser",
    WEEK_TIMEOUT_MS,
  );
}

/**
 * Rute 1: slå op på præcis titel og match på id. Returnerer null når retten
 * ikke er i søgeindekset — det er ikke en fejl, det er signalet til at falde
 * tilbage til opskriftssiden.
 */
export async function searchRecipeById(
  title: string,
  recipeId: number,
): Promise<WireRecipe | null> {
  const query = title.replace(/\s*(\.{3}|…)\s*$/, "").trim();
  if (!query) return null;

  const url =
    `${GATEWAY}/api/recipes/search?skip=0&count=10&FilterByFavorites=false` +
    `&query=${encodeURIComponent(query)}`;
  const response = await fetchJson<WireRecipeSearchResponse>(
    url,
    `opskriften "${title}"`,
  );
  return (response.recipes ?? []).find((r) => r.id === recipeId) ?? null;
}
