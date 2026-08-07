import { withTransaction } from "@/lib/db";
import * as skagenfoodRepository from "@/lib/db/skagenfoodRepository";
import { fetchWeeklyPackages, searchRecipeById } from "@/lib/skagenfood/api";
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
  | {
      ok: false;
      kind: "utilgængelig" | "ufuldstændig" | "ukendt-i-indeks";
      message: string;
    };

async function fetchOneRecipe(slot: CatalogBoxSlot): Promise<FetchOutcome> {
  const label = `"${slot.lookupTitle || `id ${slot.recipeId}`}" (id ${slot.recipeId})`;

  // Kun JSON-API'et. Der fandtes tidligere en reservevej, som hentede
  // opskriftssidens HTML og koerte dens window.__NUXT__-IIFE gennem node:vm.
  // node:vm er ikke en sikkerhedssandkasse, saa det var udfoerelse af fremmed
  // kode fra et website vi ikke kontrollerer. Den er fjernet. Svarer API'et
  // ikke, fejler vi hoejlydt i stedet for at falde tilbage.
  let hit;
  try {
    hit = await searchRecipeById(slot.lookupTitle, slot.recipeId);
  } catch (error) {
    return {
      ok: false,
      kind: "utilgængelig",
      message: `${label}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!hit) {
    // Retten staar i ugefeedet, men findes ikke i Skagenfoods soegeindeks.
    // Bevist paa id 16433 i uge 34: hverken hele titlen, nedkortninger eller
    // et opslag paa id giver traef, og der findes ingen id-baseret rute til
    // hele opskriften (alle /api/recipes/<id>-varianter svarer 404).
    // Det er et hul hos dem, ikke en fejl hos os -- og det maa ikke vaelte
    // en hel uges import, saadan som en netvaerksfejl skal.
    return {
      ok: false,
      kind: "ukendt-i-indeks",
      message: `${label}: findes ikke i Skagenfoods søgeindeks.`,
    };
  }

  const recipe = normalizeRecipe(hit, {
    source: "search",
    imageUrl: slot.imageUrl,
    url: slot.recipePath,
  });

  try {
    assertCatalogRecipe(recipe, slot.recipeId);
    return { ok: true, recipe };
  } catch (error) {
    return {
      ok: false,
      kind: "ufuldstændig",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

interface FetchAllResult {
  recipes: CatalogRecipe[];
  incomplete: Array<{ recipeId: number; title: string; message: string }>;
  /** Retter i ugefeedet som Skagenfoods soegeindeks ikke kender. */
  missingFromIndex: Array<{ recipeId: number; title: string; message: string }>;
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
  const missingFromIndex: FetchAllResult["missingFromIndex"] = [];
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
        if (outcome.kind === "ukendt-i-indeks") {
          missingFromIndex.push({
            recipeId: slot.recipeId,
            title: slot.lookupTitle,
            message: outcome.message,
          });
        } else {
          unavailable.push(outcome.message);
        }
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

  if (missingFromIndex.length && !allowIncomplete) {
    throw new SkagenfoodImportError(
      `${missingFromIndex.length} af ${slots.length} retter findes ikke i Skagenfoods ` +
        `søgeindeks. Intet er skrevet til databasen.\n  - ` +
        `${missingFromIndex.map((entry) => entry.message).join("\n  - ")}\n` +
        `De kan ikke hentes, uanset hvor mange gange vi prøver — der findes ingen ` +
        `id-baseret rute til hele opskriften. Kør med --spring-ufuldstændige-over ` +
        `for at hente resten af ugen og få dem nævnt i rapporten.`,
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
    missingFromIndex,
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

// ---------------------------------------------------------------------------
// Delt spaerre: manuel og automatisk import maa aldrig koere samtidigt
// ---------------------------------------------------------------------------

/**
 * En import ad gangen -- uanset om den er bedt om fra den manuelle rute
 * (POST /api/ugeplan/import) eller startet af det selvhelbredende tjek i
 * baggrunden. To samtidige koersler ville hente de samme 7,5 MB fra
 * Skagenfood og skrive oven i hinanden, uden at nogen af dem bliver klogere.
 */
let importInFlight: Promise<ImportWeekReport> | null = null;

/** Koerer der en import lige nu, manuel eller automatisk? */
export function isSkagenfoodImportRunning(): boolean {
  return importInFlight !== null;
}

/**
 * Samme som importSkagenfoodWeek, men afviser hoejlydt hvis en anden import
 * allerede er i gang, i stedet for at lade de to loebe samtidigt.
 */
export async function importSkagenfoodWeekExclusive(
  options: ImportWeekOptions,
): Promise<ImportWeekReport> {
  if (importInFlight) {
    throw new SkagenfoodImportError(
      "Der kører allerede en import af Skagenfood-kataloget. Vent til den er færdig.",
    );
  }
  const work = importSkagenfoodWeek(options);
  importInFlight = work;
  try {
    return await work;
  } finally {
    importInFlight = null;
  }
}
