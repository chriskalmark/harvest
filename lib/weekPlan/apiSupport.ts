import { NextRequest } from "next/server";
import { ApiError } from "@/lib/apiUtils";
import { WeekPlanError } from "@/lib/weekPlan/week";
import { SkagenfoodImportError } from "@/lib/skagenfood/normalize";
import { emailFraRequest, IngenBrugerError } from "@/lib/auth/bruger";
import { sikrHusstand } from "@/lib/db/brugerRepository";
import { withTransaction } from "@/lib/db";

/**
 * Fælles hjælp til ugeplanens API-ruter.
 *
 * Alle beskeder ud af disse ruter er på dansk, fordi de bliver vist som de er.
 */

/** Læser JSON-kroppen. En tom eller ulæselig krop er en 400, ikke en 500. */
export async function readJsonBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("Kaldet skal have en JSON-krop.", 400);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError("JSON-kroppen skal være et objekt.", 400);
  }
  return raw as Record<string, unknown>;
}

/**
 * Fejl fra domænet er brugerens skyld og skal vises som 400 med den danske
 * besked. Alt andet får lov at boble op som 500 -- vi må ikke skjule en
 * databasefejl bag en pæn tekst.
 */
export async function withWeekPlanErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof IngenBrugerError) {
      // 401 og ikke 400: det er ikke kaldet der er forkert, det er
      // identiteten der mangler. Skaermen kan bede om et genindlaes.
      throw new ApiError(error.message, 401);
    }
    if (error instanceof WeekPlanError) {
      throw new ApiError(error.message, 400);
    }
    if (error instanceof SkagenfoodImportError) {
      throw new ApiError(error.message, 502);
    }
    throw error;
  }
}

/** Ugen kan vælges med ?uge=, ?week= eller ?mandag=. */
export function weekFromQuery(request: NextRequest): string | undefined {
  const params = request.nextUrl.searchParams;
  return (
    params.get("uge") ?? params.get("week") ?? params.get("mandag") ?? undefined
  );
}

/** Kroppens ugefelt, uanset om kaldet skriver dansk eller engelsk. */
export function weekFromBody(body: Record<string, unknown>): unknown {
  return body.uge ?? body.week ?? body.mandag ?? undefined;
}

/** Dagen kan hedde dag eller weekday. 1 = mandag ... 7 = søndag. */
export function weekdayFromBody(body: Record<string, unknown>): unknown {
  return body.dag ?? body.weekday ?? undefined;
}

export function portionsFromBody(body: Record<string, unknown>): unknown {
  return body.portioner ?? body.portions ?? undefined;
}

export function noteFromBody(body: Record<string, unknown>): unknown {
  return body.note ?? body.noter ?? undefined;
}

/**
 * Husstanden for den der spørger.
 *
 * Identiteten kommer fra Cloudflare Access' SIGNEREDE token -- ikke fra
 * e-mail-headeren, og ALDRIG fra forespørgslens krop eller adresse. Kunne
 * man skrive husstanden selv, kunne man skrive naboens og kigge med.
 *
 * Kender vi ikke e-mailen i forvejen, får den sin egen husstand. Det er
 * det der gør, at en inviteret familie bare kan logge ind og gå i gang --
 * de får en tom uge, ikke en fejl.
 */
export async function husstandFraRequest(request: NextRequest): Promise<string> {
  const email = await emailFraRequest(request);
  if (!email) throw new IngenBrugerError();

  return withTransaction((client) => sikrHusstand(client, email));
}
