import { NextRequest } from "next/server";
import {
  getLatestMealPlan,
  getMealPlanByWeekRange,
  updateMealPlanLists,
} from "@/lib/services/mealPlanService";
import { ApiError, createRouteHandler } from "@/lib/apiUtils";
import { requireString } from "@/lib/routeValidation";
import {
  resolveStoreZone,
  organizeShoppingListForStoreLayout,
} from "@/lib/shoppingListOrder";
import type { ListCategory, StoredMealPlan } from "@/lib/types";

async function saveShoppingList(
  mealPlan: StoredMealPlan,
  shoppingList: ListCategory[],
  updatedFrom: string,
  options?: { preserveItemOrder?: boolean },
) {
  const organizedShoppingList = options?.preserveItemOrder
    ? shoppingList
    : organizeShoppingListForStoreLayout(shoppingList);

  return updateMealPlanLists(mealPlan.id, {
    shoppingList: organizedShoppingList,
    junkList: mealPlan.junkList,
    householdGoods: mealPlan.householdGoods ?? [],
    source: "user_edit",
    generationContext: {
      updatedFrom,
      updatedAt: new Date().toISOString(),
    },
  });
}

function findShoppingItemIndex(
  shoppingList: ListCategory[],
  category: string,
  itemName: string,
): { categoryIndex: number; itemIndex: number } | null {
  const categoryIndex = shoppingList.findIndex((c) => c.category === category);
  if (categoryIndex !== -1) {
    const itemIndex = shoppingList[categoryIndex].items.findIndex(
      (item) => item.n === itemName,
    );
    if (itemIndex !== -1) {
      return { categoryIndex, itemIndex };
    }
  }

  for (const [fallbackCategoryIndex, categoryGroup] of shoppingList.entries()) {
    const itemIndex = categoryGroup.items.findIndex(
      (item) => item.n === itemName,
    );
    if (itemIndex !== -1) {
      return { categoryIndex: fallbackCategoryIndex, itemIndex };
    }
  }

  return null;
}

export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const category = requireString(obj.category, "category");
  const itemObj =
    obj.item && typeof obj.item === "object"
      ? (obj.item as Record<string, unknown>)
      : {};
  const itemName = requireString(itemObj.n, "item.n");
  const itemQty =
    typeof itemObj.q === "string" && itemObj.q.trim()
      ? itemObj.q.trim()
      : undefined;

  const mealPlan = weekRange
    ? await getMealPlanByWeekRange(weekRange)
    : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  // Find or create the persisted store-zone category for the item.
  // `category` is the zone the caller asked to place this item under.
  const shoppingList = [...mealPlan.shoppingList];
  const itemStoreZone = resolveStoreZone(category);
  let categoryIndex = shoppingList.findIndex(
    (c) => c.category === itemStoreZone,
  );
  if (categoryIndex === -1) {
    categoryIndex = shoppingList.findIndex((c) => c.category === category);
  }

  if (categoryIndex === -1) {
    shoppingList.push({
      category: itemStoreZone,
      items: [],
    });
    categoryIndex = shoppingList.length - 1;
  }

  // Add item
  shoppingList[categoryIndex].items.push({
    n: itemName,
    ...(itemQty ? { q: itemQty } : {}),
  });

  const updated = await saveShoppingList(
    mealPlan,
    shoppingList,
    "shopping_list_add",
  );

  return { shoppingList: updated.shoppingList };
});

export const PUT = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const shoppingListRaw = obj.shoppingList;
  if (!Array.isArray(shoppingListRaw)) {
    throw new ApiError("shoppingList must be an array", 400);
  }
  const shoppingList = shoppingListRaw as ListCategory[];

  const mealPlan = weekRange
    ? await getMealPlanByWeekRange(weekRange)
    : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const updated = await saveShoppingList(
    mealPlan,
    shoppingList,
    "shopping_list_update",
  );

  return { shoppingList: updated.shoppingList };
});

export const DELETE = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;

  // { all: true } toemmer hele listen. Bemaerk at varer, der stammer fra
  // ugens retter, kommer igen naeste gang listen udledes — kun haandtilfoejede
  // varer forsvinder permanent. Knappen i brugerfladen siger det samme.
  const clearAll = obj.all === true;

  const mealPlan = weekRange
    ? await getMealPlanByWeekRange(weekRange)
    : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  if (clearAll) {
    const cleared = await saveShoppingList(mealPlan, [], "shopping_list_clear");
    return { shoppingList: cleared.shoppingList };
  }

  const category = requireString(obj.category, "category");
  const itemName = requireString(obj.itemName, "itemName");

  const shoppingList = [...mealPlan.shoppingList];
  const target = findShoppingItemIndex(shoppingList, category, itemName);

  if (target) {
    shoppingList[target.categoryIndex].items = shoppingList[
      target.categoryIndex
    ].items.filter((item) => item.n !== itemName);

    // Remove empty categories
    if (shoppingList[target.categoryIndex].items.length === 0) {
      shoppingList.splice(target.categoryIndex, 1);
    }
  }

  const updated = await saveShoppingList(
    mealPlan,
    shoppingList,
    "shopping_list_delete",
  );

  return { shoppingList: updated.shoppingList };
});

// PATCH: Toggle pantry and/or checked status for an item
export const PATCH = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekRange = typeof obj.weekRange === "string" ? obj.weekRange : null;
  const category = requireString(obj.category, "category");
  const itemName = requireString(obj.itemName, "itemName");
  const pantry = typeof obj.pantry === "boolean" ? obj.pantry : undefined;
  const checked = typeof obj.checked === "boolean" ? obj.checked : undefined;
  if (pantry === undefined && checked === undefined) {
    throw new ApiError("pantry or checked is required", 400);
  }

  const mealPlan = weekRange
    ? await getMealPlanByWeekRange(weekRange)
    : await getLatestMealPlan();
  if (!mealPlan) {
    throw new ApiError("Meal plan not found", 404);
  }

  const shoppingList = [...mealPlan.shoppingList];
  const target = findShoppingItemIndex(shoppingList, category, itemName);

  if (!target) {
    throw new ApiError("Item not found", 404);
  }

  // Update pantry and/or checked status
  shoppingList[target.categoryIndex].items[target.itemIndex] = {
    ...shoppingList[target.categoryIndex].items[target.itemIndex],
    ...(pantry !== undefined ? { pantry } : {}),
    ...(checked !== undefined ? { checked } : {}),
  };

  const updated = await saveShoppingList(
    mealPlan,
    shoppingList,
    checked !== undefined
      ? "shopping_list_checked_toggle"
      : "shopping_list_pantry_toggle",
    { preserveItemOrder: true },
  );

  return { shoppingList: updated.shoppingList };
});
