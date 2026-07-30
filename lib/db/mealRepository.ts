import { PoolClient } from "pg";
import {
  MealPlanRow,
  MealRow,
  MealPlanMealRow,
  MealFeedbackRow,
} from "@/lib/types";

/**
 * Pure database query operations
 * No business logic, no mapping, no side effects
 * Only raw SQL queries and result sets
 */

export async function getMealPlanById(
  client: PoolClient,
  id: number,
): Promise<MealPlanRow | null> {
  const result = await client.query<MealPlanRow>(
    `SELECT * FROM meal_plans WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getMealPlanByWeekRange(
  client: PoolClient,
  weekRange: string,
): Promise<MealPlanRow | null> {
  const result = await client.query<MealPlanRow>(
    `SELECT * FROM meal_plans WHERE week_range = $1 LIMIT 1`,
    [weekRange],
  );
  return result.rows[0] ?? null;
}

export async function getMealPlanByWeekStartDate(
  client: PoolClient,
  weekStartDateOnly: string,
): Promise<MealPlanRow | null> {
  const result = await client.query<MealPlanRow>(
    `
      SELECT *
      FROM meal_plans
      WHERE week_start_date = $1::date
      LIMIT 1
    `,
    [weekStartDateOnly],
  );
  return result.rows[0] ?? null;
}

export async function getMostRecentlyUpdatedMealPlan(
  client: PoolClient,
): Promise<MealPlanRow | null> {
  const result = await client.query<MealPlanRow>(
    `
      SELECT *
      FROM meal_plans
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
  );
  return result.rows[0] ?? null;
}

export async function listMealPlanWeeks(
  client: PoolClient,
): Promise<MealPlanRow[]> {
  const result = await client.query<MealPlanRow>(
    `
      SELECT *
      FROM meal_plans
      ORDER BY week_start_date DESC NULLS LAST, updated_at DESC, id DESC
    `,
  );
  return result.rows;
}

export async function upsertMealPlanRow(
  client: PoolClient,
  input: {
    weekRange: string;
    weekStartDateOnly: string;
    planDataJson: string;
    source: string;
    status: string;
    generationContextJson: string;
  },
): Promise<MealPlanRow> {
  const result = await client.query<MealPlanRow>(
    `
      INSERT INTO meal_plans (week_range, week_start_date, plan_data, source, status, generation_context)
      VALUES ($1, $2::date, $3::jsonb, $4, $5, $6::jsonb)
      ON CONFLICT (week_range)
      DO UPDATE SET
        week_start_date = EXCLUDED.week_start_date,
        plan_data = EXCLUDED.plan_data,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        generation_context = EXCLUDED.generation_context,
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.weekRange,
      input.weekStartDateOnly,
      input.planDataJson,
      input.source,
      input.status,
      input.generationContextJson,
    ],
  );
  if (!result.rows[0]) {
    throw new Error("Failed to upsert meal plan.");
  }
  return result.rows[0];
}

export async function updateMealPlanLists(
  client: PoolClient,
  input: {
    mealPlanId: number;
    shoppingListJson: string;
    junkListJson: string;
    householdGoodsJson: string;
    source: string;
    generationContextJson: string;
  },
): Promise<MealPlanRow> {
  const result = await client.query<MealPlanRow>(
    `
      UPDATE meal_plans
      SET
        plan_data = jsonb_set(
          jsonb_set(
            jsonb_set(plan_data, '{shoppingList}', $2::jsonb, true),
            '{junkList}',
            $3::jsonb,
            true
          ),
          '{householdGoods}',
          $4::jsonb,
          true
        ),
        source = $5,
        generation_context = $6::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      input.mealPlanId,
      input.shoppingListJson,
      input.junkListJson,
      input.householdGoodsJson,
      input.source,
      input.generationContextJson,
    ],
  );
  if (!result.rows[0]) {
    throw new Error("Failed to update meal plan lists.");
  }
  return result.rows[0];
}

export async function getDistinctMealIdsForPlan(
  client: PoolClient,
  mealPlanId: number,
): Promise<Array<{ meal_id: number | string }>> {
  const result = await client.query<{ meal_id: number | string }>(
    `
      SELECT DISTINCT meal_id
      FROM meal_plan_meals
      WHERE meal_plan_id = $1
    `,
    [mealPlanId],
  );
  return result.rows;
}

export async function deleteMealPlanMeals(
  client: PoolClient,
  mealPlanId: number,
): Promise<void> {
  await client.query(`DELETE FROM meal_plan_meals WHERE meal_plan_id = $1`, [
    mealPlanId,
  ]);
}

export async function insertMealPlanMeal(
  client: PoolClient,
  input: {
    mealPlanId: number;
    slotOrder: number;
    mealId: number;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO meal_plan_meals (
        meal_plan_id,
        slot_order,
        meal_id
      )
      VALUES ($1, $2, $3)
    `,
    [input.mealPlanId, input.slotOrder, input.mealId],
  );
}

export async function getMealPlanMealAtSlot(
  client: PoolClient,
  mealPlanId: number,
  slotOrder: number,
): Promise<{ meal_id: number | string } | null> {
  const result = await client.query<{ meal_id: number | string }>(
    `
      SELECT meal_id
      FROM meal_plan_meals
      WHERE meal_plan_id = $1
        AND slot_order = $2
    `,
    [mealPlanId, slotOrder],
  );
  return result.rows[0] ?? null;
}

export async function getMaxSlotOrderForPlan(
  client: PoolClient,
  mealPlanId: number,
): Promise<number> {
  const result = await client.query<{ max_slot: number | null }>(
    `
      SELECT MAX(slot_order) AS max_slot
      FROM meal_plan_meals
      WHERE meal_plan_id = $1
    `,
    [mealPlanId],
  );
  const maxSlot = result.rows[0]?.max_slot;
  return typeof maxSlot === "number" ? maxSlot : -1;
}

export async function updateMealPlanMealAtSlot(
  client: PoolClient,
  input: {
    mealPlanId: number;
    slotOrder: number;
    mealId: number;
  },
): Promise<void> {
  const result = await client.query(
    `
      UPDATE meal_plan_meals
      SET meal_id = $3
      WHERE meal_plan_id = $1
        AND slot_order = $2
    `,
    [input.mealPlanId, input.slotOrder, input.mealId],
  );

  if (result.rowCount === 0) {
    throw new Error("Meal slot not found.");
  }
}

export async function deleteMealPlanMealAtSlot(
  client: PoolClient,
  mealPlanId: number,
  slotOrder: number,
): Promise<number | null> {
  const existing = await getMealPlanMealAtSlot(client, mealPlanId, slotOrder);
  if (!existing) {
    return null;
  }

  await client.query(
    `
      DELETE FROM meal_plan_meals
      WHERE meal_plan_id = $1
        AND slot_order = $2
    `,
    [mealPlanId, slotOrder],
  );

  await client.query(
    `
      UPDATE meal_plan_meals
      SET slot_order = slot_order - 1
      WHERE meal_plan_id = $1
        AND slot_order > $2
    `,
    [mealPlanId, slotOrder],
  );

  return toNumber(existing.meal_id);
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export async function isMealOnPlan(
  client: PoolClient,
  mealPlanId: number,
  mealId: number,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM meal_plan_meals
        WHERE meal_plan_id = $1
          AND meal_id = $2
      ) AS exists
    `,
    [mealPlanId, mealId],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function getMealsForMealPlan(
  client: PoolClient,
  mealPlanId: number,
): Promise<MealPlanMealRow[]> {
  const result = await client.query<MealPlanMealRow>(
    `
      SELECT
        mpm.slot_order,
        mf.liked,
        m.*
      FROM meal_plan_meals mpm
      INNER JOIN meals m ON m.id = mpm.meal_id
      LEFT JOIN meal_feedback mf
        ON mf.meal_plan_id = mpm.meal_plan_id
       AND mf.meal_id = mpm.meal_id
      WHERE mpm.meal_plan_id = $1
      ORDER BY mpm.slot_order ASC
    `,
    [mealPlanId],
  );
  return result.rows;
}

export async function getMealFeedbackForPlan(
  client: PoolClient,
  mealPlanId: number,
): Promise<MealFeedbackRow[]> {
  const result = await client.query<MealFeedbackRow>(
    `
      SELECT *
      FROM meal_feedback
      WHERE meal_plan_id = $1
      ORDER BY updated_at DESC
    `,
    [mealPlanId],
  );
  return result.rows;
}

export async function removeStaleMealFeedback(
  client: PoolClient,
  mealPlanId: number,
): Promise<void> {
  await client.query(
    `
      DELETE FROM meal_feedback mf
      WHERE mf.meal_plan_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM meal_plan_meals mpm
          WHERE mpm.meal_plan_id = mf.meal_plan_id
            AND mpm.meal_id = mf.meal_id
        )
    `,
    [mealPlanId],
  );
}

export async function findMealByExactSignature(
  client: PoolClient,
  meal: {
    name: string;
    meal_type: MealRow["meal_type"];
    protein: string[];
    base: string[];
    veg: string[];
    engine: string[];
    calories: number;
    protein_grams: number;
    carbs_grams: number;
    fat_grams: number;
    fiber_grams: number;
  },
): Promise<MealRow | null> {
  const result = await client.query<MealRow>(
    `
      SELECT *
      FROM meals
      WHERE name = $1
        AND meal_type = $2
        AND protein = $3
        AND base = $4
        AND veg = $5
        AND engine = $6
        AND calories = $7
        AND protein_grams = $8
        AND carbs_grams = $9
        AND fat_grams = $10
        AND fiber_grams = $11
      LIMIT 1
    `,
    [
      meal.name,
      meal.meal_type,
      meal.protein,
      meal.base,
      meal.veg,
      meal.engine,
      meal.calories,
      meal.protein_grams,
      meal.carbs_grams,
      meal.fat_grams,
      meal.fiber_grams,
    ],
  );
  return result.rows[0] ?? null;
}

export async function insertMeal(
  client: PoolClient,
  mealData: Omit<
    MealRow,
    | "id"
    | "created_at"
    | "updated_at"
    | "heart_count"
    | "appearance_count"
    | "last_served_at"
  >,
): Promise<{ id: number | string }> {
  const result = await client.query<{ id: number | string }>(
    `
      INSERT INTO meals (
        name,
        meal_type,
        protein,
        base,
        veg,
        engine,
        ingredients,
        calories,
        protein_grams,
        carbs_grams,
        fat_grams,
        fiber_grams,
        servings,
        steps,
        image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
      RETURNING id
    `,
    [
      mealData.name,
      mealData.meal_type,
      mealData.protein,
      mealData.base,
      mealData.veg,
      mealData.engine,
      JSON.stringify(mealData.ingredients),
      mealData.calories,
      mealData.protein_grams,
      mealData.carbs_grams,
      mealData.fat_grams,
      mealData.fiber_grams,
      mealData.servings,
      JSON.stringify(mealData.steps),
      mealData.image_url,
    ],
  );
  if (!result.rows[0]) {
    throw new Error("Failed to insert meal.");
  }
  return result.rows[0];
}

export async function getMealById(
  client: PoolClient,
  mealId: number,
): Promise<MealRow | null> {
  const result = await client.query<MealRow>(
    `
      SELECT *
      FROM meals
      WHERE id = $1
      LIMIT 1
    `,
    [mealId],
  );
  return result.rows[0] ?? null;
}

export async function getMealLikedForPlan(
  client: PoolClient,
  input: { mealPlanId: number; mealId: number },
): Promise<{ liked: boolean } | null> {
  const result = await client.query<{ liked: boolean }>(
    `
      SELECT liked
      FROM meal_feedback
      WHERE meal_plan_id = $1
        AND meal_id = $2
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [input.mealPlanId, input.mealId],
  );
  return result.rows[0] ?? null;
}

export async function refreshMealStats(
  client: PoolClient,
  mealIds: number[],
): Promise<void> {
  if (!mealIds.length) return;

  await client.query(
    `
      UPDATE meals AS m
      SET
        appearance_count = stats.appearance_count,
        heart_count = stats.heart_count,
        last_served_at = stats.last_served_at
      FROM (
        SELECT
          ids.meal_id,
          COALESCE(appearances.appearance_count, 0) AS appearance_count,
          COALESCE(hearts.heart_count, 0) AS heart_count,
          appearances.last_served_at
        FROM UNNEST($1::bigint[]) AS ids(meal_id)
        LEFT JOIN (
          SELECT
            mpm.meal_id,
            COUNT(*)::int AS appearance_count,
            MAX(mp.updated_at) AS last_served_at
          FROM meal_plan_meals mpm
          INNER JOIN meal_plans mp ON mp.id = mpm.meal_plan_id
          WHERE mpm.meal_id = ANY($1::bigint[])
          GROUP BY mpm.meal_id
        ) appearances ON appearances.meal_id = ids.meal_id
        LEFT JOIN (
          SELECT
            meal_id,
            COUNT(*)::int AS heart_count
          FROM meal_feedback
          WHERE liked = TRUE
            AND meal_id = ANY($1::bigint[])
          GROUP BY meal_id
        ) hearts ON hearts.meal_id = ids.meal_id
      ) AS stats
      WHERE m.id = stats.meal_id
    `,
    [mealIds],
  );
}

export async function upsertMealFeedback(
  client: PoolClient,
  input: { mealPlanId: number; mealId: number; liked: boolean },
): Promise<MealFeedbackRow> {
  const result = await client.query<MealFeedbackRow>(
    `
      INSERT INTO meal_feedback (
        meal_plan_id,
        meal_id,
        liked
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (meal_plan_id, meal_id)
      DO UPDATE SET
        liked = EXCLUDED.liked,
        updated_at = NOW()
      RETURNING *
    `,
    [input.mealPlanId, input.mealId, input.liked],
  );
  if (!result.rows[0]) {
    throw new Error("Failed to upsert meal feedback.");
  }
  return result.rows[0];
}

export async function updateMeal(
  client: PoolClient,
  input: {
    id: number;
    name: string;
    meal_type: MealRow["meal_type"];
    protein: string[];
    base: string[];
    veg: string[];
    engine: string[];
    ingredients: MealRow["ingredients"];
    calories: number;
    protein_grams: number;
    carbs_grams: number;
    fat_grams: number;
    fiber_grams: number;
    servings: number;
    steps: string[];
    image_url: string | null;
  },
): Promise<MealRow | null> {
  const result = await client.query<MealRow>(
    `
      UPDATE meals
      SET
        name = $2,
        meal_type = $3,
        protein = $4,
        base = $5,
        veg = $6,
        engine = $7,
        ingredients = $8::jsonb,
        calories = $9,
        protein_grams = $10,
        carbs_grams = $11,
        fat_grams = $12,
        fiber_grams = $13,
        servings = $14,
        steps = $15::jsonb,
        image_url = $16,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      input.id,
      input.name,
      input.meal_type,
      input.protein,
      input.base,
      input.veg,
      input.engine,
      JSON.stringify(input.ingredients),
      input.calories,
      input.protein_grams,
      input.carbs_grams,
      input.fat_grams,
      input.fiber_grams,
      input.servings,
      JSON.stringify(input.steps),
      input.image_url,
    ],
  );
  return result.rows[0] ?? null;
}

export async function updateMealServings(
  client: PoolClient,
  mealId: number,
  servings: number,
): Promise<MealRow | null> {
  const result = await client.query<MealRow>(
    `
      UPDATE meals
      SET servings = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [mealId, servings],
  );
  return result.rows[0] ?? null;
}

export async function insertMealReturningRow(
  client: PoolClient,
  mealData: Omit<
    MealRow,
    | "id"
    | "created_at"
    | "updated_at"
    | "heart_count"
    | "appearance_count"
    | "last_served_at"
  >,
): Promise<MealRow> {
  const result = await client.query<MealRow>(
    `
      INSERT INTO meals (
        name,
        meal_type,
        protein,
        base,
        veg,
        engine,
        ingredients,
        calories,
        protein_grams,
        carbs_grams,
        fat_grams,
        fiber_grams,
        servings,
        steps,
        image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
      RETURNING *
    `,
    [
      mealData.name,
      mealData.meal_type,
      mealData.protein,
      mealData.base,
      mealData.veg,
      mealData.engine,
      JSON.stringify(mealData.ingredients),
      mealData.calories,
      mealData.protein_grams,
      mealData.carbs_grams,
      mealData.fat_grams,
      mealData.fiber_grams,
      mealData.servings,
      JSON.stringify(mealData.steps),
      mealData.image_url,
    ],
  );
  if (!result.rows[0]) {
    throw new Error("Failed to insert meal.");
  }
  return result.rows[0];
}

export async function ensureMealPlanExists(
  client: PoolClient,
  mealPlanId: number,
): Promise<void> {
  const result = await client.query<{ id: number | string }>(
    `
      SELECT id
      FROM meal_plans
      WHERE id = $1
      LIMIT 1
    `,
    [mealPlanId],
  );
  if (!result.rows[0]) {
    throw new Error("Meal plan not found.");
  }
}

export async function findOrCreateJunkItem(
  client: PoolClient,
  name: string,
): Promise<number | string> {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Junk item name is required.");
  }

  const existing = await client.query<{ id: number | string }>(
    `
      SELECT id
      FROM junk_items
      WHERE name = $1
      LIMIT 1
    `,
    [normalized],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: number | string }>(
    `
      INSERT INTO junk_items (name)
      VALUES ($1)
      ON CONFLICT (name)
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `,
    [normalized],
  );
  if (!inserted.rows[0]) {
    throw new Error("Failed to create junk item.");
  }
  return inserted.rows[0].id;
}

export async function upsertJunkFeedback(
  client: PoolClient,
  input: { mealPlanId: number; junkItemId: number; liked: boolean },
): Promise<{
  id: number | string;
  meal_plan_id: number | string;
  junk_item_id: number | string;
  liked: boolean;
  created_at: Date;
  updated_at: Date;
}> {
  const result = await client.query<{
    id: number | string;
    meal_plan_id: number | string;
    junk_item_id: number | string;
    liked: boolean;
    created_at: Date;
    updated_at: Date;
  }>(
    `
      INSERT INTO junk_feedback (
        meal_plan_id,
        junk_item_id,
        liked
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (meal_plan_id, junk_item_id)
      DO UPDATE SET
        liked = EXCLUDED.liked,
        updated_at = NOW()
      RETURNING *
    `,
    [input.mealPlanId, input.junkItemId, input.liked],
  );
  if (!result.rows[0]) {
    throw new Error("Failed to upsert junk feedback.");
  }
  return result.rows[0];
}

export async function refreshJunkItemStats(
  client: PoolClient,
  junkItemIds: number[],
): Promise<void> {
  if (!junkItemIds.length) return;

  await client.query(
    `
      UPDATE junk_items AS ji
      SET heart_count = stats.heart_count,
          updated_at = NOW()
      FROM (
        SELECT
          ids.junk_item_id,
          COALESCE(hearts.heart_count, 0) AS heart_count
        FROM UNNEST($1::bigint[]) AS ids(junk_item_id)
        LEFT JOIN (
          SELECT
            junk_item_id,
            COUNT(*)::int AS heart_count
          FROM junk_feedback
          WHERE liked = TRUE
            AND junk_item_id = ANY($1::bigint[])
          GROUP BY junk_item_id
        ) hearts ON hearts.junk_item_id = ids.junk_item_id
      ) AS stats
      WHERE ji.id = stats.junk_item_id
    `,
    [junkItemIds],
  );
}

export async function getJunkItemById(
  client: PoolClient,
  junkItemId: number,
): Promise<{ id: number | string; name: string; heart_count: number } | null> {
  const result = await client.query<{
    id: number | string;
    name: string;
    heart_count: number;
  }>(
    `
      SELECT id, name, heart_count
      FROM junk_items
      WHERE id = $1
      LIMIT 1
    `,
    [junkItemId],
  );
  return result.rows[0] ?? null;
}
