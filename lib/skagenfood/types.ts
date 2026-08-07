/**
 * Skagenfood-kataloget: typer for både tråden (deres JSON) og katalogets
 * egen form (det vi gemmer).
 *
 * Tråd-typerne beskriver kun de felter henteren faktisk læser. Alt er
 * valgfrit, fordi svaret kommer fra et fremmed API vi ikke kontrollerer --
 * normaliseringen i normalize.ts er det sted der kræver og fejler højlydt.
 */

// ---------------------------------------------------------------------------
// Tråden: gateway.skagenfood.dk
// ---------------------------------------------------------------------------

export interface WireAmount {
  numberOfPortions?: number;
  hasValue?: boolean;
  amount?: number;
  unitKey?: string;
  formattedIngredientLine?: string;
}

export interface WireImage {
  source?: { url?: string };
}

export interface WireIngredient {
  name?: string;
  mainIngredient?: boolean;
  allergenic?: boolean;
  baseIngredientName?: string;
  amounts?: WireAmount[];
  image?: WireImage;
}

export interface WireIngredientGroup {
  name?: string;
  ingredients?: WireIngredient[];
}

export interface WireStep {
  minutesInTimeline?: number;
  title?: string;
  text?: string;
  textStripped?: string;
  ingredients?: Array<{ name?: string }>;
}

export interface WireTagGroup {
  groupAlias?: string;
  values?: Array<{ name?: string; displayName?: string; value?: string }>;
}

export interface WireEnergyEntry {
  name?: string;
  amount?: number;
  unit?: string;
}

/** Et helt opskriftsobjekt, som det ser ud både i /api/recipes/search og i SSR-siden. */
export interface WireRecipe {
  id?: number;
  name?: string;
  totalMinutes?: number;
  formattedTimeTotal?: string;
  meta?: { urlName?: string };
  image?: WireImage;
  ingredientGroups?: WireIngredientGroup[];
  steps?: WireStep[];
  tags?: WireTagGroup[];
  energyData?: WireEnergyEntry[];
}

export interface WireRecipeSearchResponse {
  paginationInfo?: { totalHits?: number };
  recipes?: WireRecipe[];
}

/** Rettens plads i en kasse -- her står id'et vi skal hente den fulde opskrift for. */
export interface WireBoxContent {
  dayName?: string;
  title?: string;
  recipe?: {
    id?: number;
    title?: string;
    imageUrl?: string;
    url?: string;
    formattedTimeTotal?: string;
  } | null;
}

export interface WireWeek {
  name?: string;
  year?: number;
  displayName?: string;
  imageUrl?: string;
  teaser?: string;
  items?: Array<{ boxContents?: WireBoxContent[] }>;
}

export interface WireSubscriptionPackage {
  id?: number;
  sku?: string;
  name?: string;
  url?: string;
  sortOrder?: number;
  weeks?: WireWeek[];
}

export interface WireWeeklyPackagesResponse {
  subscriptionPackages?: WireSubscriptionPackage[];
}

// ---------------------------------------------------------------------------
// Katalogets egen form
// ---------------------------------------------------------------------------

export interface IsoWeek {
  year: number;
  week: number;
}

export interface CatalogAmount {
  /** Antal portioner denne mængde gælder for (1-5). */
  portions: number;
  amount: number;
  unitKey: string;
  /** Skagenfoods færdige danske linje, fx "400 g bagekartofler". */
  line: string;
}

export interface CatalogIngredient {
  name: string;
  /** Ingrediensgruppens navn; "" for hovedlisten, ellers fx "Sovs" eller "Topping". */
  section: string;
  /** Skagenfoods varegruppe, fx "3. Frugt, grønsager & snitgrønt". */
  baseGroup: string;
  mainIngredient: boolean;
  allergenic: boolean;
  imageUrl: string | null;
  amounts: CatalogAmount[];
}

export interface CatalogStep {
  /**
   * minutesInTimeline — trinnets tidsstempel i opskriftens tidslinje.
   * Null når Skagenfood ikke har tidsstemplet trinnet (38 af 186 trin i
   * uge 33/2026). Null er sandheden; 0 ville være et opfundet tidsstempel.
   */
  minute: number | null;
  title: string;
  /** Ren tekst (textStripped). */
  text: string;
  /** Samme trin som HTML, hvis vi vil vise afsnit. */
  html: string;
  ingredients: string[];
}

export interface CatalogTagGroup {
  group: string;
  values: string[];
}

export interface CatalogEnergyEntry {
  name: string;
  amount: number;
  unit: string;
}

export type CatalogRecipeSource = "search" | "ssr";

export interface CatalogRecipe {
  recipeId: number;
  name: string;
  urlName: string | null;
  url: string | null;
  imageUrl: string | null;
  totalMinutes: number | null;
  portionOptions: number[];
  ingredients: CatalogIngredient[];
  pantryItems: string[];
  equipment: string[];
  steps: CatalogStep[];
  tags: CatalogTagGroup[];
  energy: CatalogEnergyEntry[];
  source: CatalogRecipeSource;
}

/** En ret-plads i en kasse. Peger på en opskrift via recipeId. */
export interface CatalogBoxSlot {
  position: number;
  recipeId: number;
  dayName: string | null;
  boxTitle: string | null;
  /** Rå billed-URL fra ugesvaret; bedre end SSR-sidens beskårne variant. */
  imageUrl: string | null;
  /** Rettens titel i ugesvaret. Kan være afkortet med "..." -- brug den kun til opslag. */
  lookupTitle: string;
  /** Sti til opskriftssiden, fx "/da-dk/opskrifter/...-13677". */
  recipePath: string | null;
}

export interface CatalogBox {
  packageId: number;
  sku: string | null;
  name: string;
  portions: number | null;
  days: number | null;
  imageUrl: string | null;
  teaser: string | null;
  sortOrder: number;
  slots: CatalogBoxSlot[];
}

export interface CatalogWeek {
  year: number;
  week: number;
  displayName: string;
  boxes: CatalogBox[];
  /** Ret-plads uden opskrift bliver ikke gemt, men tælles og rapporteres. */
  slotsWithoutRecipe: number;
}
