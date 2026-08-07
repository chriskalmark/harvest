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
 * Én rute til den fulde opskrift: /api/recipes/search, match på id.
 * (Opskriftssidens window.__NUXT__ blev tidligere brugt som reserve. Den
 *  vej er fjernet: den kraevede at koere fremmed JavaScript fra sitet.)
 *
 * Deres søgning kan IKKE stoles på med en hel titel. Målt mod uge 33/2026:
 * "Grillede koteletter med grønne bønner og quinoa" (id 16377) giver 0 hits,
 * selvom det er ordret det navn indekset selv har på retten — men
 * "Grillede koteletter med grønne" finder den. Det samme gælder id 13709.
 * Og id 15609 får sin titel afkortet midt i et ord ("... og yogh...") allerede
 * i ugesvaret, så den hele titel findes slet ikke at søge på.
 *
 * Derfor: søg med titlen, og korter den ét ord ad gangen fra enden, indtil
 * retten dukker op. Der accepteres kun et svar med det id vi leder efter, så
 * en kortere søgning kan aldrig hente en forkert ret ind.
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

/** Færrest ord vi vil søge på. Under det bliver et træf tilfældigt. */
const MIN_QUERY_WORDS = 2;

/** Hvor mange svar vi beder om. Bredt nok til at retten er med, når titlen kortes. */
const SEARCH_COUNT = 20;

/**
 * Søgeord for én ret, længste først.
 *
 * Sidste ord ryger et ad gangen, fordi det er halen der får deres søgning til
 * at svare tomt — og fordi en afkortet titel ("... og yogh...") netop har et
 * halvt ord til sidst.
 */
export function searchQueriesForTitle(title: string): string[] {
  const cleaned = title.replace(/\s*(\.{3}|…)\s*$/, "").trim();
  if (!cleaned) return [];

  const words = cleaned.split(/\s+/);
  const queries: string[] = [];
  for (let length = words.length; length >= MIN_QUERY_WORDS; length -= 1) {
    queries.push(words.slice(0, length).join(" "));
  }
  // Ét-ords-titler skal stadig kunne slås op.
  if (queries.length === 0) queries.push(cleaned);
  return queries;
}

/**
 * Slå retten op og match på id. Returnerer null når ingen af søgningerne
 * finder id'et — så er retten utilgængelig, og det skal fejle højlydt.
 *
 * Der accepteres kun et svar hvor id stemmer. En kortere søgning kan derfor
 * aldrig få en anden ret til at snige sig ind i kataloget.
 */
export async function searchRecipeById(
  title: string,
  recipeId: number,
): Promise<WireRecipe | null> {
  for (const query of searchQueriesForTitle(title)) {
    const url =
      `${GATEWAY}/api/recipes/search?skip=0&count=${SEARCH_COUNT}&FilterByFavorites=false` +
      `&query=${encodeURIComponent(query)}`;
    const response = await fetchJson<WireRecipeSearchResponse>(
      url,
      `opskriften "${title}"`,
    );
    const hit = (response.recipes ?? []).find((r) => r.id === recipeId);
    if (hit) return hit;
  }
  return null;
}
