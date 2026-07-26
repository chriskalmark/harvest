import { NextRequest } from "next/server";
import { mutateMealPlanComposition } from "@/lib/services/mealPlanService";
import { ApiError, createRouteHandler } from "@/lib/apiUtils";
import { parseMealType, requireNumber, requireString } from "@/lib/routeValidation";
import type { MealPlanCompositionAction, MealType } from "@/lib/types";

function parseAction(value: unknown): MealPlanCompositionAction {
  if (value === "swap" || value === "remove" || value === "add") {
    return value;
  }
  throw new ApiError("action must be swap, remove, or add.", 400);
}

export const PATCH = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as Record<string, unknown>;
  const weekRange = requireString(body.weekRange, "weekRange");
  const action = parseAction(body.action);

  const slotOrder =
    body.slotOrder === undefined
      ? undefined
      : requireNumber(body.slotOrder, "slotOrder");

  const mealId =
    body.mealId === undefined ? undefined : requireNumber(body.mealId, "mealId");

  const type =
    body.type === undefined
      ? undefined
      : (parseMealType(String(body.type)) ??
        (() => {
          throw new ApiError("type must be Breakfast, Lunch, Dinner, or Snack.", 400);
        })());

  try {
    const mealPlan = await mutateMealPlanComposition({
      weekRange,
      action,
      slotOrder,
      mealId,
      type: type as MealType | undefined,
    });
    return { mealPlan };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update menu.";
    throw new ApiError(message, 400);
  }
});
