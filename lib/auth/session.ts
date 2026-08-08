/**
 * Husstandens session.
 *
 * Der er ingen sessionstabel og ingen brugere. Der er én husstand, én
 * adgangskode, og et signeret stykke tekst i en cookie der siger hvornår
 * adgangen udløber. Serveren behøver ikke huske noget mellem to kald --
 * signaturen er beviset.
 *
 * Formen er `<udløbstidspunkt>.<signatur>`, hvor signaturen er HMAC-SHA256
 * over udløbstidspunktet med SESSION_SECRET. Kan man ikke genskabe
 * signaturen, er cookien forfalsket eller pillet ved.
 *
 * Web Crypto og ikke node:crypto, fordi den samme kode skal kunne køre i
 * middleware (Edge) og i en API-rute (Node). To implementeringer af det
 * samme ville før eller siden komme til at være uenige.
 */

export const SESSION_COOKIE = "harvest_husstand";

/** 90 dage. Man skal ikke logge ind, fordi man står i Netto. */
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/**
 * Fejler LUKKET.
 *
 * Mangler hemmeligheden, kan ingen session laves og ingen verificeres --
 * så er appen låst i stedet for åben. Det modsatte ville betyde, at en
 * glemt miljøvariabel tavst slog adgangskoden fra.
 */
function hemmelighed(): string | null {
  const raw = process.env.SESSION_SECRET;
  if (typeof raw !== "string") return null;
  const rent = raw.trim();
  // For kort er ikke en hemmelighed. 32 tegn er 128 bit skrevet med hex.
  return rent.length >= 32 ? rent : null;
}

export function erKonfigureret(): boolean {
  return hemmelighed() !== null;
}

function base64url(bytes: ArrayBuffer): string {
  let tekst = "";
  for (const b of new Uint8Array(bytes)) tekst += String.fromCharCode(b);
  return btoa(tekst).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signér(besked: string, nøgle: string): Promise<string> {
  const kode = new TextEncoder();
  const importeret = await crypto.subtle.importKey(
    "raw",
    kode.encode(nøgle),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    await crypto.subtle.sign("HMAC", importeret, kode.encode(besked)),
  );
}

/**
 * Sammenligning der tager lige lang tid uanset hvor tidligt de er uenige.
 *
 * En almindelig !== afslører gennem tiden hvor mange tegn der passede, og
 * så kan en signatur gættes tegn for tegn.
 */
function ensTid(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let forskel = 0;
  for (let i = 0; i < a.length; i += 1) {
    forskel |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return forskel === 0;
}

/** Laver cookiens indhold. Null hvis hemmeligheden mangler. */
export async function lavSessionToken(
  nu: number = Date.now(),
): Promise<string | null> {
  const nøgle = hemmelighed();
  if (!nøgle) return null;
  const udløber = String(nu + SESSION_MAX_AGE_SECONDS * 1000);
  return `${udløber}.${await signér(udløber, nøgle)}`;
}

/** Er cookien ægte og stadig gyldig? */
export async function erGyldigSession(
  token: string | undefined | null,
  nu: number = Date.now(),
): Promise<boolean> {
  const nøgle = hemmelighed();
  if (!nøgle || !token) return false;

  const skilt = token.indexOf(".");
  if (skilt <= 0) return false;

  const udløber = token.slice(0, skilt);
  const signatur = token.slice(skilt + 1);
  if (!/^\d+$/.test(udløber) || signatur.length === 0) return false;

  // Signaturen tjekkes FØR udløbet. Ellers ville svartiden røbe, om et
  // gæt havde den rigtige form, uden at man kendte hemmeligheden.
  const forventet = await signér(udløber, nøgle);
  if (!ensTid(signatur, forventet)) return false;

  return Number(udløber) > nu;
}
