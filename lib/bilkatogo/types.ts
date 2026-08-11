/**
 * Bilka ToGo: typer for tråden (deres Algolia-svar) og for det Harvest arbejder
 * med (match og kurvlinjer).
 *
 * To adskilte verdener, samme mønster som Skagenfood-kataloget:
 *  - Wire-typerne beskriver kun de felter vi faktisk læser, og alt er valgfrit,
 *    fordi svaret kommer fra et indeks vi ikke styrer.
 *  - Domænetyperne er det Harvest sender videre til kurven.
 *
 * Baggrund for hvorfor det er delt sådan: søgning og kurv er to helt forskellige
 * systemer hos Bilka. Søgningen er en offentlig Algolia-nøgle uden login. Kurven
 * er deres eget API bag et Gigya-login. Derfor kan matching testes frit mod
 * virkeligheden, mens kurv-delen kræver en session Chris selv logger ind i.
 */

// ---------------------------------------------------------------------------
// Tråden: Algolia (prod_BILKATOGO_PRODUCTS)
// ---------------------------------------------------------------------------

/**
 * Søgenøglen skjuler de fleste felter. Et hit har reelt kun objectID og
 * _highlightResult. Produktnavnet findes derfor kun inde i highlightet, med
 * <em>-markering rundt om de matchede ord. Vi henter navnet derfra og fjerner
 * markeringen.
 */
export interface WireHighlightValue {
  value?: string;
}

export interface WireProductHit {
  objectID?: string;
  _highlightResult?: {
    name?: WireHighlightValue;
    searchHierachy?: WireHighlightValue[];
  };
}

export interface WireSearchResponse {
  hits?: WireProductHit[];
  nbHits?: number;
  query?: string;
}

// ---------------------------------------------------------------------------
// Domænet: match og kurv
// ---------------------------------------------------------------------------

/** Et produkt søgningen fandt. productId er det kurven skal bruge. */
export interface ProductMatch {
  productId: string;
  /** Navnet renset for <em>-markering. Kun til visning og bekræftelse. */
  name: string;
  /** Søgningens rang, 0 er bedste hit. Til at vælge og til at vise tvivl. */
  rank: number;
}

/**
 * Resultatet af at slå én indkøbsvare op.
 *
 * source fortæller hvor productId kom fra:
 *  - "override": Chris' egen faste-vare-mapping. Deterministisk, ingen tvivl.
 *  - "search":   bedste Algolia-hit. Kan være forkert, derfor følger alternatives med.
 *  - "none":     intet hit. Varen skal håndteres manuelt, ikke gættes.
 */
export type MatchSource = "override" | "search" | "none";

export interface ShoppingMatch {
  /** Varen som den stod på indkøbslisten (ListItem.n). */
  query: string;
  /** Ønsket antal. Udledt af listen; falder tilbage til 1. */
  count: number;
  source: MatchSource;
  /** null når source er "none". */
  match: ProductMatch | null;
  /** Øvrige hits fra søgningen, så et forkert valg kan rettes. Tom ved override. */
  alternatives: ProductMatch[];
}

/** En linje klar til kurven: hvilket produkt, hvor mange. */
export interface CartLine {
  productId: string;
  count: number;
}

/** Svaret fra ét kurv-kald. Bilka lægger en besked med når noget er begrænset. */
export interface AddLineResult {
  line: CartLine;
  ok: boolean;
  /** Bilkas besked, fx tilbudsgrænse ("må max købe 4"). null når alt gik rent. */
  message: string | null;
  /** Fejltekst når kaldet slog fejl. null ved ok. */
  error: string | null;
}

/**
 * En funktion der sender ét kurv-kald og giver rå-svaret tilbage.
 *
 * Kurv-klienten kender med vilje ikke til cookies, login eller basketGUID. Den
 * får en poster udefra, og i scriptet er den bakket af en Playwright-kontekst
 * der allerede er logget ind. Så kan matching-logikken testes uden en session,
 * og session-delen ligger ét sted.
 */
export type CartPoster = (body: AddToCartBody) => Promise<AddToCartResponse>;

/**
 * Kroppen sitet selv sender pr. vare. Felterne er læst ud af deres frontend:
 * add-kaldet sender {productId, count, fullCart:0}, og søster-kaldet SetOption
 * viser at serveren bruger snake_case med cartVersion:6. Holdes de samme her,
 * ser kaldet ud præcis som browserens eget.
 */
export interface AddToCartBody {
  product_id: string;
  count: number;
  fullCart: 0 | 1;
  cartVersion: number;
}

/**
 * Kun det klienten læser af svaret. Resten af kurven ignoreres her.
 *
 * uid er den vigtigste. Bilka svarer 200 OK, selv når man ikke er logget
 * ind -- varen ryger bare i en ANONYM kurv, som ingen kan se. Det kostede
 * en runde hvor scriptet meldte "19/19 lagt i, 0 fejlede" til en kurv der
 * stod tom paa sitet. HTTP-status alene er derfor ikke et svar paa om det
 * lykkedes.
 */
export interface AddToCartResponse {
  offerLimitMessage?: string;
  message?: string;
  /** -1 = ikke logget ind. Alt andet = den rigtige kurv. */
  uid?: number;
}
