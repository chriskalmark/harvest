import { writeFile } from "fs/promises";
import path from "path";
import { ListCategory, MealInput, WeekData } from "@/lib/types";
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";

const MARKDOWN_PATH = path.join(process.cwd(), "data", "current-week.md");
const JSON_PATH = path.join(process.cwd(), "data", "current-week.json");

export type NormalizedWeekData = WeekData & { shoppingList: ListCategory[] };

export function extractWeekDataFromMarkdown(markdown: string): WeekData {
  const match = markdown.match(/```json\s*([\s\S]*?)```/i);

  if (!match) {
    throw new Error(
      "Unable to find a ```json``` block in data/current-week.md."
    );
  }

  const parsed = JSON.parse(match[1]) as unknown;
  assertWeekData(parsed);

  return normalizeWeekData(parsed);
}

export async function writeWeekDataJson(weekData: WeekData): Promise<string> {
  const normalized = normalizeWeekData(weekData);
  await writeFile(JSON_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return JSON_PATH;
}

function normalizeStringArray(value: unknown, field: string): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`${field} must be a non-empty string.`);
    }
    return [trimmed];
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v.length > 0);

    if (!normalized.length) {
      throw new Error(`${field} must be a non-empty array of non-empty strings.`);
    }

    return normalized;
  }

  throw new Error(`${field} must be a non-empty string or array of non-empty strings.`);
}

function normalizeMacros<T extends { fiber?: number }>(macros: T): T & { fiber: number } {
  return {
    ...macros,
    fiber: typeof macros.fiber === "number" && Number.isFinite(macros.fiber) ? macros.fiber : 0,
  };
}

export function normalizeWeekDataBuildArrays(weekData: WeekData): WeekData {
  return {
    ...weekData,
    meals: weekData.meals.map((meal, mealIndex) => ({
      ...meal,
      build: {
        pro: normalizeStringArray(meal.build.pro, `meals[${mealIndex}].build.pro`),
        base: normalizeStringArray(meal.build.base, `meals[${mealIndex}].build.base`),
        veg: normalizeStringArray(meal.build.veg, `meals[${mealIndex}].build.veg`),
        engine: normalizeStringArray(meal.build.engine, `meals[${mealIndex}].build.engine`),
      },
      macros: normalizeMacros(meal.macros),
      ingredients: meal.ingredients?.map((ingredient) => ({
        ...ingredient,
        macros: normalizeMacros(ingredient.macros),
      })),
    })),
  };
}

export function normalizeWeekData(weekData: WeekData): NormalizedWeekData {
  const normalized = normalizeWeekDataBuildArrays(weekData);

  return {
    ...normalized,
    shoppingList: deriveShoppingListFromMeals(
      normalized.meals,
      normalized.shoppingList ?? [],
      normalized.junkList,
      normalized.householdGoods ?? []
    ),
  };
}

export function buildMarkdownFromWeekData(weekData: WeekData): string {
  return `# Current Week Plan

Use this file as the AI-editable planning brief for the next Harvest week.

## Workflow
1. Update the week summary notes if helpful.
2. Replace the JSON block with the full new week.
3. Omit \`shoppingList\` unless you need temporary manual extras; it is derived from meal ingredients.
4. Run \`npm run meal-plan:sync\` to validate and write \`data/current-week.json\`.
5. Run \`npm run meal-plan:publish\` to upsert the current week into Postgres.

## Canonical JSON
\`\`\`json
${JSON.stringify(weekData, null, 2)}
\`\`\`
`;
}

export async function writeWeekMarkdown(weekData: WeekData): Promise<string> {
  await writeFile(MARKDOWN_PATH, buildMarkdownFromWeekData(normalizeWeekData(weekData)), "utf8");
  return MARKDOWN_PATH;
}

function assertWeekData(value: unknown): asserts value is WeekData {
  if (!isRecord(value)) {
    throw new Error("Week data must be a JSON object.");
  }

  assertString(value.weekRange, "weekRange");
  assertMeals(value.meals, "meals");
  if ("shoppingList" in value && value.shoppingList !== undefined) {
    assertListCategories(value.shoppingList, "shoppingList");
  }
  assertListCategories(value.junkList, "junkList");
}

function assertMeals(value: unknown, field: string): asserts value is MealInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty array.`);
  }

  value.forEach((meal, mealIndex) => {
    assertMeal(meal, `${field}[${mealIndex}]`);
  });
}

function assertMeal(value: unknown, field: string): asserts value is MealInput {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object.`);
  }

  assertString(value.type, `${field}.type`);
  assertString(value.name, `${field}.name`);
  assertRecord(value.build, `${field}.build`);
  assertStringOrArray(value.build.pro, `${field}.build.pro`);
  assertStringOrArray(value.build.base, `${field}.build.base`);
  assertStringOrArray(value.build.veg, `${field}.build.veg`);
  assertStringOrArray(value.build.engine, `${field}.build.engine`);
  assertRecord(value.macros, `${field}.macros`);
  assertNumber(value.macros.cal, `${field}.macros.cal`);
  assertNumber(value.macros.p, `${field}.macros.p`);
  assertNumber(value.macros.c, `${field}.macros.c`);
  assertNumber(value.macros.f, `${field}.macros.f`);
  assertOptionalNumber(value.macros.fiber, `${field}.macros.fiber`);

  // Validate optional ingredients array if present
  if ('ingredients' in value && value.ingredients !== undefined) {
    if (!Array.isArray(value.ingredients)) {
      throw new Error(`${field}.ingredients must be an array.`);
    }

    value.ingredients.forEach((ingredient, idx) => {
      if (!isRecord(ingredient)) {
        throw new Error(`${field}.ingredients[${idx}] must be an object.`);
      }

      assertString(ingredient.name, `${field}.ingredients[${idx}].name`);
      assertString(ingredient.quantity, `${field}.ingredients[${idx}].quantity`);
      assertString(ingredient.category, `${field}.ingredients[${idx}].category`);
      assertRecord(ingredient.macros, `${field}.ingredients[${idx}].macros`);
      assertNumber(ingredient.macros.cal, `${field}.ingredients[${idx}].macros.cal`);
      assertNumber(ingredient.macros.p, `${field}.ingredients[${idx}].macros.p`);
      assertNumber(ingredient.macros.c, `${field}.ingredients[${idx}].macros.c`);
      assertNumber(ingredient.macros.f, `${field}.ingredients[${idx}].macros.f`);
      assertOptionalNumber(ingredient.macros.fiber, `${field}.ingredients[${idx}].macros.fiber`);
    });
  }
}

function assertListCategories(
  value: unknown,
  field: string
): asserts value is ListCategory[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  value.forEach((category, categoryIndex) => {
    if (!isRecord(category)) {
      throw new Error(`${field}[${categoryIndex}] must be an object.`);
    }

    assertString(category.category, `${field}[${categoryIndex}].category`);

    if (!Array.isArray(category.items)) {
      throw new Error(`${field}[${categoryIndex}].items must be an array.`);
    }

    category.items.forEach((item, itemIndex) => {
      if (!isRecord(item)) {
        throw new Error(
          `${field}[${categoryIndex}].items[${itemIndex}] must be an object.`
        );
      }

      assertString(item.n, `${field}[${categoryIndex}].items[${itemIndex}].n`);
      if ("q" in item && item.q !== undefined) {
        assertString(item.q, `${field}[${categoryIndex}].items[${itemIndex}].q`);
      }
    });
  });
}

function assertRecord(
  value: unknown,
  field: string
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object.`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
}

function assertStringOrArray(value: unknown, field: string): asserts value is string | string[] {
  if (typeof value === "string" && value.trim().length > 0) {
    return;
  }
  
  if (Array.isArray(value) && value.length > 0 && value.every(item => typeof item === "string" && item.trim().length > 0)) {
    return;
  }
  
  throw new Error(`${field} must be a non-empty string or array of non-empty strings.`);
}

function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${field} must be a number.`);
  }
}

function assertOptionalNumber(value: unknown, field: string): asserts value is number | undefined {
  if (value === undefined) return;
  assertNumber(value, field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
