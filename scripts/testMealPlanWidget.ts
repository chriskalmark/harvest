import assert from "node:assert/strict";
import {
  buildWidgetItems,
  formatWidgetDayLabel,
} from "@/lib/domain/mealPlanWidget";
import { addDays, fromDateOnlyString } from "@/lib/weekRange";

// Onsdag 29. juli 2026. Ugen starter mandag 27. juli.
const today = fromDateOnlyString("2026-07-29");
const thisWeek = "2026-07-27";
const nextWeek = "2026-08-03";

// Dagens dato faar "I dag", morgendagen "I morgen", resten ugedag + d/m.
assert.equal(formatWidgetDayLabel(today, today), "I dag");
assert.equal(formatWidgetDayLabel(addDays(today, 1), today), "I morgen");
assert.equal(formatWidgetDayLabel(addDays(today, 2), today), "Fredag 31/7");
assert.equal(formatWidgetDayLabel(addDays(today, 5), today), "Mandag 3/8");

{
  // Aftensretterne fordeles fra mandag, saa mandag og tirsdag ligger bag os.
  const items = buildWidgetItems(
    [
      {
        weekStartDateOnly: thisWeek,
        dinnerNames: ["Lasagne", "Tacos", "Torsk", "Kikaertegryde"],
      },
    ],
    today,
  );
  assert.deepEqual(items, ["I dag · Torsk", "I morgen · Kikaertegryde"]);
}

{
  // To ugeplaner: vinduet fortsaetter ind i naeste uge, stadig i datoorden.
  const items = buildWidgetItems(
    [
      { weekStartDateOnly: nextWeek, dinnerNames: ["Fisk", "Suppe"] },
      { weekStartDateOnly: thisWeek, dinnerNames: ["A", "B", "C", "D", "E"] },
    ],
    today,
  );
  assert.deepEqual(items, [
    "I dag · C",
    "I morgen · D",
    "Fredag 31/7 · E",
    "Mandag 3/8 · Fisk",
    "Tirsdag 4/8 · Suppe",
  ]);
}

{
  // Dage uden ret udelades — her er der hul fra loerdag til soendag.
  const items = buildWidgetItems(
    [
      { weekStartDateOnly: thisWeek, dinnerNames: ["A", "B", "C"] },
      { weekStartDateOnly: nextWeek, dinnerNames: ["Fisk"] },
    ],
    today,
  );
  assert.deepEqual(items, ["I dag · C", "Mandag 3/8 · Fisk"]);
}

{
  // Vinduet er syv dage: dag 7 (5. august) er udenfor og skal falde fra.
  const items = buildWidgetItems(
    [
      {
        weekStartDateOnly: nextWeek,
        dinnerNames: ["Mandag", "Tirsdag", "Onsdag"],
      },
    ],
    today,
  );
  assert.deepEqual(items, ["Mandag 3/8 · Mandag", "Tirsdag 4/8 · Tirsdag"]);
}

{
  // Ingen madplan i vinduet giver en tom liste, ikke en fejl.
  assert.deepEqual(buildWidgetItems([], today), []);
}

console.log("meal plan widget: OK");
