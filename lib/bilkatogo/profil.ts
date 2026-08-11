import fs from "node:fs";
import path from "node:path";

/**
 * Den vedvarende browserprofil til Bilka, og spørgsmålet "er vi logget ind".
 *
 * To fejl er begået her, og begge var af samme slags: at læse et tegn i
 * stedet for at måle det der betyder noget.
 *
 *   1. storageState gemte kun localStorage for de origins browseren HAVDE
 *      BESØGT. Bilkas login går gennem Gigya på sit eget domæne i en
 *      iframe -- den blev tabt. Nu gemmes hele profilmappen.
 *
 *   2. Login blev aflæst af TEKSTEN på siden: "Log ud", "Min konto",
 *      "Mit overblik". Bilka skriver "Mit BilkaToGo". Så sagde scriptet
 *      "du er ikke logget ind" til en mand der var logget ind.
 *
 * Derfor spørger vi nu API'et. Kurv-svaret bærer uid, og -1 betyder
 * anonym. Det er ikke et tegn man tolker -- det er præcis det tal der
 * afgør, om varen ryger i DIN kurv eller i en ingen kan se.
 */

export const PROFIL_MAPPE = ".bilka-profile";

export function profilSti(): string {
  return path.join(process.cwd(), PROFIL_MAPPE);
}

export function profilFindes(): boolean {
  const sti = profilSti();
  return fs.existsSync(sti) && fs.readdirSync(sti).length > 0;
}

export const IKKE_LOGGET_IND_BESKED =
  "Bilka-sessionen er ikke logget ind (uid -1). Kør: npm run bilka:setup";

/** Minimal form af det vi rører ved Playwright, så modulet står frit. */
export interface HarRequest {
  request: {
    fetch(
      url: string,
      opts: { method?: string },
    ): Promise<{ ok(): boolean; text(): Promise<string> }>;
  };
}

/**
 * Et harmløst kurv-kald: sæt linjen for ét produkt til 0.
 *
 * Er varen ikke i kurven, sker der ingenting -- men svaret bærer uid, og
 * det er alt vi skal bruge. Der lægges intet i kurven af at spørge.
 */
const PRØVE_URL =
  "https://api.bilkatogo.dk/api/shop/v6/ChangeLineCount" +
  "?u=w&productId=20824&count=0&fullCart=0";

export async function erLoggetInd(context: HarRequest): Promise<boolean> {
  try {
    const svar = await context.request.fetch(PRØVE_URL, { method: "POST" });
    if (!svar.ok()) return false;
    const uid = /"uid":\s*(-?\d+)/.exec(await svar.text())?.[1];
    return uid !== undefined && uid !== "-1";
  } catch {
    return false;
  }
}
