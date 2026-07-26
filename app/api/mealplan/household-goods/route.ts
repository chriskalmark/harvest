import { NextRequest } from "next/server";
import {
  getLatestMealPlan,
  getMealPlanByWeekRange,
  updateMealPlanLists,
} from "@/lib/services/mealPlanService";
import { ApiError, createRouteHandler } from "@/lib/apiUtils";
import { requireString } from "@/lib/routeValidation";
import { HOUSEHOLD_GOODS_CATALOG } from "@/lib/constants";
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";
import type { HouseholdGoodsItem, StoredMealPlan } from "@/lib/types";

function findCatalogEntry(category: string) {
  return HOUSEHOLD_GOODS_CATALOG.find((entry) => entry.category === category);
}

function parseHouseholdGoods(value: unknown): HouseholdGoodsItem[] {
  if (!Array.isArray(value)) {
    throw new ApiError("householdGoods must be an array", 400);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ApiError(`householdGoods[${index}] must be an object`, 400);
    }

    const itemObj = item as Record<string, unknown>;
    const category = requireString(
      itemObj.category,
      `householdGoods[${index}].category`
    ).trim();
    const n = requireString(itemObj.n, `householdGoods[${index}].n`).trim();
    const catalogEntry = findCatalogEntry(category);

    if (!catalogEntry || catalogEntry.n !== n) {
      throw new ApiError(`householdGoods[${index}] is not a valid catalog item`, 400);
    }

    return { category, n };
  });
}

async function saveHouseholdGoods(
  mealPlan: StoredMealPlan,
  householdGoods: HouseholdGoodsItem[],
  updatedFrom: string
) {
  const shoppingList = deriveShoppingListFromMeals(
    mealPlan.meals,
    mealPlan.shoppingList,
    mealPlan.junkList,
    householdGoods
  );

  return updateMealPlanLists(mealPlan.id, {
    shoppingList,
    junkList: mealPlan.junkList,
    householdGoods,
    source: "user_edit",
    generationContext: {
      updatedFrom,
      updatedAt: new Date().toISOString(),
    },
  });
}

export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const category = requireString(obj.category, "category").trim();
  const catalogEntry = findCatalogEntry(category);

  if (!catalogEntry) {
    throw new ApiError("Unknown household goods category", 400);
  }

  const mealPlan = weekRange ? await getMealPlanByWeekRange(weekRange) : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const householdGoods = [...mealPlan.householdGoods];
  if (householdGoods.some((item) => item.category === category)) {
    throw new ApiError("Item is already on this week's household goods list", 409);
  }

  householdGoods.push({
    category: catalogEntry.category,
    n: catalogEntry.n,
  });

  const updated = await saveHouseholdGoods(mealPlan, householdGoods, "household_goods_add");

  return { householdGoods: updated.householdGoods };
});

export const PUT = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const householdGoods = parseHouseholdGoods(obj.householdGoods);

  const mealPlan = weekRange ? await getMealPlanByWeekRange(weekRange) : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const updated = await saveHouseholdGoods(mealPlan, householdGoods, "household_goods_update");

  return { householdGoods: updated.householdGoods };
});

export const DELETE = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const category = requireString(obj.category, "category").trim();

  const mealPlan = weekRange ? await getMealPlanByWeekRange(weekRange) : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const householdGoods = mealPlan.householdGoods.filter((item) => item.category !== category);
  const updated = await saveHouseholdGoods(mealPlan, householdGoods, "household_goods_delete");

  return { householdGoods: updated.householdGoods };
});
