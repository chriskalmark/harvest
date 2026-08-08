import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * POST /api/logout
 *
 * Sletter cookien. Der findes ingen sessionstabel at rydde op i -- beviset
 * ER cookien, så når den er væk, er adgangen væk.
 *
 * Bemærk: en cookie der allerede er kopieret, gælder til den udløber. Skal
 * ALLE sessioner ryge (fx hvis en telefon bliver væk), skiftes
 * SESSION_SECRET på serveren. Så er hver eneste signatur ugyldig med det
 * samme.
 */
export async function POST() {
  const svar = NextResponse.json(
    { data: { ok: true } },
    { headers: { "Cache-Control": "no-store" } },
  );

  svar.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return svar;
}
