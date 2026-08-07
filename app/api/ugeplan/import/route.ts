import { NextRequest } from "next/server";
import { ApiError, createRouteHandler } from "@/lib/apiUtils";
import { formatIsoWeek } from "@/lib/skagenfood/isoWeek";
import { importSkagenfoodWeek } from "@/lib/services/skagenfoodCatalogService";
import { readJsonBody, withWeekPlanErrors } from "@/lib/weekPlan/apiSupport";
import { resolveImportWeek } from "@/lib/weekPlan/importSelection";

/**
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
 */

// Standalone Node-server, så der er ingen platformsgrænse at ramme -- men
// Next skal have besked om at ruten gerne må være længe undervejs.
export const maxDuration = 600;
export const dynamic = "force-dynamic";

/**
 * Én import ad gangen. To samtidige kørsler ville hente de samme 7,5 MB og
 * skrive oven i hinanden uden at nogen bliver klogere.
 */
let running: Promise<unknown> | null = null;

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

  if (running) {
    throw new ApiError(
      "Der kører allerede en import. Vent til den er færdig.",
      409,
    );
  }

  const log: string[] = [];
  const work = withWeekPlanErrors(() =>
    importSkagenfoodWeek({
      target,
      dryRun,
      allowIncomplete,
      onProgress: (message) => {
        log.push(message);
      },
    }),
  );
  running = work;

  try {
    const report = await work;
    return {
      import: {
        ...report,
        weekLabel: formatIsoWeek(target),
        log,
      },
    };
  } finally {
    running = null;
  }
});
