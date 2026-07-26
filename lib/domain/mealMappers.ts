/**
 * Pure mapping functions between database rows and domain objects
 * No side effects, no database calls - pure transformations only
 */

import {
  StoredMeal,
  MealIngredient,
  MealFeedback,
  MealInput,
  MealRow,
  MealFeedbackRow,
  MealPlanMealRow
} from "@/lib/types";

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function normalizeIngredients(value: unknown): MealIngredient[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((ingredient): ingredient is MealIngredient => {
    if (!ingredient || typeof ingredient !== "object") {
      return false;
    }

    const candidate = ingredient as Partial<MealIngredient>;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.quantity === "string" &&
      typeof candidate.category === "string" &&
      Boolean(candidate.macros)
    );
  });
}

export function mapMeal(
  row: MealRow,
  likedForCurrentWeek = false,
  slotOrder = 0
): StoredMeal {
  return {
    mealId: toNumber(row.id),
    slotOrder,
    type: row.meal_type,
    name: row.name,
    build: {
      pro: row.protein,
      base: row.base,
      veg: row.veg,
      engine: row.engine,
    },
    ingredients: normalizeIngredients(row.ingredients),
    macros: {
      cal: row.calories,
      p: row.protein_grams,
      c: row.carbs_grams,
      f: row.fat_grams,
      fiber: row.fiber_grams ?? 0,
    },
    heartCount: row.heart_count,
    appearanceCount: row.appearance_count,
    likedForCurrentWeek,
    lastServedAt: normalizeDate(row.last_served_at),
  };
}

export function mapMealFeedback(row: MealFeedbackRow): MealFeedback {
  return {
    id: toNumber(row.id),
    mealPlanId: toNumber(row.meal_plan_id),
    mealId: toNumber(row.meal_id),
    liked: row.liked,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapPlanMeals(rows: MealPlanMealRow[]): StoredMeal[] {
  return [...rows]
    .sort((a, b) => a.slot_order - b.slot_order)
    .map((row) => mapMeal(row, Boolean(row.liked), row.slot_order));
}

export function toMealInput(meal: StoredMeal): MealInput {
  return {
    type: meal.type,
    name: meal.name,
    build: meal.build,
    ingredients: meal.ingredients,
    macros: meal.macros,
  };
}

export function mealMatches(row: MealRow, meal: MealInput): boolean {
  const arraysEqual = (a: string[], b: string[]) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  return (
    row.name === meal.name &&
    row.meal_type === meal.type &&
    arraysEqual(row.protein, meal.build.pro) &&
    arraysEqual(row.base, meal.build.base) &&
    arraysEqual(row.veg, meal.build.veg) &&
    arraysEqual(row.engine, meal.build.engine) &&
    row.calories === meal.macros.cal &&
    row.protein_grams === meal.macros.p &&
    row.carbs_grams === meal.macros.c &&
    row.fat_grams === meal.macros.f &&
    row.fiber_grams === meal.macros.fiber
  );
}

export function mealInputToRow(mealInput: MealInput): Omit<MealRow, 'id' | 'created_at' | 'updated_at' | 'heart_count' | 'appearance_count' | 'last_served_at'> {
  return {
    name: mealInput.name,
    meal_type: mealInput.type,
    protein: mealInput.build.pro,
    base: mealInput.build.base,
    veg: mealInput.build.veg,
    engine: mealInput.build.engine,
    ingredients: mealInput.ingredients ?? [],
    calories: mealInput.macros.cal,
    protein_grams: mealInput.macros.p,
    carbs_grams: mealInput.macros.c,
    fat_grams: mealInput.macros.f,
    fiber_grams: mealInput.macros.fiber,
  };
}

export function serializePlanData(weekData: {
  shoppingList: unknown;
  junkList: unknown;
  householdGoods?: unknown;
}) {
  return {
    shoppingList: weekData.shoppingList,
    junkList: weekData.junkList,
    householdGoods: weekData.householdGoods ?? [],
  };
}
