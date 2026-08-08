import { danishCount } from "@/lib/weekPlan/view";

/**
 * Indkøbsskærmens sprog.
 *
 * Rent som view.ts: ind kommer tal, ud kommer den danske sætning. Ingen
 * database, ingen React -- så hver linje brugeren læser kan efterprøves.
 *
 * Overskriften taler i ord, linjen under i tal. Det er den samme opdeling
 * som på ugeplanen, og den er bevidst: ordene er tonen, tallet er sandheden.
 */

export interface IndkøbOverskrift {
  line1: string;
  line2: string;
}

export function indkøbHeadline(
  antalVarer: number,
  antalKlaret: number,
  antalAftener: number,
): IndkøbOverskrift {
  if (antalAftener === 0) {
    return { line1: "Ingen retter", line2: "på ugen endnu." };
  }
  if (antalVarer === 0) {
    return { line1: "Ingen varer", line2: "at hente." };
  }

  const mangler = Math.max(0, antalVarer - antalKlaret);
  if (mangler === 0) return { line1: "Alt er", line2: "i kurven." };
  if (mangler === antalVarer) {
    return { line1: `${antalVarer} varer`, line2: "at hente." };
  }

  const ord = danishCount(mangler);
  const tekst = mangler <= 7 ? ord : String(mangler);
  return {
    line1: `${tekst} ${mangler === 1 ? "vare" : "varer"}`,
    line2: "tilbage.",
  };
}

export function indkøbSummary(
  antalVarer: number,
  antalKlaret: number,
  antalAftener: number,
): string {
  if (antalAftener === 0) {
    return "Læg retter på ugeplanen, så står varerne her";
  }

  const aftener = `${antalAftener} ${antalAftener === 1 ? "aften" : "aftener"}`;

  if (antalVarer === 0) return `${aftener} planlagt`;
  return `${antalKlaret} af ${antalVarer} varer · ${aftener}`;
}
