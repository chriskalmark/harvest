import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import {
  clearChecks,
  getShoppingList,
  setChecked,
} from "@/lib/services/weekPlanShoppingService";
import {
  husstandFraRequest,
  readJsonBody,
  weekFromBody,
  weekFromQuery,
  withWeekPlanErrors,
} from "@/lib/weekPlan/apiSupport";

/**
 * GET  /api/ugeplan/indkoeb?uge=2026-08-10   -> ugens indkøbsliste
 * POST /api/ugeplan/indkoeb                  -> kryds af, eller start forfra
 *
 *   { "uge": "denne", "varer": ["små kartofler::g"], "afkrydset": true }
 *   { "uge": "denne", "nulstil": true }
 *
 * Der findes med vilje ingen rute til at tilføje eller slette en vare.
 * Listen ER ugeplanen, regnet ud på ny hver gang. Vil man af med en vare,
 * fjerner man retten der kræver den -- så kan listen aldrig komme til at
 * vise noget, ugen ikke længere indeholder.
 *
 * Begge svar rummer HELE listen, så skærmen aldrig skal gætte på hvordan
 * den ser ud efter et tryk.
 */

export const GET = createRouteHandler(async (request: NextRequest) => {
  const husstand = await withWeekPlanErrors(() => husstandFraRequest(request));

  const indkøb = await withWeekPlanErrors(() =>
    getShoppingList({ husstand, week: weekFromQuery(request) }),
  );
  return { indkøb };
});

export const POST = createRouteHandler(async (request: NextRequest) => {
  const body = await readJsonBody(request);
  const uge = weekFromBody(body);
  const husstand = await withWeekPlanErrors(() => husstandFraRequest(request));

  if (body.nulstil === true) {
    const indkøb = await withWeekPlanErrors(() =>
      clearChecks({ husstand, week: uge }),
    );
    return { indkøb };
  }

  const indkøb = await withWeekPlanErrors(() =>
    setChecked({
      husstand,
      week: uge,
      itemKeys: body.varer ?? body.itemKeys,
      checked: body.afkrydset ?? body.checked,
    }),
  );
  return { indkøb };
});
