import assert from "node:assert/strict";
import { HOUSEHOLD_GOODS_SECTION, STORE_CATEGORY_ORDER } from "@/lib/constants";
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";
import type {
  HouseholdGoodsItem,
  MealInput,
  MealIngredientUnit,
} from "@/lib/types";
import type { StoreZone } from "@/lib/constants";

function meal(
  name: string,
  ingredients: Array<{
    name: string;
    amount: number;
    unit: MealIngredientUnit;
    zone: StoreZone;
  }>,
): MealInput {
  return {
    type: "Dinner",
    name,
    build: { pro: [], base: [], veg: [], engine: [] },
    ingredients: ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: "1",
      amount: ingredient.amount,
      unit: ingredient.unit,
      zone: ingredient.zone,
      category: "pro",
      macros: { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
    })),
    macros: { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
    servings: 2,
    steps: [],
    imageUrl: null,
  };
}

const mealA = meal("Meal A", [
  { name: "Æg", amount: 4, unit: "stk", zone: "Køl" },
  { name: "Spinat", amount: 200, unit: "g", zone: "Frugt & grønt" },
]);
const mealB = meal("Meal B", [
  { name: "Æg", amount: 4, unit: "stk", zone: "Køl" },
  { name: "Ris", amount: 300, unit: "g", zone: "Kolonial" },
]);

const previousList = deriveShoppingListFromMeals([mealA, mealB], [], []);
const withOrphans = deriveShoppingListFromMeals([mealB], previousList, []);
const pruned = deriveShoppingListFromMeals([mealB], previousList, [], [], {
  pruneOrphans: true,
});

function itemNames(list: ReturnType<typeof deriveShoppingListFromMeals>) {
  return list
    .flatMap((category) => category.items.map((item) => item.n))
    .sort();
}

assert.deepEqual(itemNames(withOrphans), ["ris", "spinat", "æg"]);

assert.deepEqual(itemNames(pruned), ["ris", "æg"]);

const householdGoods: HouseholdGoodsItem[] = [
  {
    category: "Opvaskemiddel",
    n: "Opvaskemiddel",
  },
];

const withHousehold = deriveShoppingListFromMeals(
  [mealB],
  [],
  [],
  householdGoods,
);
const householdSection = withHousehold.at(-1);

assert.equal(householdSection?.category, HOUSEHOLD_GOODS_SECTION);
assert.deepEqual(
  householdSection?.items.map((item) => item.n),
  ["Opvaskemiddel"],
);
assert.equal(householdSection?.items[0]?.shoppingSource, "household");

const storeZoneNames = withHousehold
  .slice(0, -1)
  .flatMap((category) => category.items.map((item) => item.n));

assert.ok(!storeZoneNames.includes("Opvaskemiddel"));
assert.ok(
  withHousehold
    .slice(0, -1)
    .every((category) =>
      (STORE_CATEGORY_ORDER as readonly string[]).includes(category.category),
    ),
);

// The derived shopping list carries real quantities scaled by servings, not
// just item names — this is the model's whole point over the old Trader
// Joe's shape (which had no numeric amount, so this couldn't be asserted).
const eggItem = withHousehold
  .flatMap((category) => category.items)
  .find((item) => item.n === "æg");
assert.equal(eggItem?.q, "8 stk");

const checkedPrevious = deriveShoppingListFromMeals(
  [mealB],
  withHousehold,
  [],
  householdGoods,
);
const checkedHouseholdSection = checkedPrevious.at(-1);

assert.equal(checkedHouseholdSection?.items[0]?.checked, undefined);

const checkedList = deriveShoppingListFromMeals(
  [mealB],
  [
    {
      category: HOUSEHOLD_GOODS_SECTION,
      items: [
        {
          n: "Opvaskemiddel",
          checked: true,
          shoppingSource: "household",
        },
      ],
    },
  ],
  [],
  householdGoods,
);

assert.equal(checkedList.at(-1)?.items[0]?.checked, true);

console.log("shopping list derivation tests passed");
