import assert from "node:assert/strict";
import {
  foldDanish,
  normalizeCatalogQuery,
} from "../lib/weekPlan/catalogQuery";
import {
  danishCount,
  dayHeading,
  daySubtitle,
  dayTitle,
  formatDayDate,
  formatMinutes,
  isPast,
  isToday,
  leadWeekday,
  portionsLabel,
  relativeWeekName,
  shiftWeek,
  weekHeadline,
  weekNumberLabel,
  weekRangeLabel,
  weekSummary,
} from "../lib/weekPlan/view";
import { buildWeekPlan, WeekPlanError } from "../lib/weekPlan/week";
import type { WeekPlanDayRow } from "../lib/weekPlan/types";

/**
 * Test af ugeplan-skærmens sprog.
 *
 * Alt herinde er rent -- ingen database, intet netværk, ingen browser. Det
 * der efterprøves er de sætninger brugeren rent faktisk læser: at en tom uge
 * inviterer i stedet for at melde fejl, at datoerne staar rigtigt hen over
 * baade et maanedsskifte og et aarsskifte, og at æ/ø/å foldes begge veje.
 */

// ---------------------------------------------------------------------------
// Tal i ord: overskriften taler, linjen under taeller
// ---------------------------------------------------------------------------

assert.equal(danishCount(0), "Nul");
assert.equal(danishCount(1), "Én");
assert.equal(danishCount(7), "Syv");
// Over syv har ordet ingen plads i en uge -- tallet er tydeligere.
assert.equal(danishCount(8), "8");

assert.deepEqual(weekHeadline(0), { line1: "Ugen ligger", line2: "åben." });
assert.deepEqual(weekHeadline(1), { line1: "Én aften", line2: "er på plads." });
assert.deepEqual(weekHeadline(3), {
  line1: "Tre aftener",
  line2: "er på plads.",
});
assert.deepEqual(weekHeadline(7), {
  line1: "Hele ugen",
  line2: "er på plads.",
});

// En tom uge er den normale tilstand mandag morgen. Ingen af de tre sætninger
// må lyde som en fejl -- ingen "mangler", ingen "ingen retter".
for (const planned of [0, 1, 4, 7]) {
  const headline = weekHeadline(planned);
  const text = `${headline.line1} ${headline.line2} ${weekSummary(planned)}`;
  for (const forbudt of ["mangler", "fejl", "ingen retter", "tom"]) {
    assert.ok(
      !text.toLowerCase().includes(forbudt),
      `Teksten for ${planned} planlagte dage siger "${forbudt}": ${text}`,
    );
  }
}

assert.equal(weekSummary(0), "Syv aftener at fylde ud");
assert.equal(weekSummary(3), "3 af 7 aftener planlagt");
assert.equal(weekSummary(7), "Syv af syv. Ingen tvivl.");

// ---------------------------------------------------------------------------
// Ugeskift og ugens navn
// ---------------------------------------------------------------------------

assert.equal(shiftWeek("2026-08-10", 1), "2026-08-17");
assert.equal(shiftWeek("2026-08-10", -1), "2026-08-03");
assert.equal(shiftWeek("2026-08-10", 0), "2026-08-10");
// Over et månedsskifte, og over et årsskifte.
assert.equal(shiftWeek("2026-12-28", 1), "2027-01-04");
assert.throws(() => shiftWeek("2026-08-11", 1), WeekPlanError);

assert.equal(weekNumberLabel("2026-08-10"), "Uge 33");
assert.equal(weekNumberLabel("2026-08-03"), "Uge 32");

assert.equal(weekRangeLabel("2026-08-10"), "10.–16. august");
// Ugen der deler sig over to måneder skriver begge.
assert.equal(weekRangeLabel("2026-07-27"), "27. juli – 2. august");
// Kun ved årsskiftet er årstallene værd at bruge plads på.
assert.equal(
  weekRangeLabel("2026-12-28"),
  "28. december 2026 – 3. januar 2027",
);

const torsdagIUge33 = new Date(2026, 7, 13);
assert.equal(relativeWeekName("2026-08-10", torsdagIUge33), "Denne uge");
assert.equal(relativeWeekName("2026-08-17", torsdagIUge33), "Næste uge");
assert.equal(relativeWeekName("2026-08-03", torsdagIUge33), "Sidste uge");
assert.equal(relativeWeekName("2026-08-24", torsdagIUge33), null);

// ---------------------------------------------------------------------------
// Datoer
// ---------------------------------------------------------------------------

assert.equal(formatDayDate("2026-08-13"), "13. august");
assert.equal(formatDayDate("2026-01-01"), "1. januar");

assert.ok(isToday("2026-08-13", torsdagIUge33));
assert.ok(!isToday("2026-08-14", torsdagIUge33));
assert.ok(isPast("2026-08-12", torsdagIUge33));
// I dag er ikke fortid. Man skal stadig lave mad.
assert.ok(!isPast("2026-08-13", torsdagIUge33));
assert.ok(!isPast("2026-08-14", torsdagIUge33));

// ---------------------------------------------------------------------------
// Dagspladsens tekst
// ---------------------------------------------------------------------------

const tomUge = buildWeekPlan("2026-08-10", []);
assert.equal(tomUge.days.length, 7);
assert.equal(tomUge.plannedDays, 0);

const tomDag = tomUge.days[2];
assert.equal(dayTitle(tomDag), "Åben aften");
assert.equal(daySubtitle(tomDag), "Vælg en ret, eller skriv jeres egen");
assert.equal(dayHeading(tomDag), "Onsdag 12. august");

const katalogRaekke: WeekPlanDayRow = {
  weekday: 4,
  slotKind: "catalog",
  portions: 4,
  manualTitle: null,
  note: null,
  recipe: {
    recipeId: 13621,
    name: "Gris og blomkål",
    imageUrl: "https://recipes.skagenfood.dk/media/1/gris.jpg",
    url: null,
    totalMinutes: 30,
    portionOptions: [2, 3, 4, 5],
  },
};
const manuelRaekke: WeekPlanDayRow = {
  weekday: 5,
  slotKind: "manual",
  portions: 2,
  manualTitle: "Lasagne",
  note: null,
  recipe: null,
};

const blandetUge = buildWeekPlan("2026-08-10", [katalogRaekke, manuelRaekke]);
assert.equal(blandetUge.plannedDays, 2);

const katalogDag = blandetUge.days[3];
assert.equal(dayTitle(katalogDag), "Gris og blomkål");
assert.equal(daySubtitle(katalogDag), "30 min · 4 pers.");
assert.equal(dayHeading(katalogDag), "Torsdag 13. august");

const manuelDag = blandetUge.days[4];
assert.equal(dayTitle(manuelDag), "Lasagne");
// Selvskrevet ret har ingen tid -- saa staar portionerne alene, ikke "null min".
assert.equal(daySubtitle(manuelDag), "2 pers.");

assert.equal(formatMinutes(30), "30 min");
assert.equal(formatMinutes(null), null);
assert.equal(formatMinutes(0), null);
assert.equal(formatMinutes(-5), null);
assert.equal(portionsLabel(1), "1 pers.");
assert.equal(portionsLabel(4), "4 pers.");

// ---------------------------------------------------------------------------
// Hvilken dag der faar den store plads
// ---------------------------------------------------------------------------

// Ligger i dag i ugen, er det i dag man skal lave mad til.
assert.equal(leadWeekday(blandetUge, torsdagIUge33), 4);
// Ellers er det mandag -- ugens begyndelse, ikke en tilfældig dag.
assert.equal(leadWeekday(blandetUge, new Date(2026, 8, 20)), 1);
assert.equal(leadWeekday(blandetUge, new Date(2026, 6, 1)), 1);

// ---------------------------------------------------------------------------
// Foldningen af æ, ø og å
// ---------------------------------------------------------------------------

// Begge sider af en søgning foldes gennem foldDanish, saa "spidskaal" finder
// "spidskål" og omvendt. Retvælgeren (lib/catalog/picker.ts) bygger sin egen
// filtrering oven paa netop de to funktioner herunder.
assert.equal(foldDanish("Spidskål"), "spidskaal");
assert.equal(foldDanish("BLØDE ÆG"), "bloede aeg");
assert.equal(foldDanish("Kikærter"), "kikaerter");
// Allerede foldet tekst skal ikke aendre sig af at blive foldet igen.
assert.equal(foldDanish(foldDanish("Rødløg")), foldDanish("Rødløg"));

assert.equal(normalizeCatalogQuery("  laks   med  "), "laks med");
assert.equal(normalizeCatalogQuery("   "), "");
assert.equal(normalizeCatalogQuery("laks"), "laks");

console.log("testWeekPlanScreen: alle tjek gik igennem.");
