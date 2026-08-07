import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { setPortionsOnDay } from "@/lib/services/weekPlanService";
import {
  portionsFromBody,
  readJsonBody,
  weekFromBody,
  weekdayFromBody,
  withWeekPlanErrors,
} from "@/lib/weekPlan/apiSupport";

/**
 * PUT /api/ugeplan/dag/portioner
 *
 *   { "uge": "denne", "dag": 6, "portioner": 4 }
 *
 * Skifter portionsantallet for den ene dag. Standarden er 2, og den ændres
 * ikke af at retten skiftes ud -- portionsantallet hører til dagen.
 */
export const PUT = createRouteHandler(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const weekPlan = await withWeekPlanErrors(() =>
    setPortionsOnDay({
      week: weekFromBody(body),
      weekday: weekdayFromBody(body),
      portions: portionsFromBody(body),
    }),
  );
  return { weekPlan };
});
