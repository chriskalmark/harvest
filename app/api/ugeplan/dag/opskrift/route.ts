import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { setRecipeOnDay } from "@/lib/services/weekPlanService";
import {
  noteFromBody,
  portionsFromBody,
  readJsonBody,
  weekFromBody,
  weekdayFromBody,
  withWeekPlanErrors,
} from "@/lib/weekPlan/apiSupport";

/**
 * PUT /api/ugeplan/dag/opskrift
 *
 *   { "uge": "næste", "dag": 3, "opskriftId": 13457 }
 *
 * Lægger en opskrift fra Skagenfood-kataloget på dagen. Findes opskriften
 * ikke i kataloget, svarer ruten 400 -- der lægges aldrig et id ud, som ingen
 * opskrift svarer til.
 *
 * "portioner" er valgfrit. Udelades det, står dagens portionsantal som det er.
 */
export const PUT = createRouteHandler(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const weekPlan = await withWeekPlanErrors(() =>
    setRecipeOnDay({
      week: weekFromBody(body),
      weekday: weekdayFromBody(body),
      recipeId: body.opskriftId ?? body.recipeId,
      note: noteFromBody(body),
      portions: portionsFromBody(body),
    }),
  );
  return { weekPlan };
});
