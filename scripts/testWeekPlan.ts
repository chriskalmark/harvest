import assert from "node:assert/strict";
import {
  addDays,
  buildWeekPlan,
  DAYS_IN_WEEK,
  DEFAULT_PORTIONS,
  isDateOnly,
  isoWeekdayOf,
  MAX_PORTIONS,
  mondayOf,
  normalizeManualTitle,
  normalizeNote,
  normalizeWeekStart,
  optionalPortions,
  parseDateOnly,
  requireMonday,
  requirePortions,
  requireRecipeId,
  requireWeekday,
  slotTitle,
  weekDates,
  weekLabel,
  WeekPlanError,
  WEEKDAY_NAMES,
} from "../lib/weekPlan/week";
import { resolveImportWeek } from "../lib/weekPlan/importSelection";
import type {
  WeekPlanDayRow,
  WeekPlanRecipeSummary,
} from "../lib/weekPlan/types";

/**
 * Test af ugeplanlæggerens datamodel.
 *
 * Alt herinde er rent -- ingen database, intet netværk. Det der testes er de
 * fire løfter datamodellen giver:
 *
 *   1. En uge er mandag til søndag og identificeres af mandagens dato.
 *   2. Der er ALTID præcis syv dagspladser, også når basen har færre rækker.
 *   3. En dagsplads er tom, en katalogopskrift eller en selvskrevet ret --
 *      aldrig noget midt imellem.
 *   4. Portionsantallet er per dag og er 2 når intet andet er sagt.
 */

function fejler(fn: () => unknown, delAfBesked: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(
      error instanceof WeekPlanError,
      `Forventede WeekPlanError, fik ${String(error)}`,
    );
    assert.ok(
      error.message.includes(delAfBesked),
      `Beskeden "${error.message}" nævner ikke "${delAfBesked}".`,
    );
    return true;
  });
}

// ---------------------------------------------------------------------------
// Datoer: mandag er ugens identitet
// ---------------------------------------------------------------------------

assert.equal(isDateOnly("2026-08-03"), true);
assert.equal(isDateOnly("2026-8-3"), false);
assert.equal(isDateOnly("2026-02-30"), false, "30. februar findes ikke");
assert.equal(isDateOnly("2026-13-01"), false);
assert.equal(isDateOnly(42), false);

// 3. august 2026 er en mandag. Hele testen hviler på det ankerpunkt.
assert.equal(isoWeekdayOf("2026-08-03"), 1);
assert.equal(isoWeekdayOf("2026-08-09"), 7, "søndag er dag 7, ikke dag 0");
assert.equal(WEEKDAY_NAMES[0], "Mandag");
assert.equal(WEEKDAY_NAMES[6], "Søndag");
assert.equal(WEEKDAY_NAMES.length, DAYS_IN_WEEK);

// Enhver dag i ugen peger på den samme mandag.
for (let offset = 0; offset < DAYS_IN_WEEK; offset += 1) {
  assert.equal(mondayOf(addDays("2026-08-03", offset)), "2026-08-03");
}
// Søndag hører til ugen der begyndte om mandagen -- ikke til ugen efter.
assert.equal(mondayOf("2026-08-09"), "2026-08-03");
assert.equal(mondayOf("2026-08-10"), "2026-08-10");

// Månedsskifte og årsskifte må ikke tabe en dag.
assert.equal(addDays("2026-08-31", 1), "2026-09-01");
assert.equal(addDays("2026-12-31", 1), "2027-01-01");
assert.equal(addDays("2026-01-01", -1), "2025-12-31");
assert.equal(mondayOf("2027-01-01"), "2026-12-28");

// Sommertid: Danmark skifter 29. marts 2026. Regnes der i lokal tid, rykker
// mandagen en dag. Her regnes der i UTC, så den bliver stående.
assert.equal(mondayOf("2026-03-29"), "2026-03-23");
assert.equal(mondayOf("2026-03-30"), "2026-03-30");
assert.equal(addDays("2026-03-28", 1), "2026-03-29");
assert.equal(addDays("2026-10-24", 2), "2026-10-26");

assert.equal(parseDateOnly("2026-08-03").getUTCDate(), 3);
fejler(() => parseDateOnly("3. august"), "ÅÅÅÅ-MM-DD");
fejler(() => parseDateOnly("2026-02-30"), "ikke en rigtig dato");

assert.equal(requireMonday("2026-08-03"), "2026-08-03");
fejler(() => requireMonday("2026-08-05"), "onsdag");
fejler(() => requireMonday("2026-08-09"), "søndag");

// ---------------------------------------------------------------------------
// Ugevalg: en KOMMENDE uge skal kunne vælges
// ---------------------------------------------------------------------------

const torsdag = new Date(2026, 7, 6); // 6. august 2026, en torsdag

assert.equal(normalizeWeekStart(undefined, torsdag), "2026-08-03");
assert.equal(normalizeWeekStart("", torsdag), "2026-08-03");
assert.equal(normalizeWeekStart("denne", torsdag), "2026-08-03");
assert.equal(normalizeWeekStart("næste", torsdag), "2026-08-10");
assert.equal(normalizeWeekStart("naeste", torsdag), "2026-08-10");
assert.equal(normalizeWeekStart("NÆSTE", torsdag), "2026-08-10");
assert.equal(normalizeWeekStart("forrige", torsdag), "2026-07-27");
// En vilkårlig dato bliver til sin egen mandag.
assert.equal(normalizeWeekStart("2026-08-06", torsdag), "2026-08-03");
assert.equal(normalizeWeekStart("2026-08-10", torsdag), "2026-08-10");
// Søndag aften: "næste uge" er ugen der begynder i morgen.
assert.equal(normalizeWeekStart("næste", new Date(2026, 7, 9)), "2026-08-10");
fejler(() => normalizeWeekStart("uge 33", torsdag), "ÅÅÅÅ-MM-DD");

// ---------------------------------------------------------------------------
// Ugens syv datoer og dens etiket
// ---------------------------------------------------------------------------

const dates = weekDates("2026-08-03");
assert.equal(dates.length, DAYS_IN_WEEK);
assert.deepEqual(dates, [
  "2026-08-03",
  "2026-08-04",
  "2026-08-05",
  "2026-08-06",
  "2026-08-07",
  "2026-08-08",
  "2026-08-09",
]);
fejler(() => weekDates("2026-08-04"), "begynder om mandagen");

// Skagenfood kalder ugen fra 3. august for "Uge 32". Etiketten skal sige det
// samme tal, ellers taler planlæggeren og kataloget forbi hinanden.
assert.equal(weekLabel("2026-08-03"), "Uge 32 · 3.–9. august 2026");
// Uge hen over et månedsskifte.
assert.equal(weekLabel("2026-07-27"), "Uge 31 · 27. juli – 2. august 2026");
// Uge hen over et årsskifte.
assert.equal(
  weekLabel("2026-12-28"),
  "Uge 53 · 28. december 2026 – 3. januar 2027",
);

// ---------------------------------------------------------------------------
// Validering af det API'et får ind
// ---------------------------------------------------------------------------

assert.equal(requireWeekday(1), 1);
assert.equal(requireWeekday(7), 7);
assert.equal(requireWeekday("4"), 4);
fejler(() => requireWeekday(0), "1 (mandag) til 7 (søndag)");
fejler(() => requireWeekday(8), "1 (mandag) til 7 (søndag)");
fejler(() => requireWeekday(2.5), "helt tal");
fejler(() => requireWeekday("mandag"), "1 (mandag) til 7 (søndag)");

assert.equal(DEFAULT_PORTIONS, 2, "husstanden er to personer");
assert.equal(requirePortions(1), 1);
assert.equal(requirePortions(MAX_PORTIONS), MAX_PORTIONS);
assert.equal(requirePortions("3"), 3);
fejler(() => requirePortions(0), "mellem 1 og 12");
fejler(() => requirePortions(13), "mellem 1 og 12");
fejler(() => requirePortions(2.5), "helt tal");

// undefined betyder "lad portionsantallet stå", ikke "sæt det til 2".
assert.equal(optionalPortions(undefined), undefined);
assert.equal(optionalPortions(null), undefined);
assert.equal(optionalPortions(""), undefined);
assert.equal(optionalPortions(4), 4);

assert.equal(requireRecipeId(13457), 13457);
assert.equal(requireRecipeId("13457"), 13457);
fejler(() => requireRecipeId(0), "helt positivt tal");
fejler(() => requireRecipeId(-3), "helt positivt tal");

// Et navn er nok. "Lasagne" er en gyldig ret.
assert.equal(normalizeManualTitle("Lasagne"), "Lasagne");
assert.equal(normalizeManualTitle("  Boller i  karry "), "Boller i karry");
assert.equal(normalizeManualTitle("Rødgrød med fløde"), "Rødgrød med fløde");
fejler(() => normalizeManualTitle(""), "skal have et navn");
fejler(() => normalizeManualTitle("   "), "skal have et navn");
fejler(() => normalizeManualTitle(null), "skal have et navn");
fejler(() => normalizeManualTitle("x".repeat(121)), "højst være på 120 tegn");

assert.equal(normalizeNote(undefined), null);
assert.equal(normalizeNote("  "), null);
assert.equal(normalizeNote(" Uden løg "), "Uden løg");
fejler(() => normalizeNote("x".repeat(501)), "højst være på 500 tegn");

// ---------------------------------------------------------------------------
// De syv dagspladser
// ---------------------------------------------------------------------------

const opskrift: WeekPlanRecipeSummary = {
  recipeId: 13457,
  name: "Mørksejfilet med kartofler",
  imageUrl: "https://example.invalid/moerksej.jpg",
  url: "/opskrifter/moerksejfilet",
  totalMinutes: 30,
  portionOptions: [1, 2, 3, 4, 5],
};

const katalogdag: WeekPlanDayRow = {
  weekday: 1,
  slotKind: "catalog",
  portions: 2,
  manualTitle: null,
  note: null,
  recipe: opskrift,
};

const manueldag: WeekPlanDayRow = {
  weekday: 3,
  slotKind: "manual",
  portions: 4,
  manualTitle: "Lasagne",
  note: "Rester til fredag",
  recipe: null,
};

// En tom uge har stadig syv dage.
const tomUge = buildWeekPlan("2026-08-03", []);
assert.equal(tomUge.days.length, DAYS_IN_WEEK);
assert.equal(tomUge.plannedDays, 0);
assert.deepEqual(
  tomUge.days.map((day) => day.slotKind),
  Array(DAYS_IN_WEEK).fill("empty"),
);
assert.deepEqual(
  tomUge.days.map((day) => day.portions),
  Array(DAYS_IN_WEEK).fill(DEFAULT_PORTIONS),
);
assert.deepEqual(
  tomUge.days.map((day) => day.title),
  Array(DAYS_IN_WEEK).fill(null),
);
assert.equal(tomUge.weekStart, "2026-08-03");
assert.equal(tomUge.weekEnd, "2026-08-09");
assert.equal(tomUge.isoWeek, 32);
assert.equal(tomUge.isoYear, 2026);
assert.equal(tomUge.label, "Uge 32 · 3.–9. august 2026");

// To udfyldte dage: de fem andre er stadig der, stadig tomme.
const halvUge = buildWeekPlan("2026-08-03", [manueldag, katalogdag]);
assert.equal(halvUge.days.length, DAYS_IN_WEEK);
assert.equal(halvUge.plannedDays, 2);
// Rækkefølgen kommer af ugedagen, ikke af rækkefølgen ind.
assert.deepEqual(
  halvUge.days.map((day) => day.weekday),
  [1, 2, 3, 4, 5, 6, 7],
);
assert.deepEqual(
  halvUge.days.map((day) => day.dayName),
  ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"],
);
assert.deepEqual(
  halvUge.days.map((day) => day.date),
  dates,
);
assert.equal(halvUge.days[0].slotKind, "catalog");
assert.equal(halvUge.days[0].title, "Mørksejfilet med kartofler");
assert.equal(halvUge.days[0].recipe?.recipeId, 13457);
assert.equal(halvUge.days[1].slotKind, "empty");
assert.equal(halvUge.days[1].portions, DEFAULT_PORTIONS);
assert.equal(halvUge.days[2].slotKind, "manual");
assert.equal(halvUge.days[2].title, "Lasagne");
assert.equal(halvUge.days[2].portions, 4, "portionsantal er per dag");
assert.equal(halvUge.days[2].note, "Rester til fredag");
assert.equal(halvUge.days[6].slotKind, "empty");

// Titlen på en dagsplads afhænger af dens slags.
assert.equal(slotTitle(katalogdag), "Mørksejfilet med kartofler");
assert.equal(slotTitle(manueldag), "Lasagne");
assert.equal(
  slotTitle({ ...katalogdag, slotKind: "empty", recipe: null }),
  null,
);

// En hel uge.
const helUge = buildWeekPlan(
  "2026-08-03",
  Array.from({ length: DAYS_IN_WEEK }, (_, index) => ({
    ...katalogdag,
    weekday: index + 1,
  })),
);
assert.equal(helUge.plannedDays, DAYS_IN_WEEK);

// ---------------------------------------------------------------------------
// Halve dagspladser må aldrig vises
// ---------------------------------------------------------------------------

fejler(
  () => buildWeekPlan("2026-08-03", [katalogdag, { ...katalogdag }]),
  "to rækker for dag 1",
);
fejler(
  () => buildWeekPlan("2026-08-03", [{ ...katalogdag, weekday: 8 }]),
  "1 (mandag) til 7 (søndag)",
);
fejler(
  () => buildWeekPlan("2026-08-03", [{ ...katalogdag, recipe: null }]),
  "opskriften mangler",
);
fejler(
  () => buildWeekPlan("2026-08-03", [{ ...manueldag, manualTitle: "  " }]),
  "selvskrevet ret uden navn",
);
fejler(
  () =>
    buildWeekPlan("2026-08-03", [
      { ...katalogdag, slotKind: "aftensmad" as WeekPlanDayRow["slotKind"] },
    ]),
  "ukendt slags",
);
fejler(() => buildWeekPlan("2026-08-04", []), "begynder om mandagen");

// ---------------------------------------------------------------------------
// Importruten skal kunne hente en KOMMENDE uge
// ---------------------------------------------------------------------------

// 6. august 2026 er en torsdag i ISO-uge 32.
assert.deepEqual(resolveImportWeek(undefined, undefined, torsdag), {
  year: 2026,
  week: 33,
});
assert.deepEqual(resolveImportWeek("", undefined, torsdag), {
  year: 2026,
  week: 33,
});
assert.deepEqual(resolveImportWeek("næste", undefined, torsdag), {
  year: 2026,
  week: 33,
});
assert.deepEqual(resolveImportWeek("denne", undefined, torsdag), {
  year: 2026,
  week: 32,
});
assert.deepEqual(resolveImportWeek(34, undefined, torsdag), {
  year: 2026,
  week: 34,
});
assert.deepEqual(resolveImportWeek("34", "2026", torsdag), {
  year: 2026,
  week: 34,
});
// Søndag aften: næste uge er den der begynder i morgen.
assert.deepEqual(
  resolveImportWeek(undefined, undefined, new Date(2026, 7, 9)),
  {
    year: 2026,
    week: 33,
  },
);
// Årsskifte: uge 53 i 2026 efterfølges af uge 1 i 2027.
assert.deepEqual(
  resolveImportWeek(undefined, undefined, new Date(2026, 11, 31)),
  { year: 2027, week: 1 },
);

fejler(() => resolveImportWeek("uge 33", undefined, torsdag), "mellem 1 og 53");
fejler(() => resolveImportWeek(0, undefined, torsdag), "mellem 1 og 53");
fejler(() => resolveImportWeek(54, undefined, torsdag), "mellem 1 og 53");
fejler(
  () => resolveImportWeek("næste", 2026, torsdag),
  "kun bruges sammen med et ugenummer",
);
fejler(() => resolveImportWeek(34, 1999, torsdag), "mellem 2020 og 2100");

console.log("testWeekPlan: alle tjek gik igennem.");
