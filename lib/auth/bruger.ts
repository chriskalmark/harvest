import { createPublicKey, createVerify } from "node:crypto";

/**
 * Hvem er det der spørger?
 *
 * Cloudflare Access sætter to headere på hver forespørgsel den slipper
 * igennem. E-mailen er den nemme, og den er IKKE nok alene:
 *
 *   Cf-Access-Authenticated-User-Email:  k@lmar.io
 *   Cf-Access-Jwt-Assertion:             <signeret JWT>
 *
 * Enhver der rammer serveren udenom Cloudflare -- på jeres eget netværk via
 * port 3005 -- kan sætte e-mail-headeren selv og skrive hvad som helst i
 * den. Så ville man kunne læse en anden husstands madplan ved at gætte en
 * e-mail. Derfor er det TOKENET der afgør identiteten, og e-mailen læses
 * ud af tokenet, ikke af sin egen header.
 *
 * Fejler noget som helst, er man ingen. Der er ingen "hvis vi ikke kan
 * verificere, så stoler vi på headeren" -- det ville gøre hele
 * verificeringen ligegyldig.
 */

/**
 * Teamets domæne og applikationens AUD-tag.
 *
 * Ingen af dem er hemmeligheder -- de står i den adresse Access sender
 * folk hen til, når de skal logge ind. De ligger som standardværdier, så
 * appen virker uden opsætning, og kan overskrives med miljøvariabler hvis
 * applikationen laves om i Cloudflare.
 */
/*
 * Laeses ved KALDET, ikke ved import.
 *
 * Ved import ville vaerdien blive bagt ind, foerste gang modulet blev
 * indlaest -- og saa kunne den ikke aendres uden en genstart. Det gjorde
 * ogsaa den foerste udgave af testen umulig at skrive: importen loeb foer
 * testen naaede at saette miljoevariablerne.
 */
function teamDomæne(): string {
  return (
    process.env.CF_ACCESS_TEAM_DOMAIN ?? "stormosegaard.cloudflareaccess.com"
  );
}

function audience(): string {
  return (
    process.env.CF_ACCESS_AUD ??
    "d91816ecd13d0579e9701e45bf4e24d276063c314bda8b49049ae5509bbee653"
  );
}

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  n?: string;
  e?: string;
}

interface NøgleCache {
  nøgler: Map<string, string>;
  hentetMs: number;
}

/**
 * Cloudflare roterer sine nøgler. En times levetid er kort nok til at følge
 * med og lang nok til at vi ikke henter certifikater ved hver forespørgsel.
 */
const CACHE_MS = 60 * 60 * 1000;
let cache: NøgleCache | null = null;
let henter: Promise<NøgleCache> | null = null;

function base64urlTilBuffer(tekst: string): Buffer {
  return Buffer.from(tekst.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function hentNøgler(nu: number): Promise<NøgleCache> {
  const svar = await fetch(`https://${teamDomæne()}/cdn-cgi/access/certs`, {
    cache: "no-store",
  });
  if (!svar.ok) {
    throw new Error(`Kunne ikke hente Access-nøgler: ${svar.status}`);
  }

  const krop = (await svar.json()) as { keys?: Jwk[] };
  const nøgler = new Map<string, string>();

  for (const jwk of krop.keys ?? []) {
    if (!jwk.kid || jwk.kty !== "RSA" || !jwk.n || !jwk.e) continue;
    try {
      const pem = createPublicKey({
        key: { kty: "RSA", n: jwk.n, e: jwk.e },
        format: "jwk",
      }).export({ type: "spki", format: "pem" });
      nøgler.set(jwk.kid, pem.toString());
    } catch {
      // En nøgle vi ikke kan læse, springes over. De andre kan stadig bruges.
    }
  }

  if (nøgler.size === 0) {
    throw new Error("Access svarede uden brugbare nøgler.");
  }
  return { nøgler, hentetMs: nu };
}

async function nøgleFor(kid: string, nu: number): Promise<string | null> {
  if (cache && nu - cache.hentetMs < CACHE_MS) {
    const kendt = cache.nøgler.get(kid);
    if (kendt) return kendt;
    // Ukendt kid på en frisk cache betyder som regel, at Cloudflare lige har
    // roteret. Hentes igen, én gang.
  }

  if (!henter) {
    henter = hentNøgler(nu)
      .then((frisk) => {
        cache = frisk;
        return frisk;
      })
      .finally(() => {
        henter = null;
      });
  }

  try {
    const frisk = await henter;
    return frisk.nøgler.get(kid) ?? null;
  } catch {
    return null;
  }
}

interface Krav {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
}

function audPasser(aud: unknown): boolean {
  const forventet = audience();
  // Cloudflare skriver aud som en liste, men enkeltværdi ses også.
  if (typeof aud === "string") return aud === forventet;
  if (Array.isArray(aud)) return aud.includes(forventet);
  return false;
}

/**
 * E-mailen fra et verificeret Access-token, eller null.
 *
 * Null betyder "ingen identitet" -- aldrig "luk igennem alligevel".
 */
export async function emailFraToken(
  token: string | null | undefined,
  nu: number = Date.now(),
): Promise<string | null> {
  if (!token) return null;

  const dele = token.split(".");
  if (dele.length !== 3) return null;

  let hoved: { kid?: string; alg?: string };
  let krav: Krav;
  try {
    hoved = JSON.parse(base64urlTilBuffer(dele[0]).toString("utf8"));
    krav = JSON.parse(base64urlTilBuffer(dele[1]).toString("utf8"));
  } catch {
    return null;
  }

  // Kun RS256. Uden det tjek kunne nogen sende alg:"none" og skrive sine
  // egne krav -- det klassiske hul i JWT-verificering.
  if (hoved.alg !== "RS256" || !hoved.kid) return null;

  if (!audPasser(krav.aud)) return null;
  if (typeof krav.iss === "string" && !krav.iss.includes(teamDomæne())) {
    return null;
  }

  const udløber = Number(krav.exp);
  if (!Number.isFinite(udløber) || udløber * 1000 <= nu) return null;

  const pem = await nøgleFor(hoved.kid, nu);
  if (!pem) return null;

  const kontrol = createVerify("RSA-SHA256");
  kontrol.update(`${dele[0]}.${dele[1]}`);
  kontrol.end();

  let gyldig = false;
  try {
    gyldig = kontrol.verify(pem, base64urlTilBuffer(dele[2]));
  } catch {
    return null;
  }
  if (!gyldig) return null;

  const email = krav.email;
  if (typeof email !== "string" || !email.includes("@")) return null;

  return email.trim().toLowerCase();
}

/** Læser identiteten af en forespørgsel. Null når der ikke er nogen. */
export async function emailFraRequest(request: {
  headers: { get(navn: string): string | null };
}): Promise<string | null> {
  return emailFraToken(request.headers.get("cf-access-jwt-assertion"));
}

/** Kastes når en rute kræver en identitet og ikke har en. */
export class IngenBrugerError extends Error {
  constructor() {
    super(
      "Kunne ikke se hvem du er. Prøv at genindlæse siden, så Cloudflare kan logge dig ind igen.",
    );
    this.name = "IngenBrugerError";
  }
}
