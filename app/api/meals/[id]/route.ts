import type { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { ApiError } from "@/lib/apiUtils";
import { updateMealById, updateMealServings } from "@/lib/services/mealService";
import { requireNumber } from "@/lib/routeValidation";

function parseMealId(request: NextRequest): number {
  const id = request.nextUrl.pathname.split("/").filter(Boolean).pop();
  const mealId = Number(id);
  if (!Number.isFinite(mealId)) {
    throw new ApiError("Invalid meal ID", 400);
  }
  return mealId;
}

export const PUT = createRouteHandler(async (request: NextRequest) => {
  const mealId = parseMealId(request);
  const body = (await request.json()) as unknown;
  await updateMealById(mealId, body);
  return { success: true };
});

// Partial update — currently only used to persist a servings change from the
// stepper on /meal/[id] without requiring the full recipe payload PUT needs.
export const PATCH = createRouteHandler(async (request: NextRequest) => {
  const mealId = parseMealId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const servings = requireNumber(body.servings, "servings");
  await updateMealServings(mealId, servings);
  return { success: true };
});
