import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  erGyldigSession,
  erKonfigureret,
  SESSION_COOKIE,
} from "@/lib/auth/session";

/**
 * Porten ind til Harvest.
 *
 * Indtil nu kunne hvem som helst på internettet både læse og skrive
 * madplanen: 14 skriveruter uden en eneste kontrol. Her lukkes den.
 *
 * Reglen er hvidliste, ikke sortliste. Alt kræver en gyldig session,
 * undtagen præcis det der står i ÅBNE_STIER nedenfor -- så en ny rute er
 * lukket den dag den bliver skrevet, uden at nogen skal huske noget.
 *
 * Sider sendes til /login. API-ruter får 401 med JSON, for en fetch der
 * pludselig fik en HTML-loginside tilbage, ville fejle på en måde der er
 * svær at forstå.
 */

const ÅBNE_STIER = new Set([
  "/login",
  "/api/login",
  "/api/logout",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/robots.txt",
]);

function erÅben(pathname: string): boolean {
  if (ÅBNE_STIER.has(pathname)) return true;

  // Ikoner og billeder skal kunne hentes af telefonens hjemmeskærm, før
  // nogen er logget ind -- ellers viser den et tomt ikon.
  if (pathname.startsWith("/icons/")) return true;

  // /api/widget har sit EGET token (WIDGET_TOKEN) og kaldes serverside af
  // Home Assistant, som aldrig har en browsercookie. Den ville aldrig
  // kunne komme igennem her, og dens eget token er den rigtige lås.
  if (pathname === "/api/widget") return true;

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // De gamle omskrivninger. De ligger EFTER låsen i rækkefølge, men
  // beregnes her, fordi svaret skal være det samme som før for en
  // bruger der er logget ind.
  const omskriv = gammelOmskrivning(request);

  if (erÅben(pathname)) return omskriv ?? NextResponse.next();

  // Mangler SESSION_SECRET, er der ingen der kan komme ind. Det er med
  // vilje: en glemt miljøvariabel må ikke tavst slå adgangskoden fra.
  if (!erKonfigureret()) {
    return afvis(request, "Adgangskoden er ikke sat op på serveren.");
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await erGyldigSession(token)) {
    return omskriv ?? NextResponse.next();
  }

  return afvis(request, "Log ind for at se madplanen.");
}

function afvis(request: NextRequest, besked: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: besked },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  // Hvor man var på vej hen, så man lander rigtigt efter login.
  const videre = request.nextUrl.pathname + request.nextUrl.search;
  if (videre !== "/") url.searchParams.set("videre", videre);
  return NextResponse.redirect(url);
}

/** /week, /plan og /junk pegede på den gamle menu. Uændret. */
function gammelOmskrivning(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/week" || pathname === "/plan") {
    const url = request.nextUrl.clone();
    url.pathname = "/menu";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/junk") {
    const url = request.nextUrl.clone();
    url.pathname = "/menu";
    if (!url.searchParams.has("type")) url.searchParams.set("type", "Junk");
    return NextResponse.rewrite(url);
  }

  return null;
}

export const config = {
  /*
   * Alt undtagen Next.js' eget statiske indhold.
   *
   * _next/static og _next/image indeholder ingen af husstandens data --
   * det er JavaScript, CSS og billeder fra Skagenfood. Ville man låse dem
   * også, kunne loginsiden ikke tegne sig selv.
   */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
