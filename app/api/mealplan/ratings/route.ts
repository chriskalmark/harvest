import { NextRequest } from "next/server";
import { saveMealHeart } from "@/lib/services/mealPlanService";
import { SaveMealHeartInput } from "@/lib/types";
import { createRouteHandler } from "@/lib/apiUtils";
import { requireBoolean, requireNumber } from "@/lib/routeValidation";

export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as Partial<SaveMealHeartInput>;

  const mealPlanId = requireNumber(body.mealPlanId, "mealPlanId");
  const mealId = requireNumber(body.mealId, "mealId");
  const liked = requireBoolean(body.liked, "liked");

  const feedback = await saveMealHeart({ mealPlanId, mealId, liked });
  return { feedback };
});
