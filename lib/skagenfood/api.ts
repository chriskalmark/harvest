import vm from "node:vm";
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
 *   2. Opskriftssiden, hvor hele objektet ligger i window.__NUXT__.
 *
 * Rute 1 er billigst, men deres søgeindeks er ikke komplet: 2 af 50 retter i
 * uge 33/2026 gav 0 hits (id 16377 og id 15609, hvis titel oven i købet er
 * afkortet med "..."). Rute 2 rammer altid, fordi ugesvaret giver os den
 * præcise sti. Derfor: søg først, fald tilbage til siden, fejl højlydt hvis
 * begge slår fejl.
 */

const GATEWAY = "https://gateway.skagenfood.dk";
const SITE = "https://skagenfood.dk";

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
const HTML_ACCEPT = "text/html";

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

/**
 * Rute 2: opskriftssiden er server-renderet, og hele opskriften ligger i en
 * minificeret `window.__NUXT__=…`-IIFE. Den er JavaScript, ikke JSON, så den
 * skal evalueres.
 *
 * node:vm er ikke en sikkerhedssandkasse, men konteksten får kun `{ window: {} }`
 * — ingen require, ingen process, ingen globalThis fra værten — og koden er
 * afgrænset til netop den ene tildeling. Det er den samme teknik som er
 * verificeret mod tre sider under kortlægningen.
 */
export async function fetchRecipeFromPage(
  recipePath: string,
): Promise<WireRecipe> {
  const url = recipePath.startsWith("http")
    ? recipePath
    : `${SITE}${recipePath}`;
  const html = await fetchText(url, `opskriftssiden ${recipePath}`, {
    accept: HTML_ACCEPT,
    expect: "html",
  });

  const start = html.indexOf("window.__NUXT__=");
  if (start < 0) {
    throw new SkagenfoodImportError(
      `Opskriftssiden ${url} indeholder ikke window.__NUXT__. Siden har skiftet form, og henteren skal rettes.`,
    );
  }
  const end = html.indexOf("</script>", start);
  if (end < 0) {
    throw new SkagenfoodImportError(
      `Opskriftssiden ${url} har et window.__NUXT__ der ikke slutter. Henteren stopper.`,
    );
  }

  const sandbox: { window: { __NUXT__?: unknown } } = { window: {} };
  vm.createContext(sandbox);
  try {
    vm.runInContext(html.slice(start, end), sandbox, { timeout: 5_000 });
  } catch (error) {
    throw new SkagenfoodImportError(
      `Kunne ikke læse opskriftsdataene på ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const recipe = readNuxtRecipe(sandbox.window.__NUXT__);
  if (!recipe) {
    throw new SkagenfoodImportError(
      `Opskriftssiden ${url} havde ingen opskrift under window.__NUXT__.data[0].content.content.recipeViewObject.recipe.`,
    );
  }
  return recipe;
}

function readNuxtRecipe(nuxt: unknown): WireRecipe | null {
  if (!nuxt || typeof nuxt !== "object") return null;
  const data = (nuxt as { data?: unknown }).data;
  if (!Array.isArray(data) || !data.length) return null;
  const content = (data[0] as { content?: { content?: unknown } })?.content
    ?.content;
  if (!content || typeof content !== "object") return null;
  const recipe = (content as { recipeViewObject?: { recipe?: unknown } })
    .recipeViewObject?.recipe;
  if (!recipe || typeof recipe !== "object") return null;
  return recipe as WireRecipe;
}
