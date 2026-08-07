import { foldDanish, normalizeCatalogQuery } from "@/lib/weekPlan/catalogQuery";
import type { PickerRecipe } from "@/lib/catalog/types";

/**
 * Vælgerens rene regnestykker: søgning, filtrering, gruppering og portioner.
 *
 * Ingen database, intet netværk, ingen React. Hele ugen -- ~50 retter, hele
 * kataloget 93 -- ligger allerede i telefonen når vælgeren åbner, så alt
 * herinde kører på et array og svarer med det samme. Det er hele grunden til
 * at der ikke er en søgerute: et tastetryk må ikke koste en netværkstur i en
 * butik med dårligt signal.
 *
 * Foldningen af æ/ø/å er lånt fra lib/weekPlan/catalogQuery.ts frem for
 * skrevet om. To forskellige folder i samme app ville betyde, at den samme
 * søgning gav to forskellige svar afhængigt af hvilken skærm man stod på.
 */

/**
 * Skagenfoods egne hovedingrediens-etiketter, i den rækkefølge de skal stå.
 * Kød først, så fisk, så det grønne -- ikke alfabetisk, for alfabetisk ville
 * sætte "Fisk" før "Fjerkræ" og "Grøntsager" midt imellem kødet.
 *
 * Målt på kataloget (93 opskrifter, uge 32+33/2026): Fisk 26, Gris 25,
 * Okse 18, Fjerkræ 17, Grøntsager 15, Skaldyr 2. Etiketter vi ikke kender
 * på forhånd falder bagerst, alfabetisk -- de forsvinder ikke.
 */
export const MAIN_INGREDIENT_ORDER = [
  "Fjerkræ",
  "Okse",
  "Gris",
  "Fisk",
  "Skaldyr",
  "Grøntsager",
] as const;

/** Retter uden hovedingrediens-etiket. Ingen ret må falde ud af listen. */
export const OTHER_MAIN_INGREDIENT = "Andet";

/** Grænsen for "hurtig". 30 minutter er en hverdagsaften. */
export const QUICK_MINUTES = 30;

/**
 * Den ene etiket retten sorteres under, når den har flere.
 * Rækkefølgen i MAIN_INGREDIENT_ORDER afgør: en ret tagget både "Gris" og
 * "Fjerkræ" lander under Fjerkræ, hver gang, uanset hvad Skagenfood skrev først.
 */
export function primaryMainIngredient(values: string[]): string | null {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  for (const known of MAIN_INGREDIENT_ORDER) {
    const hit = cleaned.find((value) => value === known);
    if (hit) return hit;
  }
  return [...cleaned].sort((a, b) => a.localeCompare(b, "da"))[0];
}

/** Etiketten retten står under i listen. Aldrig null -- så hellere "Andet". */
export function bucketOf(recipe: PickerRecipe): string {
  return recipe.mainIngredient ?? OTHER_MAIN_INGREDIENT;
}

function bucketRank(bucket: string): number {
  const index = MAIN_INGREDIENT_ORDER.indexOf(
    bucket as (typeof MAIN_INGREDIENT_ORDER)[number],
  );
  if (index !== -1) return index;
  // "Andet" allerbagerst, ukendte etiketter lige foran.
  return bucket === OTHER_MAIN_INGREDIENT
    ? MAIN_INGREDIENT_ORDER.length + 1
    : MAIN_INGREDIENT_ORDER.length;
}

/**
 * Alt der kan søges på i én streng: navn, hovedingrediens, opskriftstype og
 * ingrediensnavne. Ingredienserne er med, fordi "quinoa" og "kartofler" er
 * lige så gyldige indgange som "laks" -- og de står sjældent i titlen.
 */
export function searchHaystack(recipe: PickerRecipe): string {
  return foldDanish(
    normalizeCatalogQuery(
      [
        recipe.name,
        ...recipe.mainIngredients,
        ...recipe.recipeTypes,
        ...recipe.ingredientNames,
      ].join(" "),
    ),
  );
}

/**
 * Alle ord i søgningen skal findes, i vilkårlig rækkefølge. "laks kartoffel"
 * finder retten der har begge dele, uanset hvad der står først i titlen.
 */
export function matchesQuery(recipe: PickerRecipe, query: string): boolean {
  const words = foldDanish(normalizeCatalogQuery(query))
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchHaystack(recipe);
  return words.every((word) => haystack.includes(word));
}

export interface PickerFilters {
  query: string;
  /** Null = alle hovedingredienser. */
  mainIngredient: string | null;
  /** Null = ingen tidsgrænse. Retter uden tid falder ud når der er en grænse. */
  maxMinutes: number | null;
}

export const EMPTY_FILTERS: PickerFilters = {
  query: "",
  mainIngredient: null,
  maxMinutes: null,
};

export function hasActiveFilters(filters: PickerFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.mainIngredient !== null ||
    filters.maxMinutes !== null
  );
}

export function filterRecipes(
  recipes: PickerRecipe[],
  filters: PickerFilters,
): PickerRecipe[] {
  return recipes.filter((recipe) => {
    if (
      filters.mainIngredient !== null &&
      bucketOf(recipe) !== filters.mainIngredient
    ) {
      return false;
    }
    if (filters.maxMinutes !== null) {
      // Ukendt tid kan ikke love at være under grænsen. Den ryger ud, frem
      // for at blive vist som noget den måske ikke er.
      if (recipe.totalMinutes === null) return false;
      if (recipe.totalMinutes > filters.maxMinutes) return false;
    }
    return matchesQuery(recipe, filters.query);
  });
}

export interface MainIngredientFacet {
  value: string;
  count: number;
}

/**
 * Chippernes tal. Tælles på det der er tilbage EFTER søgning og tidsgrænse,
 * men før hovedingrediens-valget -- ellers ville den valgte chip stå med sit
 * eget tal og alle andre med nul, og man kunne ikke se hvad man skifter til.
 */
export function mainIngredientFacets(
  recipes: PickerRecipe[],
  filters: PickerFilters,
): MainIngredientFacet[] {
  const withoutIngredientFilter = filterRecipes(recipes, {
    ...filters,
    mainIngredient: null,
  });

  const counts = new Map<string, number>();
  for (const recipe of withoutIngredientFilter) {
    const bucket = bucketOf(recipe);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort(
      (a, b) =>
        bucketRank(a.value) - bucketRank(b.value) ||
        a.value.localeCompare(b.value, "da"),
    );
}

/**
 * Hurtigst først, derefter alfabetisk på dansk.
 *
 * Det gør den første ret i hver sektion til den hurtigste i sin kategori --
 * og det er netop den, listen viser stort. Størrelsen har altså en grund:
 * den peger på ugens hurtigste kyllingeret, ikke på en tilfældig.
 */
export function comparePickerRecipes(a: PickerRecipe, b: PickerRecipe): number {
  const aMinutes = a.totalMinutes ?? Number.POSITIVE_INFINITY;
  const bMinutes = b.totalMinutes ?? Number.POSITIVE_INFINITY;
  if (aMinutes !== bMinutes) return aMinutes - bMinutes;
  return a.name.localeCompare(b.name, "da");
}

export interface PickerSection {
  key: string;
  label: string;
  recipes: PickerRecipe[];
}

/** Retterne delt op efter hovedingrediens, i fast rækkefølge. */
export function groupRecipes(recipes: PickerRecipe[]): PickerSection[] {
  const byBucket = new Map<string, PickerRecipe[]>();
  for (const recipe of recipes) {
    const bucket = bucketOf(recipe);
    const list = byBucket.get(bucket);
    if (list) list.push(recipe);
    else byBucket.set(bucket, [recipe]);
  }

  return [...byBucket.entries()]
    .map(([label, list]) => ({
      key: label,
      label,
      recipes: [...list].sort(comparePickerRecipes),
    }))
    .sort(
      (a, b) =>
        bucketRank(a.label) - bucketRank(b.label) ||
        a.label.localeCompare(b.label, "da"),
    );
}

/**
 * "35 min" og "2 pers." skrives af lib/weekPlan/view.ts (formatMinutes og
 * portionsLabel) -- ugeplanens rækker og vælgerens rækker står side om side,
 * og de to skal skrive tid og portioner ens.
 */

/** "10 ingredienser" -- og "1 ingrediens", for det hedder det på dansk. */
export function ingredientCountLabel(count: number): string {
  return count === 1 ? "1 ingrediens" : `${count} ingredienser`;
}

/**
 * Kan retten overhovedet laves til så mange?
 *
 * Skagenfood leverer mængder for bestemte portionsantal -- som regel
 * {1,2,3,4}, men fx opskrift 13621 har kun {2,3,4}. Portionsantallet hører
 * til DAGEN og skal ikke laves om, fordi man skifter ret. Så i stedet for
 * stiltiende at rykke dagen fra 5 til 4 siger vælgeren det på kortet:
 * retten kan vælges, man ved bare hvad man går ind til.
 *
 * Tom liste betyder "vi ved det ikke" -- og så påstår vi ikke noget.
 */
export function supportsPortions(
  recipe: PickerRecipe,
  portions: number,
): boolean {
  if (recipe.portionOptions.length === 0) return true;
  return recipe.portionOptions.includes(portions);
}

/** "Ingen mængder til 5 pers." -- kun når det er tilfældet. */
export function missingPortionsNote(
  recipe: PickerRecipe,
  portions: number,
): string | null {
  if (supportsPortions(recipe, portions)) return null;
  return `Ingen mængder til ${portions} pers.`;
}
