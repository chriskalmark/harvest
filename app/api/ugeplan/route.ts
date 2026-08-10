import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { scheduleAutoImportCheck } from "@/lib/services/skagenfoodAutoImportService";
import { getWeekPlan } from "@/lib/services/weekPlanService";
import {
  husstandFraRequest,
  weekFromQuery,
  withWeekPlanErrors,
} from "@/lib/weekPlan/apiSupport";

/**
 * GET /api/ugeplan            -> indeværende uge
 * GET /api/ugeplan?uge=næste  -> næste uge
 * GET /api/ugeplan?uge=2026-08-10
 *
 * Svarer altid med syv dagspladser, også for en uge der aldrig er planlagt.
 * Kaldet skriver ingenting i databasen -- bortset fra det selvhelbredende
 * tjek nedenfor, som kun skriver til Skagenfood-kataloget, aldrig til ugen
 * der laeses.
 */
export const GET = createRouteHandler(async (request: NextRequest) => {
  // Selvhelbredende: er den KOMMENDE uges opskrifter der mangler i kataloget,
  // startes en hentning i baggrunden. Kaldet her venter ikke paa den --
  // scheduleAutoImportCheck returnerer med det samme, saa denne laesning
  // aldrig staar og venter paa Skagenfood. Se
  // lib/services/skagenfoodAutoImportService.ts for spaerre, afkoeling og
  // hvordan en fejl bliver synlig.
  scheduleAutoImportCheck();

  // Husstanden foerst, og fra det signerede token -- aldrig fra adressen.
  const husstand = await withWeekPlanErrors(() => husstandFraRequest(request));

  const weekPlan = await withWeekPlanErrors(() =>
    getWeekPlan({ husstand, week: weekFromQuery(request) }),
  );
  return { weekPlan };
});
