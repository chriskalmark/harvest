import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { getWeekPlan } from "@/lib/services/weekPlanService";
import { weekFromQuery, withWeekPlanErrors } from "@/lib/weekPlan/apiSupport";

/**
 * GET /api/ugeplan            -> indeværende uge
 * GET /api/ugeplan?uge=næste  -> næste uge
 * GET /api/ugeplan?uge=2026-08-10
 *
 * Svarer altid med syv dagspladser, også for en uge der aldrig er planlagt.
 * Kaldet skriver ingenting i databasen.
 */
export const GET = createRouteHandler(async (request: NextRequest) => {
  const weekPlan = await withWeekPlanErrors(() =>
    getWeekPlan({ week: weekFromQuery(request) }),
  );
  return { weekPlan };
});
