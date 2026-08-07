import { withTransaction } from "@/lib/db";
import * as skagenfoodRepository from "@/lib/db/skagenfoodRepository";
import {
  fetchRecipeFromPage,
  fetchWeeklyPackages,
  searchRecipeById,
} from "@/lib/skagenfood/api";
import { formatIsoWeek } from "@/lib/skagenfood/isoWeek";
import {
  assertCatalogRecipe,
  countSlots,
  normalizeRecipe,
  selectCatalogWeek,
  SkagenfoodImportError,
  uniqueSlots,
} from "@/lib/skagenfood/normalize";
import type {
  CatalogBoxSlot,
  CatalogRecipe,
  CatalogWeek,
  IsoWeek,
} from "@/lib/skagenfood/types";

/**
 * Henteren: én uges måltidskasser og alle deres opskrifter fra Skagenfood ind
 * i Harvests katalog.
 *
 * Rækkefølgen er det vigtigste her. Hele ugen bliver hentet og valideret
 * FÆRDIG, før databasen overhovedet bliver rørt. Går én ret galt, skriver
 * henteren ingenting — hverken den ret eller de 49 andre. Det er den eneste
 * måde at garantere, at en halv opskrift aldrig ligger og venter ved komfuret.
 */

export interface ImportWeekOptions {
  target: IsoWeek;
  /** Antal samtidige opskriftskald. Standard 4 — nok til fart, pænt mod deres API. */
  concurrency?: number;
  /** Hent og validér alt, men skriv ikke. */
  dryRun?: boolean;
  /**
   * Lad retter, som Skagenfood ikke selv har skrevet færdig, blive udeladt af
   * kataloget i stedet for at stoppe hele kørslen. De bliver aldrig gemt
   * halve — de bliver ikke gemt.
   */
  allowIncomplete?: boolean;
  onProgress?: (message: string) => void;
}

export interface ImportWeekReport {
  week: IsoWeek;
  displayName: string;
  boxCount: number;
  slotCount: number;
  slotsWithoutRecipe: number;
  recipeCount: number;
  fromSearch: number;
  fromPage: number;
  /** Retter Skagenfood ikke har skrevet færdig. Udeladt, aldrig gemt halve. */
  incomplete: Array<{ recipeId: number; title: string; message: string }>;
  dryRun: boolean;
  storedBoxRecipes: number;
  removedBoxes: number;
  recipesInCatalog: number;
}

const DEFAULT_CONCURRENCY = 4;

/**
 * To slags fejl, og de fortjener ikke samme behandling.
 *
 * "utilgængelig": vi kunne ikke få fat i opskriften — netværk, en side der har
 * skiftet form, et id der ikke findes. Det er vores problem, og det skal altid
 * stoppe kørslen. Ellers ville en netværkshikke stille og roligt gøre ugen
 * fattigere, uden at nogen opdagede det.
 *
 * "ufuldstændig": vi fik fat i opskriften, men Skagenfood har ikke skrevet den
 * færdig. Fx id 13457 "MK bolognese", som ligger i Michelle Kristensens kasse
 * som "Dag 4 (Færdigret) — (hvis tilkøbt)": én ingrediens, ingen mængder, ét
 * trin. Det er en færdigret man varmer, ikke en ret man laver. Den slags kan
 * ikke laves hel af os, og den må aldrig gemmes halv.
 */
type FetchOutcome =
  | { ok: true; recipe: CatalogRecipe }
  | { ok: false; kind: "utilgængelig" | "ufuldstændig"; message: string };

async function fetchOneRecipe(slot: CatalogBoxSlot): Promise<FetchOutcome> {
  const label = `"${slot.lookupTitle || `id ${slot.recipeId}`}" (id ${slot.recipeId})`;
  let searchProblem = "";
  let searchWasIncomplete = false;

  try {
    const hit = await searchRecipeById(slot.lookupTitle, slot.recipeId);
    if (hit) {
      const recipe = normalizeRecipe(hit, {
        source: "search",
        imageUrl: slot.imageUrl,
        url: slot.recipePath,
      });
      try {
        assertCatalogRecipe(recipe, slot.recipeId);
        return { ok: true, recipe };
      } catch (error) {
        // Opslaget ramte den rigtige ret, men indholdet var mangelfuldt.
        // Opskriftssiden er den fyldigere kilde — prøv den, før vi dømmer.
        searchWasIncomplete = true;
        searchProblem = error instanceof Error ? error.message : String(error);
      }
    } else {
      searchProblem = "titelopslaget gav ingen ret med det id";
    }
  } catch (error) {
    searchProblem = error instanceof Error ? error.message : String(error);
  }

  if (!slot.recipePath) {
    return {
      ok: false,
      kind: searchWasIncomplete ? "ufuldstændig" : "utilgængelig",
      message: `${label}: ${searchProblem}, og ugesvaret gav ingen sti til opskriftssiden.`,
    };
  }

  let page;
  try {
    page = await fetchRecipeFromPage(slot.recipePath);
  } catch (error) {
    return {
      ok: false,
      kind: "utilgængelig",
      message: `${label}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const recipe = normalizeRecipe(page, {
    source: "ssr",
    imageUrl: slot.imageUrl,
    url: slot.recipePath,
  });

  // Serverede siden en anden ret, end vi bad om, har vi ikke fået fat i vores.
  // Det er "utilgængelig" og skal altid stoppe kørslen — ellers kunne
  // --spring-ufuldstændige-over komme til at sluge en forbyttet opskrift.
  if (recipe.recipeId !== slot.recipeId) {
    return {
      ok: false,
      kind: "utilgængelig",
      message: `${label}: opskriftssiden ${slot.recipePath} handlede om id ${recipe.recipeId}.`,
    };
  }

  try {
    assertCatalogRecipe(recipe, slot.recipeId);
    return { ok: true, recipe };
  } catch (error) {
    return {
      ok: false,
      // Begge kilder er enige om, at opskriften ikke er skrevet færdig.
      kind: "ufuldstændig",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

interface FetchAllResult {
  recipes: CatalogRecipe[];
  incomplete: Array<{ recipeId: number; title: string; message: string }>;
}

async function fetchAllRecipes(
  slots: CatalogBoxSlot[],
  concurrency: number,
  allowIncomplete: boolean,
  onProgress?: (message: string) => void,
): Promise<FetchAllResult> {
  const recipes = new Array<CatalogRecipe | undefined>(slots.length);
  const unavailable: string[] = [];
  const incomplete: FetchAllResult["incomplete"] = [];
  let nextIndex = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= slots.length) return;

      const slot = slots[index];
      const outcome = await fetchOneRecipe(slot);
      if (outcome.ok) {
        recipes[index] = outcome.recipe;
      } else if (outcome.kind === "ufuldstændig") {
        incomplete.push({
          recipeId: slot.recipeId,
          title: slot.lookupTitle,
          message: outcome.message,
        });
      } else {
        unavailable.push(outcome.message);
      }
      done += 1;
      onProgress?.(
        `  ${done}/${slots.length} — ${slot.lookupTitle || `id ${slot.recipeId}`}`,
      );
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, slots.length)) },
      () => worker(),
    ),
  );

  if (unavailable.length) {
    throw new SkagenfoodImportError(
      `${unavailable.length} af ${slots.length} retter kunne slet ikke hentes. ` +
        `Intet er skrevet til databasen.\n  - ${unavailable.join("\n  - ")}`,
    );
  }

  if (incomplete.length && !allowIncomplete) {
    throw new SkagenfoodImportError(
      `${incomplete.length} af ${slots.length} retter er ikke skrevet færdig hos Skagenfood. ` +
        `Intet er skrevet til databasen — en halv opskrift må aldrig ende i basen.\n  - ` +
        `${incomplete.map((entry) => entry.message).join("\n  - ")}\n` +
        `Er det færdigretter uden opskrift (fx "hvis tilkøbt"), så kør igen med ` +
        `--spring-ufuldstændige-over. De bliver da udeladt af kataloget og nævnt i rapporten — aldrig gemt halve.`,
    );
  }

  return {
    recipes: recipes.filter((recipe): recipe is CatalogRecipe =>
      Boolean(recipe),
    ),
    incomplete,
  };
}

async function storeWeek(
  week: CatalogWeek,
  recipes: CatalogRecipe[],
): Promise<{
  storedBoxRecipes: number;
  removedBoxes: number;
  recipesInCatalog: number;
}> {
  return withTransaction(async (client) => {
    const weekId = await skagenfoodRepository.upsertSkagenfoodWeek(client, {
      year: week.year,
      week: week.week,
      displayName: week.displayName,
    });

    // Opskrifterne først: kasse-retterne peger på dem med en fremmednøgle.
    for (const recipe of recipes) {
      await skagenfoodRepository.upsertSkagenfoodRecipe(client, recipe);
    }

    // En ret der blev sprunget over, har ingen opskrift i basen. Så får den
    // heller ingen plads i kassen — et link til en opskrift der ikke findes,
    // er præcis den tomme skal vi ikke vil have.
    const stored = new Set(recipes.map((recipe) => recipe.recipeId));

    for (const box of week.boxes) {
      const boxId = await skagenfoodRepository.upsertSkagenfoodBox(
        client,
        weekId,
        box,
      );
      await skagenfoodRepository.replaceSkagenfoodBoxRecipes(
        client,
        boxId,
        box.slots.filter((slot) => stored.has(slot.recipeId)),
      );
    }

    const removedBoxes = await skagenfoodRepository.deleteSkagenfoodBoxesNotIn(
      client,
      weekId,
      week.boxes.map((box) => box.packageId),
    );

    return {
      storedBoxRecipes:
        await skagenfoodRepository.countSkagenfoodBoxRecipesForWeek(
          client,
          weekId,
        ),
      removedBoxes,
      recipesInCatalog:
        await skagenfoodRepository.countSkagenfoodRecipes(client),
    };
  });
}

export async function importSkagenfoodWeek(
  options: ImportWeekOptions,
): Promise<ImportWeekReport> {
  const {
    target,
    dryRun = false,
    allowIncomplete = false,
    onProgress,
  } = options;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  onProgress?.(`Henter måltidskasserne fra Skagenfood (7,5 MB) …`);
  const payload = await fetchWeeklyPackages();

  const week = selectCatalogWeek(payload, target);
  const slots = uniqueSlots(week);
  onProgress?.(
    `${formatIsoWeek(target)}: ${week.boxes.length} kasser, ` +
      `${countSlots(week)} ret-pladser, ${slots.length} unikke opskrifter.`,
  );

  if (!slots.length) {
    throw new SkagenfoodImportError(
      `${formatIsoWeek(target)} har måltidskasser, men ingen retter. Henteren stopper.`,
    );
  }

  const { recipes, incomplete } = await fetchAllRecipes(
    slots,
    concurrency,
    allowIncomplete,
    onProgress,
  );

  const report: ImportWeekReport = {
    week: target,
    displayName: week.displayName,
    boxCount: week.boxes.length,
    slotCount: countSlots(week),
    slotsWithoutRecipe: week.slotsWithoutRecipe,
    recipeCount: recipes.length,
    fromSearch: recipes.filter((r) => r.source === "search").length,
    fromPage: recipes.filter((r) => r.source === "ssr").length,
    incomplete,
    dryRun,
    storedBoxRecipes: 0,
    removedBoxes: 0,
    recipesInCatalog: 0,
  };

  if (dryRun) {
    onProgress?.("Prøvekørsel — databasen er ikke rørt.");
    return report;
  }

  onProgress?.("Skriver ugen i én transaktion …");
  const stored = await storeWeek(week, recipes);

  return { ...report, ...stored };
}
