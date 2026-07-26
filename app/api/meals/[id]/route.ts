import type { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { ApiError } from "@/lib/apiUtils";
import { updateMealById } from "@/lib/services/mealService";

export const PUT = createRouteHandler(async (request: NextRequest) => {
  const id = request.nextUrl.pathname.split("/").filter(Boolean).pop();
  const mealId = Number(id);
  if (!Number.isFinite(mealId)) {
    throw new ApiError("Invalid meal ID", 400);
  }

  const body = (await request.json()) as unknown;
  await updateMealById(mealId, body);
  return { success: true };
});