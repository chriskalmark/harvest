import { pool, withTransaction } from "@/lib/db";
import * as weekPlanRepository from "@/lib/db/weekPlanRepository";
import * as shoppingRepository from "@/lib/db/weekPlanShoppingRepository";
import { byggIndkøbsliste, type IndkøbsDag } from "@/lib/weekPlan/indkoeb";
import type { Indkøbsliste } from "@/lib/weekPlan/indkoeb";
import { buildWeekPlan, WeekPlanError } from "@/lib/weekPlan/week";
import {
  resolveWeekStart,
  type WeekSelector,
} from "@/lib/services/weekPlanService";
import type { WeekPlan } from "@/lib/weekPlan/types";

/**
 * Ugens indkøbsliste.
 *
 * Den er en UDREGNING over ugeplanen, ikke et sted man gemmer varer. Derfor
 * findes her ingen "tilføj vare" og ingen "slet vare": vil man af med en
 * vare, fjerner man retten der kræver den. Det er også derfor listen aldrig
 * kan komme til at vise noget, ugeplanen ikke længere indeholder.
 *
 * Det eneste der gemmes, er hvad man har lagt i kurven.
 */

export interface UgensIndkøb {
  weekStart: string;
  weekLabel: string;
  liste: Indkøbsliste;
}

export interface SetCheckedInput extends WeekSelector {
  itemKeys: unknown;
  checked: unknown;
}

function krævNøgler(rå: unknown): string[] {
  const liste = Array.isArray(rå) ? rå : [rå];
  const nøgler = liste
    .filter((post): post is string => typeof post === "string")
    .map((post) => post.trim())
    .filter(Boolean);

  if (nøgler.length === 0) {
    throw new WeekPlanError("Der blev ikke sendt nogen vare at krydse af.");
  }
  if (nøgler.length > 500) {
    throw new WeekPlanError("For mange varer i ét kald.");
  }
  return nøgler;
}

function krævChecked(rå: unknown): boolean {
  if (typeof rå === "boolean") return rå;
  throw new WeekPlanError("'afkrydset' skal være true eller false.");
}

/**
 * Kobler ugens syv dagspladser sammen med opskrifternes ingredienser.
 *
 * Dagene ved hvilken opskrift der ligger hvor, men ikke hvad der er i den.
 * Ingredienserne hentes i ét opslag for hele ugen.
 */
async function byggDage(
  client: Parameters<typeof shoppingRepository.readCheckedKeys>[0],
  weekPlan: WeekPlan,
): Promise<IndkøbsDag[]> {
  const recipeIds = weekPlan.days
    .map((day) => day.recipe?.recipeId)
    .filter((id): id is number => typeof id === "number");

  const indhold = await shoppingRepository.readRecipeContents(
    client,
    recipeIds,
  );

  return weekPlan.days.map((day) => {
    const opskrift =
      day.recipe && indhold.get(day.recipe.recipeId)
        ? indhold.get(day.recipe.recipeId)!
        : null;

    return {
      weekday: day.weekday,
      dayName: day.dayName,
      // Ligger opskriften ikke længere i kataloget, er dagen ikke tom -- men
      // den kan ikke bidrage med varer. Den falder til 'empty' her, og
      // ugeplanen viser stadig retten som den plejer.
      slotKind: opskrift
        ? day.slotKind
        : day.slotKind === "catalog"
          ? "empty"
          : day.slotKind,
      portions: day.portions,
      manualTitle: day.manualTitle,
      recipe: opskrift,
    };
  });
}

export async function getShoppingList(
  input: WeekSelector = {},
  now?: Date,
): Promise<UgensIndkøb> {
  const monday = resolveWeekStart(input, now);
  const client = await pool.connect();
  try {
    const weekPlanId = await weekPlanRepository.findWeekPlanId(client, monday);
    const rows =
      weekPlanId === null
        ? []
        : await weekPlanRepository.readWeekPlanDays(client, weekPlanId);
    const weekPlan = buildWeekPlan(monday, rows);

    const afkrydsede =
      weekPlanId === null
        ? new Set<string>()
        : await shoppingRepository.readCheckedKeys(client, weekPlanId);

    const dage = await byggDage(client, weekPlan);

    return {
      weekStart: monday,
      weekLabel: weekPlan.label,
      liste: byggIndkøbsliste(dage, afkrydsede),
    };
  } finally {
    client.release();
  }
}

/** Sætter eller fjerner flueben og svarer med hele listen bagefter. */
export async function setChecked(
  input: SetCheckedInput,
  now?: Date,
): Promise<UgensIndkøb> {
  const monday = resolveWeekStart(input, now);
  const nøgler = krævNøgler(input.itemKeys);
  const checked = krævChecked(input.checked);

  await withTransaction(async (client) => {
    const weekPlanId = await weekPlanRepository.findWeekPlanId(client, monday);
    if (weekPlanId === null) {
      throw new WeekPlanError(
        "Der er ingen plan for den uge endnu, så der er heller ikke noget at handle.",
      );
    }
    await shoppingRepository.setChecked(client, weekPlanId, nøgler, checked);
  });

  return getShoppingList({ week: monday }, now);
}

/** Fjerner alle flueben på ugen. */
export async function clearChecks(
  input: WeekSelector = {},
  now?: Date,
): Promise<UgensIndkøb> {
  const monday = resolveWeekStart(input, now);

  await withTransaction(async (client) => {
    const weekPlanId = await weekPlanRepository.findWeekPlanId(client, monday);
    if (weekPlanId === null) return;
    await shoppingRepository.clearAllChecks(client, weekPlanId);
  });

  return getShoppingList({ week: monday }, now);
}
