import fs from "node:fs";
import path from "node:path";

/**
 * Den vedvarende browserprofil til Bilka.
 *
 * Foerste udgave gemte sessionen med Playwrights storageState. Den tager
 * cookies plus localStorage for de origins browseren HAR BESOEGT -- og
 * Bilkas login gaar gennem Gigya, som holder sin tilstand paa sit eget
 * domaene i en iframe. Den blev aldrig gemt. Resultatet var en session der
 * saa gyldig ud, svarede 200 OK paa alt, og skrev til en anonym kurv.
 *
 * En rigtig profilmappe beholder alt: cookies for alle domaener,
 * localStorage for alle origins, IndexedDB, service workers. Det er den
 * samme mekanisme en almindelig browser bruger til at holde dig logget ind
 * mellem to dage.
 *
 * Derfor logger man ind ÉN gang. Herefter koerer pushet uden vindue og
 * uden spoergsmaal, indtil Bilka selv lader sessionen udloebe.
 */

export const PROFIL_MAPPE = ".bilka-profile";

export function profilSti(): string {
  return path.join(process.cwd(), PROFIL_MAPPE);
}

export function profilFindes(): boolean {
  const sti = profilSti();
  return fs.existsSync(sti) && fs.readdirSync(sti).length > 0;
}

/** Tegn paa siden der kun staar der, naar man er logget ind. */
export const LOGGET_IND = /log ud|min konto|mit overblik/i;

export const IKKE_LOGGET_IND_BESKED =
  "Bilka-sessionen er ikke logget ind. Kør: npm run bilka:setup";
