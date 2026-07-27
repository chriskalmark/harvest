import { readFile } from "fs/promises";
import path from "path";
import { PoolClient } from "pg";
import { pool, withTransaction } from "@/lib/db";
import * as mealRepo from "@/lib/db/mealRepository";
import {
  mapPlanMeals as mapPlanMealsFromRows,
  mapMealFeedback,
  mealInputToRow,
  mealMatches as mealMatchesFn,
  serializePlanData as serializePlanDataFn,
} from "@/lib/domain/mealMappers";
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";
import { normalizeWeekDataBuildArrays } from "@/lib/mealPlanMarkdown";
import {
  ListCategory,
  MealFeedback,
  MealInput,
  MealPlanRow,
  MutateMealPlanCompositionInput,
  SaveMealHeartInput,
  StoredMeal,
  StoredMealPlan,
  WeekData,
  WeekOption,
  HouseholdGoodsItem,
} from "@/lib/types";
import {
  deriveWeekStartDateOnlyFromWeekRange,
  formatWeekRangeDanish,
  getWeekStartDateOnly,
  toSortValueFromDateOnly,
} from "@/lib/weekRange";

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export async function readSeedWeekData(): Promise<WeekData> {
  const filePath = path.join(process.cwd(), "data", "current-week.json");
  const raw = await readFile(filePath, "utf8");
  const weekData = normalizeWeekDataBuildArrays(JSON.parse(raw) as WeekData);
  return {
    ...weekData,
    shoppingList: deriveShoppingListFromMeals(
      weekData.meals,
      weekData.shoppingList ?? [],
      weekData.junkList,
      weekData.householdGoods ?? [],
    ),
  };
}

async function enrichJunkList(
  client: PoolClient,
  mealPlanId: number,
  junkList: ListCategory[],
): Promise<ListCategory[]> {
  const names = Array.from(
    new Set(
      junkList.flatMap((category) =>
        category.items.map((item) => item.n).filter(Boolean),
      ),
    ),
  );

  if (names.length === 0) {
    return junkList;
  }

  const result = await client.query<{
    id: number | string;
    name: string;
    heart_count: number;
    liked: boolean | null;
  }>(
    `
      SELECT
        ji.id,
        ji.name,
        ji.heart_count,
        jf.liked
      FROM junk_items ji
      LEFT JOIN junk_feedback jf
        ON jf.junk_item_id = ji.id
       AND jf.meal_plan_id = $1
      WHERE ji.name = ANY($2::text[])
    `,
    [mealPlanId, names],
  );

  const byName = new Map(
    result.rows.map((row) => [
      row.name,
      {
        junkItemId: toNumber(row.id),
        heartCount: row.heart_count,
        likedForCurrentWeek: Boolean(row.liked),
      },
    ]),
  );

  return junkList.map((category) => ({
    ...category,
    items: category.items.map((item) => {
      const enriched = byName.get(item.n);
      if (!enriched) {
        return {
          ...item,
          heartCount: 0,
          likedForCurrentWeek: false,
        };
      }

      return {
        ...item,
        ...enriched,
      };
    }),
  }));
}

async function getMealFeedbackForPlan(
  client: PoolClient,
  mealPlanId: number,
): Promise<MealFeedback[]> {
  const rows = await mealRepo.getMealFeedbackForPlan(client, mealPlanId);
  return rows.map(mapMealFeedback);
}

async function getMealPlanMeals(
  client: PoolClient,
  mealPlanId: number,
): Promise<StoredMeal[]> {
  const rows = await mealRepo.getMealsForMealPlan(client, mealPlanId);
  return mapPlanMealsFromRows(rows);
}

async function buildStoredMealPlan(
  client: PoolClient,
  row: MealPlanRow,
): Promise<StoredMealPlan> {
  const mealPlanId = toNumber(row.id);
  const meals = await getMealPlanMeals(client, mealPlanId);
  const junkList = await enrichJunkList(
    client,
    mealPlanId,
    row.plan_data.junkList ?? [],
  );
  const householdGoods: HouseholdGoodsItem[] =
    row.plan_data.householdGoods ?? [];
  const shoppingList = deriveShoppingListFromMeals(
    meals,
    row.plan_data.shoppingList ?? [],
    junkList,
    householdGoods,
  );

  return {
    id: mealPlanId,
    weekRange: row.week_range,
    meals,
    shoppingList,
    junkList,
    householdGoods,
    source: row.source,
    status: row.status,
    generationContext: row.generation_context ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    mealFeedback: await getMealFeedbackForPlan(client, mealPlanId),
  };
}

function mapWeekOption(row: MealPlanRow): WeekOption {
  const weekRange = row.week_range;
  const updatedAt = row.updated_at;
  const inferredStartDateOnly = deriveWeekStartDateOnlyFromWeekRange(
    weekRange,
    updatedAt,
  );
  const sortValue = inferredStartDateOnly
    ? toSortValueFromDateOnly(inferredStartDateOnly)
    : 0;

  const year = updatedAt.getFullYear();
  const weekRangeWithYear = weekRange.includes(String(year))
    ? weekRange
    : `${weekRange}, ${year}`;

  return {
    id: toNumber(row.id),
    weekRange: row.week_range,
    // weekRange itself must stay in the parseable English shape (see
    // lib/weekRange.ts); displayLabel is Danish for the UI only.
    displayLabel: formatWeekRangeDanish(weekRangeWithYear),
    sortValue,
    updatedAt: row.updated_at.toISOString(),
  };
}

async function findOrCreateMeal(
  client: PoolClient,
  meal: MealInput,
): Promise<number> {
  const existing = await mealRepo.findMealByExactSignature(client, {
    name: meal.name,
    meal_type: meal.type,
    protein: meal.build.pro,
    base: meal.build.base,
    veg: meal.build.veg,
    engine: meal.build.engine,
    calories: meal.macros.cal,
    protein_grams: meal.macros.p,
    carbs_grams: meal.macros.c,
    fat_grams: meal.macros.f,
    fiber_grams: meal.macros.fiber,
  });

  if (existing && mealMatchesFn(existing, meal)) {
    const existingId = toNumber(existing.id);
    if (
      meal.ingredients &&
      JSON.stringify(existing.ingredients ?? []) !==
        JSON.stringify(meal.ingredients)
    ) {
      await mealRepo.updateMeal(client, {
        id: existingId,
        ...mealInputToRow(meal),
      });
    }
    return existingId;
  }

  const inserted = await mealRepo.insertMeal(client, mealInputToRow(meal));
  return toNumber(inserted.id);
}

async function refreshMealStats(client: PoolClient, mealIds: number[]) {
  await mealRepo.refreshMealStats(client, mealIds);
}

async function removeStaleFeedback(client: PoolClient, mealPlanId: number) {
  await mealRepo.removeStaleMealFeedback(client, mealPlanId);
}

async function findOrCreateJunkItem(
  client: PoolClient,
  name: string,
): Promise<number> {
  const id = await mealRepo.findOrCreateJunkItem(client, name);
  return toNumber(id);
}

async function refreshJunkItemStats(client: PoolClient, junkItemIds: number[]) {
  await mealRepo.refreshJunkItemStats(client, junkItemIds);
}

export async function upsertMealPlan(
  weekData: WeekData,
  options?: {
    source?: string;
    status?: string;
    generationContext?: Record<string, unknown>;
  },
): Promise<StoredMealPlan> {
  return withTransaction(async (client) => {
    const source = options?.source ?? "seed_json";
    const status = options?.status ?? "active";
    const generationContext = options?.generationContext ?? {};
    const referenceDate = (() => {
      const maybePublishedAt = generationContext.publishedAt;
      const maybeSeededAt = generationContext.seededAt;
      const maybeUpdatedAt = generationContext.updatedAt;

      const pick =
        typeof maybePublishedAt === "string" && maybePublishedAt
          ? maybePublishedAt
          : typeof maybeSeededAt === "string" && maybeSeededAt
            ? maybeSeededAt
            : typeof maybeUpdatedAt === "string" && maybeUpdatedAt
              ? maybeUpdatedAt
              : null;

      const parsed = pick ? new Date(pick) : null;
      return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
    })();
    const weekStartDateOnly =
      deriveWeekStartDateOnlyFromWeekRange(weekData.weekRange, referenceDate) ??
      getWeekStartDateOnly(referenceDate);
    const existingPlanRow = await mealRepo.getMealPlanByWeekRange(
      client,
      weekData.weekRange,
    );
    const normalizedWeekData = normalizeWeekDataBuildArrays(weekData);
    const previousShoppingList =
      existingPlanRow?.plan_data.shoppingList ??
      normalizedWeekData.shoppingList ??
      [];
    const householdGoods =
      existingPlanRow?.plan_data.householdGoods ??
      normalizedWeekData.householdGoods ??
      [];
    const weekDataToStore: WeekData & { shoppingList: ListCategory[] } = {
      ...normalizedWeekData,
      householdGoods,
      shoppingList: deriveShoppingListFromMeals(
        normalizedWeekData.meals,
        previousShoppingList,
        normalizedWeekData.junkList,
        householdGoods,
      ),
    };

    const planRow = await mealRepo.upsertMealPlanRow(client, {
      weekRange: weekDataToStore.weekRange,
      weekStartDateOnly,
      planDataJson: JSON.stringify(serializePlanDataFn(weekDataToStore)),
      source,
      status,
      generationContextJson: JSON.stringify(generationContext),
    });

    const mealPlanId = toNumber(planRow.id);
    const previousMealIds = await mealRepo.getDistinctMealIdsForPlan(
      client,
      mealPlanId,
    );
    await mealRepo.deleteMealPlanMeals(client, mealPlanId);

    const touchedMealIds = new Set<number>(
      previousMealIds.map((row) => toNumber(row.meal_id)),
    );

    for (const [slotOrder, meal] of weekDataToStore.meals.entries()) {
      const mealId = await findOrCreateMeal(client, meal);
      touchedMealIds.add(mealId);

      await mealRepo.insertMealPlanMeal(client, {
        mealPlanId,
        slotOrder,
        mealId,
      });
    }

    await removeStaleFeedback(client, mealPlanId);
    await refreshMealStats(client, [...touchedMealIds]);

    return buildStoredMealPlan(client, planRow);
  });
}

export async function getLatestMealPlan(): Promise<StoredMealPlan | null> {
  const client = await pool.connect();

  try {
    const currentWeekStartDateOnly = getWeekStartDateOnly();
    const currentWeekRow = await mealRepo.getMealPlanByWeekStartDate(
      client,
      currentWeekStartDateOnly,
    );

    if (currentWeekRow) {
      return buildStoredMealPlan(client, currentWeekRow);
    }

    const fallbackRow = await mealRepo.getMostRecentlyUpdatedMealPlan(client);
    return fallbackRow ? buildStoredMealPlan(client, fallbackRow) : null;
  } finally {
    client.release();
  }
}

export async function getMealPlanByWeekRange(
  weekRange: string,
): Promise<StoredMealPlan | null> {
  const client = await pool.connect();

  try {
    const row = await mealRepo.getMealPlanByWeekRange(client, weekRange);
    return row ? buildStoredMealPlan(client, row) : null;
  } finally {
    client.release();
  }
}

export async function listMealPlanWeeks(): Promise<WeekOption[]> {
  const client = await pool.connect();
  try {
    const rows = await mealRepo.listMealPlanWeeks(client);
    const weeks = rows.map(mapWeekOption);
    return weeks.sort((a, b) => a.sortValue - b.sortValue);
  } finally {
    client.release();
  }
}

export async function seedMealPlanFromJson(): Promise<StoredMealPlan> {
  const weekData = await readSeedWeekData();

  return upsertMealPlan(weekData, {
    source: "current-week.json",
    generationContext: {
      seededFrom: "data/current-week.json",
      seededAt: new Date().toISOString(),
    },
  });
}

export async function updateMealPlanLists(
  mealPlanId: number,
  input: {
    shoppingList: ListCategory[];
    junkList: ListCategory[];
    householdGoods: HouseholdGoodsItem[];
    source?: string;
    generationContext?: Record<string, unknown>;
  },
): Promise<StoredMealPlan> {
  return withTransaction(async (client) => {
    const row = await mealRepo.updateMealPlanLists(client, {
      mealPlanId,
      shoppingListJson: JSON.stringify(input.shoppingList),
      junkListJson: JSON.stringify(input.junkList),
      householdGoodsJson: JSON.stringify(input.householdGoods),
      source: input.source ?? "user_edit",
      generationContextJson: JSON.stringify(input.generationContext ?? {}),
    });

    return buildStoredMealPlan(client, row);
  });
}

export async function mutateMealPlanComposition(
  input: MutateMealPlanCompositionInput,
): Promise<StoredMealPlan> {
  return withTransaction(async (client) => {
    const planRow = await mealRepo.getMealPlanByWeekRange(
      client,
      input.weekRange,
    );
    if (!planRow) {
      throw new Error("Meal plan not found.");
    }

    const mealPlanId = toNumber(planRow.id);
    const previousShoppingList = planRow.plan_data.shoppingList ?? [];
    const junkList = planRow.plan_data.junkList ?? [];
    const householdGoods: HouseholdGoodsItem[] =
      planRow.plan_data.householdGoods ?? [];
    const touchedMealIds = new Set<number>();

    if (input.action === "add") {
      if (!input.type) {
        throw new Error("type is required for add.");
      }
      if (input.mealId === undefined) {
        throw new Error("mealId is required for add.");
      }

      const mealRow = await mealRepo.getMealById(client, input.mealId);
      if (!mealRow) {
        throw new Error("Meal not found.");
      }
      if (mealRow.meal_type !== input.type) {
        throw new Error(`Meal type must be ${input.type}.`);
      }
      if (await mealRepo.isMealOnPlan(client, mealPlanId, input.mealId)) {
        throw new Error("Meal is already on this week's menu.");
      }

      const nextSlot =
        (await mealRepo.getMaxSlotOrderForPlan(client, mealPlanId)) + 1;
      await mealRepo.insertMealPlanMeal(client, {
        mealPlanId,
        slotOrder: nextSlot,
        mealId: input.mealId,
      });
      touchedMealIds.add(input.mealId);
    } else {
      if (input.slotOrder === undefined) {
        throw new Error("slotOrder is required.");
      }

      const slotMeal = await mealRepo.getMealPlanMealAtSlot(
        client,
        mealPlanId,
        input.slotOrder,
      );
      if (!slotMeal) {
        throw new Error("Meal slot not found.");
      }

      const currentMealId = toNumber(slotMeal.meal_id);
      touchedMealIds.add(currentMealId);

      if (input.action === "remove") {
        const removedMealId = await mealRepo.deleteMealPlanMealAtSlot(
          client,
          mealPlanId,
          input.slotOrder,
        );
        if (removedMealId !== null) {
          touchedMealIds.add(removedMealId);
        }
      } else if (input.action === "swap") {
        if (input.mealId === undefined) {
          throw new Error("mealId is required for swap.");
        }
        if (input.mealId === currentMealId) {
          throw new Error("Meal is already in this slot.");
        }
        if (await mealRepo.isMealOnPlan(client, mealPlanId, input.mealId)) {
          throw new Error("Meal is already on this week's menu.");
        }

        const mealRow = await mealRepo.getMealById(client, input.mealId);
        if (!mealRow) {
          throw new Error("Meal not found.");
        }

        const currentMealRow = await mealRepo.getMealById(
          client,
          currentMealId,
        );
        if (!currentMealRow) {
          throw new Error("Current meal not found.");
        }
        if (mealRow.meal_type !== currentMealRow.meal_type) {
          throw new Error(
            `Replacement meal must be ${currentMealRow.meal_type}.`,
          );
        }

        await mealRepo.updateMealPlanMealAtSlot(client, {
          mealPlanId,
          slotOrder: input.slotOrder,
          mealId: input.mealId,
        });
        touchedMealIds.add(input.mealId);
      }
    }

    await removeStaleFeedback(client, mealPlanId);

    const meals = await getMealPlanMeals(client, mealPlanId);
    const pruneOrphans = input.action !== "add";
    const shoppingList = deriveShoppingListFromMeals(
      meals,
      previousShoppingList,
      junkList,
      householdGoods,
      { pruneOrphans },
    );

    await mealRepo.updateMealPlanLists(client, {
      mealPlanId,
      shoppingListJson: JSON.stringify(shoppingList),
      junkListJson: JSON.stringify(junkList),
      householdGoodsJson: JSON.stringify(householdGoods),
      source: "menu_edit",
      generationContextJson: JSON.stringify({
        lastCompositionAction: input.action,
        updatedAt: new Date().toISOString(),
      }),
    });

    await refreshMealStats(client, [...touchedMealIds]);

    const updatedRow = await mealRepo.getMealPlanById(client, mealPlanId);
    if (!updatedRow) {
      throw new Error("Meal plan not found after update.");
    }

    return buildStoredMealPlan(client, updatedRow);
  });
}

export async function saveMealHeart(
  input: SaveMealHeartInput,
): Promise<MealFeedback> {
  return withTransaction(async (client) => {
    const mealRow = await mealRepo.getMealById(client, input.mealId);
    if (!mealRow) {
      throw new Error("Meal not found.");
    }

    const row = await mealRepo.upsertMealFeedback(client, input);

    await refreshMealStats(client, [input.mealId]);

    return mapMealFeedback(row);
  });
}

export async function saveJunkHeart(input: {
  mealPlanId: number;
  itemName: string;
  liked: boolean;
}): Promise<{
  id: number;
  mealPlanId: number;
  junkItemId: number;
  itemName: string;
  liked: boolean;
  heartCount: number;
  createdAt: string;
  updatedAt: string;
}> {
  return withTransaction(async (client) => {
    await mealRepo.ensureMealPlanExists(client, input.mealPlanId);

    const junkItemId = await findOrCreateJunkItem(client, input.itemName);

    const feedback = await mealRepo.upsertJunkFeedback(client, {
      mealPlanId: input.mealPlanId,
      junkItemId,
      liked: input.liked,
    });

    await refreshJunkItemStats(client, [junkItemId]);

    const item = await mealRepo.getJunkItemById(client, junkItemId);
    if (!item) {
      throw new Error("Junk item not found.");
    }

    return {
      id: toNumber(feedback.id),
      mealPlanId: toNumber(feedback.meal_plan_id),
      junkItemId: toNumber(feedback.junk_item_id),
      itemName: item.name,
      liked: feedback.liked,
      heartCount: item.heart_count,
      createdAt: feedback.created_at.toISOString(),
      updatedAt: feedback.updated_at.toISOString(),
    };
  });
}
