import { pool } from "@/lib/db";
import * as catalogPickerRepository from "@/lib/db/catalogPickerRepository";
import { formatIsoWeek } from "@/lib/skagenfood/isoWeek";
import type { PickerCatalog, PickerScope } from "@/lib/catalog/types";
import { isoWeekOfDateOnly, WeekPlanError } from "@/lib/weekPlan/week";
import { resolveWeekStart } from "@/lib/services/weekPlanService";

/**
 * Vælgerens servicelag: hvilke opskrifter kan lægges på denne uges dage.
 *
 * Broen mellem de to ugebegreber ligger her, og den er værd at forstå:
 * ugeplanen kender kun mandagens dato, mens Skagenfood-kataloget er nøglet
 * på ISO-år og -ugenummer. Mandag 2026-08-03 er ISO-uge 32, og Skagenfood
 * kalder den samme uge "Uge 32 - sø 2/8 - lø 8/8" -- deres leveringsuge
 * løber søndag til lørdag, men navnet er ISO-ugenummeret. Derfor kan de to
 * regnes om til hinanden uden gætterier.
 *
 * Ingenting herinde skriver i databasen.
 */

/**
 * Kataloget er FÆLLES og har derfor ingen husstand.
 *
 * Skagenfoods 137 opskrifter er de samme for alle, og søndagsimporten
 * kører én gang for alle. Ville man dele kataloget op per husstand, skulle
 * hver familie importere de samme opskrifter igen -- og de ville stadig
 * være de samme.
 *
 * Derfor arver den her IKKE fra WeekSelector: den bruger kun ugen.
 */
export interface PickerCatalogInput {
  /** "ÅÅÅÅ-MM-DD", "denne", "næste" -- eller udeladt for denne uge. */
  week?: unknown;
  /** "uge" (standard) eller "alle". */
  scope?: unknown;
}

/** "uge" er standarden: man planlægger som regel i den uge man kigger på. */
export function resolveScope(raw: unknown): PickerScope {
  if (raw === undefined || raw === null || raw === "") return "uge";
  if (raw === "uge" || raw === "week") return "uge";
  if (raw === "alle" || raw === "all" || raw === "katalog") return "alle";
  throw new WeekPlanError(
    `Omfanget skal være "uge" eller "alle". Fik "${String(raw)}".`,
  );
}

/**
 * Henter de opskrifter vælgeren skal vise.
 *
 * Når ugen ikke er hentet ned endnu, svarer vi med HELE kataloget frem for
 * en tom liste, og siger det i notice. En tom skærm ville ligne en fejl i
 * appen; et katalog med en forklaring er sandt og til at handle på.
 */
export async function getPickerCatalog(
  input: PickerCatalogInput = {},
  now?: Date,
): Promise<PickerCatalog> {
  const weekStart = resolveWeekStart({ husstand: "", week: input.week }, now);
  const requestedScope = resolveScope(input.scope);
  const { year, week } = isoWeekOfDateOnly(weekStart);

  const client = await pool.connect();
  try {
    const catalogWeek = await catalogPickerRepository.findCatalogWeek(
      client,
      year,
      week,
    );

    if (requestedScope === "alle") {
      return {
        scope: "alle",
        weekStart,
        isoYear: year,
        isoWeek: week,
        weekDisplayName: catalogWeek?.displayName ?? null,
        weekInCatalog: catalogWeek !== null,
        notice: null,
        recipes: await catalogPickerRepository.readAllRecipes(client),
      };
    }

    if (catalogWeek === null) {
      return {
        scope: "alle",
        weekStart,
        isoYear: year,
        isoWeek: week,
        weekDisplayName: null,
        weekInCatalog: false,
        notice: `Skagenfoods ${formatIsoWeek({ year, week })} er ikke hentet ned endnu. Du ser hele kataloget.`,
        recipes: await catalogPickerRepository.readAllRecipes(client),
      };
    }

    return {
      scope: "uge",
      weekStart,
      isoYear: year,
      isoWeek: week,
      weekDisplayName: catalogWeek.displayName,
      weekInCatalog: true,
      notice: null,
      recipes: await catalogPickerRepository.readWeekRecipes(
        client,
        catalogWeek.id,
      ),
    };
  } finally {
    client.release();
  }
}
