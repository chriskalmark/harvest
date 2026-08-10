import { GRUNDOPSKRIFTER, type Grundopskrift } from "@/data/grundopskrifter";
import { nøgleNavn } from "@/lib/weekPlan/indkoeb";

/**
 * Halvfabrikata fra Skagenfoods kasse, oversat til noget man kan købe.
 *
 * Skagenfood skriver "tilsæt mørbradgryde", fordi den ligger færdig i
 * kassen. Handler man i Netto, findes den ikke -- og indkøbslisten bad om
 * en vare der ikke er til at købe. Det er ikke en skønhedsfejl: man stod i
 * butikken og kunne ikke lave onsdagens mad.
 *
 * De 21 halvfabrikata i kataloget falder i to slags:
 *
 *   lav-selv    foldes ud til rigtige varer på indkøbslisten. "mørbradgryde"
 *               bliver til svinemørbrad, champignon, løg, fløde og bouillon.
 *   køb-færdig  findes i Netto. Står som den er, men med en note om hvad
 *               den indeholder, hvis man vil lave den selv alligevel.
 *
 * Opslaget sker på det NORMALISEREDE navn, det samme indkøbslisten bruger
 * til at lægge varer sammen. Ellers ville "Mørbradgryde" og "mørbradgryde"
 * være to forskellige ting.
 */

const EFTER_NAVN = new Map<string, Grundopskrift>(
  GRUNDOPSKRIFTER.map((opskrift) => [nøgleNavn(opskrift.navn), opskrift]),
);

/** Grundopskriften for et ingrediensnavn, eller null. */
export function grundopskriftFor(navn: string): Grundopskrift | null {
  return EFTER_NAVN.get(nøgleNavn(navn)) ?? null;
}

/** Skal ingrediensen foldes ud til rigtige varer? */
export function skalFoldesUd(navn: string): boolean {
  return grundopskriftFor(navn)?.slags === "lav-selv";
}

export interface UdfoldetVare {
  navn: string;
  mængde: number;
  enhed: string;
}

/**
 * Halvfabrikataet foldet ud til varer, skaleret til antal personer.
 *
 * Skagenfoods egen mængde ("400 g mørbradgryde") bruges IKKE. Den siger kun
 * at retten kræver mørbradgryde -- ikke hvad der er i den. Mængderne kommer
 * fra vores egen grundopskrift, som er skrevet pr. person.
 */
export function foldUd(navn: string, portioner: number): UdfoldetVare[] {
  const opskrift = grundopskriftFor(navn);
  if (!opskrift || opskrift.slags !== "lav-selv") return [];
  if (!Number.isFinite(portioner) || portioner <= 0) return [];

  return opskrift.ingredienser.map((ingrediens) => ({
    navn: ingrediens.navn,
    mængde: ingrediens.mængde * portioner,
    enhed: ingrediens.enhed,
  }));
}

/** Zonen grundopskriften selv angiver, hvis den gør. */
export function zoneFraGrundopskrift(navn: string): string | null {
  return grundopskriftFor(navn)?.zone ?? null;
}

/** Noten der skal stå ved en købe-færdig vare. */
export function noteFor(navn: string): string | null {
  const opskrift = grundopskriftFor(navn);
  if (!opskrift || opskrift.slags !== "køb-færdig") return null;
  return opskrift.note ?? null;
}

/** Alle grundopskrifter en ret trækker på. Til opskriftsvisningen. */
export function grundopskrifterI(
  ingrediensnavne: readonly string[],
): Grundopskrift[] {
  const set = new Map<string, Grundopskrift>();
  for (const navn of ingrediensnavne) {
    const fundet = grundopskriftFor(navn);
    if (fundet) set.set(fundet.navn, fundet);
  }
  return Array.from(set.values());
}

export type { Grundopskrift };
