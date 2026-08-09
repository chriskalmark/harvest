/**
 * Eksport af indkøbslisten.
 *
 * Den vigtigste prøve er den første: formatet til Påmindelser må IKKE
 * indeholde overskrifter eller tomme linjer. Apples Påmindelser laver én
 * påmindelse per linje, så "FRUGT & GRØNT" ville blive til en påmindelse
 * man skulle krydse af sammen med agurken.
 */

import assert from "node:assert/strict";
import {
  antalIEksport,
  somTekst,
  tilPåmindelser,
} from "../lib/weekPlan/eksport";
import type { Indkøbsliste, IndkøbsVare } from "../lib/weekPlan/indkoeb";

function vare(
  navn: string,
  mængde: string | null,
  checked = false,
): IndkøbsVare {
  return {
    key: `${navn}::x`,
    navn,
    mængde,
    tilDage: "mandag",
    weekdays: [1],
    checked,
  };
}

const liste: Indkøbsliste = {
  afsnit: [
    {
      zone: "Frugt & grønt",
      varer: [
        vare("agurk", "200 g"),
        vare("basilikum", "1 bundt", true),
        vare("små kartofler", "500 g"),
      ],
    },
    {
      zone: "Kød & fjerkræ",
      varer: [vare("nakkekoteletter", "2 stk")],
    },
  ],
  skabet: [vare("salt & peber", null), vare("olivenolie", null, true)],
  egneRetter: [{ weekday: 5, dayName: "Fredag", title: "Lasagne" }],
  antalVarer: 4,
  antalKlaret: 1,
  antalAftener: 3,
};

// --- 1. Påmindelser: kun varelinjer, intet andet ------------------------
{
  const tekst = tilPåmindelser(liste);
  const linjer = tekst.split("\n");

  assert.deepEqual(linjer, [
    "agurk – 200 g",
    "små kartofler – 500 g",
    "nakkekoteletter – 2 stk",
  ]);

  assert.equal(
    linjer.filter((l) => l.trim() === "").length,
    0,
    "ingen tomme linjer -- de ville blive til tomme påmindelser",
  );
  assert.equal(
    tekst.includes("FRUGT"),
    false,
    "ingen zoneoverskrifter i Påmindelser-formatet",
  );
  assert.equal(
    tekst.includes("basilikum"),
    false,
    "afkrydsede varer skal ikke med",
  );
  assert.equal(tekst.includes("Lasagne"), false, "egne retter er ikke en vare");
  assert.equal(
    tekst.includes("salt"),
    false,
    "skabet er ikke indkøb og kommer ikke med som standard",
  );
}

// --- 2. Alt med, hvis man beder om det ----------------------------------
{
  const alt = tilPåmindelser(liste, { kunManglende: false, medSkabet: true });
  const linjer = alt.split("\n");
  assert.equal(linjer.length, 6, "4 varer + 2 skabsting");
  assert.ok(linjer.includes("basilikum – 1 bundt"), "den afkrydsede kom med");
  assert.ok(linjer.includes("salt & peber"), "skabsting uden mængde");
}

// --- 3. Varer uden mængde får ikke en tom tankestreg --------------------
{
  const uden: Indkøbsliste = {
    ...liste,
    afsnit: [{ zone: "Kolonial", varer: [vare("rasp", null)] }],
    skabet: [],
  };
  assert.equal(tilPåmindelser(uden), "rasp", "ingen ' – ' når mængden mangler");
}

// --- 4. Tom liste giver tom streng, ikke støj ---------------------------
{
  const tom: Indkøbsliste = {
    afsnit: [],
    skabet: [],
    egneRetter: [],
    antalVarer: 0,
    antalKlaret: 0,
    antalAftener: 0,
  };
  assert.equal(tilPåmindelser(tom), "");
  assert.equal(antalIEksport(tom), 0);

  // Alt krydset af er også tomt -- der er intet tilbage at handle.
  const altKlaret: Indkøbsliste = {
    ...tom,
    afsnit: [{ zone: "Kolonial", varer: [vare("rasp", "50 g", true)] }],
  };
  assert.equal(tilPåmindelser(altKlaret), "");
}

// --- 5. Den læsbare form beholder sin struktur --------------------------
{
  const tekst = somTekst(liste, "Uge 34 · 17.–23. august");
  assert.ok(tekst.startsWith("Uge 34 · 17.–23. august"), "ugen står øverst");
  assert.ok(tekst.includes("FRUGT & GRØNT"), "zoner med");
  assert.ok(tekst.includes("- agurk – 200 g"), "varer med bindestreg");
  assert.ok(
    tekst.includes("JERES EGNE RETTER\n- Fredag: Lasagne"),
    "egne retter med -- ellers glemmer man fredag",
  );
  assert.equal(tekst.includes("basilikum"), false, "afkrydset udeladt");

  // Et afsnit hvor ALT er krydset af må ikke stå som en tom overskrift.
  const halvt: Indkøbsliste = {
    ...liste,
    afsnit: [
      { zone: "Frugt & grønt", varer: [vare("agurk", "200 g", true)] },
      { zone: "Kolonial", varer: [vare("rasp", "50 g")] },
    ],
  };
  const halvTekst = somTekst(halvt, "Uge 34");
  assert.equal(
    halvTekst.includes("FRUGT & GRØNT"),
    false,
    "tomt afsnit skrives ikke",
  );
  assert.ok(halvTekst.includes("KOLONIAL"));
}

// --- 6. Tællingen passer med det der eksporteres ------------------------
{
  assert.equal(antalIEksport(liste), 3, "tre varer mangler");
  assert.equal(
    tilPåmindelser(liste).split("\n").length,
    antalIEksport(liste),
    "tallet på knappen skal svare til antal linjer",
  );
  assert.equal(antalIEksport(liste, { medSkabet: true }), 4);
  assert.equal(antalIEksport(liste, { kunManglende: false }), 4);
}

console.log("Eksport: 6 prøver holdt.");
