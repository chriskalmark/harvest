import assert from "node:assert/strict";
import {
  contrastRatio,
  parseColor,
  ratio,
  stack,
  toSrgb,
} from "../lib/color/contrast";
import { token, tokenNames, type Theme } from "../lib/color/tokens";

/**
 * Kontrasten er blevet skoennet fire gange i det her projekt og maalt for lavt
 * bagefter hver gang. To paastande stod direkte imod hinanden i sidste runde:
 * at "I DAG"-maerket maalte 1,55:1 i moerkt tema, og at moerkt tema var rent.
 * Testen her afgoer den slags med regnestykket i stedet for oejet.
 *
 * Farverne laeses ud af app/globals.css, saa testen ikke kan komme til at
 * maale en kopi af en farve der er blevet aendret.
 */

/* --------------------------------------------------------------------- */
/* 1. Selve konverteringen skal vaere rigtig, ellers er alt andet stoej.  */
/* --------------------------------------------------------------------- */

const white = toSrgb(parseColor("oklch(1 0 0)"));
const black = toSrgb(parseColor("oklch(0 0 0)"));

assert.equal(
  Math.round(contrastRatio(white, black) * 100) / 100,
  21,
  "Hvid mod sort skal give præcis 21:1 — ellers er OKLab-matricerne forkerte",
);
assert.equal(
  Math.round(contrastRatio(white, white) * 1000) / 1000,
  1,
  "En farve mod sig selv er 1:1",
);

// oklch(0.5 0 0) er en neutral gråtone. Den må ikke lande på en farvet værdi.
const grey = toSrgb(parseColor("oklch(0.5 0 0)"));
assert.ok(
  Math.abs(grey.r - grey.g) < 0.002 && Math.abs(grey.g - grey.b) < 0.002,
  `oklch(0.5 0 0) skal være grå, blev r=${grey.r} g=${grey.g} b=${grey.b}`,
);

// Alfa skal lægges sammen som browseren gør det: halvt hvidt over sort er grå.
const halvt = stack("oklch(0 0 0)", ["oklch(1 0 0 / 0.5)"]);
assert.ok(
  Math.abs(halvt.r - 0.5) < 0.001,
  `Kompositering ramte forkert: ${halvt.r}`,
);

// Uden kompositering ville en chip på /0.16 blive målt som sin fulde farve.
// De to tal SKAL være forskellige, ellers er alfa-leddet faldet ud.
const medAlfa = ratio("oklch(0.93 0.015 150)", "oklch(0.26 0.02 152)", [
  "oklch(1 0 0 / 0.05)",
]);
const udenAlfa = ratio("oklch(0.93 0.015 150)", "oklch(0.26 0.02 152)");
assert.notEqual(
  medAlfa,
  udenAlfa,
  "Et halvgennemsigtigt lag skal ændre målingen",
);

/* --------------------------------------------------------------------- */
/* 2. Temaernes tokens skal findes i alle tre blokke.                     */
/* --------------------------------------------------------------------- */

const themes: Theme[] = ["light", "dark", "media-dark"];

/**
 * :root.dark er den klasse temaknappen saetter; @media-tvillingen daekker
 * systemvalget. Drev de to fra hinanden, saa oplever brugere af knappen noget
 * andet end brugere af systemtemaet -- det er sket, og det kostede tre
 * etiketter under 2:1. De skal vaere identiske.
 */
for (const name of tokenNames()) {
  assert.equal(
    token(name, "dark"),
    token(name, "media-dark"),
    `${name} står forskelligt i :root.dark og @media-tvillingen`,
  );
}

/* --------------------------------------------------------------------- */
/* 3. De pladser hvor tekst faktisk staar.                                */
/* --------------------------------------------------------------------- */

type Case = {
  hvad: string;
  tekst: string;
  flade: string;
  lag?: string[];
  px: number;
  fed: boolean;
};

const cases: Case[] = [
  // Header.tsx — ordmærket. Stod på --harvest-green og målte 2,27:1 i lyst.
  {
    hvad: 'Ordmærket "Harvest"',
    tekst: "--harvest-green-ink",
    flade: "--background",
    px: 24.8,
    fed: true,
  },
  // BottomNav.tsx — aktiv fane. Stod på --harvest-green og målte 3,34:1.
  {
    hvad: "Bundnav, aktiv fane",
    tekst: "--harvest-green-ink",
    flade: "--surface-1",
    px: 11,
    fed: true,
  },
  {
    hvad: "Bundnav, hvilende fane",
    tekst: "--text-muted",
    flade: "--surface-1",
    px: 11,
    fed: true,
  },
  // DagRaekke.tsx — "I DAG". Guld blæk på guld tint, oven på kortet.
  {
    hvad: '"I dag"-mærket',
    tekst: "--harvest-gold-ink",
    flade: "--surface-1",
    lag: ["--tint-gold"],
    px: 10,
    fed: true,
  },
  {
    hvad: "Dagsnavn i ugeplanen",
    tekst: "--harvest-green-ink",
    flade: "--surface-1",
    px: 11,
    fed: true,
  },
  {
    hvad: "Undertekst i dagsrækken",
    tekst: "--text-muted",
    flade: "--surface-1",
    px: 12.8,
    fed: false,
  },
  // UgeplanSkaerm.tsx — den grønne flade. --harvest-green giver kun 3,48:1
  // for hvid tekst; fladen bruger derfor --field-green.
  {
    hvad: "Hvid tekst på den grønne flade",
    tekst: "oklch(1 0 0)",
    flade: "--field-green",
    px: 14,
    fed: false,
  },
  // KatalogVaelger.tsx — hvilende filterchip på --tint-stone.
  {
    hvad: "Hvilende chip i retvælgeren",
    tekst: "--text-muted",
    flade: "--surface-1",
    lag: ["--tint-stone"],
    px: 13,
    fed: true,
  },
  // RecipeScreen.tsx — et klaret trin dæmpes med farve, ikke opacity.
  {
    hvad: "Klaret trin i opskriften",
    tekst: "--text-muted",
    flade: "--surface-1",
    px: 16,
    fed: false,
  },
  {
    hvad: "Brødtekst i opskriftens trin",
    tekst: "--foreground",
    flade: "--surface-1",
    px: 19.2,
    fed: false,
  },
  {
    hvad: "Brødtekst på sidens bund",
    tekst: "--foreground",
    flade: "--background",
    px: 16,
    fed: false,
  },
];

/** WCAG 1.4.3: 18,66px fed eller 24px normal er "stor tekst" og kræver 3:1. */
function required(px: number, fed: boolean): number {
  return (fed ? px >= 18.66 : px >= 24) ? 3 : 4.5;
}

function resolve(name: string, theme: Theme): string {
  return name.startsWith("--") ? token(name, theme) : name;
}

let checks = 0;
for (const theme of themes) {
  for (const c of cases) {
    const value = ratio(
      resolve(c.tekst, theme),
      resolve(c.flade, theme),
      (c.lag ?? []).map((l) => resolve(l, theme)),
    );
    const need = required(c.px, c.fed);
    assert.ok(
      value >= need,
      `${c.hvad} (${theme}): ${value.toFixed(2)}:1, kræver ${need}:1`,
    );
    checks += 1;
  }
}

/* --------------------------------------------------------------------- */
/* 4. De to farver der ER faldet, må ikke snige sig tilbage som tekst.    */
/* --------------------------------------------------------------------- */

// --harvest-green som tekstfarve på en lys flade er dét mønster der har
// fejlet to gange. Testen dokumenterer HVORFOR --harvest-green-ink findes.
const groenPaaFlade = ratio(
  token("--harvest-green", "light"),
  token("--background", "light"),
);
assert.ok(
  groenPaaFlade < 3,
  `--harvest-green måler ${groenPaaFlade}:1 mod --background — hvis den nu ` +
    `klarer 3:1, er farven ændret og kommentarerne i Header/BottomNav er forældede`,
);

const hvidPaaGroen = ratio("oklch(1 0 0)", token("--harvest-green", "light"));
assert.ok(
  hvidPaaGroen < 4.5,
  `Hvid på --harvest-green måler ${hvidPaaGroen}:1 — --field-green findes ` +
    `netop fordi den her ikke klarer 4,5:1`,
);

console.log(
  `testThemeContrast: alle tjek grønne (${checks} kontrastmålinger i tre temaer` +
    `, ${tokenNames().length} tokens sammenlignet mellem :root.dark og @media)`,
);
