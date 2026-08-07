import type {
  CatalogEnergyEntry,
  CatalogIngredient,
  CatalogRecipe,
  CatalogStep,
  CatalogTagGroup,
} from "@/lib/skagenfood/types";
import type {
  RecipeCard,
  RecipeIngredientLine,
  RecipeIngredientSection,
  RecipeStepView,
  RecipeView,
} from "@/lib/recipe/types";

/**
 * Opskriftsvisningens regnestykker. Rene funktioner -- ingen React, ingen
 * database, intet netvaerk. Det er her alt det, skaermen viser, bliver
 * afgjort, saa det kan proeves af uden at starte en browser.
 *
 * To ting styrer alle valg herinde:
 *
 *   1. Vi finder aldrig et tal paa. Skagenfood har allerede skrevet hver
 *      maengde faerdig paa dansk for 1-5 portioner ("0,5 stk blomkål").
 *      Mangler linjen for et portionsantal, viser vi navnet alene -- vi
 *      ganger ikke selv og gaetter os til "1,5 stk".
 *   2. Null er sandheden. Et trin uden tidsstempel faar ingen tid paa
 *      skaermen; 51 af 399 trin i kataloget er uden.
 */

/** To voksne i husstanden -- det er det antal, skærmen åbner på. */
export const DEFAULT_PORTIONS = 2;

// ---------------------------------------------------------------------------
// Portionsantal
// ---------------------------------------------------------------------------

/**
 * Vaelger det portionsantal skaermen skal vise.
 *
 * Opskrifterne er ikke enige om hvilke antal de kan: nogle kan {1,2,3,4},
 * andre {2,3,4,5}. Oensket antal bruges hvis opskriften har det, ellers det
 * naermeste. Staar to lige naert (oensket 2, mulige 1 og 3), vinder det
 * stoerste -- hellere en portion for meget end en aftensmad for lidt.
 */
export function resolvePortions(
  options: number[],
  requested?: number | null,
): number {
  const available = [
    ...new Set(options.filter((n) => Number.isInteger(n) && n > 0)),
  ].sort((a, b) => a - b);
  if (!available.length) return DEFAULT_PORTIONS;

  const wanted =
    typeof requested === "number" && Number.isFinite(requested)
      ? Math.round(requested)
      : DEFAULT_PORTIONS;

  if (available.includes(wanted)) return wanted;

  return available.reduce((best, candidate) => {
    const bestGap = Math.abs(best - wanted);
    const gap = Math.abs(candidate - wanted);
    if (gap < bestGap) return candidate;
    if (gap === bestGap) return Math.max(best, candidate);
    return best;
  }, available[0]);
}

/**
 * Naeste eller forrige mulige portionsantal. Klodser i enderne i stedet for
 * at rulle rundt -- en trykfejl paa "flere" maa ikke lande paa 1 person.
 */
export function shiftPortions(
  options: number[],
  current: number,
  direction: 1 | -1,
): number {
  const available = [...new Set(options)].sort((a, b) => a - b);
  if (!available.length) return current;
  const index = available.indexOf(current);
  if (index === -1) return resolvePortions(available, current + direction);
  const next = index + direction;
  if (next < 0 || next >= available.length) return current;
  return available[next];
}

/** "2 personer" / "1 person" -- teksten ved portionstaelleren. */
export function portionsLabel(portions: number): string {
  return portions === 1 ? "1 person" : `${portions} personer`;
}

// ---------------------------------------------------------------------------
// Ingredienser
// ---------------------------------------------------------------------------

/**
 * Skagenfoods faerdige linje for netop dette portionsantal.
 * Null naar opskriften ikke har en maengde for antallet, eller naar linjen er
 * tom (faerdigretter uden opskrift har tomme linjer).
 */
export function ingredientLineFor(
  ingredient: CatalogIngredient,
  portions: number,
): string | null {
  const hit = ingredient.amounts.find((amount) => amount.portions === portions);
  const line = hit?.line?.trim();
  return line ? line : null;
}

/**
 * Nogle opskrifter kalder hovedlisten "ingredienser"; andre lader navnet staa
 * tomt. Begge dele er den samme liste og skal ikke have en overskrift.
 */
function isMainSection(section: string): boolean {
  return section.trim() === "" || /^ingredienser$/i.test(section.trim());
}

/**
 * Ingredienserne grupperet som Skagenfood selv har grupperet dem: hovedlisten
 * foerst, derefter "Sovs", "Dressing", "Cremet rød karry" i den raekkefoelge
 * de optraeder. Raekkefoelgen inden for en gruppe roeres ikke -- den er
 * kokkens, ikke vores.
 */
export function buildIngredientSections(
  ingredients: CatalogIngredient[],
  portions: number,
): RecipeIngredientSection[] {
  const sections: RecipeIngredientSection[] = [];
  const byTitle = new Map<string, RecipeIngredientSection>();

  for (const ingredient of ingredients) {
    const name = ingredient.name.trim();
    if (!name) continue;

    const title = isMainSection(ingredient.section)
      ? null
      : ingredient.section.trim();
    const key = title ?? "";

    let section = byTitle.get(key);
    if (!section) {
      section = { title, items: [] };
      byTitle.set(key, section);
      sections.push(section);
    }

    const item: RecipeIngredientLine = {
      name,
      line: ingredientLineFor(ingredient, portions),
      allergenic: ingredient.allergenic,
      mainIngredient: ingredient.mainIngredient,
    };
    section.items.push(item);
  }

  // Hovedlisten foerst, uanset hvor i svaret den laa.
  return sections.sort(
    (a, b) => Number(a.title !== null) - Number(b.title !== null),
  );
}

// ---------------------------------------------------------------------------
// Trin
// ---------------------------------------------------------------------------

/**
 * "0 min", "10 min" -- trinnets plads paa opskriftens tidslinje.
 * Null naar Skagenfood ikke har tidsstemplet trinnet.
 */
export function formatTimelineLabel(minute: number | null): string | null {
  if (minute === null || !Number.isFinite(minute) || minute < 0) return null;
  return `${Math.round(minute)} min`;
}

/**
 * Trinnets afsnit. Skagenfood skriver flere saetninger i ét trin adskilt af
 * linjeskift; ved komfuret er de nemmere at finde tilbage til som afsnit end
 * som én mur af tekst.
 */
export function stepParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Trinnets egne ingredienser, med maengden for det valgte portionsantal.
 *
 * Skagenfood skriver hvilke ingredienser hvert trin bruger, men kun ved navn.
 * Vi slaar navnet op i opskriftens ingrediensliste (517 af 519 opslag i
 * kataloget rammer) og viser den faerdige linje, saa man kan se "2 stk
 * aubergine" i det trin hvor auberginen skal i gryden -- uden at rulle op.
 * Rammer opslaget ikke, staar navnet alene.
 */
export function stepIngredientLines(
  step: CatalogStep,
  ingredients: CatalogIngredient[],
  portions: number,
): string[] {
  const byName = new Map<string, CatalogIngredient>();
  for (const ingredient of ingredients) {
    const key = ingredient.name.trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, ingredient);
  }

  const seen = new Set<string>();
  const lines: string[] = [];

  for (const raw of step.ingredients) {
    const name = raw.trim();
    if (!name) continue;
    const match = byName.get(name.toLowerCase());
    const line = match ? (ingredientLineFor(match, portions) ?? name) : name;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }

  return lines;
}

export function buildSteps(
  steps: CatalogStep[],
  ingredients: CatalogIngredient[],
  portions: number,
): RecipeStepView[] {
  return steps.map((step, index) => ({
    number: index + 1,
    timeLabel: formatTimelineLabel(step.minute),
    title: step.title.trim(),
    paragraphs: stepParagraphs(step.text),
    ingredients: stepIngredientLines(step, ingredients, portions),
  }));
}

// ---------------------------------------------------------------------------
// Tid, tal og maerkater
// ---------------------------------------------------------------------------

/** "30 min". Null naar opskriften ikke har en samlet tid. */
export function formatTotalMinutes(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0)
    return null;
  return `${Math.round(minutes)} min`;
}

/** Dansk decimalkomma, hoejst én decimal: 674 -> "674", 32.6 -> "32,6". */
export function formatEnergyValue(amount: number): string {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}

function findEnergy(
  energy: CatalogEnergyEntry[],
  name: string,
): CatalogEnergyEntry | null {
  return (
    energy.find(
      (entry) => entry.name.trim().toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}

function energyRow(entry: CatalogEnergyEntry): {
  label: string;
  value: string;
} {
  const unit = entry.unit.trim();
  return {
    label: entry.name.trim(),
    value: unit
      ? `${formatEnergyValue(entry.amount)} ${unit}`
      : formatEnergyValue(entry.amount),
  };
}

/**
 * Kun energi og protein, og kun hvis de findes. Resten af naeringstallene hoerer
 * hjemme i den lille liste nederst -- appen bedoemmer ikke nogen.
 */
export function headlineNutrition(
  energy: CatalogEnergyEntry[],
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const kcal = findEnergy(energy, "Energi");
  if (kcal) rows.push(energyRow(kcal));
  const protein = findEnergy(energy, "Protein");
  if (protein) rows.push(energyRow(protein));
  return rows;
}

export function nutritionRows(
  energy: CatalogEnergyEntry[],
): Array<{ label: string; value: string }> {
  return energy.map(energyRow);
}

/** Foerste vaerdi i en tag-gruppe, fx "opskriftstype" -> "Vegetarretter". */
export function tagValue(
  tags: CatalogTagGroup[],
  group: string,
): string | null {
  const hit = tags.find(
    (tag) => tag.group.trim().toLowerCase() === group.toLowerCase(),
  );
  const value = hit?.values.find((entry) => entry.trim());
  return value ? value.trim() : null;
}

/**
 * Skagenfoods opskriftsside. Kataloget gemmer stien ("/da-dk/opskrifter/...");
 * her bliver den til en hel adresse. Er stien allerede en hel adresse, bruges
 * den som den er.
 */
export function absoluteRecipeUrl(url: string | null): string | null {
  const path = url?.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return null;
  return `https://www.skagenfood.dk${path}`;
}

// ---------------------------------------------------------------------------
// Hele visningen
// ---------------------------------------------------------------------------

/** Regner hele opskriften faerdig for ét portionsantal. */
export function buildRecipeView(
  recipe: CatalogRecipe,
  requestedPortions?: number | null,
): RecipeView {
  const portions = resolvePortions(recipe.portionOptions, requestedPortions);

  return {
    recipe,
    portions,
    timeLabel: formatTotalMinutes(recipe.totalMinutes),
    kind: tagValue(recipe.tags, "opskriftstype"),
    mainIngredient: tagValue(recipe.tags, "hovedingrediens"),
    author: tagValue(recipe.tags, "forfatter"),
    sections: buildIngredientSections(recipe.ingredients, portions),
    steps: buildSteps(recipe.steps, recipe.ingredients, portions),
    pantryItems: recipe.pantryItems.filter((item) => item.trim()),
    equipment: recipe.equipment.filter((item) => item.trim()),
    headlineNutrition: headlineNutrition(recipe.energy),
    nutrition: nutritionRows(recipe.energy),
    sourceUrl: absoluteRecipeUrl(recipe.url),
  };
}

/** Kortet i oversigten -- alt hvad en raekke skal bruge, intet mere. */
export function toRecipeCard(recipe: CatalogRecipe): RecipeCard {
  return {
    recipeId: recipe.recipeId,
    name: recipe.name,
    imageUrl: recipe.imageUrl,
    totalMinutes: recipe.totalMinutes,
    portionOptions: recipe.portionOptions,
    kind: tagValue(recipe.tags, "opskriftstype"),
    mainIngredient: tagValue(recipe.tags, "hovedingrediens"),
    stepCount: recipe.steps.length,
    ingredientCount: recipe.ingredients.length,
  };
}

/**
 * Fritekstsoegning i oversigten. Matcher paa navn, type og hovedingrediens,
 * og er ligeglad med store bogstaver og med om man skriver "kål" eller "kaal".
 */
export function matchesRecipeSearch(card: RecipeCard, query: string): boolean {
  const needle = foldDanish(query);
  if (!needle) return true;
  const haystack = foldDanish(
    [card.name, card.kind ?? "", card.mainIngredient ?? ""].join(" "),
  );
  return needle
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Smaa bogstaver, og æ/ø/å skrevet begge veje. Man skal kunne finde
 * "spidskål" ved at taste "spidskaal" paa et taastatur man ikke kender.
 */
export function foldDanish(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .trim();
}
