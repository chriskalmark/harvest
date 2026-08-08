/**
 * Indkøbslisten udledt af ugeplanen.
 *
 * Prøverne er bygget over rigtige Skagenfood-tal: mængderne til 1-5 personer
 * ligger i deres data, og en enkelt aften kan kræve et halvt bundt basilikum.
 */

import assert from "node:assert/strict";
import {
  byggIndkøbsliste,
  nøgleNavn,
  type IndkøbsDag,
} from "../lib/weekPlan/indkoeb";
import { indkøbHeadline, indkøbSummary } from "../lib/weekPlan/indkoebView";

const DAGSNAVNE = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
];

function tom(weekday: number): IndkøbsDag {
  return {
    weekday,
    dayName: DAGSNAVNE[weekday - 1],
    slotKind: "empty",
    portions: 2,
    manualTitle: null,
    recipe: null,
  };
}

function ret(
  weekday: number,
  navn: string,
  ingredienser: [string, number, string | null][],
  portioner = 2,
  skabet: string[] = [],
): IndkøbsDag {
  return {
    weekday,
    dayName: DAGSNAVNE[weekday - 1],
    slotKind: "catalog",
    portions: portioner,
    manualTitle: null,
    recipe: {
      recipeId: 1000 + weekday,
      name: navn,
      pantryItems: skabet,
      ingredients: ingredienser.map(([name, perPerson, unitKey]) => ({
        name,
        // Som Skagenfood: én række per portionsantal, ikke én der ganges.
        amounts: [1, 2, 3, 4, 5].map((portions) => ({
          portions,
          amount: perPerson * portions,
          unitKey,
        })),
      })),
    },
  };
}

function egen(weekday: number, title: string): IndkøbsDag {
  return {
    weekday,
    dayName: DAGSNAVNE[weekday - 1],
    slotKind: "manual",
    portions: 2,
    manualTitle: title,
    recipe: null,
  };
}

function find(liste: ReturnType<typeof byggIndkøbsliste>, navn: string) {
  return liste.afsnit
    .flatMap((a) => a.varer)
    .find((v) => v.navn.toLowerCase() === navn.toLowerCase());
}

// --- 1. Tom uge giver tom liste -----------------------------------------
{
  const liste = byggIndkøbsliste([1, 2, 3, 4, 5, 6, 7].map(tom));
  assert.equal(liste.afsnit.length, 0, "tom uge må ikke give afsnit");
  assert.equal(liste.antalVarer, 0);
  assert.equal(liste.antalAftener, 0);
  assert.equal(liste.egneRetter.length, 0);
}

// --- 2. Én ret: mængden læses, den ganges ikke ---------------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "Kylling", [
      ["kyllingebryst", 1, "stk"],
      ["små kartofler", 250, "g"],
    ]),
    ...[2, 3, 4, 5, 6, 7].map(tom),
  ]);

  assert.equal(liste.antalAftener, 1);
  assert.equal(find(liste, "kyllingebryst")?.mængde, "2 stk", "2 personer");
  assert.equal(find(liste, "små kartofler")?.mængde, "500 g");
  assert.equal(find(liste, "små kartofler")?.tilDage, "mandag");
}

// --- 3. Ugens rækkefølge er butikkens, ikke opskriftens ------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "Alt muligt", [
      ["spaghetti", 100, "g"],
      ["kyllingebryst", 1, "stk"],
      ["rugbrød", 1, "stk"],
      ["agurk", 1, "stk"],
      ["sødmælk", 100, "ml"],
    ]),
    ...[2, 3, 4, 5, 6, 7].map(tom),
  ]);

  assert.deepEqual(
    liste.afsnit.map((a) => a.zone),
    ["Frugt & grønt", "Brød", "Køl", "Kød & fjerkræ", "Kolonial"],
    "afsnittene skal komme i butikkens rækkefølge",
  );
}

// --- 4. To aftener lægges sammen ----------------------------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "Mandagsret", [["små kartofler", 250, "g"]]),
    ret(4, "Torsdagsret", [["små kartofler", 150, "g"]]),
    ...[2, 3, 5, 6, 7].map(tom),
  ]);

  const kartofler = find(liste, "små kartofler");
  assert.equal(kartofler?.mængde, "800 g", "500 g + 300 g");
  assert.equal(kartofler?.tilDage, "mandag og torsdag");
  assert.deepEqual(kartofler?.weekdays, [1, 4]);
  assert.equal(liste.antalVarer, 1, "samme vare må kun stå én gang");
}

// --- 5. Tre aftener: dagene skrives med og og komma ----------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "A", [["hvidløg", 1, "fed"]]),
    ret(3, "B", [["hvidløg", 1, "fed"]]),
    ret(7, "C", [["hvidløg", 1, "fed"]]),
    ...[2, 4, 5, 6].map(tom),
  ]);
  assert.equal(find(liste, "hvidløg")?.tilDage, "mandag, onsdag og søndag");
  assert.equal(find(liste, "hvidløg")?.mængde, "6 fed");
}

// --- 6. Halve stykvarer rundes op EFTER sammenlægning --------------------
// Et halvt bundt basilikum findes ikke. To halve er ét helt.
{
  const énAften = byggIndkøbsliste([
    ret(1, "A", [["basilikum", 0.25, "bundt"]]),
    ...[2, 3, 4, 5, 6, 7].map(tom),
  ]);
  assert.equal(
    find(énAften, "basilikum")?.mængde,
    "1 bundt",
    "0,5 bundt skal rundes op til 1",
  );

  const toAftener = byggIndkøbsliste([
    ret(1, "A", [["basilikum", 0.25, "bundt"]]),
    ret(2, "B", [["basilikum", 0.25, "bundt"]]),
    ...[3, 4, 5, 6, 7].map(tom),
  ]);
  assert.equal(
    find(toAftener, "basilikum")?.mængde,
    "1 bundt",
    "to halve bundter er ét -- ikke to",
  );
}

// --- 7. Store mængder skrives som man køber dem --------------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "A", [
      ["kartofler", 400, "g"],
      ["sødmælk", 300, "ml"],
      ["fløde", 3, "dl"],
    ]),
    ret(2, "B", [
      ["kartofler", 400, "g"],
      ["sødmælk", 300, "ml"],
      ["fløde", 3, "dl"],
    ]),
    ...[3, 4, 5, 6, 7].map(tom),
  ]);

  assert.equal(find(liste, "kartofler")?.mængde, "1,6 kg", "1600 g → kg");
  assert.equal(find(liste, "sødmælk")?.mængde, "1,2 l", "1200 ml → l");
  assert.equal(find(liste, "fløde")?.mængde, "1,2 l", "12 dl → l");
}

// --- 8. Samme vare i to enheder blandes ikke sammen ----------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "A", [["tomater", 200, "g"]]),
    ret(2, "B", [["tomater", 1, "stk"]]),
    ...[3, 4, 5, 6, 7].map(tom),
  ]);
  assert.equal(liste.antalVarer, 2, "400 g og 2 stk er ikke det samme");
}

// --- 9. Portionsantallet følger dagen, ikke ugen ------------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "To personer", [["ris", 75, "g"]], 2),
    ret(2, "Fire personer", [["ris", 75, "g"]], 4),
    ...[3, 4, 5, 6, 7].map(tom),
  ]);
  assert.equal(find(liste, "ris")?.mængde, "450 g", "150 g + 300 g");
}

// --- 10. Portionsantal uden egen række skaleres -------------------------
{
  const dag = ret(1, "Otte personer", [["ris", 75, "g"]], 8);
  const liste = byggIndkøbsliste([dag, ...[2, 3, 4, 5, 6, 7].map(tom)]);
  assert.equal(
    find(liste, "ris")?.mængde,
    "600 g",
    "8 personer findes ikke i tabellen og skaleres fra én person",
  );
}

// --- 11. Vand kommer ikke på sedlen -------------------------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "A", [
      ["vand", 500, "ml"],
      ["kogende vand", 1, "l"],
      ["ris", 75, "g"],
    ]),
    ...[2, 3, 4, 5, 6, 7].map(tom),
  ]);
  assert.equal(liste.antalVarer, 1, "kun risene skal købes");
  assert.equal(find(liste, "ris")?.mængde, "150 g");
}

// --- 12. Egne retter står for sig -- de har ingen ingredienser ----------
{
  const liste = byggIndkøbsliste([
    ret(1, "Kylling", [["kyllingebryst", 1, "stk"]]),
    egen(5, "Lasagne"),
    ...[2, 3, 4, 6, 7].map(tom),
  ]);

  assert.equal(liste.antalAftener, 2, "en egen ret er også en planlagt aften");
  assert.deepEqual(liste.egneRetter, [
    { weekday: 5, dayName: "Fredag", title: "Lasagne" },
  ]);
  assert.equal(liste.antalVarer, 1, "lasagne må ikke blive til en vare");
}

// --- 13. Skabet er en huskeliste, ikke en indkøbsseddel -----------------
{
  const liste = byggIndkøbsliste([
    ret(1, "A", [["ris", 75, "g"]], 2, ["Olie", "Salt og peber"]),
    ret(2, "B", [["ris", 75, "g"]], 2, ["Olie"]),
    ...[3, 4, 5, 6, 7].map(tom),
  ]);

  assert.equal(liste.skabet.length, 2, "olie må kun stå én gang");
  assert.deepEqual(liste.skabet.map((v) => v.navn).sort(), [
    "Olie",
    "Salt og peber",
  ]);
  assert.equal(liste.skabet[0].mængde, null, "skabsting har ingen mængde");
  assert.equal(
    liste.afsnit.flatMap((a) => a.varer).some((v) => v.navn === "Olie"),
    false,
    "skabsting må ikke stå blandt varerne",
  );
}

// --- 14. Afkrydsninger overlever at listen regnes forfra ----------------
{
  const dage: IndkøbsDag[] = [
    ret(1, "A", [
      ["ris", 75, "g"],
      ["agurk", 1, "stk"],
    ]),
    ...[2, 3, 4, 5, 6, 7].map(tom),
  ];

  const førstegang = byggIndkøbsliste(dage);
  const risNøgle = find(førstegang, "ris")!.key;

  const andengang = byggIndkøbsliste(dage, new Set([risNøgle]));
  assert.equal(find(andengang, "ris")?.checked, true);
  assert.equal(find(andengang, "agurk")?.checked, false);
  assert.equal(andengang.antalKlaret, 1);
  assert.equal(andengang.antalVarer, 2);
}

// --- 15. Nøglen ændrer sig ikke når en ret lægges til --------------------
// Ellers ville afkrydsningerne falde af hver gang ugen redigeres.
{
  const mandag = ret(1, "A", [["små kartofler", 250, "g"]]);
  const torsdag = ret(4, "B", [["små kartofler", 150, "g"]]);

  const før = byggIndkøbsliste([mandag, ...[2, 3, 4, 5, 6, 7].map(tom)]);
  const efter = byggIndkøbsliste([
    mandag,
    torsdag,
    ...[2, 3, 5, 6, 7].map(tom),
  ]);

  assert.equal(
    find(før, "små kartofler")!.key,
    find(efter, "små kartofler")!.key,
    "nøglen skal være den samme før og efter",
  );
}

// --- 16. Danske tegn overlever normaliseringen --------------------------
{
  assert.equal(nøgleNavn("Rødløg"), "rødløg");
  assert.equal(nøgleNavn("Müsli"), "müsli", "accenter må ikke ædes");
  assert.equal(nøgleNavn("Fløde 38% (piskefløde)"), "fløde 38");
  assert.equal(nøgleNavn("  gulerødder,  revet "), "gulerødder revet");
}

// --- 17. Varer står alfabetisk i deres afsnit ---------------------------
{
  const liste = byggIndkøbsliste([
    ret(1, "A", [
      ["ærter", 100, "g"],
      ["agurk", 1, "stk"],
      ["østers", 2, "stk"],
      ["blomkål", 1, "stk"],
    ]),
    ...[2, 3, 4, 5, 6, 7].map(tom),
  ]);

  const grønt = liste.afsnit.find((a) => a.zone === "Frugt & grønt");
  assert.deepEqual(
    grønt?.varer.map((v) => v.navn),
    ["agurk", "blomkål", "ærter"],
    "dansk sortering: æ kommer efter z, ikke efter a",
  );
}

// --- 17b. Samme ting står ikke både på sedlen og i skabet ---------------
// Skagenfood skriver olivenolie som ingrediens med mængde i én opskrift og
// under "du skal selv have" i en anden. To linjer får den ene glemt.
{
  const liste = byggIndkøbsliste([
    ret(1, "A", [["olivenolie, EVOO", 1, "spsk"]], 2, ["Salt & peber"]),
    ret(2, "B", [["ris", 75, "g"]], 2, ["Olivenolie, EVOO", "Salt & peber"]),
    ...[3, 4, 5, 6, 7].map(tom),
  ]);

  assert.equal(
    find(liste, "olivenolie, EVOO")?.mængde,
    "2 spsk",
    "olien har en mængde og hører på sedlen",
  );
  assert.deepEqual(
    liste.skabet.map((v) => v.navn),
    ["Salt & peber"],
    "olien må ikke også stå i skabet",
  );
}

// --- 18. Overskriften siger sandheden om ugen ---------------------------
{
  assert.deepEqual(indkøbHeadline(0, 0, 0), {
    line1: "Ingen retter",
    line2: "på ugen endnu.",
  });
  assert.deepEqual(indkøbHeadline(0, 0, 3), {
    line1: "Ingen varer",
    line2: "at hente.",
  });
  assert.deepEqual(indkøbHeadline(12, 0, 3), {
    line1: "12 varer",
    line2: "at hente.",
  });
  assert.deepEqual(indkøbHeadline(12, 12, 3), {
    line1: "Alt er",
    line2: "i kurven.",
  });
  assert.deepEqual(indkøbHeadline(12, 9, 3), {
    line1: "Tre varer",
    line2: "tilbage.",
  });
  assert.deepEqual(
    indkøbHeadline(12, 11, 3),
    { line1: "Én vare", line2: "tilbage." },
    "én vare, ikke én varer",
  );
  assert.deepEqual(
    indkøbHeadline(30, 5, 5),
    { line1: "25 varer", line2: "tilbage." },
    "over syv skrives med tal",
  );
}

// --- 19. Underlinjen tæller i tal ---------------------------------------
{
  assert.equal(
    indkøbSummary(0, 0, 0),
    "Læg retter på ugeplanen, så står varerne her",
  );
  assert.equal(indkøbSummary(0, 0, 1), "1 aften planlagt");
  assert.equal(indkøbSummary(23, 5, 4), "5 af 23 varer · 4 aftener");
}

console.log("Indkøbsliste: 20 prøver holdt.");
