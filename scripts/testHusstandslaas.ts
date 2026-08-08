/**
 * Låsen.
 *
 * Auditten beviste, at hvem som helst kunne skrive i madplanen. De her
 * prøver findes for at det ikke sker igen -- og hver af dem svarer til en
 * konkret måde en lås plejer at gå i stykker på.
 */

import assert from "node:assert/strict";
import { lavAftryk, passerKodeord } from "../lib/auth/kodeord";
import {
  erGyldigSession,
  erKonfigureret,
  lavSessionToken,
  SESSION_MAX_AGE_SECONDS,
} from "../lib/auth/session";

const HEMMELIGHED = "a".repeat(64);

function medHemmelighed(værdi: string | undefined) {
  if (værdi === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = værdi;
}

async function main() {
  /* --- Kodeordet ---------------------------------------------------- */

  const aftryk = await lavAftryk("stormosegaard 2026");

  assert.ok(
    !aftryk.includes("stormosegaard"),
    "Aftrykket må aldrig indeholde selve koden",
  );
  assert.equal(aftryk.split("$").length, 4, "scrypt$N$salt$aftryk");

  assert.equal(
    await passerKodeord("stormosegaard 2026", aftryk),
    true,
    "Den rigtige kode skal passe",
  );
  assert.equal(
    await passerKodeord("Stormosegaard 2026", aftryk),
    false,
    "Store og små bogstaver er ikke det samme",
  );
  assert.equal(
    await passerKodeord("stormosegaard 2027", aftryk),
    false,
    "Ét tegn forkert er forkert",
  );
  assert.equal(await passerKodeord("", aftryk), false, "Tom kode er forkert");

  // To aftryk af den SAMME kode skal være forskellige. Er de ens, er saltet
  // faldet ud, og så kan et opslagsværk knække dem begge på én gang.
  const aftryk2 = await lavAftryk("stormosegaard 2026");
  assert.notEqual(aftryk, aftryk2, "Saltet skal gøre hvert aftryk unikt");
  assert.equal(await passerKodeord("stormosegaard 2026", aftryk2), true);

  /* --- Fejler LUKKET, ikke åbent ------------------------------------ */

  assert.equal(
    await passerKodeord("hvad som helst", undefined),
    false,
    "Manglende aftryk må ikke lukke alle ind",
  );
  assert.equal(
    await passerKodeord("hvad som helst", ""),
    false,
    "Tomt aftryk må ikke lukke alle ind",
  );
  assert.equal(
    await passerKodeord("hvad som helst", "noget-vrøvl"),
    false,
    "Ulæseligt aftryk må ikke lukke alle ind",
  );
  assert.equal(
    await passerKodeord("hvad som helst", "scrypt$16384$zz$zz"),
    false,
    "Ugyldig hex må ikke lukke alle ind",
  );
  assert.equal(
    await passerKodeord("hvad som helst", "md5$1$aa$bb"),
    false,
    "En anden algoritme må ikke accepteres",
  );

  /* --- Sessionen ---------------------------------------------------- */

  medHemmelighed(undefined);
  assert.equal(erKonfigureret(), false, "Ingen hemmelighed = ikke sat op");
  assert.equal(
    await lavSessionToken(),
    null,
    "Uden hemmelighed kan der ikke laves en session",
  );
  assert.equal(
    await erGyldigSession("1900000000000.hvadsomhelst"),
    false,
    "Uden hemmelighed er INGEN session gyldig",
  );

  medHemmelighed("for-kort");
  assert.equal(
    erKonfigureret(),
    false,
    "En hemmelighed på 8 tegn er ikke en hemmelighed",
  );

  medHemmelighed(HEMMELIGHED);
  assert.equal(erKonfigureret(), true);

  const nu = 1_770_000_000_000;
  const token = await lavSessionToken(nu);
  assert.ok(token, "Med hemmelighed skal der komme et token");

  assert.equal(
    await erGyldigSession(token, nu + 1000),
    true,
    "Et friskt token er gyldigt",
  );

  /* --- Forfalskning ------------------------------------------------- */

  const [udløber, signatur] = token!.split(".");

  assert.equal(
    await erGyldigSession(`${Number(udløber) + 1}.${signatur}`, nu),
    false,
    "Skubber man udløbet frem, passer signaturen ikke længere",
  );
  assert.equal(
    await erGyldigSession(`${udløber}.${signatur.slice(0, -1)}x`, nu),
    false,
    "Ét tegn ændret i signaturen er nok",
  );
  assert.equal(
    await erGyldigSession(`${udløber}.`, nu),
    false,
    "Tom signatur er ikke gyldig",
  );
  assert.equal(
    await erGyldigSession(udløber, nu),
    false,
    "Uden punktum er det ikke et token",
  );
  assert.equal(
    await erGyldigSession("...", nu),
    false,
    "Vrøvl er ikke gyldigt",
  );
  assert.equal(await erGyldigSession(undefined, nu), false);
  assert.equal(await erGyldigSession("", nu), false);

  // En anden hemmelighed må ikke kunne godkende vores token.
  medHemmelighed("b".repeat(64));
  assert.equal(
    await erGyldigSession(token, nu),
    false,
    "Skiftes hemmeligheden, bliver alle sessioner ugyldige",
  );

  /* --- Udløb -------------------------------------------------------- */

  medHemmelighed(HEMMELIGHED);
  const lige_før = nu + SESSION_MAX_AGE_SECONDS * 1000 - 1000;
  const lige_efter = nu + SESSION_MAX_AGE_SECONDS * 1000 + 1000;

  assert.equal(
    await erGyldigSession(token, lige_før),
    true,
    "Dagen før udløbet er man stadig inde",
  );
  assert.equal(
    await erGyldigSession(token, lige_efter),
    false,
    "Efter 90 dage skal man taste koden igen",
  );

  medHemmelighed(undefined);
  console.log("Husstandslås: 30 prøver holdt.");
}

main().catch((fejl) => {
  console.error(fejl);
  process.exit(1);
});
