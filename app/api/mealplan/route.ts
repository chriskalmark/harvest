import { NextRequest } from "next/server";
import {
  getLatestMealPlan,
  getMealPlanByWeekRange,
  listMealPlanWeeks,
} from "@/lib/services/mealPlanService";
import { organizeShoppingListForStoreLayout } from "@/lib/shoppingListOrder";
import { createRouteHandler } from "@/lib/apiUtils";

export const GET = createRouteHandler(async (request: NextRequest) => {
  const weekRange = request.nextUrl.searchParams.get("weekRange");
  const [mealPlan, weeks] = await Promise.all([
    weekRange ? getMealPlanByWeekRange(weekRange) : getLatestMealPlan(),
    listMealPlanWeeks(),
  ]);

  // Reorganize shopping list to match actual Trader Joe's store walking order
  const organizedMealPlan = mealPlan ? {
    ...mealPlan,
    shoppingList: organizeShoppingListForStoreLayout(mealPlan.shoppingList)
  } : null;

  return { mealPlan: organizedMealPlan, weeks };
});
