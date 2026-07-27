import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mealInputToRow } from "../lib/domain/mealMappers";
import { MealInput } from "../lib/types";

// Regression test for a data-loss bug: insertMeal / updateMeal / insertMealReturningRow
// in lib/db/mealRepository.ts hand-write their SQL column lists instead of deriving
// them from mealInputToRow, so newly added fields (servings, steps, image_url) were
// silently dropped on write while the read path (mapMeal) kept working fine.
//
// This test does two things without needing a live database:
//   1. Confirms mealInputToRow actually carries servings/steps/image_url (the row shape
//      write paths are supposed to persist).
//   2. Statically inspects the SQL text of every INSERT/UPDATE ... meals query in
//      mealRepository.ts and asserts each key returned by mealInputToRow has a
//      corresponding column in that query's column list.

const sampleInput: MealInput = {
  type: "Dinner",
  name: "Test Meal",
  build: {
    pro: ["chicken"],
    base: ["rice"],
    veg: ["broccoli"],
    engine: ["soy"],
  },
  ingredients: [],
  macros: { cal: 500, p: 40, c: 50, f: 10, fiber: 5 },
  servings: 4,
  steps: ["Chop the chicken.", "Cook the rice.", "Combine and serve."],
  imageUrl: "https://example.com/image.jpg",
};

const row = mealInputToRow(sampleInput);

assert.equal(row.servings, 4, "mealInputToRow must carry servings");
assert.deepEqual(
  row.steps,
  sampleInput.steps,
  "mealInputToRow must carry steps",
);
assert.equal(
  row.image_url,
  sampleInput.imageUrl,
  "mealInputToRow must carry image_url",
);

// Map from MealRow key (as produced by mealInputToRow) to the SQL column name used
// in the meals table. Keys already match column names 1:1 except this test doesn't
// need a translation table since mealInputToRow's keys ARE the column names.
const rowKeys = Object.keys(row);

const repoPath = path.join(process.cwd(), "lib/db/mealRepository.ts");
const source = fs.readFileSync(repoPath, "utf8");

// Extract each `INSERT INTO meals (...)` and `UPDATE meals SET ...` statement's column list.
function extractInsertColumns(functionSource: string): string[] {
  const match = functionSource.match(
    /INSERT INTO meals\s*\(([\s\S]*?)\)\s*VALUES/,
  );
  assert.ok(match, "Expected an INSERT INTO meals (...) VALUES statement");
  return match![1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractUpdateColumns(functionSource: string): string[] {
  const match = functionSource.match(/UPDATE meals\s*SET([\s\S]*?)WHERE/);
  assert.ok(match, "Expected an UPDATE meals SET ... WHERE statement");
  return match![1]
    .split(",")
    .map((s) => s.trim().split("=")[0].trim())
    .filter(Boolean);
}

function extractFunctionSource(name: string): string {
  const re = new RegExp(
    `export async function ${name}\\([\\s\\S]*?\\n}\\n`,
    "m",
  );
  const match = source.match(re);
  assert.ok(match, `Could not find function ${name} in mealRepository.ts`);
  return match![0];
}

// Keys that intentionally have no column in the write payload passed to mealInputToRow
// (id/timestamps/derived stats) are never in `rowKeys`, so no need to exclude them here.

for (const fnName of ["insertMeal", "insertMealReturningRow"]) {
  const fnSource = extractFunctionSource(fnName);
  const columns = extractInsertColumns(fnSource);
  for (const key of rowKeys) {
    assert.ok(
      columns.includes(key),
      `${fnName}'s INSERT column list is missing "${key}" ` +
        `(mealInputToRow produces this field, so it will be silently dropped on write). ` +
        `Columns found: ${columns.join(", ")}`,
    );
  }
}

{
  const fnSource = extractFunctionSource("updateMeal");
  const columns = extractUpdateColumns(fnSource);
  for (const key of rowKeys) {
    assert.ok(
      columns.includes(key),
      `updateMeal's UPDATE SET column list is missing "${key}" ` +
        `(mealInputToRow produces this field, so it will be silently dropped on write). ` +
        `Columns found: ${columns.join(", ")}`,
    );
  }
}

console.log(
  "Meal repository write-path tests passed (servings/steps/image_url survive insertMeal, insertMealReturningRow, updateMeal).",
);
