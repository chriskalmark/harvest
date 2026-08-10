import { PoolClient } from "pg";
import { DAYS_IN_WEEK } from "@/lib/weekPlan/week";
import type { WeekPlanDayRow, WeekPlanSlotKind } from "@/lib/weekPlan/types";

/**
 * Rene databaseoperationer for ugeplanlæggeren.
 * Ingen forretningslogik, ingen netværk, ingen validering -- kun SQL.
 *
 * Ingen af funktionerne herinde sletter noget. "Ryd en dag" er en UPDATE der
 * sætter pladsen tom, ikke en DELETE -- pladsen skal blive stående, for ugen
 * har altid syv dage.
 */

interface DayRow {
  weekday: number;
  slot_kind: string;
  portions: number;
  manual_title: string | null;
  note: string | null;
  skagenfood_recipe_id: string | number | null;
  recipe_name: string | null;
  recipe_image_url: string | null;
  recipe_url: string | null;
  recipe_total_minutes: number | null;
  recipe_portion_options: number[] | null;
}

function mapDayRow(row: DayRow): WeekPlanDayRow {
  const recipeId =
    row.skagenfood_recipe_id === null ? null : Number(row.skagenfood_recipe_id);

  return {
    weekday: Number(row.weekday),
    slotKind: row.slot_kind as WeekPlanSlotKind,
    portions: Number(row.portions),
    manualTitle: row.manual_title,
    note: row.note,
    recipe:
      recipeId === null || row.recipe_name === null
        ? null
        : {
            recipeId,
            name: row.recipe_name,
            imageUrl: row.recipe_image_url,
            url: row.recipe_url,
            totalMinutes:
              row.recipe_total_minutes === null
                ? null
                : Number(row.recipe_total_minutes),
            portionOptions: (row.recipe_portion_options ?? []).map(Number),
          },
  };
}

/** Ugens id, eller null hvis ugen aldrig er blevet rørt. Skriver ingenting. */
export async function findWeekPlanId(
  client: PoolClient,
  husstand: string,
  mondayDate: string,
): Promise<number | null> {
  const result = await client.query<{ id: string | number }>(
    `SELECT id FROM week_plans WHERE husstand = $1 AND monday_date = $2::date`,
    [husstand, mondayDate],
  );
  return result.rows[0] ? Number(result.rows[0].id) : null;
}

/**
 * Opretter ugen og dens syv dagspladser, hvis de ikke findes.
 * Idempotent: kaldes den igen, sker der intet ud over et nyt updated_at.
 */
export async function ensureWeekPlan(
  client: PoolClient,
  husstand: string,
  mondayDate: string,
): Promise<number> {
  const result = await client.query<{ id: string | number }>(
    `
      INSERT INTO week_plans (husstand, monday_date)
      VALUES ($1, $2::date)
      ON CONFLICT (husstand, monday_date)
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `,
    [husstand, mondayDate],
  );
  if (!result.rows[0]) {
    throw new Error(`Kunne ikke oprette ugeplanen for ${mondayDate}.`);
  }
  const weekPlanId = Number(result.rows[0].id);

  // Præcis syv pladser, hver gang. Findes de allerede, rører vi dem ikke.
  await client.query(
    `
      INSERT INTO week_plan_days (week_plan_id, weekday)
      SELECT $1, weekday FROM generate_series(1, $2) AS weekday
      ON CONFLICT (week_plan_id, weekday) DO NOTHING
    `,
    [weekPlanId, DAYS_IN_WEEK],
  );

  return weekPlanId;
}

export async function readWeekPlanDays(
  client: PoolClient,
  weekPlanId: number,
): Promise<WeekPlanDayRow[]> {
  const result = await client.query<DayRow>(
    `
      SELECT
        d.weekday,
        d.slot_kind,
        d.portions,
        d.manual_title,
        d.note,
        d.skagenfood_recipe_id,
        r.name          AS recipe_name,
        r.image_url     AS recipe_image_url,
        r.url           AS recipe_url,
        r.total_minutes AS recipe_total_minutes,
        r.portion_options AS recipe_portion_options
      FROM week_plan_days d
      LEFT JOIN skagenfood_recipes r
        ON r.recipe_id = d.skagenfood_recipe_id
      WHERE d.week_plan_id = $1
      ORDER BY d.weekday ASC
    `,
    [weekPlanId],
  );
  return result.rows.map(mapDayRow);
}

export async function recipeExists(
  client: PoolClient,
  recipeId: number,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM skagenfood_recipes WHERE recipe_id = $1`,
    [recipeId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Lægger en katalogopskrift på dagen.
 *
 * portions === undefined lader dagens portionsantal stå: portionsantallet
 * hører til dagen, ikke til retten. Skifter man ret på en dag hvor der skal
 * være fire, skal der stadig være fire.
 */
export async function setCatalogRecipe(
  client: PoolClient,
  input: {
    weekPlanId: number;
    weekday: number;
    recipeId: number;
    note: string | null;
    portions?: number;
  },
): Promise<void> {
  await writeDay(client, {
    weekPlanId: input.weekPlanId,
    weekday: input.weekday,
    slotKind: "catalog",
    recipeId: input.recipeId,
    manualTitle: null,
    note: input.note,
    portions: input.portions,
  });
}

export async function setManualDish(
  client: PoolClient,
  input: {
    weekPlanId: number;
    weekday: number;
    title: string;
    note: string | null;
    portions?: number;
  },
): Promise<void> {
  await writeDay(client, {
    weekPlanId: input.weekPlanId,
    weekday: input.weekday,
    slotKind: "manual",
    recipeId: null,
    manualTitle: input.title,
    note: input.note,
    portions: input.portions,
  });
}

/**
 * Tømmer dagen. Pladsen bliver stående -- den bliver tom, ikke slettet.
 * Portionsantallet står også: det er dagens indstilling, ikke rettens.
 */
export async function clearDay(
  client: PoolClient,
  input: { weekPlanId: number; weekday: number },
): Promise<void> {
  await writeDay(client, {
    weekPlanId: input.weekPlanId,
    weekday: input.weekday,
    slotKind: "empty",
    recipeId: null,
    manualTitle: null,
    note: null,
    portions: undefined,
  });
}

export async function setPortions(
  client: PoolClient,
  input: { weekPlanId: number; weekday: number; portions: number },
): Promise<void> {
  const result = await client.query(
    `
      UPDATE week_plan_days
      SET portions = $3::smallint,
          updated_at = NOW()
      WHERE week_plan_id = $1 AND weekday = $2
    `,
    [input.weekPlanId, input.weekday, input.portions],
  );
  assertOneRow(result.rowCount ?? 0, input.weekday);
}

async function writeDay(
  client: PoolClient,
  input: {
    weekPlanId: number;
    weekday: number;
    slotKind: WeekPlanSlotKind;
    recipeId: number | null;
    manualTitle: string | null;
    note: string | null;
    portions: number | undefined;
  },
): Promise<void> {
  const result = await client.query(
    `
      UPDATE week_plan_days
      SET slot_kind = $3,
          skagenfood_recipe_id = $4::bigint,
          manual_title = $5,
          note = $6,
          portions = COALESCE($7::smallint, portions),
          updated_at = NOW()
      WHERE week_plan_id = $1 AND weekday = $2
    `,
    [
      input.weekPlanId,
      input.weekday,
      input.slotKind,
      input.recipeId,
      input.manualTitle,
      input.note,
      input.portions ?? null,
    ],
  );
  assertOneRow(result.rowCount ?? 0, input.weekday);
}

function assertOneRow(rowCount: number, weekday: number): void {
  if (rowCount !== 1) {
    throw new Error(
      `Dagsplads ${weekday} findes ikke i ugeplanen — der blev rørt ${rowCount} rækker.`,
    );
  }
}

export async function countWeekPlans(client: PoolClient): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM week_plans`,
  );
  return Number(result.rows[0]?.count ?? 0);
}
