import { pool, withTransaction } from "@/lib/db";
import * as weekPlanRepository from "@/lib/db/weekPlanRepository";
import {
  buildWeekPlan,
  normalizeManualTitle,
  normalizeNote,
  normalizeWeekStart,
  optionalPortions,
  requireMonday,
  requirePortions,
  requireRecipeId,
  requireWeekday,
  WeekPlanError,
} from "@/lib/weekPlan/week";
import type { WeekPlan } from "@/lib/weekPlan/types";

/**
 * Ugeplanlæggerens servicelag: læs og skriv én uge.
 *
 * To regler gælder alle skrivninger herinde:
 *
 *   1. Alt der ændrer noget sker i én transaktion og returnerer HELE ugen
 *      bagefter. Kaldet behøver aldrig gætte på hvordan ugen ser ud nu.
 *   2. Ugen og dens syv dagspladser oprettes automatisk ved første skrivning.
 *      At LÆSE en uge opretter derimod ingenting -- man skal kunne kigge på
 *      uge 44 uden at der pludselig ligger en tom uge 44 i basen.
 */

export interface WeekSelector {
  /** "ÅÅÅÅ-MM-DD", "denne", "næste", "forrige" -- eller udeladt for denne uge. */
  week?: unknown;
}

export interface SetRecipeInput extends WeekSelector {
  weekday: unknown;
  recipeId: unknown;
  note?: unknown;
  portions?: unknown;
}

export interface SetManualDishInput extends WeekSelector {
  weekday: unknown;
  title: unknown;
  note?: unknown;
  portions?: unknown;
}

export interface ClearDayInput extends WeekSelector {
  weekday: unknown;
}

export interface SetPortionsInput extends WeekSelector {
  weekday: unknown;
  portions: unknown;
}

/** Oversætter det kaldet siger til mandagens dato. */
export function resolveWeekStart(input: WeekSelector, now?: Date): string {
  return requireMonday(normalizeWeekStart(input.week, now));
}

/**
 * Henter ugen. Findes den ikke i basen, svarer vi med syv tomme dagspladser
 * i stedet for ingenting -- en uge der ikke er planlagt endnu er stadig en uge.
 */
export async function getWeekPlan(
  input: WeekSelector = {},
  now?: Date,
): Promise<WeekPlan> {
  const monday = resolveWeekStart(input, now);
  const client = await pool.connect();
  try {
    const weekPlanId = await weekPlanRepository.findWeekPlanId(client, monday);
    if (weekPlanId === null) return buildWeekPlan(monday, []);
    const rows = await weekPlanRepository.readWeekPlanDays(client, weekPlanId);
    return buildWeekPlan(monday, rows);
  } finally {
    client.release();
  }
}

export async function setRecipeOnDay(
  input: SetRecipeInput,
  now?: Date,
): Promise<WeekPlan> {
  const monday = resolveWeekStart(input, now);
  const weekday = requireWeekday(input.weekday);
  const recipeId = requireRecipeId(input.recipeId);
  const note = normalizeNote(input.note);
  const portions = optionalPortions(input.portions);

  return withTransaction(async (client) => {
    if (!(await weekPlanRepository.recipeExists(client, recipeId))) {
      throw new WeekPlanError(
        `Opskrift ${recipeId} findes ikke i Skagenfood-kataloget. Importér ugen først.`,
      );
    }
    const weekPlanId = await weekPlanRepository.ensureWeekPlan(client, monday);
    await weekPlanRepository.setCatalogRecipe(client, {
      weekPlanId,
      weekday,
      recipeId,
      note,
      portions,
    });
    return buildWeekPlan(
      monday,
      await weekPlanRepository.readWeekPlanDays(client, weekPlanId),
    );
  });
}

export async function setManualDishOnDay(
  input: SetManualDishInput,
  now?: Date,
): Promise<WeekPlan> {
  const monday = resolveWeekStart(input, now);
  const weekday = requireWeekday(input.weekday);
  const title = normalizeManualTitle(input.title);
  const note = normalizeNote(input.note);
  const portions = optionalPortions(input.portions);

  return withTransaction(async (client) => {
    const weekPlanId = await weekPlanRepository.ensureWeekPlan(client, monday);
    await weekPlanRepository.setManualDish(client, {
      weekPlanId,
      weekday,
      title,
      note,
      portions,
    });
    return buildWeekPlan(
      monday,
      await weekPlanRepository.readWeekPlanDays(client, weekPlanId),
    );
  });
}

export async function clearDay(
  input: ClearDayInput,
  now?: Date,
): Promise<WeekPlan> {
  const monday = resolveWeekStart(input, now);
  const weekday = requireWeekday(input.weekday);

  return withTransaction(async (client) => {
    const weekPlanId = await weekPlanRepository.ensureWeekPlan(client, monday);
    await weekPlanRepository.clearDay(client, { weekPlanId, weekday });
    return buildWeekPlan(
      monday,
      await weekPlanRepository.readWeekPlanDays(client, weekPlanId),
    );
  });
}

export async function setPortionsOnDay(
  input: SetPortionsInput,
  now?: Date,
): Promise<WeekPlan> {
  const monday = resolveWeekStart(input, now);
  const weekday = requireWeekday(input.weekday);
  const portions = requirePortions(input.portions);

  return withTransaction(async (client) => {
    const weekPlanId = await weekPlanRepository.ensureWeekPlan(client, monday);
    await weekPlanRepository.setPortions(client, {
      weekPlanId,
      weekday,
      portions,
    });
    return buildWeekPlan(
      monday,
      await weekPlanRepository.readWeekPlanDays(client, weekPlanId),
    );
  });
}
