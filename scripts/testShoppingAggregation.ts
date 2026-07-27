import assert from "node:assert/strict";
import { normalizeShoppingName } from "@/lib/domain/shoppingUsage";
import { aggregateShoppingQuantities } from "@/lib/domain/shoppingAggregation";
import type { MealIngredient } from "@/lib/types";

// Danske bogstaver skal overleve normaliseringen.
assert.equal(normalizeShoppingName("Kikærter"), "kikærter");
assert.equal(normalizeShoppingName("Rødløg"), "rødløg");
assert.equal(normalizeShoppingName("Smør"), "smør");

// Store og små bogstaver og ekstra mellemrum er samme vare.
assert.equal(normalizeShoppingName("  Frisk  Persille "), "frisk persille");

// Parenteser og tegnsætning fjernes.
assert.equal(normalizeShoppingName("Hvidløg (frisk)"), "hvidløg");

// Forskellige varer må ikke kollidere.
assert.notEqual(
  normalizeShoppingName("rødløg"),
  normalizeShoppingName("hvidløg"),
);

// Accenttegn overlever — müsli og crème fraiche er almindelige danske varer.
assert.equal(normalizeShoppingName("Müsli"), "müsli");
assert.equal(normalizeShoppingName("Filé"), "filé");
assert.equal(normalizeShoppingName("Crème fraiche"), "crème fraiche");

// Tegnsætning og symboler fjernes stadig.
assert.equal(normalizeShoppingName("()"), "");
assert.equal(normalizeShoppingName("Skyr 0,1 %"), "skyr 0 1");

function ing(
  name: string,
  amount: number,
  unit: MealIngredient["unit"],
  zone: MealIngredient["zone"] = "Kolonial",
): MealIngredient {
  return {
    name,
    quantity: `${amount} ${unit}`,
    amount,
    unit,
    zone,
    category: "base",
    macros: { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
  };
}

// Mængden ganges med rettens portionstal.
{
  const result = aggregateShoppingQuantities([
    {
      servings: 2,
      ingredients: [ing("kyllingelår", 150, "g", "Kød & fjerkræ")],
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 300);
  assert.equal(result[0].unit, "g");
  assert.equal(result[0].zone, "Kød & fjerkræ");
}

// Samme vare i to retter lægges sammen.
{
  const result = aggregateShoppingQuantities([
    {
      servings: 2,
      ingredients: [ing("kyllingelår", 150, "g", "Kød & fjerkræ")],
    },
    {
      servings: 4,
      ingredients: [ing("Kyllingelår", 100, "g", "Kød & fjerkræ")],
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 700);
  assert.equal(result[0].name, "kyllingelår");
}

// Forskellig enhed for samme navn giver to linjer — vi gætter ikke.
{
  const result = aggregateShoppingQuantities([
    { servings: 2, ingredients: [ing("hvidløg", 1, "stk")] },
    { servings: 2, ingredients: [ing("hvidløg", 5, "g")] },
  ]);
  assert.equal(result.length, 2);
}

// Nul portioner giver ingen varer.
{
  const result = aggregateShoppingQuantities([
    { servings: 0, ingredients: [ing("persille", 1, "bundt")] },
  ]);
  assert.equal(result.length, 0);
}

// Brøkdele rundes op — man kan ikke købe 1,4 dåse.
{
  const result = aggregateShoppingQuantities([
    { servings: 3, ingredients: [ing("hakkede tomater", 0.5, "dåse")] },
  ]);
  assert.equal(result[0].amount, 2);
}

console.log("shopping aggregation: OK");
