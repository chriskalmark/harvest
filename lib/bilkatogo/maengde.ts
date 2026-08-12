/**
 * Hvor mange pakker skal der til?
 *
 * Indtil nu blev alt med vægt til "1 stk". Skal der bruges 1,5 kg kartofler,
 * og posen er på 1 kg, lagde vi én pose i kurven -- og så manglede der en
 * halv kilo, når man stod ved komfuret.
 *
 * Bilkas søgning giver produktets fulde navn med pakkestørrelsen i:
 *
 *   "Salling Bagekartofler 1,5 kg"
 *   "Arla Letmælk 1,5% fedt 1 l"
 *   "Skrabeæg M/L 10 stk."
 *
 * Herfra kan behovet omregnes til et antal pakker. Er der ingen størrelse i
 * navnet -- og det er der ofte ikke, fx ved løsvægt -- falder vi tilbage til
 * 1 og siger det. Et gæt der ligner et regnestykke er værre end et ærligt 1.
 */

export interface Mængde {
  tal: number;
  enhed: string;
}

/** Gram og milliliter er grundenheder; resten regnes om til dem. */
const TIL_GRUND: Record<string, { faktor: number; grund: string }> = {
  g: { faktor: 1, grund: "g" },
  gr: { faktor: 1, grund: "g" },
  kg: { faktor: 1000, grund: "g" },
  ml: { faktor: 1, grund: "ml" },
  cl: { faktor: 10, grund: "ml" },
  dl: { faktor: 100, grund: "ml" },
  l: { faktor: 1000, grund: "ml" },
  ltr: { faktor: 1000, grund: "ml" },
  stk: { faktor: 1, grund: "stk" },
};

function tilTal(tekst: string): number {
  return Number.parseFloat(tekst.replace(",", "."));
}

/** Omregner til gram, milliliter eller stk. Null når enheden er ukendt. */
export function tilGrundenhed(m: Mængde): Mængde | null {
  const nøgle = m.enhed.toLowerCase().replace(/\.$/, "");
  const regel = TIL_GRUND[nøgle];
  if (!regel || !Number.isFinite(m.tal) || m.tal <= 0) return null;
  return { tal: m.tal * regel.faktor, enhed: regel.grund };
}

/**
 * Pakkestørrelsen læst ud af et produktnavn.
 *
 * Tages fra SLUTNINGEN af navnet. "Letmælk 1,5% fedt 1 l" indeholder både
 * 1,5 og 1 -- fedtprocenten står først, og den er ikke en pakkestørrelse.
 * Procenttal springes derfor over.
 */
export function pakkestørrelse(produktnavn: string): Mængde | null {
  const rent = produktnavn.toLowerCase().replace(/\s+/g, " ").trim();

  const alle = [
    ...rent.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|cl|dl|ltr|l|stk)\.?\b/g),
  ].filter((m) => {
    // "1,5% fedt" er ikke en pakke. Et tal fulgt af % springes over.
    const efter = rent.slice(
      m.index! + m[0].length,
      m.index! + m[0].length + 2,
    );
    return !efter.trimStart().startsWith("%");
  });

  const sidste = alle[alle.length - 1];
  if (!sidste) return null;

  const tal = tilTal(sidste[1]);
  if (!Number.isFinite(tal) || tal <= 0) return null;
  return { tal, enhed: sidste[2] };
}

/** Behovet læst ud af indkøbslistens mængdetekst, fx "1,5 kg" eller "4 fed". */
export function behovFraTekst(q: string | undefined): Mængde | null {
  if (!q) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*([a-zæøå]+)?/i.exec(q.trim());
  if (!m) return null;
  const tal = tilTal(m[1]);
  if (!Number.isFinite(tal) || tal <= 0) return null;
  return { tal, enhed: (m[2] ?? "stk").toLowerCase() };
}

export interface AntalResultat {
  antal: number;
  /** Hvorfor det tal. Vises i rapporten, så et 1-tal ikke ser udregnet ud. */
  begrundelse: string;
}

/**
 * Hvor mange pakker dækker behovet?
 *
 * Rundes OP: mangler man 100 g, kan man ikke købe 0,8 pose. Og aldrig under
 * 1 -- står varen på listen, skal der købes mindst én.
 *
 * Loftet på 12 er en sikkerhedsline, ikke en regel. Går et regnestykke galt
 * -- fx hvis "2 g gær" mødte en pakke på 0,5 g -- vil man hellere have 12 i
 * kurven end 400.
 */
export function antalPakker(
  behovTekst: string | undefined,
  produktnavn: string,
): AntalResultat {
  const behov = behovFraTekst(behovTekst);
  if (!behov) return { antal: 1, begrundelse: "ingen mængde på listen" };

  // Stykvarer: behovet ER antallet. "4 fed hvidløg" er ikke fire pakker
  // hvidløg, men "2 stk nakkekoteletter" er to stykker. Kun stk tælles op.
  const behovGrund = tilGrundenhed(behov);
  if (!behovGrund) {
    return { antal: 1, begrundelse: `"${behov.enhed}" kan ikke omregnes` };
  }
  const pakke = pakkestørrelse(produktnavn);

  if (behovGrund.enhed === "stk") {
    /*
     * "2 stk" ganges KUN op, naar varen saelges styksvis.
     *
     * Uden det her blev "2 stk nakkekoteletter" til to bakker af
     * "Nakkekoteletter 3,2-3,4 kg" -- altsaa 6,4 kilo svinekoed i kurven.
     * Saelges varen efter vaegt, indeholder én pakke allerede flere
     * stykker, og ét er svaret.
     */
    const pakkeGrundStk = pakke ? tilGrundenhed(pakke) : null;

    if (pakkeGrundStk && pakkeGrundStk.enhed !== "stk") {
      return {
        antal: 1,
        begrundelse: `pakken er ${pakke!.tal} ${pakke!.enhed} og rummer flere`,
      };
    }

    if (pakkeGrundStk && pakkeGrundStk.enhed === "stk") {
      const antal = Math.min(
        12,
        Math.max(1, Math.ceil(behovGrund.tal / pakkeGrundStk.tal)),
      );
      return {
        antal,
        begrundelse: `${antal} × ${pakke!.tal} stk til ${behov.tal} stk`,
      };
    }

    const antal = Math.min(12, Math.max(1, Math.ceil(behovGrund.tal)));
    return { antal, begrundelse: `${antal} stk fra listen` };
  }

  if (!pakke) {
    return { antal: 1, begrundelse: "pakkestørrelse ukendt" };
  }
  const pakkeGrund = tilGrundenhed(pakke);
  if (!pakkeGrund || pakkeGrund.enhed !== behovGrund.enhed) {
    return {
      antal: 1,
      begrundelse: `pakken er ${pakke.tal} ${pakke.enhed}, behovet ${behov.tal} ${behov.enhed}`,
    };
  }

  const rå = behovGrund.tal / pakkeGrund.tal;
  const antal = Math.min(12, Math.max(1, Math.ceil(Number(rå.toFixed(4)))));

  return {
    antal,
    begrundelse:
      antal === 1
        ? `1 × ${pakke.tal} ${pakke.enhed} dækker ${behov.tal} ${behov.enhed}`
        : `${antal} × ${pakke.tal} ${pakke.enhed} til ${behov.tal} ${behov.enhed}`,
  };
}

/**
 * Hvilket af søgningens hits passer bedst til behovet?
 *
 * Bilkas øverste hit for "svinemørbrad" er en storkøkkenpakke på 2,7 kg.
 * Skal der bruges 300 g, er det ikke et match -- det er ni gange for meget,
 * og det stod i kurven, fordi vi altid tog det første hit.
 *
 * Reglen: den MINDSTE pakke der dækker behovet, vinder. Findes ingen der
 * dækker, tages den største -- så køber man to af dem i stedet.
 *
 * Pakker uden størrelse i navnet (løsvægt, "Soyasauce") sorteres ikke væk;
 * de får søgningens egen rangering, fordi vi ikke ved bedre. At gætte på
 * dem ville være at bytte ét blindt valg ud med et andet.
 */
export function bedsteHit<T extends { name: string }>(
  hits: readonly T[],
  behovTekst: string | undefined,
): T | undefined {
  if (hits.length === 0) return undefined;

  const behov = behovFraTekst(behovTekst);
  const behovGrund = behov ? tilGrundenhed(behov) : null;

  // Uden et behov i en enhed vi forstår, står søgningens rækkefølge ved magt.
  if (!behovGrund || behovGrund.enhed === "stk") return hits[0];

  interface Vurderet {
    hit: T;
    /** Pakkens størrelse i samme grundenhed som behovet. */
    størrelse: number;
    plads: number;
  }

  const vurderede: Vurderet[] = [];
  for (const hit of hits) {
    const pakke = pakkestørrelse(hit.name);
    if (!pakke) continue;
    const grund = tilGrundenhed(pakke);
    if (!grund || grund.enhed !== behovGrund.enhed) continue;
    vurderede.push({
      hit,
      størrelse: grund.tal,
      plads: hits.indexOf(hit),
    });
  }

  if (vurderede.length === 0) return hits[0];

  const dækker = vurderede.filter((v) => v.størrelse >= behovGrund.tal);

  if (dækker.length > 0) {
    // Mindste pakke der raekker. Ved lige stoerrelse vinder soegningens egen
    // raekkefoelge, saa vi ikke omroder mere end noedvendigt.
    dækker.sort((a, b) => a.størrelse - b.størrelse || a.plads - b.plads);
    return dækker[0].hit;
  }

  vurderede.sort((a, b) => b.størrelse - a.størrelse || a.plads - b.plads);
  return vurderede[0].hit;
}
