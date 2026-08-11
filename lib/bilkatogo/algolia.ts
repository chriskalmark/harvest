import type {
  ProductMatch,
  WireProductHit,
  WireSearchResponse,
} from "@/lib/bilkatogo/types";

/**
 * Søgelaget mod Bilka ToGo.
 *
 * Det er den offentlige Algolia-instans deres eget site søger i. App-id og
 * søgenøgle ligger i klartekst i deres frontend-bundle, fordi enhver besøgende
 * skal kunne søge uden login. Nøglen er søge-only: den kan slå produkter op,
 * ikke ændre noget. Det er derfor matching kan bygges og testes frit, mens
 * kurven kræver en rigtig session.
 *
 * Bemærk om felterne: søgenøglen er sat op til kun at levere objectID og
 * _highlightResult. Produktnavnet står derfor kun inde i highlightet, med
 * <em>-markering rundt om de matchede ord. Vi tager navnet derfra og fjerner
 * markeringen. Der er ingen pris eller lagerstatus at hente her; det ligger bag
 * kurv-API'et. Til at koble en indkøbsvare til et produkt-id er navn + id nok.
 */

const APP_ID = "F9VBJLR1BK";
/** Søge-only nøgle fra deres frontend. Kan kun læse produktindekset. */
const SEARCH_API_KEY = "1deaf41c87e729779f7695c00f190cc9";
const INDEX = "prod_BILKATOGO_PRODUCTS";

const ENDPOINT = `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX}/query`;

/**
 * nonsearchable:false er det filter deres eget site altid lægger på. Uden det
 * kommer varer med der ikke må dukke op i en søgning. Vi bruger samme filter,
 * så vores hits svarer til dem en bruger ville se.
 */
const BASE_FILTERS = "nonsearchable:false";

const DEFAULT_HITS = 8;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export class BilkatogoSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BilkatogoSearchError";
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fjern Algolias <em>-markering fra en highlightet streng. */
function stripHighlight(value: string): string {
  return value.replace(/<\/?em>/g, "").trim();
}

/**
 * Produktnavnet ud af et hit. Prøver name-feltet først, ellers første led i
 * searchHierachy (produktets eget navn står øverst i hierarkiet). Tom streng
 * når intet af det findes; kaldet afgør så selv om det duer.
 */
function nameOfHit(hit: WireProductHit): string {
  const highlight = hit._highlightResult;
  const fromName = highlight?.name?.value;
  if (fromName) return stripHighlight(fromName);
  const fromHierarchy = highlight?.searchHierachy?.[0]?.value;
  if (fromHierarchy) return stripHighlight(fromHierarchy);
  return "";
}

async function postQuery(
  query: string,
  hitsPerPage: number,
  timeoutMs: number,
): Promise<WireSearchResponse> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "X-Algolia-Application-Id": APP_ID,
          "X-Algolia-API-Key": SEARCH_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          hitsPerPage,
          filters: BASE_FILTERS,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as WireSearchResponse;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 500);
      }
    }
  }

  throw new BilkatogoSearchError(
    `Kunne ikke søge på "${query}" efter ${MAX_ATTEMPTS} forsøg: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

/**
 * Slå en søgestreng op og få produkterne tilbage, bedste hit først.
 *
 * Returnerer en tom liste når Algolia ikke fandt noget. Hits uden objectID
 * springes over; et produkt uden id kan alligevel ikke lægges i kurven.
 */
export async function searchProducts(
  query: string,
  options: { hitsPerPage?: number; timeoutMs?: number } = {},
): Promise<ProductMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const response = await postQuery(
    trimmed,
    options.hitsPerPage ?? DEFAULT_HITS,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const matches: ProductMatch[] = [];
  for (const hit of response.hits ?? []) {
    if (!hit.objectID) continue;
    matches.push({
      productId: hit.objectID,
      name: nameOfHit(hit),
      rank: matches.length,
    });
  }
  return matches;
}
