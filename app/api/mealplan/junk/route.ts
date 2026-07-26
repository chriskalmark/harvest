import { NextRequest } from "next/server";
import {
  getLatestMealPlan,
  getMealPlanByWeekRange,
  updateMealPlanLists,
} from "@/lib/services/mealPlanService";
import { ApiError, createRouteHandler } from "@/lib/apiUtils";
import { requireBoolean, requireString } from "@/lib/routeValidation";
import { JUNK_CATEGORY_ORDER } from "@/lib/constants";
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";
import type { ListCategory, StoredMealPlan } from "@/lib/types";

function createDefaultJunkList(): ListCategory[] {
  return JUNK_CATEGORY_ORDER.map((category) => ({
    category,
    items: [],
  }));
}

function cloneJunkList(junkList: ListCategory[]): ListCategory[] {
  return junkList.map((category) => ({
    ...category,
    items: [...category.items],
  }));
}

function findJunkItemIndex(
  junkList: ListCategory[],
  category: string | null,
  itemName: string
): { categoryIndex: number; itemIndex: number } | null {
  if (category) {
    const categoryIndex = junkList.findIndex((group) => group.category === category);
    if (categoryIndex !== -1) {
      const itemIndex = junkList[categoryIndex].items.findIndex((item) => item.n === itemName);
      if (itemIndex !== -1) {
        return { categoryIndex, itemIndex };
      }
    }
  }

  for (const [categoryIndex, group] of junkList.entries()) {
    const itemIndex = group.items.findIndex((item) => item.n === itemName);
    if (itemIndex !== -1) {
      return { categoryIndex, itemIndex };
    }
  }

  return null;
}

function parseJunkList(value: unknown): ListCategory[] {
  if (!Array.isArray(value)) {
    throw new ApiError("junkList must be an array", 400);
  }

  return value.map((category, categoryIndex) => {
    if (!category || typeof category !== "object") {
      throw new ApiError(`junkList[${categoryIndex}] must be an object`, 400);
    }

    const categoryObj = category as Record<string, unknown>;
    const categoryName = requireString(
      categoryObj.category,
      `junkList[${categoryIndex}].category`
    ).trim();
    if (!Array.isArray(categoryObj.items)) {
      throw new ApiError(`junkList[${categoryIndex}].items must be an array`, 400);
    }

    return {
      category: categoryName,
      items: categoryObj.items.map((item, itemIndex) => {
        if (!item || typeof item !== "object") {
          throw new ApiError(
            `junkList[${categoryIndex}].items[${itemIndex}] must be an object`,
            400
          );
        }

        const itemObj = item as Record<string, unknown>;
        const parsed = {
          n: requireString(
            itemObj.n,
            `junkList[${categoryIndex}].items[${itemIndex}].n`
          ).trim(),
          ...(typeof itemObj.q === "string" && itemObj.q.trim()
            ? { q: itemObj.q.trim() }
            : {}),
          ...(typeof itemObj.pantry === "boolean" ? { pantry: itemObj.pantry } : {}),
        };

        return parsed;
      }),
    };
  });
}

async function saveJunkList(
  mealPlan: StoredMealPlan,
  junkList: ListCategory[],
  updatedFrom: string
) {
  const shoppingList = deriveShoppingListFromMeals(
    mealPlan.meals,
    mealPlan.shoppingList,
    junkList,
    mealPlan.householdGoods ?? []
  );

  return updateMealPlanLists(mealPlan.id, {
    shoppingList,
    junkList,
    householdGoods: mealPlan.householdGoods ?? [],
    source: "user_edit",
    generationContext: {
      updatedFrom,
      updatedAt: new Date().toISOString(),
    },
  });
}

export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj = (body && typeof body === "object") ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const category = typeof obj.category === "string" && obj.category.trim()
    ? obj.category.trim()
    : JUNK_CATEGORY_ORDER[0];
  const itemObj = (obj.item && typeof obj.item === "object") ? (obj.item as Record<string, unknown>) : {};
  const itemName = requireString(itemObj.n, "item.n").trim();
  const itemQty = typeof itemObj.q === "string" && itemObj.q.trim() ? itemObj.q.trim() : "1";

  const mealPlan = weekRange ? await getMealPlanByWeekRange(weekRange) : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const junkList = mealPlan.junkList.length > 0
    ? cloneJunkList(mealPlan.junkList)
    : createDefaultJunkList();
  let categoryIndex = junkList.findIndex((group) => group.category === category);
  if (categoryIndex === -1) {
    junkList.push({
      category,
      items: [],
    });
    categoryIndex = junkList.length - 1;
  }

  junkList[categoryIndex].items.push({
    n: itemName,
    q: itemQty,
  });

  const updated = await saveJunkList(mealPlan, junkList, "junk_list_add");

  return { junkList: updated.junkList };
});

// PATCH: Toggle pantry status for a junk item
export const PATCH = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj = (body && typeof body === "object") ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const category = requireString(obj.category, "category");
  const itemName = requireString(obj.itemName, "itemName").trim();
  const pantry = requireBoolean(obj.pantry, "pantry");

  const mealPlan = weekRange ? await getMealPlanByWeekRange(weekRange) : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const junkList = cloneJunkList(mealPlan.junkList);
  const categoryIndex = junkList.findIndex((c) => c.category === category);

  if (categoryIndex === -1) {
    throw new ApiError("Category not found", 404);
  }

  const itemIndex = junkList[categoryIndex].items.findIndex((item) => item.n === itemName);
  if (itemIndex === -1) {
    throw new ApiError("Item not found", 404);
  }

  junkList[categoryIndex].items[itemIndex] = {
    ...junkList[categoryIndex].items[itemIndex],
    pantry,
  };

  const updated = await saveJunkList(mealPlan, junkList, "junk_list_pantry_toggle");

  return { junkList: updated.junkList };
});

export const PUT = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj = (body && typeof body === "object") ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const junkList = parseJunkList(obj.junkList);

  const mealPlan = weekRange ? await getMealPlanByWeekRange(weekRange) : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const updated = await saveJunkList(mealPlan, junkList, "junk_list_update");

  return { junkList: updated.junkList };
});

export const DELETE = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj = (body && typeof body === "object") ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const category = typeof obj.category === "string" ? obj.category : null;
  const itemName = requireString(obj.itemName, "itemName").trim();

  const mealPlan = weekRange ? await getMealPlanByWeekRange(weekRange) : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const junkList = cloneJunkList(mealPlan.junkList);
  const target = findJunkItemIndex(junkList, category, itemName);

  if (target) {
    junkList[target.categoryIndex].items.splice(target.itemIndex, 1);
  }

  const updated = await saveJunkList(mealPlan, junkList, "junk_list_delete");

  return { junkList: updated.junkList };
});
