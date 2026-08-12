import { searchProducts } from "@/lib/bilkatogo/algolia";
import { antalPakker, bedsteHit } from "@/lib/bilkatogo/maengde";
import type { ProductMatch, ShoppingMatch } from "@/lib/bilkatogo/types";

/**
 * At koble en indkøbsvare til et Bilka-produkt.
 *
 * Kernen i problemet: "hakket oksekød" giver mange hits, og det bedste
 * søgeresultat er ikke altid den vare Chris plejer at købe. Ren søgning er
 * derfor et gæt. To ting gør det pålideligt:
 *
 *  1. En override-mapping fra varenavn til produkt-id. Chris' faste varer slås
 *     ikke op, de peger direkte på det rigtige produkt. Deterministisk.
 *  2. For alt andet: bedste hit, men alternativerne følger med, så et forkert
 *     valg kan rettes uden en ny søgning. Og et manglende hit gætter vi ikke
 *     på; det markeres som "none" og skal håndteres i hånden.
 *
 * Tanken er at override-listen vokser af sig selv: hver gang en søgning ramte
 * forkert, tilføjer Chris varen til mappingen, og næste uge er den fast.
 */

/** Det matching skal bruge fra en indkøbslinje. ListItem opfylder det. */
export interface ShoppingLineInput {
  /** Varenavn (ListItem.n). */
  n: string;
  /** Mængde som fritekst (ListItem.q), fx "2", "500 g", "1 pakke". */
  q?: string;
}

/**
 * Override-mapping: varenavn (normaliseret) til produkt-id.
 *
 * Nøglen normaliseres på samme måde som opslaget, så "Letmælk", "letmælk" og
 * " letmælk " rammer samme post. En tom eller manglende værdi betyder "ingen
 * override for den vare".
 */
export type OverrideMap = Record<string, string>;

/** Ens nøgleform for både mapping og opslag: små bogstaver, trimmet. */
export function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Antal ud af en fritekst-mængde.
 *
 * Kun et ledende heltal tæller som stykantal ("2", "2 stk", "2 pakker" -> 2).
 * En mængde i vægt eller volumen ("500 g", "1,5 l") er ikke et stykantal, og
 * der købes så 1 af varen. Det er den ærlige fortolkning: Bilkas kurv tæller
 * enheder, ikke gram, og vi opfinder ikke en omregning vi ikke har.
 */
export function parseCount(q: string | undefined): number {
  if (!q) return 1;
  const match = q.trim().match(/^(\d+)(?!\s*[.,]?\d*\s*(g|kg|ml|l|dl))/i);
  if (!match) return 1;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Match én indkøbslinje.
 *
 * Override vinder altid og springer søgningen helt over. Ellers søges der, og
 * bedste hit bliver valget mens resten bliver alternativer. Intet hit giver
 * source "none" og match null.
 */
export async function matchLine(
  line: ShoppingLineInput,
  overrides: OverrideMap = {},
): Promise<ShoppingMatch> {
  /*
   * Foreloebigt antal. Er der et soegetraef, regnes det om nedenfor ud fra
   * pakkestoerrelsen i produktnavnet -- "1,5 kg kartofler" mod en pose paa
   * 1 kg er to poser, ikke én. Uden det blev alt med vaegt til 1 stk.
   */
  const count = parseCount(line.q);
  const key = normalizeKey(line.n);

  const overrideId = overrides[key];
  if (overrideId) {
    return {
      query: line.n,
      count,
      source: "override",
      match: { productId: overrideId, name: line.n, rank: 0 },
      alternatives: [],
    };
  }

  const hits = await searchProducts(line.n);
  if (hits.length === 0) {
    return {
      query: line.n,
      count,
      source: "none",
      match: null,
      alternatives: [],
    };
  }

  /*
   * Vaelg efter PAKKESTOERRELSE, ikke efter soegningens raekkefoelge.
   *
   * Bilkas oeverste hit for "svinemoerbrad" er en storkoekkenpakke paa
   * 2,7 kg. Skal der bruges 300 g, er det ni gange for meget -- og det
   * havnede i kurven, fordi vi altid tog hits[0].
   */
  const best = bedsteHit(hits, line.q)!;
  const rest = hits.filter((h) => h !== best);

  /*
   * Antallet regnes ud af PAKKESTOERRELSEN i produktnavnet.
   *
   * "Salling Bagekartofler 1,5 kg" daekker 500 g med én pose, mens
   * "Kartofler 1 kg" kraever to til halvanden kilo. Foer det her blev alt
   * med vaegt til 1 stk, uanset hvor meget der skulle bruges.
   *
   * Og "2 stk" ganges kun op, naar varen saelges styksvis -- ellers blev
   * to nakkekoteletter til to bakker af 3,2 kg.
   */
  const beregnet = antalPakker(line.q, best.name);

  return {
    query: line.n,
    count: beregnet.antal,
    countBegrundelse: beregnet.begrundelse,
    source: "search",
    match: best,
    alternatives: rest,
  };
}

/**
 * Match en hel liste. Kørt i rækkefølge frem for parallelt: det er høfligt mod
 * deres API, og en indkøbsliste er små tal, så det er hurtigt nok.
 */
export async function matchList(
  lines: ShoppingLineInput[],
  overrides: OverrideMap = {},
): Promise<ShoppingMatch[]> {
  const results: ShoppingMatch[] = [];
  for (const line of lines) {
    results.push(await matchLine(line, overrides));
  }
  return results;
}

/** De matches der faktisk kan lægges i kurven (override eller søgning ramte). */
export function matchedProductIds(
  matches: ShoppingMatch[],
): { productId: string; count: number }[] {
  return matches
    .filter((m): m is ShoppingMatch & { match: ProductMatch } => m.match !== null)
    .map((m) => ({ productId: m.match.productId, count: m.count }));
}
