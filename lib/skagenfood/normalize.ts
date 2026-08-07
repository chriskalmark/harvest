import type {
  CatalogAmount,
  CatalogBox,
  CatalogBoxSlot,
  CatalogEnergyEntry,
  CatalogIngredient,
  CatalogRecipe,
  CatalogRecipeSource,
  CatalogStep,
  CatalogTagGroup,
  CatalogWeek,
  IsoWeek,
  WireAmount,
  WireRecipe,
  WireWeeklyPackagesResponse,
} from "@/lib/skagenfood/types";
import { formatIsoWeek } from "@/lib/skagenfood/isoWeek";

/**
 * Rene omformninger fra Skagenfoods JSON til katalogets form.
 *
 * Ingen netværk, ingen database. Alt der kan gå galt med fremmed data bliver
 * fanget her og kastet som SkagenfoodImportError med en dansk besked — det er
 * hele pointen: en ret der ikke kan hentes helt, må aldrig nå databasen.
 */

export class SkagenfoodImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkagenfoodImportError";
  }
}

// Grupper Skagenfood bruger til ting kunden selv skal have stående.
// Verificeret på uge 33/2026: "Du skal selv have:", "Du skal selv have",
// "Basisvarer (ikke inkluderet):" og "Basisvarer (medfølger ikke):".
const PANTRY_GROUP = /du skal selv have|basisvarer/i;

// "Redskaber:" og "Redskaber".
const EQUIPMENT_GROUP = /redskab/i;

export function isPantryGroup(groupName: string): boolean {
  return PANTRY_GROUP.test(groupName);
}

export function isEquipmentGroup(groupName: string): boolean {
  return EQUIPMENT_GROUP.test(groupName);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Fjerner HTML-tags, så et trin uden textStripped stadig har læsbar tekst. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Ugen og kasserne
// ---------------------------------------------------------------------------

/** "3 dage/2 pers." -> 2. Null når navnet ikke siger det. */
export function parseBoxPortions(boxName: string): number | null {
  const match = boxName.match(/(\d+)\s*pers/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** "3 dage/2 pers." -> 3. Null når navnet ikke siger det. */
export function parseBoxDays(boxName: string): number | null {
  const match = boxName.match(/(\d+)\s*dage?\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** Ugerne der faktisk ligger i svaret. Skagenfood leverer altid tre. */
export function listAvailableWeeks(
  payload: WireWeeklyPackagesResponse,
): IsoWeek[] {
  const seen = new Map<string, IsoWeek>();
  for (const pkg of payload.subscriptionPackages ?? []) {
    for (const week of pkg.weeks ?? []) {
      const number = Number(week.name);
      const year = finiteNumber(week.year);
      if (!Number.isInteger(number) || year === null) continue;
      seen.set(`${year}-${number}`, { year, week: number });
    }
  }
  return [...seen.values()].sort((a, b) => a.year - b.year || a.week - b.week);
}

/**
 * Plukker én uge ud af svaret. Skagenfood sender alle tre uger i samme kald og
 * ignorerer enhver uge-parameter, så valget sker her — det er præcis det, der
 * gør henteren i stand til at køre på en kommende uge.
 */
export function selectCatalogWeek(
  payload: WireWeeklyPackagesResponse,
  target: IsoWeek,
): CatalogWeek {
  const packages = payload.subscriptionPackages ?? [];
  if (!packages.length) {
    throw new SkagenfoodImportError(
      "Skagenfood svarede uden en eneste måltidskasse. Henteren stopper — der er intet at importere.",
    );
  }

  const available = listAvailableWeeks(payload);
  const boxes: CatalogBox[] = [];
  let displayName = "";
  let slotsWithoutRecipe = 0;

  packages.forEach((pkg, packageIndex) => {
    const week = (pkg.weeks ?? []).find(
      (candidate) =>
        Number(candidate.name) === target.week &&
        finiteNumber(candidate.year) === target.year,
    );
    if (!week) return;

    const packageId = finiteNumber(pkg.id);
    if (packageId === null) {
      throw new SkagenfoodImportError(
        `Måltidskasse nummer ${packageIndex + 1} i ${formatIsoWeek(target)} mangler et id. Henteren stopper.`,
      );
    }

    const name = text(pkg.name);
    if (!name) {
      throw new SkagenfoodImportError(
        `Måltidskasse ${packageId} i ${formatIsoWeek(target)} mangler et navn. Henteren stopper.`,
      );
    }

    if (!displayName) displayName = text(week.displayName);

    const slots: CatalogBoxSlot[] = [];
    for (const item of week.items ?? []) {
      for (const content of item.boxContents ?? []) {
        const recipe = content.recipe;
        const recipeId = finiteNumber(recipe?.id);
        if (!recipe || recipeId === null) {
          slotsWithoutRecipe += 1;
          continue;
        }
        slots.push({
          position: slots.length,
          recipeId,
          dayName: text(content.dayName) || null,
          boxTitle: text(content.title) || null,
          imageUrl: text(recipe.imageUrl) || null,
          lookupTitle: text(recipe.title),
          recipePath: text(recipe.url) || null,
        });
      }
    }

    boxes.push({
      packageId,
      sku: text(pkg.sku) || null,
      name,
      portions: parseBoxPortions(name),
      days: parseBoxDays(name),
      imageUrl: text(week.imageUrl) || null,
      teaser: text(week.teaser) || null,
      sortOrder: finiteNumber(pkg.sortOrder) ?? packageIndex,
      slots,
    });
  });

  if (!boxes.length) {
    const list = available.length
      ? available.map(formatIsoWeek).join(", ")
      : "ingen";
    throw new SkagenfoodImportError(
      `Skagenfood har ingen data for ${formatIsoWeek(target)}. ` +
        `Deres API leverer kun de uger de selv har lagt op — lige nu: ${list}. ` +
        `Historik og uger længere ude kan ikke hentes.`,
    );
  }

  return {
    year: target.year,
    week: target.week,
    displayName: displayName || `Uge ${target.week} ${target.year}`,
    boxes,
    slotsWithoutRecipe,
  };
}

/** Alle ret-pladser i ugen, uden dubletter, nøglet på opskrifts-id. */
export function uniqueSlots(week: CatalogWeek): CatalogBoxSlot[] {
  const byRecipe = new Map<number, CatalogBoxSlot>();
  for (const box of week.boxes) {
    for (const slot of box.slots) {
      if (!byRecipe.has(slot.recipeId)) byRecipe.set(slot.recipeId, slot);
    }
  }
  return [...byRecipe.values()].sort((a, b) => a.recipeId - b.recipeId);
}

export function countSlots(week: CatalogWeek): number {
  return week.boxes.reduce((sum, box) => sum + box.slots.length, 0);
}

// ---------------------------------------------------------------------------
// Opskriften
// ---------------------------------------------------------------------------

function normalizeAmounts(amounts: WireAmount[] | undefined): {
  amounts: CatalogAmount[];
  portions: number[];
} {
  const result: CatalogAmount[] = [];
  const portions: number[] = [];

  for (const amount of amounts ?? []) {
    if (amount.hasValue !== true) continue;
    const portionCount = finiteNumber(amount.numberOfPortions);
    const value = finiteNumber(amount.amount);
    if (portionCount === null || value === null) continue;
    const line = text(amount.formattedIngredientLine);
    result.push({
      portions: portionCount,
      amount: value,
      unitKey: text(amount.unitKey),
      line,
    });
    portions.push(portionCount);
  }

  result.sort((a, b) => a.portions - b.portions);
  return { amounts: result, portions };
}

function normalizeSteps(wire: WireRecipe): CatalogStep[] {
  const steps: CatalogStep[] = [];
  for (const step of wire.steps ?? []) {
    const html = typeof step.text === "string" ? step.text : "";
    const stripped = text(step.textStripped) || stripHtml(html);
    steps.push({
      // Ikke alle trin er tidsstemplede — 38 af 186 trin i uge 33/2026 havde
      // ingen minutesInTimeline. Null er sandheden; 0 ville være opfundet.
      minute: finiteNumber(step.minutesInTimeline),
      title: text(step.title),
      text: stripped,
      html,
      ingredients: (step.ingredients ?? [])
        .map((ingredient) => text(ingredient.name))
        .filter(Boolean),
    });
  }
  return steps;
}

function normalizeTags(wire: WireRecipe): CatalogTagGroup[] {
  return (wire.tags ?? [])
    .map((tag) => ({
      group: text(tag.groupAlias),
      values: (tag.values ?? [])
        .map(
          (value) =>
            text(value.name) || text(value.displayName) || text(value.value),
        )
        .filter(Boolean),
    }))
    .filter((tag) => tag.values.length > 0);
}

function normalizeEnergy(wire: WireRecipe): CatalogEnergyEntry[] {
  const entries: CatalogEnergyEntry[] = [];
  for (const entry of wire.energyData ?? []) {
    const amount = finiteNumber(entry.amount);
    const name = text(entry.name);
    if (!name || amount === null) continue;
    entries.push({ name, amount, unit: text(entry.unit) });
  }
  return entries;
}

export interface NormalizeRecipeContext {
  source: CatalogRecipeSource;
  /** Rå billed-URL fra ugesvaret; foretrækkes over SSR-sidens beskårne. */
  imageUrl?: string | null;
  /** Sti til opskriftssiden fra ugesvaret. */
  url?: string | null;
}

export function normalizeRecipe(
  wire: WireRecipe,
  context: NormalizeRecipeContext,
): CatalogRecipe {
  const ingredients: CatalogIngredient[] = [];
  const pantryItems: string[] = [];
  const equipment: string[] = [];
  const portionSet = new Set<number>();

  for (const group of wire.ingredientGroups ?? []) {
    const section = text(group.name);
    for (const ingredient of group.ingredients ?? []) {
      const name = text(ingredient.name);
      if (!name) continue;

      if (isPantryGroup(section)) {
        pantryItems.push(name);
        continue;
      }
      if (isEquipmentGroup(section)) {
        equipment.push(name);
        continue;
      }

      const { amounts, portions } = normalizeAmounts(ingredient.amounts);
      for (const portion of portions) portionSet.add(portion);

      ingredients.push({
        name,
        section,
        baseGroup: text(ingredient.baseIngredientName),
        mainIngredient: ingredient.mainIngredient === true,
        allergenic: ingredient.allergenic === true,
        imageUrl: text(ingredient.image?.source?.url) || null,
        amounts,
      });
    }
  }

  return {
    recipeId: finiteNumber(wire.id) ?? 0,
    name: text(wire.name),
    urlName: text(wire.meta?.urlName) || null,
    url: text(context.url) || null,
    imageUrl: text(context.imageUrl) || text(wire.image?.source?.url) || null,
    totalMinutes: finiteNumber(wire.totalMinutes),
    portionOptions: [...portionSet].sort((a, b) => a - b),
    ingredients,
    pantryItems: [...new Set(pantryItems)],
    equipment: [...new Set(equipment)],
    steps: normalizeSteps(wire),
    tags: normalizeTags(wire),
    energy: normalizeEnergy(wire),
    source: context.source,
  };
}

/**
 * Sidste port før databasen. Kaster ved den mindste mangel, så en halv
 * opskrift aldrig når frem til komfuret.
 */
export function assertCatalogRecipe(
  recipe: CatalogRecipe,
  expectedRecipeId: number,
): void {
  const label = recipe.name
    ? `"${recipe.name}" (id ${expectedRecipeId})`
    : `opskrift id ${expectedRecipeId}`;

  const fail = (reason: string): never => {
    throw new SkagenfoodImportError(
      `Opskriften ${label} kunne ikke hentes helt: ${reason} Henteren stopper, og intet bliver skrevet.`,
    );
  };

  if (recipe.recipeId !== expectedRecipeId) {
    fail(
      `svaret handlede om id ${recipe.recipeId} og ikke om id ${expectedRecipeId}.`,
    );
  }
  if (!recipe.name) {
    fail("den har intet navn.");
  }
  if (!recipe.ingredients.length) {
    fail("den har ingen ingredienser.");
  }
  if (!recipe.portionOptions.length) {
    fail("ingen af ingredienserne har en mængde for noget portionsantal.");
  }
  if (!recipe.steps.length) {
    fail("den har ingen trin.");
  }

  const emptyStep = recipe.steps.findIndex((step) => !step.text);
  if (emptyStep >= 0) {
    fail(`trin ${emptyStep + 1} er tomt.`);
  }
}
