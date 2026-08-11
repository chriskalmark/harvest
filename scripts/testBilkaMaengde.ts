/**
 * Antal pakker ud fra pakkestørrelsen i produktnavnet.
 *
 * Den vigtigste prøve er nummer 3. Uden den blev "2 stk nakkekoteletter" til
 * TO bakker af "Nakkekoteletter 3,2-3,4 kg" -- 6,4 kilo svinekød i kurven.
 */

import assert from "node:assert/strict";
import {
  antalPakker,
  behovFraTekst,
  pakkestørrelse,
} from "../lib/bilkatogo/maengde";

// --- 1. Pakkestørrelsen læses af navnet ---------------------------------
assert.deepEqual(pakkestørrelse("Salling Bagekartofler 1,5 kg"), {
  tal: 1.5,
  enhed: "kg",
});
assert.deepEqual(pakkestørrelse("Saltet smør 200g"), { tal: 200, enhed: "g" });
assert.deepEqual(pakkestørrelse("Skrabeæg M/L 10 stk."), {
  tal: 10,
  enhed: "stk",
});
assert.equal(pakkestørrelse("Agurk"), null, "ingen størrelse i navnet");

// Fedtprocenten er ikke en pakkestørrelse.
assert.deepEqual(
  pakkestørrelse("Arla Letmælk 1,5% fedt 1 l"),
  { tal: 1, enhed: "l" },
  "1,5% må ikke læses som pakken",
);
assert.equal(
  pakkestørrelse("Letmælk 1,5% fedt"),
  null,
  "kun en fedtprocent er ingen pakkestørrelse",
);

// --- 2. Vægt regnes om til pakker ---------------------------------------
assert.equal(antalPakker("500 g", "Bagekartofler 1,5 kg").antal, 1);
assert.equal(
  antalPakker("1,5 kg", "Kartofler 1 kg").antal,
  2,
  "halvanden kilo kræver to poser af én",
);
assert.equal(antalPakker("2 kg", "Kartofler 1 kg").antal, 2);
assert.equal(
  antalPakker("2,1 kg", "Kartofler 1 kg").antal,
  3,
  "der rundes OP -- man kan ikke købe en tiendedel pose",
);
assert.equal(antalPakker("30 g", "Saltet smør 200g").antal, 1);

// --- 3. "stk" ganges KUN op når varen sælges styksvis -------------------
{
  const bakke = antalPakker("2 stk", "Nakkekoteletter 3,2-3,4 kg");
  assert.equal(
    bakke.antal,
    1,
    "to koteletter er IKKE to bakker af 3,2 kg -- det var 6,4 kg kød",
  );
  assert.match(bakke.begrundelse, /rummer flere/);

  assert.equal(
    antalPakker("2 stk", "Salling Agurk").antal,
    2,
    "uden pakkestørrelse er behovet antallet",
  );
  assert.equal(
    antalPakker("10 stk", "Skrabeæg M/L 10 stk.").antal,
    1,
    "ti æg er én bakke med ti",
  );
  assert.equal(antalPakker("12 stk", "Skrabeæg M/L 10 stk.").antal, 2);
  assert.equal(antalPakker("4 stk", "Skrabeæg M/L 10 stk.").antal, 1);
}

// --- 4. Uomregnelige enheder giver et ærligt 1 --------------------------
for (const [behov, navn] of [
  ["4 fed", "Salling Hvidløg 200 g"],
  ["2 tsk", "Dijon Sennep 370 g"],
  ["1 bundt", "Rosmarin"],
] as [string, string][]) {
  const r = antalPakker(behov, navn);
  assert.equal(r.antal, 1, `${behov} skal give 1`);
  assert.ok(r.begrundelse.length > 0, "og sige hvorfor");
}

// --- 5. Modstridende enheder gætter ikke --------------------------------
{
  const r = antalPakker("1 dl", "Salling Grøntsagsbouillon 100 g");
  assert.equal(r.antal, 1, "dl mod g kan ikke sammenlignes");
  assert.match(r.begrundelse, /pakken er 100 g/);
}

// --- 6. Loftet fanger et regnestykke der løber løbsk --------------------
assert.equal(
  antalPakker("5 kg", "Gær 0,5 g").antal,
  12,
  "et vildt regnestykke skal stoppe ved 12, ikke lægge 10.000 i kurven",
);

// --- 7. Ingen mængde, intet gæt -----------------------------------------
assert.equal(antalPakker(undefined, "Agurk").antal, 1);
assert.equal(antalPakker("", "Agurk").antal, 1);
assert.equal(behovFraTekst(undefined), null);
assert.deepEqual(behovFraTekst("2"), { tal: 2, enhed: "stk" });

console.log("Bilka-mængder: 7 prøvegrupper holdt.");
