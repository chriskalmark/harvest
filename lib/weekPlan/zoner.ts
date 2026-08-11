import {
  DEFAULT_STORE_ZONE,
  STORE_CATEGORY_ORDER,
  type StoreZone,
} from "@/lib/constants";

/**
 * Hvor i Netto ligger den her ingrediens?
 *
 * Skagenfood fortæller hvad der skal i gryden, men ikke hvor man finder det.
 * Den gamle madplan slap for spørgsmålet, fordi en forfatter skrev zonen på
 * hver ingrediens i hånden. Kataloget har ingen forfatter -- 307 navne kom
 * ind fra deres API uden en eneste zone -- så den viden skal stå her.
 *
 * Reglerne er ordnede, og den første der rammer, vinder. Rækkefølgen er ikke
 * kosmetik, den ER logikken. Hver af disse står i de rigtige data:
 *
 *   "grøntsagsbouillon" indeholder "grønt", men er kolonial.
 *   "kokosmælk" indeholder "mælk", men står ikke på køl.
 *   "hytteost" indeholder "ost", men ligger ved mælken, ikke ved ostene.
 *   "tomatpuré" indeholder "tomat", men ligger ikke i frugt og grønt.
 *   "græskarkerner" indeholder "græskar", men ligger ved nødderne.
 *   "stødt chili" indeholder "chili", men er et krydderi.
 *   "stegt kartoffel krydderi" indeholder "kartoffel", men er et krydderi.
 *   "tørrede abrikoser" indeholder "abrikoser", men er tørret frugt.
 *
 * Derfor står det snævre altid før det brede.
 *
 * Og der matches på HELE ORD, ikke på delstrenge. "friske abrikoser"
 * indeholder bogstaverne r-i-s, og en naiv includes("ris") ville sende
 * abrikoserne hen til risene.
 */

/** Står i opskriften, men aldrig på en indkøbsseddel. */
const IKKE_VARER = new Set(["vand", "kogende vand", "isterninger", "is"]);

interface Regel {
  zone: StoreZone;
  /** Matcher et helt ord. Ord på 4+ tegn matcher også bøjninger forfra. */
  ord?: string[];
  /** Matcher et ord der ender sådan -- "rødløg" fanges af "løg". */
  slutter?: string[];
  /** Matcher hele navnet. Til vendinger der ikke er ét ord. */
  udtryk?: RegExp[];
}

const REGLER: Regel[] = [
  // --- 1. Tilberedt slår altid råvaren ------------------------------------
  // "tørrede abrikoser" er kolonial, selvom abrikoser er frugt.
  {
    zone: "Kolonial",
    udtryk: [
      /\btørret\b|\btørrede\b/,
      /\bstødt\b|\bstødte\b/,
      /\bfra dåse\b|\bi dåse\b|\bpå dåse\b/,
      /\bflåede\b/,
      /\bi vand\b|\bi olie\b|\bi lage\b/,
      /\bhenkogt\b|\bsyltet\b|\bsyltede\b/,
      /\bsorte bønner\b|\bhvide bønner\b|\bkidneybønner\b/,
      // Hvide asparges saelges henkogte paa glas. Friske hvide asparges
      // findes stort set ikke i en dansk hverdagsbutik.
      /\bhvide asparges\b/,
    ],
    ord: ["borlottibønner"],
  },

  // --- 2. Frost -----------------------------------------------------------
  {
    zone: "Frost",
    ord: ["pommes"],
    udtryk: [/\bfrost\b|\bfrossen\b|\bfrosne\b|\bdybfrost\b/],
  },

  // --- 3. Krydderier, saucer, konserves, kerner og nødder -----------------
  // Før både kød og grønt: "texan pork rub" er ikke kød, og
  // "stegt kartoffel krydderi" er ikke kartofler.
  {
    zone: "Kolonial",
    ord: [
      "krydderi",
      "krydderier",
      "krydderimix",
      "krydderiblanding",
      "rub",
      "spice",
      "spices",
      "masala",
      "karry",
      "curry",
      "paste",
      "gochugaru",
      "bouillon",
      "sauce",
      "sovs",
      "sugo",
      "ketchup",
      "mayonnaise",
      "remoulade",
      "sennep",
      "tahin",
      "sriracha",
      "dukkah",
      "chiliflager",
      "peberrod",
      "kapers",
      "honning",
      "rasp",
      "olie",
      "eddike",
      "kokosmælk",
      "tomatpuré",
      "tomatpure",
      "tomatrelish",
      "tomatsugo",
      "pizzasauce",
      "tarteletfyld",
      "peanuts",
      "rosiner",
      "pinjekerner",
      "græskarkerner",
      "solsikkekerner",
      "hasselnødder",
      "hasselnøddekerner",
      "mandler",
      "valnødder",
      "cashewnødder",
    ],
    slutter: [
      "krydderi",
      "krydderier",
      "sauce",
      "sovs",
      "sugo",
      "bouillon",
      "olie",
      "eddike",
      "mel",
      "kerner",
      "nødder",
    ],
    udtryk: [
      /\bfive spice\b/,
      /\bsalt\b/,
      /\bpeber\b/,
      /\bmuskatnød\b|\bkanel\b|\bkardemomme\b|\bgurkemeje\b|\bpaprika\b/,
      /\bkorianderfrø\b|\bfennikelfrø\b|\bsesamfrø\b|\bspidskommen\b/,
    ],
  },

  // --- 4. Fisk ------------------------------------------------------------
  {
    zone: "Fisk",
    ord: [
      "laks",
      "rejer",
      "ansjoser",
      "tun",
      "skipjack",
      "makrel",
      "fiskefrikadeller",
      "fiskefrikadelle",
      "krabbe",
      "muslinger",
      "torsk",
      "kuller",
      "kulmule",
      "rødspætte",
    ],
    slutter: ["filet"],
    udtryk: [/\basc\b/, /\bskagen salmon\b/],
  },

  // --- 5. Kød og fjerkræ --------------------------------------------------
  {
    zone: "Kød & fjerkræ",
    ord: [
      "kylling",
      "kyllingebryst",
      "kyllingelår",
      "kyllingekød",
      "høns",
      "gris",
      "grisekød",
      "okse",
      "oksekød",
      "kalvekød",
      "lammekød",
      "bacon",
      "kotelet",
      "koteletter",
      "nakkekoteletter",
      "skaftkotelet",
      "mørbrad",
      "mørbradgryde",
      "skinke",
      "skinkegryde",
      "frikadeller",
      "frikadelle",
      "kødboller",
      "kødbolle",
      "millionbøf",
      "albondigas",
      "hakket",
    ],
    udtryk: [/\bfilet á la mørbrad\b/, /\bhopballe mølle\b/],
  },

  // --- 6. Køl før ost -----------------------------------------------------
  // Hytteost og flødeost hedder "ost", men står ved mælken i Netto.
  {
    zone: "Køl",
    ord: ["hytteost", "flødeost", "smøreost"],
    udtryk: [/\bcreme fraiche\b/, /\bcreme frisk\b/],
  },

  // --- 7. Ost og pålæg ----------------------------------------------------
  {
    zone: "Ost & pålæg",
    ord: [
      "ost",
      "mozzarella",
      "parmesan",
      "parmigiano",
      "pecorino",
      "ricotta",
      "feta",
      "salatost",
      "cheddar",
      "pepperoni",
      "spegepølse",
      "salami",
    ],
    slutter: ["ost"],
    udtryk: [/\bfior di latte\b/],
  },

  // --- 8. Køl: mejeri, æg og frisk dej ------------------------------------
  {
    zone: "Køl",
    ord: [
      "mælk",
      "sødmælk",
      "letmælk",
      "minimælk",
      "kærnemælk",
      "fløde",
      "piskefløde",
      "yoghurt",
      "skyr",
      "smør",
      "æg",
      "creme",
      "pizzadej",
      "dej",
      "bearnaise",
    ],
    // "madlavningsfloede" starter ikke med "floede", saa praefiks-reglen
    // fanger den ikke. Uden endelsen her havnede den i Kolonial.
    slutter: ["mælk", "fløde"],
  },

  // --- 9. Brød ------------------------------------------------------------
  {
    zone: "Brød",
    ord: [
      "brød",
      "rugbrød",
      "naanbrød",
      "pitabrød",
      "baguette",
      "baguettes",
      "bolle",
      "boller",
      "burgerboller",
      "surdejsboller",
      "wraps",
      "tortilla",
      "tarteletter",
    ],
    slutter: ["brød", "bolle", "boller"],
  },

  // --- 10. Frugt og grønt -------------------------------------------------
  // Sidst blandt de snævre: alt forarbejdet er fanget ovenfor, så det der
  // står her, er den friske råvare.
  {
    zone: "Frugt & grønt",
    ord: [
      "agurk",
      "aubergine",
      "avokado",
      "spinat",
      "babyspinat",
      "kartofler",
      "kartoffel",
      "bagekartofler",
      "spisekartofler",
      "basilikum",
      "salat",
      "salathoved",
      "bladselleri",
      "knoldselleri",
      "blomkål",
      "broccoli",
      "champignon",
      "champignons",
      "squash",
      "courgette",
      "zucchini",
      "tomat",
      "tomater",
      "citron",
      "lime",
      "dild",
      "fennikel",
      "gulerod",
      "gulerødder",
      "peberfrugt",
      "snackpeber",
      "grønkål",
      "hvidkål",
      "spidskål",
      "rødkål",
      "kål",
      "bønner",
      "løg",
      "hvidløg",
      "purløg",
      "ingefær",
      "karse",
      "koriander",
      "persille",
      "kruspersille",
      "mynte",
      "oregano",
      "rosmarin",
      "timian",
      "salvie",
      "løvstikke",
      "estragon",
      "porre",
      "pastinak",
      "rødbede",
      "rødbeder",
      "radiser",
      "rucola",
      "majs",
      "majskolber",
      "nektarin",
      "nektariner",
      "abrikoser",
      "æble",
      "æbler",
      "pære",
      "melon",
      "vandmelon",
      "ærter",
      "edamame",
      "mukimame",
      "svampe",
      "portobellosvampe",
      "pak",
      "chili",
      "chilier",
      "mesclun",
      "batavia",
      "romainesalat",
      "hjertesalat",
      "græskar",
      "butternut",
      "asparges",
    ],
    slutter: ["løg", "kål", "salat", "tomater", "svampe"],
    udtryk: [
      /\bfriske\b/,
      /\bfrisk oregano\b/,
      /\bi bælg\b/,
      /\bpå stilk\b/,
      /\bgurkemejerod\b/,
      /\bhelt hvidløg\b/,
    ],
  },
];

/** Små bogstaver, NFC og ét mellemrum. Æ, ø og å bliver stående. */
function normaliser(navn: string): string {
  return navn.toLowerCase().normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * Navnet delt i ord.
 *
 * Bindestreg deler: "bbq-krydderi" skal møde reglen for "krydderi", og
 * "kota-ost" skal møde reglen for "ost".
 */
function ordene(navn: string): string[] {
  return navn.split(/[^\p{L}\p{N}']+/u).filter(Boolean);
}

function rammerOrd(ord: string[], regelord: string[]): boolean {
  return regelord.some((regel) =>
    ord.some((o) => o === regel || (regel.length >= 4 && o.startsWith(regel))),
  );
}

function rammerSlutning(ord: string[], slutninger: string[]): boolean {
  return slutninger.some((slut) =>
    ord.some((o) => o.length > slut.length && o.endsWith(slut)),
  );
}

/** Er det her overhovedet noget man køber? */
export function erKøbevare(navn: string): boolean {
  const rent = normaliser(navn);
  return rent.length > 0 && !IKKE_VARER.has(rent);
}

/** Zonen i Netto. Alt der ikke passer andre steder, er kolonial. */
export function zoneForIngrediens(navn: string): StoreZone {
  const rent = normaliser(navn);
  const ord = ordene(rent);
  if (ord.length === 0) return DEFAULT_STORE_ZONE;

  for (const regel of REGLER) {
    if (regel.udtryk?.some((udtryk) => udtryk.test(rent))) return regel.zone;
    if (regel.ord && rammerOrd(ord, regel.ord)) return regel.zone;
    if (regel.slutter && rammerSlutning(ord, regel.slutter)) return regel.zone;
  }

  return DEFAULT_STORE_ZONE;
}

/** Butikkens rækkefølge. Ét sted, så listen altid sorteres ens. */
export const ZONE_RÆKKEFØLGE = STORE_CATEGORY_ORDER;
