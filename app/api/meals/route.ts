import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { createMeal, listMeals, MealSortDirection, MealSortField } from "@/lib/services/mealService";
import { parseMealSortDirection, parseMealSortField, parseMealType, parseOptionalBoundedInt } from "@/lib/routeValidation";

export const GET = createRouteHandler(async (request: NextRequest) => {
  const type = parseMealType(request.nextUrl.searchParams.get("type"));
  const minProteinRaw = request.nextUrl.searchParams.get("minProtein");
  const searchRaw = request.nextUrl.searchParams.get("search");

  const sortBy: MealSortField =
    parseMealSortField(request.nextUrl.searchParams.get("sortBy")) ?? "lastServedAt";
  const sortDirection: MealSortDirection =
    parseMealSortDirection(request.nextUrl.searchParams.get("sortDirection")) ?? "desc";

  const limit = parseOptionalBoundedInt(request.nextUrl.searchParams.get("limit"), { min: 1, max: 100 }) ?? 50;
  const offset = parseOptionalBoundedInt(request.nextUrl.searchParams.get("offset"), { min: 0, max: Number.MAX_SAFE_INTEGER }) ?? 0;

  const minProtein = minProteinRaw ? Number(minProteinRaw) : undefined;

  const result = await listMeals(
    {
      type,
      minProtein: Number.isFinite(minProtein) ? minProtein : undefined,
      search: searchRaw?.trim() ? searchRaw.trim() : undefined,
    },
    sortBy,
    sortDirection,
    limit,
    offset
  );

  return result;
});

export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = (await request.json()) as unknown;
  const result = await createMeal(body);
  return { success: true, mealId: result.mealId };
});