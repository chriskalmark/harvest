import { NextRequest, NextResponse } from "next/server";
import { aftrykFindes, passerKodeord } from "@/lib/auth/kodeord";
import {
  erKonfigureret,
  lavSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

/**
 * POST /api/login   { "kodeord": "..." }
 *
 * Det eneste sted husstandens kode bliver læst. Går den igennem, sættes en
 * signeret cookie der holder 90 dage -- man skal ikke logge ind, fordi man
 * står i Netto med en indkøbskurv.
 *
 * Tre ting er med vilje:
 *
 *   1. Svaret siger aldrig HVORFOR det gik galt. "Forkert kode" og "der er
 *      ingen kode sat op" ser ens ud udefra.
 *   2. Der ventes lige længe uanset udfald, så svartiden ikke røber noget.
 *   3. Efter for mange forsøg fra samme adresse lukkes der i et stykke tid.
 */

export const runtime = "nodejs";

/** Forsøg per IP. Nulstilles ved genstart -- det er en bremse, ikke en lås. */
const forsøg = new Map<string, { antal: number; førsteMs: number }>();
const VINDUE_MS = 15 * 60 * 1000;
const MAKS_FORSØG = 10;

function klientAdresse(request: NextRequest): string {
  const videresendt = request.headers.get("x-forwarded-for");
  if (videresendt) return videresendt.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "ukendt";
}

function forBlødt(adresse: string, nu: number): boolean {
  const post = forsøg.get(adresse);
  if (!post) return false;
  if (nu - post.førsteMs > VINDUE_MS) {
    forsøg.delete(adresse);
    return false;
  }
  return post.antal >= MAKS_FORSØG;
}

function tælForsøg(adresse: string, nu: number) {
  const post = forsøg.get(adresse);
  if (!post || nu - post.førsteMs > VINDUE_MS) {
    forsøg.set(adresse, { antal: 1, førsteMs: nu });
    return;
  }
  post.antal += 1;
}

function nej(besked = "Forkert kode.", status = 401) {
  return NextResponse.json(
    { error: besked },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const adresse = klientAdresse(request);
  const nu = Date.now();

  if (forBlødt(adresse, nu)) {
    return nej("For mange forsøg. Prøv igen om et kvarter.", 429);
  }

  let kodeord = "";
  try {
    const body = (await request.json()) as { kodeord?: unknown };
    if (typeof body.kodeord === "string") kodeord = body.kodeord;
  } catch {
    // Uparseligt indhold er bare et forkert forsøg.
  }

  if (!erKonfigureret() || !aftrykFindes()) {
    tælForsøg(adresse, nu);
    return nej();
  }

  const passer = await passerKodeord(
    kodeord,
    process.env.HOUSEHOLD_PASSWORD_HASH,
  );

  if (!passer) {
    tælForsøg(adresse, nu);
    return nej();
  }

  const token = await lavSessionToken(nu);
  if (!token) return nej();

  forsøg.delete(adresse);

  const svar = NextResponse.json(
    { data: { ok: true } },
    { headers: { "Cache-Control": "no-store" } },
  );

  svar.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // JavaScript på siden må aldrig kunne læse den. Sikker forbindelse
    // kræves, saa den ikke kan snappes paa et cafenetvaerk.
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return svar;
}
