import assert from "node:assert/strict";
import { parseMealInput } from "../lib/services/mealService";
import type { MealInput } from "../lib/types";

// Regression test for a live data-loss bug: PATCH /api/meals/[id] with only
// {"servings": N} routed through parseMealInput, which filled every absent
// field with a hardcoded default (amount: 0, unit: "stk", steps: [],
// imageUrl: null) instead of leaving it untouched. Every tap of the servings
// stepper silently wiped that meal's ingredients, steps, and image.
//
// parseMealInput now takes an optional `existing` MealInput. Any field the
// caller's payload omits must fall back to `existing`'s value, not a
// hardcoded default. This test proves that a payload naming only `servings`
// leaves ingredients, steps, and imageUrl byte-for-byte identical to the
// pre-update meal. A test that only checked servings changed would have
// passed against the broken code (it defaulted servings too) — this one
// would not.

const existing: MealInput = {
  type: "Dinner",
  name: "Ovnbagt kyllingelår med kartofler",
  build: {
    pro: ["kylling"],
    base: ["kartofler"],
    veg: ["gulerod"],
    engine: ["hvidløg"],
  },
  ingredients: [
    {
      name: "Kyllingelår",
      quantity: "300 g",
      amount: 300,
      unit: "g",
      zone: "Køl",
      category: "pro",
      macros: { cal: 500, p: 40, c: 0, f: 30, fiber: 0 },
    },
    {
      name: "Kartofler",
      quantity: "400 g",
      amount: 400,
      unit: "g",
      zone: "Frugt & grønt",
      category: "base",
      macros: { cal: 300, p: 5, c: 60, f: 0, fiber: 5 },
    },
  ],
  macros: { cal: 800, p: 45, c: 60, f: 30, fiber: 5 },
  servings: 2,
  steps: ["Ovn på 200 grader.", "Bag i 40 minutter.", "Server."],
  imageUrl: "https://example.com/kylling.jpg",
};

// 1. A servings-only PATCH payload must leave everything else untouched.
const patched = parseMealInput({ servings: 4 }, existing);

assert.equal(patched.servings, 4, "servings must update to the new value");
assert.deepEqual(
  patched.ingredients,
  existing.ingredients,
  "ingredients must be untouched by a servings-only update — this is the bug: " +
    "amounts must not collapse to 0 / unit 'stk'",
);
assert.deepEqual(
  patched.steps,
  existing.steps,
  "steps must be untouched by a servings-only update",
);
assert.equal(
  patched.imageUrl,
  existing.imageUrl,
  "imageUrl must be untouched by a servings-only update",
);
assert.equal(patched.name, existing.name, "name must be untouched");
assert.deepEqual(patched.build, existing.build, "build must be untouched");
assert.deepEqual(patched.macros, existing.macros, "macros must be untouched");

// 2. Same trap, different field: a steps-only payload must not wipe ingredients/imageUrl/servings.
const stepsOnly = parseMealInput({ steps: ["Ny handling."] }, existing);
assert.deepEqual(stepsOnly.steps, ["Ny handling."]);
assert.deepEqual(
  stepsOnly.ingredients,
  existing.ingredients,
  "ingredients must be untouched by a steps-only update",
);
assert.equal(
  stepsOnly.servings,
  existing.servings,
  "servings must be untouched",
);
assert.equal(
  stepsOnly.imageUrl,
  existing.imageUrl,
  "imageUrl must be untouched",
);

// 3. Same trap, imageUrl: an imageUrl-only payload must not wipe ingredients/steps/servings.
const imageOnly = parseMealInput(
  { imageUrl: "https://example.com/new.jpg" },
  existing,
);
assert.equal(imageOnly.imageUrl, "https://example.com/new.jpg");
assert.deepEqual(imageOnly.ingredients, existing.ingredients);
assert.deepEqual(imageOnly.steps, existing.steps);
assert.equal(imageOnly.servings, existing.servings);

// 4. Explicit null must still be able to clear imageUrl (distinguished from "absent").
const clearedImage = parseMealInput({ imageUrl: null }, existing);
assert.equal(clearedImage.imageUrl, null, "explicit null must clear imageUrl");
assert.deepEqual(
  clearedImage.ingredients,
  existing.ingredients,
  "clearing imageUrl must not touch ingredients",
);

// 5. Create mode (no `existing`) must still require the required fields and
// still default optional fields the old way — this must not regress.
assert.throws(
  () => parseMealInput({ name: "No type" }),
  /type is required/,
  "create mode must still require type",
);
const created = parseMealInput({
  name: "Ny ret",
  type: "Lunch",
  build: {
    pro: ["kylling"],
    base: ["ris"],
    veg: ["broccoli"],
    engine: ["soja"],
  },
  macros: { cal: 400, p: 30, c: 40, f: 10, fiber: 3 },
});
assert.equal(created.servings, 2, "create mode still defaults servings to 2");
assert.deepEqual(created.steps, [], "create mode still defaults steps to []");
assert.equal(
  created.imageUrl,
  null,
  "create mode still defaults imageUrl to null",
);
assert.equal(
  created.ingredients,
  undefined,
  "create mode leaves ingredients undefined when omitted",
);

console.log(
  "Meal partial-update tests passed (servings/steps/imageUrl-only updates leave the rest of the meal intact).",
);
