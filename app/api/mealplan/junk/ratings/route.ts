import { NextRequest } from "next/server";
import { saveJunkHeart } from "@/lib/services/mealPlanService";
import { createRouteHandler } from "@/lib/apiUtils";
import { requireBoolean, requireNumber, requireString } from "@/lib/routeValidation";

type SaveJunkHeartInput = {
  mealPlanId: number;
  itemName: string;
  liked: boolean;
};

export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as Partial<SaveJunkHeartInput>;

  const mealPlanId = requireNumber(body.mealPlanId, "mealPlanId");
  const itemName = requireString(body.itemName, "itemName");
  const liked = requireBoolean(body.liked, "liked");

  const feedback = await saveJunkHeart({ mealPlanId, itemName, liked });
  return { feedback };
});

