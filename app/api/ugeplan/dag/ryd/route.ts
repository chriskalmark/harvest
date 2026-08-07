import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { clearDay } from "@/lib/services/weekPlanService";
import {
  readJsonBody,
  weekFromBody,
  weekdayFromBody,
  withWeekPlanErrors,
} from "@/lib/weekPlan/apiSupport";

/**
 * POST /api/ugeplan/dag/ryd
 *
 *   { "uge": "denne", "dag": 5 }
 *
 * Tømmer dagen. Pladsen bliver stående som tom -- ugen har altid syv dage.
 * Dagens portionsantal står også, for det hører til dagen, ikke til retten.
 */
export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const weekPlan = await withWeekPlanErrors(() =>
    clearDay({
      week: weekFromBody(body),
      weekday: weekdayFromBody(body),
    }),
  );
  return { weekPlan };
});
