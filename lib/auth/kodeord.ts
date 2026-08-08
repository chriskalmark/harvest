import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Husstandens adgangskode.
 *
 * Selve koden står ingen steder -- hverken i koden, i databasen eller i
 * Portainer. Det der gemmes, er et scrypt-aftryk med sit eget salt, og
 * scrypt er med vilje langsomt og hukommelsestungt: et aftryk kan ikke
 * gættes hurtigt, selv hvis nogen får fat i det.
 *
 * node:crypto og ikke Web Crypto, fordi Web Crypto ikke har scrypt. Det er
 * i orden -- kodeordet tjekkes KUN i /api/login, som er en almindelig
 * Node-rute. Middleware rører aldrig kodeordet, kun sessionens signatur.
 */

/** Aftrykkets form: scrypt$<N>$<salt-hex>$<aftryk-hex>. */
const ALGORITME = "scrypt";
const N = 16384;
const NØGLELÆNGDE = 64;

function scryptAsync(
  kodeord: string,
  salt: Buffer,
  længde: number,
): Promise<Buffer> {
  return new Promise((løs, afvis) => {
    scrypt(
      kodeord.normalize("NFC"),
      salt,
      længde,
      { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (fejl, nøgle) => (fejl ? afvis(fejl) : løs(nøgle)),
    );
  });
}

/** Laver aftrykket der skal stå i HOUSEHOLD_PASSWORD_HASH. */
export async function lavAftryk(kodeord: string): Promise<string> {
  const salt = randomBytes(16);
  const aftryk = await scryptAsync(kodeord, salt, NØGLELÆNGDE);
  return `${ALGORITME}$${N}$${salt.toString("hex")}$${aftryk.toString("hex")}`;
}

/**
 * Passer koden til aftrykket?
 *
 * Fejler LUKKET: et aftryk der ikke kan læses, giver false. Et ødelagt
 * aftryk må aldrig komme til at betyde "luk alle ind".
 */
export async function passerKodeord(
  kodeord: string,
  gemtAftryk: string | undefined,
): Promise<boolean> {
  if (!kodeord || !gemtAftryk) return false;

  const dele = gemtAftryk.split("$");
  if (dele.length !== 4 || dele[0] !== ALGORITME) return false;

  const kostpris = Number(dele[1]);
  if (!Number.isInteger(kostpris) || kostpris < 1024) return false;

  let salt: Buffer;
  let forventet: Buffer;
  try {
    salt = Buffer.from(dele[2], "hex");
    forventet = Buffer.from(dele[3], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || forventet.length === 0) return false;

  const beregnet = await new Promise<Buffer | null>((løs) => {
    scrypt(
      kodeord.normalize("NFC"),
      salt,
      forventet.length,
      { N: kostpris, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (fejl, nøgle) => løs(fejl ? null : nøgle),
    );
  });
  if (!beregnet) return false;

  return timingSafeEqual(beregnet, forventet);
}

export function aftrykFindes(): boolean {
  const raw = process.env.HOUSEHOLD_PASSWORD_HASH;
  return typeof raw === "string" && raw.split("$").length === 4;
}
