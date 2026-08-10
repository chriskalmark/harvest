/**
 * Husstande.
 *
 * To ting bevises her, og den anden er den vigtige:
 *
 *   1. Et Access-token kan ikke forfalskes -- hverken ved at pille ved
 *      signaturen, skifte algoritme til "none", eller sende et token
 *      udstedt til en anden applikation.
 *   2. Husstanden kan ikke komme fra forespørgslens indhold. Kunne den det,
 *      kunne man skrive naboens navn og læse deres madplan.
 */

import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { emailFraToken } from "../lib/auth/bruger";
import { husstandsnavnFor } from "../lib/db/brugerRepository";

const AUD = "test-audience-tag";
const TEAM = "proeve.cloudflareaccess.com";
process.env.CF_ACCESS_AUD = AUD;
process.env.CF_ACCESS_TEAM_DOMAIN = TEAM;

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
const KID = "proevenoegle";

// Vi lader ikke testen ringe til Cloudflare. I stedet svarer vi som
// Cloudflare ville, med vores egen nøgle.
const rigtigFetch = globalThis.fetch;
let antalHentninger = 0;
globalThis.fetch = (async (url: string) => {
  if (String(url).includes("/cdn-cgi/access/certs")) {
    antalHentninger += 1;
    return new Response(
      JSON.stringify({
        keys: [{ kid: KID, kty: "RSA", alg: "RS256", ...jwk }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return rigtigFetch(url as never);
}) as typeof fetch;

function base64url(data: Buffer | string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const NU = 1_770_000_000_000;

function lavToken(
  krav: Record<string, unknown>,
  hoved: Record<string, unknown> = {},
  ægte = true,
): string {
  const h = base64url(
    JSON.stringify({ alg: "RS256", kid: KID, typ: "JWT", ...hoved }),
  );
  const k = base64url(
    JSON.stringify({
      aud: AUD,
      iss: `https://${TEAM}`,
      exp: Math.floor(NU / 1000) + 3600,
      email: "chris@lmar.io",
      ...krav,
    }),
  );
  if (!ægte) return `${h}.${k}.${base64url("noget-vroevl")}`;
  const sign = createSign("RSA-SHA256");
  sign.update(`${h}.${k}`);
  sign.end();
  return `${h}.${k}.${base64url(sign.sign(privateKey))}`;
}

async function main() {
  /* --- Et ægte token giver e-mailen ---------------------------------- */

  assert.equal(
    await emailFraToken(lavToken({}), NU),
    "chris@lmar.io",
    "Et gyldigt token skal give e-mailen",
  );

  assert.equal(
    await emailFraToken(lavToken({ email: "CHRIS@Lmar.IO" }), NU),
    "chris@lmar.io",
    "E-mailen skal ned i små bogstaver -- ellers bliver det to husstande",
  );

  /* --- Forfalskning ---------------------------------------------------- */

  assert.equal(
    await emailFraToken(lavToken({}, {}, false), NU),
    null,
    "Forkert signatur skal afvises",
  );

  assert.equal(
    await emailFraToken(lavToken({}, { alg: "none" }), NU),
    null,
    'alg:"none" er det klassiske JWT-hul og skal afvises',
  );

  assert.equal(
    await emailFraToken(lavToken({}, { alg: "HS256" }), NU),
    null,
    "Kun RS256 -- ellers kan den offentlige nøgle bruges som HMAC-nøgle",
  );

  assert.equal(
    await emailFraToken(lavToken({ aud: "en-anden-app" }), NU),
    null,
    "Et token til en ANDEN Access-applikation må ikke gælde her",
  );

  assert.equal(
    await emailFraToken(lavToken({ iss: "https://ondskab.example" }), NU),
    null,
    "Forkert udsteder skal afvises",
  );

  assert.equal(
    await emailFraToken(lavToken({ exp: Math.floor(NU / 1000) - 10 }), NU),
    null,
    "Et udløbet token skal afvises",
  );

  assert.equal(
    await emailFraToken(lavToken({ email: undefined }), NU),
    null,
    "Uden e-mail er der ingen identitet",
  );

  assert.equal(
    await emailFraToken(lavToken({ email: "ikke-en-email" }), NU),
    null,
    "Noget der ikke ligner en e-mail er ikke en identitet",
  );

  /* --- Ingenting er heller ikke en identitet -------------------------- */

  for (const intet of [null, undefined, "", "a.b", "a.b.c.d", "vrøvl"]) {
    assert.equal(
      await emailFraToken(intet, NU),
      null,
      `"${intet}" må ikke give en identitet`,
    );
  }

  /* --- Nøglerne hentes én gang, ikke ved hver forespørgsel ------------- */

  const før = antalHentninger;
  await emailFraToken(lavToken({}), NU);
  await emailFraToken(lavToken({}), NU);
  await emailFraToken(lavToken({}), NU);
  assert.equal(
    antalHentninger,
    før,
    "Nøglerne skal komme fra cachen, ikke fra Cloudflare hver gang",
  );

  /* --- Husstandsnavne -------------------------------------------------- */

  assert.equal(husstandsnavnFor("anna@a.dk"), "anna-a-dk");
  assert.equal(
    husstandsnavnFor("anna@b.dk"),
    "anna-b-dk",
    "Samme fornavn hos to udbydere må ikke give samme husstand",
  );
  assert.notEqual(husstandsnavnFor("anna@a.dk"), husstandsnavnFor("anna@b.dk"));
  assert.equal(
    husstandsnavnFor("Søren.Ø@æøå.dk"),
    "søren-ø-æøå-dk",
    "Danske tegn skal overleve",
  );
  assert.equal(husstandsnavnFor("@@@"), "husstand", "Aldrig et tomt navn");

  /* --- Husstanden må ikke kunne skrives af kaldet ---------------------- */

  const ruter = [
    "app/api/ugeplan/route.ts",
    "app/api/ugeplan/indkoeb/route.ts",
    "app/api/ugeplan/dag/manuel/route.ts",
    "app/api/ugeplan/dag/opskrift/route.ts",
    "app/api/ugeplan/dag/portioner/route.ts",
    "app/api/ugeplan/dag/ryd/route.ts",
  ];

  const { readFileSync } = await import("node:fs");
  for (const rute of ruter) {
    const kilde = readFileSync(rute, "utf8");

    assert.ok(
      kilde.includes("husstandFraRequest(request)"),
      `${rute} skal hente husstanden fra det verificerede token`,
    );
    assert.ok(
      !/husstand:\s*body\./.test(kilde),
      `${rute} må ALDRIG tage husstanden fra forespørgslens krop`,
    );
    assert.ok(
      !/husstand.*searchParams|searchParams.*husstand/.test(kilde),
      `${rute} må ALDRIG tage husstanden fra adressen`,
    );
  }

  console.log(`Husstande: 26 prøver holdt (${ruter.length} ruter gennemgået).`);
}

main().catch((fejl) => {
  console.error(fejl);
  process.exit(1);
});
