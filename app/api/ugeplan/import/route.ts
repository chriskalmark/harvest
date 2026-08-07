import { NextRequest } from "next/server";
import { ApiError, createRouteHandler } from "@/lib/apiUtils";
import { formatIsoWeek } from "@/lib/skagenfood/isoWeek";
import { getAutoImportStatus } from "@/lib/services/skagenfoodAutoImportService";
import {
  importSkagenfoodWeekExclusive,
  isSkagenfoodImportRunning,
} from "@/lib/services/skagenfoodCatalogService";
import { readJsonBody, withWeekPlanErrors } from "@/lib/weekPlan/apiSupport";
import { resolveImportWeek } from "@/lib/weekPlan/importSelection";

/**
 * GET /api/ugeplan/import
 *
 * Status for det selvhelbredende tjek der kører hver gang ugeplanen læses:
 * er det slået til, kører en import lige nu, og hvordan gik det seneste
 * forsøg på den kommende uge. Findes så en fejl aldrig er tavs -- den kan
 * altid slås op her, uden terminaladgang.
 *
 * POST /api/ugeplan/import
 *
 *   {}                                       -> næste uge (standarden)
 *   { "uge": "denne" }
 *   { "uge": 34, "aar": 2026 }
 *   { "proev": true }                        -> hent og validér, skriv intet
 *   { "springUfuldstaendigeOver": true }     -> udelad færdigretter uden opskrift
 *
 * Findes så importen kan køres fra produktionen uden terminaladgang.
 * Kørslen kan tage et par minutter: ét kald på 7,5 MB plus omkring 50
 * opskriftskald. Hele ugen hentes og valideres FÆRDIG, før databasen røres --
 * går én ret galt, skrives der ingenting.
 *
 * Spærren mod at to importer kører samtidig er delt med det selvhelbredende
 * tjek -- se importSkagenfoodWeekExclusive i skagenfoodCatalogService.ts.
 */

// Standalone Node-server, så der er ingen platformsgrænse at ramme -- men
// Next skal have besked om at ruten gerne må være længe undervejs.
export const maxDuration = 600;
export const dynamic = "force-dynamic";

export const GET = createRouteHandler(async () => {
  const status = await getAutoImportStatus();
  return { autoImport: status };
});

export const POST = createRouteHandler(async (request: NextRequest) => {
  const expectedToken = process.env.HARVEST_IMPORT_TOKEN;
  if (
    expectedToken &&
    request.headers.get("x-harvest-token") !== expectedToken
  ) {
    throw new ApiError("Importen kræver et gyldigt x-harvest-token.", 401);
  }

  const hasBody = (request.headers.get("content-length") ?? "0") !== "0";
  const body = hasBody ? await readJsonBody(request) : {};

  const target = await withWeekPlanErrors(async () =>
    resolveImportWeek(body.uge ?? body.week, body.aar ?? body.år ?? body.year),
  );

  const dryRun = body.proev === true || body.dryRun === true;
  const allowIncomplete =
    body.springUfuldstaendigeOver === true ||
    body["springUfuldstændigeOver"] === true ||
    body.allowIncomplete === true;

  // Tjekket her giver en pæn 409 i det almindelige tilfælde. Selve
  // spærringen sidder i importSkagenfoodWeekExclusive, så et sjældent
  // kapløb mellem to samtidige kald aldrig kan starte to importer -- det kan
  // højst give en anden fejlbesked.
  if (isSkagenfoodImportRunning()) {
    throw new ApiError(
      "Der kører allerede en import. Vent til den er færdig.",
      409,
    );
  }

  const log: string[] = [];
  const report = await withWeekPlanErrors(() =>
    importSkagenfoodWeekExclusive({
      target,
      dryRun,
      allowIncomplete,
      onProgress: (message) => {
        log.push(message);
      },
    }),
  );

  return {
    import: {
      ...report,
      weekLabel: formatIsoWeek(target),
      log,
    },
  };
});
