import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { getPickerCatalog } from "@/lib/services/recipePickerService";
import { weekFromQuery, withWeekPlanErrors } from "@/lib/weekPlan/apiSupport";

/**
 * GET /api/katalog/opskrifter                      -> denne uges retter
 * GET /api/katalog/opskrifter?uge=næste
 * GET /api/katalog/opskrifter?uge=2026-08-10
 * GET /api/katalog/opskrifter?omfang=alle          -> hele kataloget
 *
 * Svarer med hele ugen på én gang -- ~50 opskriftskort, ikke en side ad
 * gangen. Vælgeren filtrerer og søger lokalt, så et tastetryk aldrig koster
 * en netværkstur. Kaldet skriver ingenting.
 */
export const GET = createRouteHandler(async (request: NextRequest) => {
  const katalog = await withWeekPlanErrors(() =>
    getPickerCatalog({
      week: weekFromQuery(request),
      scope:
        request.nextUrl.searchParams.get("omfang") ??
        request.nextUrl.searchParams.get("scope") ??
        undefined,
    }),
  );
  return { katalog };
});
