import { STORE_CATEGORY_ORDER, type StoreZone } from "@/lib/constants";
import { erKøbevare, zoneForIngrediens } from "@/lib/weekPlan/zoner";

/**
 * Fra ugeplan til indkøbsliste.
 *
 * Listen GEMMES IKKE. Den regnes ud hver gang den læses, af de retter der
 * ligger på ugen lige nu. Lægger man en ret på torsdag, står varerne der
 * med det samme; fjerner man den igen, forsvinder de. Der findes derfor
 * ingen tilstand at holde i sync, og listen kan aldrig komme til at vise
 * varer til en ret man har droppet.
 *
 * Kun afkrydsningerne gemmes -- se week_plan_shopping_checks. De hænger på
 * en nøgle af navn og enhed, så de overlever at listen regnes forfra.
 *
 * To ting er værd at vide om Skagenfoods tal:
 *
 *   1. De leverer selv mængder til 1, 2, 3, 4 og 5 personer. Der ganges
 *      derfor ikke -- den rigtige række slås op. Deres egne tal er pænere
 *      end vores gangning ville være ("1 stk" i stedet for "0,67 stk").
 *   2. En enkelt aften kan kræve "0,5 bundt basilikum". Man kan ikke købe
 *      et halvt bundt, så stykvarer rundes OP til sidst -- efter at ugens
 *      aftener er lagt sammen, så to halve bundter bliver til ét.
 */

/** Enheder hvor en brøkdel ikke kan lægges i en indkøbskurv. */
const STYKVARER = new Set([
  "stk",
  "bakke",
  "bundt",
  "bæger",
  "bøtte",
  "dåse",
  "fed",
  "glas",
  "kviste",
  "pakke",
  "pose",
  "skive",
  "stængel",
]);

/** Skagenfood skriver både "stk" og "stykke". Det er den samme vare. */
const ENHEDSNAVNE: Record<string, string> = {
  stykke: "stk",
  stykker: "stk",
  kvist: "kviste",
  fed: "fed",
};

export interface KatalogMængde {
  portions: number;
  amount: number;
  unitKey: string | null;
}

export interface KatalogIngrediens {
  name: string;
  amounts: KatalogMængde[];
}

export interface IndkøbsOpskrift {
  recipeId: number;
  name: string;
  ingredients: KatalogIngrediens[];
  /** "Du skal selv have" -- ting kassen ikke indeholder. */
  pantryItems: string[];
}

export interface IndkøbsDag {
  weekday: number;
  dayName: string;
  slotKind: "empty" | "catalog" | "manual";
  portions: number;
  manualTitle: string | null;
  recipe: IndkøbsOpskrift | null;
}

export interface IndkøbsVare {
  /** Stabil nøgle. Afkrydsninger hænger på den, så den må ikke ændre sig. */
  key: string;
  navn: string;
  mængde: string | null;
  /** Ugedagene varen skal bruges på, fx "mandag og torsdag". */
  tilDage: string;
  weekdays: number[];
  checked: boolean;
}

export interface IndkøbsAfsnit {
  zone: StoreZone;
  varer: IndkøbsVare[];
}

export interface Indkøbsliste {
  afsnit: IndkøbsAfsnit[];
  /** Ting man selv skal have -- salt, olie, peber. Tjekkes i skabet. */
  skabet: IndkøbsVare[];
  /** Aftener med en selvskrevet ret. De har ingen ingredienser. */
  egneRetter: { weekday: number; dayName: string; title: string }[];
  antalVarer: number;
  antalKlaret: number;
  /** Aftener der tæller med i listen. */
  antalAftener: number;
}

/** Navnet som varen slås sammen på. Danske tegn skal overleve. */
export function nøgleNavn(navn: string): string {
  return navn
    .toLowerCase()
    .normalize("NFC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function enhedsNavn(unitKey: string | null): string {
  if (!unitKey) return "";
  const rent = unitKey.toLowerCase().trim();
  return ENHEDSNAVNE[rent] ?? rent;
}

/**
 * Mængden til det ønskede antal personer.
 *
 * Findes rækken, bruges den som den er. Ellers skaleres der fra den række
 * der ligger tættest på -- og helst fra én person, fordi den ganger rent.
 */
function mængdeTilPortioner(
  amounts: KatalogMængde[],
  portioner: number,
): { amount: number; unitKey: string | null } | null {
  const brugbare = amounts.filter(
    (a) => Number.isFinite(a.amount) && a.amount > 0 && a.portions > 0,
  );
  if (brugbare.length === 0) return null;

  const præcis = brugbare.find((a) => a.portions === portioner);
  if (præcis) return { amount: præcis.amount, unitKey: præcis.unitKey };

  const enPerson = brugbare.find((a) => a.portions === 1);
  const grundlag =
    enPerson ??
    brugbare.reduce((bedst, a) =>
      Math.abs(a.portions - portioner) < Math.abs(bedst.portions - portioner)
        ? a
        : bedst,
    );

  return {
    amount: (grundlag.amount / grundlag.portions) * portioner,
    unitKey: grundlag.unitKey,
  };
}

/** Dansk tal: komma, og ingen ",0" hængende bagefter. */
function dansk(tal: number): string {
  const rundet = Math.round(tal * 100) / 100;
  return String(rundet).replace(".", ",");
}

/**
 * Mængden som den skal stå på sedlen.
 *
 * 1500 g bliver til 1,5 kg -- man går ikke i Netto og leder efter 1500 gram.
 * Stykvarer rundes op: et halvt bundt basilikum findes ikke på hylden.
 */
function formatérMængde(amount: number, enhed: string): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";

  if (STYKVARER.has(enhed)) {
    const hele = Math.max(1, Math.ceil(Number(amount.toFixed(6))));
    return `${hele} ${enhed}`;
  }

  if (enhed === "g" && amount >= 1000) return `${dansk(amount / 1000)} kg`;
  if (enhed === "ml" && amount >= 1000) return `${dansk(amount / 1000)} l`;
  if (enhed === "dl" && amount >= 10) return `${dansk(amount / 10)} l`;

  const rundet = enhed === "g" || enhed === "ml" ? Math.round(amount) : amount;
  return enhed ? `${dansk(rundet)} ${enhed}` : dansk(rundet);
}

/**
 * "mandag", "mandag og torsdag", "mandag, torsdag og søndag".
 *
 * Står der to varer af samme slags, vil man vide hvilke aftener de dækker --
 * ellers kan man ikke skære listen ned ved at droppe én ret.
 */
function dageTekst(dagsnavne: string[]): string {
  const unikke = Array.from(new Set(dagsnavne.map((d) => d.toLowerCase())));
  if (unikke.length === 0) return "";
  if (unikke.length === 1) return unikke[0];
  return `${unikke.slice(0, -1).join(", ")} og ${unikke[unikke.length - 1]}`;
}

interface Samlet {
  key: string;
  visningsnavn: string;
  amount: number;
  enhed: string;
  zone: StoreZone;
  weekdays: number[];
  dagsnavne: string[];
}

/**
 * Ugens indkøbsliste.
 *
 * `afkrydsede` er nøglerne på de varer der allerede er lagt i kurven.
 */
export function byggIndkøbsliste(
  dage: IndkøbsDag[],
  afkrydsede: ReadonlySet<string> = new Set(),
): Indkøbsliste {
  const samlet = new Map<string, Samlet>();
  const skabsting = new Map<string, Samlet>();
  const egneRetter: Indkøbsliste["egneRetter"] = [];
  let antalAftener = 0;

  for (const dag of dage) {
    if (dag.slotKind === "manual" && dag.manualTitle) {
      egneRetter.push({
        weekday: dag.weekday,
        dayName: dag.dayName,
        title: dag.manualTitle,
      });
      antalAftener += 1;
      continue;
    }

    if (dag.slotKind !== "catalog" || !dag.recipe) continue;
    antalAftener += 1;

    for (const ingrediens of dag.recipe.ingredients) {
      if (!erKøbevare(ingrediens.name)) continue;

      const mængde = mængdeTilPortioner(ingrediens.amounts, dag.portions);
      if (!mængde) continue;

      const enhed = enhedsNavn(mængde.unitKey);
      const navn = nøgleNavn(ingrediens.name);
      if (!navn) continue;

      læg(
        samlet,
        `${navn}::${enhed}`,
        ingrediens.name,
        mængde.amount,
        enhed,
        dag,
      );
    }

    // "Du skal selv have" står uden mængde -- det er en huskeliste, ikke
    // en indkøbsseddel, og den skal ikke blandes sammen med varerne.
    for (const ting of dag.recipe.pantryItems) {
      if (!erKøbevare(ting)) continue;
      const navn = nøgleNavn(ting);
      if (!navn) continue;
      læg(skabsting, `skab::${navn}`, ting, 0, "", dag);
    }
  }

  const afsnit = byggAfsnit(samlet, afkrydsede);

  // Skagenfood skriver nogle ting begge steder: olivenolie står som
  // ingrediens MED mængde i én opskrift og under "du skal selv have" i en
  // anden. Står den på indkøbssedlen, skal den ikke også stå i skabet --
  // to linjer om det samme får én af dem til at blive glemt.
  const påSedlen = new Set(
    Array.from(samlet.values()).map((vare) => nøgleNavn(vare.visningsnavn)),
  );
  const skabet = tilVarer(
    Array.from(skabsting.values()).filter(
      (ting) => !påSedlen.has(nøgleNavn(ting.visningsnavn)),
    ),
    afkrydsede,
  );

  const alleVarer = afsnit.flatMap((a) => a.varer);
  return {
    afsnit,
    skabet,
    egneRetter,
    antalVarer: alleVarer.length,
    antalKlaret: alleVarer.filter((v) => v.checked).length,
    antalAftener,
  };
}

function læg(
  kort: Map<string, Samlet>,
  key: string,
  visningsnavn: string,
  amount: number,
  enhed: string,
  dag: IndkøbsDag,
) {
  const eksisterende = kort.get(key);
  if (eksisterende) {
    eksisterende.amount += amount;
    if (!eksisterende.weekdays.includes(dag.weekday)) {
      eksisterende.weekdays.push(dag.weekday);
      eksisterende.dagsnavne.push(dag.dayName);
    }
    return;
  }

  kort.set(key, {
    key,
    // Første forekomst vinder. Bevidst og forudsigeligt: prisen er ét
    // navn der staves som mandagens opskrift, ikke en manglende vare.
    visningsnavn: visningsnavn.trim(),
    amount,
    enhed,
    zone: zoneForIngrediens(visningsnavn),
    weekdays: [dag.weekday],
    dagsnavne: [dag.dayName],
  });
}

function byggAfsnit(
  samlet: Map<string, Samlet>,
  afkrydsede: ReadonlySet<string>,
): IndkøbsAfsnit[] {
  const efterZone = new Map<StoreZone, Samlet[]>();

  for (const vare of samlet.values()) {
    const liste = efterZone.get(vare.zone);
    if (liste) liste.push(vare);
    else efterZone.set(vare.zone, [vare]);
  }

  return STORE_CATEGORY_ORDER.map((zone) => ({
    zone,
    varer: tilVarer(efterZone.get(zone) ?? [], afkrydsede),
  })).filter((afsnit) => afsnit.varer.length > 0);
}

function tilVarer(
  varer: Samlet[],
  afkrydsede: ReadonlySet<string>,
): IndkøbsVare[] {
  return varer
    .slice()
    .sort((a, b) => a.visningsnavn.localeCompare(b.visningsnavn, "da"))
    .map((vare) => ({
      key: vare.key,
      navn: vare.visningsnavn,
      mængde: vare.amount > 0 ? formatérMængde(vare.amount, vare.enhed) : null,
      tilDage: dageTekst(vare.dagsnavne),
      weekdays: vare.weekdays.slice().sort((a, b) => a - b),
      checked: afkrydsede.has(vare.key),
    }));
}
