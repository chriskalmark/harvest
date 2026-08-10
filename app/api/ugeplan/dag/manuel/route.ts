import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { setManualDishOnDay } from "@/lib/services/weekPlanService";
import {
  husstandFraRequest,
  noteFromBody,
  portionsFromBody,
  readJsonBody,
  weekFromBody,
  weekdayFromBody,
  withWeekPlanErrors,
} from "@/lib/weekPlan/apiSupport";

/**
 * PUT /api/ugeplan/dag/manuel
 *
 *   { "uge": "2026-08-10", "dag": 2, "navn": "Lasagne" }
 *
 * Sætter en ret man selv har skrevet. Kun et navn er nødvendigt --
 * "Lasagne" er en gyldig aftensmad.
 */
export const PUT = createRouteHandler(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const husstand = await withWeekPlanErrors(() => husstandFraRequest(request));
  const weekPlan = await withWeekPlanErrors(() =>
    setManualDishOnDay({
      husstand,
      week: weekFromBody(body),
      weekday: weekdayFromBody(body),
      title: body.navn ?? body.titel ?? body.title,
      note: noteFromBody(body),
      portions: portionsFromBody(body),
    }),
  );
  return { weekPlan };
});
