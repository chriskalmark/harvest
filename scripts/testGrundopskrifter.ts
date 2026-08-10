/**
 * Grundopskrifter: halvfabrikata foldet ud til varer man kan købe.
 *
 * Den fejl der rettes her, var ikke kosmetisk. Indkøbslisten sagde
 * "mørbradgryde – 400 g", og den vare findes ikke i Netto. Man opdagede
 * det først i butikken.
 */

import assert from "node:assert/strict";
import { GRUNDOPSKRIFTER } from "../data/grundopskrifter";
import {
  foldUd,
  grundopskriftFor,
  grundopskrifterI,
  noteFor,
  skalFoldesUd,
} from "../lib/weekPlan/grundopskrifter";
import { byggIndkøbsliste, nøgleNavn, type IndkøbsDag } from "../lib/weekPlan/indkoeb";

function dag(ingrediensnavne: string[], portioner = 2): IndkøbsDag[] {
  const hoved: IndkøbsDag = {
    weekday: 1,
    dayName: "Mandag",
    slotKind: "catalog",
    portions: portioner,
    manualTitle: null,
    recipe: {
      recipeId: 1,
      name: "Prøveret",
      pantryItems: [],
      ingredients: ingrediensnavne.map((name) => ({
        name,
        amounts: [1, 2, 3, 4, 5].map((portions) => ({
          portions,
          amount: 200 * portions,
          unitKey: "g",
        })),
      })),
    },
  };
  const tomme = [2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    dayName: "x",
    slotKind: "empty" as const,
    portions: 2,
    manualTitle: null,
    recipe: null,
  }));
  return [hoved, ...tomme];
}

const navne = (liste: ReturnType<typeof byggIndkøbsliste>) =>
  liste.afsnit.flatMap((a) => a.varer.map((v) => v.navn.toLowerCase()));

// --- 1. Halvfabrikataet forsvinder fra sedlen ---------------------------
{
  const liste = byggIndkøbsliste(dag(["mørbradgryde", "kartofler"]));
  assert.equal(
    navne(liste).includes("mørbradgryde"),
    false,
    "mørbradgryde kan ikke købes og må ikke stå på sedlen",
  );
  assert.ok(navne(liste).includes("svinemørbrad"), "kødet skal frem");
  assert.ok(navne(liste).includes("champignon"));
  assert.ok(navne(liste).includes("kartofler"), "almindelige varer rører vi ikke");
}

// --- 2. Mængderne skalerer med dagens portioner -------------------------
{
  const to = byggIndkøbsliste(dag(["mørbradgryde"], 2));
  const fire = byggIndkøbsliste(dag(["mørbradgryde"], 4));
  const find = (l: ReturnType<typeof byggIndkøbsliste>, n: string) =>
    l.afsnit.flatMap((a) => a.varer).find((v) => v.navn === n);

  assert.equal(find(to, "svinemørbrad")?.mængde, "300 g", "150 g pr. person");
  assert.equal(find(fire, "svinemørbrad")?.mængde, "600 g");
  assert.equal(
    find(to, "løg")?.mængde,
    "1 stk",
    "0,5 stk pr. person, rundet op til hele stykker",
  );
}

// --- 3. Skagenfoods egen mængde bruges IKKE -----------------------------
// Deres "400 g mørbradgryde" siger kun AT retten kræver den, ikke hvad
// der er i den. Ville vi bruge tallet, blev det 400 g svinemørbrad.
{
  const liste = byggIndkøbsliste(dag(["mørbradgryde"], 2));
  const kød = liste.afsnit
    .flatMap((a) => a.varer)
    .find((v) => v.navn === "svinemørbrad");
  assert.equal(kød?.mængde, "300 g", "vores tal, ikke Skagenfoods 400 g");
}

// --- 4. Købe-færdige bliver stående, med en note ------------------------
{
  const liste = byggIndkøbsliste(dag(["bechamelsovs"]));
  const sovs = liste.afsnit
    .flatMap((a) => a.varer)
    .find((v) => v.navn === "bechamelsovs");
  assert.ok(sovs, "bechamelsovs KAN købes og skal blive stående");
  assert.ok(sovs?.note?.includes("køl"), "noten skal sige hvor den står");
  assert.equal(skalFoldesUd("bechamelsovs"), false);
}

// --- 5. Zonen må ikke modsige noten -------------------------------------
// Uden dette stod bechamelsovs under Kolonial, mens noten sagde "på køl".
{
  const liste = byggIndkøbsliste(dag(["bechamelsovs"]));
  const afsnit = liste.afsnit.find((a) =>
    a.varer.some((v) => v.navn === "bechamelsovs"),
  );
  assert.equal(afsnit?.zone, "Køl", "noten siger køl, så zonen skal sige køl");
}

// --- 6. To retter der deler en grundopskrift lægges sammen --------------
{
  const to: IndkøbsDag[] = [
    dag(["marokkanske kødboller"])[0],
    { ...dag(["marokkanske kødboller"])[0], weekday: 3, dayName: "Onsdag" },
    ...[2, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      dayName: "x",
      slotKind: "empty" as const,
      portions: 2,
      manualTitle: null,
      recipe: null,
    })),
  ];
  const liste = byggIndkøbsliste(to);
  const kød = liste.afsnit
    .flatMap((a) => a.varer)
    .find((v) => v.navn === "hakket oksekød");
  assert.equal(kød?.mængde, "500 g", "125 g × 2 personer × 2 aftener");
  assert.equal(kød?.tilDage, "mandag og onsdag");
}

// --- 7. Alle navne matcher normaliseringen ------------------------------
// Ellers ville en grundopskrift ligge i filen uden nogensinde at blive brugt.
{
  for (const opskrift of GRUNDOPSKRIFTER) {
    assert.equal(
      nøgleNavn(opskrift.navn),
      opskrift.navn,
      `"${opskrift.navn}" er ikke skrevet på normaliseret form og vil aldrig blive fundet`,
    );
    assert.ok(
      grundopskriftFor(opskrift.navn),
      `${opskrift.navn} kan ikke slås op`,
    );
    if (opskrift.slags === "lav-selv") {
      assert.ok(
        opskrift.ingredienser.length > 0,
        `${opskrift.navn} skal foldes ud, men har ingen ingredienser`,
      );
    }
    assert.ok(
      opskrift.fremgangsmåde.length > 0,
      `${opskrift.navn} mangler en fremgangsmåde`,
    );
  }
}

// --- 8. Ukendte navne røres ikke ----------------------------------------
{
  assert.equal(grundopskriftFor("agurk"), null);
  assert.equal(skalFoldesUd("agurk"), false);
  assert.equal(noteFor("agurk"), null);
  assert.deepEqual(foldUd("agurk", 2), []);
  assert.deepEqual(foldUd("mørbradgryde", 0), [], "nul personer giver intet");
}

// --- 9. Opskriftsvisningen kan finde dem ---------------------------------
{
  const fundne = grundopskrifterI([
    "mørbradgryde",
    "Kartofler",
    "bechamelsovs",
    "mørbradgryde",
  ]);
  assert.equal(fundne.length, 2, "dubletter tælles én gang");
  assert.deepEqual(
    fundne.map((o) => o.navn).sort(),
    ["bechamelsovs", "mørbradgryde"],
  );
}

console.log(
  `Grundopskrifter: 9 prøver holdt (${GRUNDOPSKRIFTER.length} opskrifter).`,
);
