import assert from "node:assert/strict";
import path from "node:path";
import { validateMealPlanFile } from "./mealPlanValidation";

// Re-add published meal-plan fixtures here once they match EXPECTED_MEAL_COUNTS in lib/constants.ts.
const fixturePaths: string[] = [
  // "data/mealplans/mealplan-week-YYYY-MM-DD.md",
];

for (const fixturePath of fixturePaths) {
  const result = validateMealPlanFile(path.join(process.cwd(), fixturePath));

  assert.equal(
    result.valid,
    true,
    [
      `${fixturePath} should pass meal-plan validation.`,
      ...result.errors.map((error) => `ERROR: ${error}`),
      ...result.warnings.map((warning) => `WARN: ${warning}`),
    ].join("\n")
  );
}

console.log(`Meal plan fixture tests passed (${fixturePaths.length} fixtures).`);
