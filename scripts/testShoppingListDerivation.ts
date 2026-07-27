import assert from "node:assert/strict";
import { HOUSEHOLD_GOODS_SECTION, STORE_CATEGORY_ORDER } from "@/lib/constants";
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";
import type { HouseholdGoodsItem, MealInput } from "@/lib/types";

function meal(name: string, ingredients: string[]): MealInput {
  return {
    type: "Dinner",
    name,
    build: { pro: [], base: [], veg: [], engine: [] },
    ingredients: ingredients.map((ingredient) => ({
      name: ingredient,
      quantity: "1",
      category: "pro",
      macros: { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
    })),
    macros: { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
  };
}

const mealA = meal("Meal A", ["Trader Joe's Eggs", "Trader Joe's Spinach"]);
const mealB = meal("Meal B", ["Trader Joe's Eggs", "Trader Joe's Rice"]);

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

assert.deepEqual(itemNames(withOrphans), [
  "Trader Joe's Eggs",
  "Trader Joe's Rice",
  "Trader Joe's Spinach",
]);

assert.deepEqual(itemNames(pruned), ["Trader Joe's Eggs", "Trader Joe's Rice"]);

const householdGoods: HouseholdGoodsItem[] = [
  {
    category: "Dish Soap",
    n: "Trader Joe's Liquid Dish Soap",
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
  ["Trader Joe's Liquid Dish Soap"],
);
assert.equal(householdSection?.items[0]?.shoppingSource, "household");

const storeZoneNames = withHousehold
  .slice(0, -1)
  .flatMap((category) => category.items.map((item) => item.n));

assert.ok(!storeZoneNames.includes("Trader Joe's Liquid Dish Soap"));
assert.ok(
  withHousehold
    .slice(0, -1)
    .every((category) => STORE_CATEGORY_ORDER.includes(category.category)),
);

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
          n: "Trader Joe's Liquid Dish Soap",
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
