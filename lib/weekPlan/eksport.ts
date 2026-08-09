import type { Indkøbsliste } from "@/lib/weekPlan/indkoeb";

/**
 * Indkøbslisten som tekst, man kan tage med andre steder hen.
 *
 * Der er to formater, og de er forskellige af en grund:
 *
 *   TIL PÅMINDELSER er én vare per linje og INTET andet. Ingen
 *   zoneoverskrifter, ingen tomme linjer, ingen ugetitel. Apples
 *   Påmindelser laver én påmindelse per linje når man indsætter, så en
 *   overskrift som "FRUGT & GRØNT" ville blive til en påmindelse man skulle
 *   krydse af sammen med agurken.
 *
 *   HELE LISTEN har overskrifter og er til at læse -- en besked til den
 *   anden, eller en note. Der skal den struktur beholdes.
 *
 * Begge tager kun det der IKKE er krydset af. Har man lagt agurken i
 * kurven, skal den ikke med over i Påmindelser bagefter.
 */

export interface EksportValg {
  /** Tag kun varer der ikke er krydset af. Standard: ja. */
  kunManglende?: boolean;
  /** Tag "tjek skabet" med. Standard: nej -- det er ikke indkøb. */
  medSkabet?: boolean;
}

function varelinje(navn: string, mængde: string | null): string {
  return mængde ? `${navn} – ${mængde}` : navn;
}

function skalMed(checked: boolean, kunManglende: boolean): boolean {
  return kunManglende ? !checked : true;
}

/**
 * Én vare per linje. Formatet Apples Påmindelser kan tage imod.
 *
 * Tom streng når der ikke er noget tilbage -- så kan skærmen sige det i
 * stedet for at kopiere ingenting og lade som om der skete noget.
 */
export function tilPåmindelser(
  liste: Indkøbsliste,
  valg: EksportValg = {},
): string {
  const kunManglende = valg.kunManglende ?? true;
  const linjer: string[] = [];

  for (const afsnit of liste.afsnit) {
    for (const vare of afsnit.varer) {
      if (skalMed(vare.checked, kunManglende)) {
        linjer.push(varelinje(vare.navn, vare.mængde));
      }
    }
  }

  if (valg.medSkabet) {
    for (const vare of liste.skabet) {
      if (skalMed(vare.checked, kunManglende)) {
        linjer.push(varelinje(vare.navn, vare.mængde));
      }
    }
  }

  return linjer.join("\n");
}

/**
 * Hele listen med zoneoverskrifter -- til en note eller en besked.
 *
 * Egne retter kommer med, for de er en del af ugen, selvom de ikke har
 * varer. Står de ikke der, ser listen ud til at dække hele ugen, og så
 * glemmer man fredag.
 */
export function somTekst(
  liste: Indkøbsliste,
  ugeTitel: string,
  valg: EksportValg = {},
): string {
  const kunManglende = valg.kunManglende ?? true;
  const dele: string[] = [ugeTitel];

  for (const afsnit of liste.afsnit) {
    const varer = afsnit.varer.filter((v) => skalMed(v.checked, kunManglende));
    if (varer.length === 0) continue;
    dele.push(
      "",
      afsnit.zone.toUpperCase(),
      ...varer.map((v) => `- ${varelinje(v.navn, v.mængde)}`),
    );
  }

  if (liste.egneRetter.length > 0) {
    dele.push(
      "",
      "JERES EGNE RETTER",
      ...liste.egneRetter.map((r) => `- ${r.dayName}: ${r.title}`),
    );
  }

  if (valg.medSkabet && liste.skabet.length > 0) {
    const varer = liste.skabet.filter((v) => skalMed(v.checked, kunManglende));
    if (varer.length > 0) {
      dele.push("", "TJEK SKABET", ...varer.map((v) => `- ${v.navn}`));
    }
  }

  return dele.join("\n");
}

/** Hvor mange varer et eksportvalg ville tage med. */
export function antalIEksport(
  liste: Indkøbsliste,
  valg: EksportValg = {},
): number {
  const kunManglende = valg.kunManglende ?? true;
  const varer = liste.afsnit.flatMap((a) => a.varer);
  const skabet = valg.medSkabet ? liste.skabet : [];
  return [...varer, ...skabet].filter((v) => skalMed(v.checked, kunManglende))
    .length;
}
