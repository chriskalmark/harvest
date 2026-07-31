import assert from "node:assert/strict";
import { setAllItemsChecked } from "@/lib/domain/shoppingListBulkChecked";
import type { ListCategory } from "@/lib/types";

// Regression coverage for the "clear shopping list" rebuild: the list can't
// be deleted (it's re-derived from the week's meals on every read — see
// buildStoredMealPlan), so the clear action instead marks every item as
// checked via PATCH /api/mealplan/shopping { all: true, checked: true }.
// setAllItemsChecked is the pure core of that endpoint branch.

const list: ListCategory[] = [
  {
    category: "Køl",
    items: [
      { n: "Kyllingelår", q: "300 g" },
      { n: "Æg", q: "6 stk", checked: true, pantry: true },
    ],
  },
  {
    category: "Frugt & grønt",
    items: [{ n: "Kartofler", q: "400 g" }],
  },
];

// 1. Marking everything checked sets `checked: true` on every item, in every
// category — including ones already checked, and without touching `q` or
// `pantry`.
const allChecked = setAllItemsChecked(list, true);
for (const category of allChecked) {
  for (const item of category.items) {
    assert.equal(
      item.checked,
      true,
      `${item.n} in ${category.category} must be checked`,
    );
  }
}
assert.equal(allChecked[0].items[0].q, "300 g", "quantity must be untouched");
assert.equal(
  allChecked[0].items[1].pantry,
  true,
  "pantry flag must be untouched",
);

// 2. The input list must not be mutated in place — the caller (the API
// route) re-reads mealPlan.shoppingList elsewhere in the same request, and a
// shared-reference mutation would corrupt it.
assert.equal(
  list[0].items[0].checked,
  undefined,
  "original list must be untouched",
);

// 3. `checked: false` (the inverse direction) must work the same way, in
// case the endpoint is ever used to bulk-uncheck.
const allUnchecked = setAllItemsChecked(allChecked, false);
for (const category of allUnchecked) {
  for (const item of category.items) {
    assert.equal(item.checked, false, `${item.n} must be unchecked`);
  }
}

// 4. An empty shopping list must return an empty list, not throw.
assert.deepEqual(setAllItemsChecked([], true), []);

console.log(
  "Shopping bulk-checked tests passed (all items marked checked/unchecked without touching quantity or pantry state, no in-place mutation).",
);
