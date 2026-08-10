import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";

/**
 * GET /api/hvem — hvem siger Cloudflare Access at du er?
 *
 * Det her er en MÅLING, ikke en funktion. Hele planen om flere husstande
 * hviler på, at Access sender identiteten videre til appen. Det er
 * dokumenteret adfærd, men dokumenteret er præcis hvad der blev sagt om
 * Påmindelser, og det holdt ikke. Så det bliver målt først.
 *
 * Ruten svarer med HVILKE headere der er til stede, ikke deres indhold --
 * bortset fra e-mailen, som er hele pointen. JWT'en rapporteres kun som
 * længde: den er et gyldigt adgangsbevis, og den skal ikke stå i en
 * browserfane eller i en samtale.
 *
 * Når identiteten er bekræftet, bliver ruten til grundlaget for
 * lib/auth/bruger.ts. Indtil da er den et spørgsmål.
 */

/** Headerne Cloudflare Access sætter, når den slipper en forespørgsel igennem. */
const ACCESS_HEADERE = [
  "cf-access-authenticated-user-email",
  "cf-access-jwt-assertion",
  "cf-ray",
  "cf-connecting-ip",
] as const;

export const GET = createRouteHandler(async (request: NextRequest) => {
  const fundne: Record<string, string> = {};

  for (const navn of ACCESS_HEADERE) {
    const værdi = request.headers.get(navn);
    if (værdi === null) {
      fundne[navn] = "MANGLER";
      continue;
    }
    // JWT'en er et adgangsbevis. Længden beviser at den er der; indholdet
    // hører ingen andre steder hjemme.
    fundne[navn] =
      navn === "cf-access-jwt-assertion"
        ? `til stede (${værdi.length} tegn)`
        : værdi;
  }

  const email = request.headers.get("cf-access-authenticated-user-email");
  const jwt = request.headers.get("cf-access-jwt-assertion");

  return {
    headere: fundne,
    kanByggePaaDet: Boolean(email && jwt),
    forklaring: email
      ? jwt
        ? "Access sender både e-mail og et signeret token. Flere husstande kan bygges på det."
        : "E-mailen er der, men ikke tokenet. E-mailen alene kan forfalskes af enhver der rammer serveren udenom Cloudflare -- fx på jeres eget netværk via port 3005."
      : "Access sender ingen identitet. Enten går forespørgslen udenom Cloudflare, eller også er applikationen ikke sat op til at videresende identiteten.",
  };
});
