import fs from "fs";
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";
import { extractWeekDataFromMarkdown } from "@/lib/mealPlanMarkdown";
import { isStoreZone } from "@/lib/shoppingListOrder";
import { ListCategory, Macros, MealInput, WeekData } from "@/lib/types";

import { EXPECTED_MEAL_COUNTS } from "@/lib/constants";

const REQUIRED_JUNK_CATEGORIES = [
  "Coffee/Creamer",
  "Beer/Wine",
  "Chips",
  "Sweets",
  "Frozen Food",
  "Frozen Treats",
  "Beverages/Drinks",
];

const MACRO_KEYS = ["cal", "p", "c", "f", "fiber"] as const;

export interface MealPlanValidationOptions {
  printShoppingOrder?: boolean;
  allowShoppingFallbacks?: boolean;
  macroTolerance?: number;
}

export interface MealPlanValidationResult {
  valid: boolean;
  filepath: string;
  weekData?: WeekData;
  shoppingList?: ListCategory[];
  errors: string[];
  warnings: string[];
}

export function validateMealPlanFile(
  filepath: string,
  options: MealPlanValidationOptions = {},
): MealPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const macroTolerance = options.macroTolerance ?? 1;

  try {
    const content = fs.readFileSync(filepath, "utf8");
    const rawWeekData = parseRawWeekData(content);
    const weekData = extractWeekDataFromMarkdown(content);

    validateMealCounts(weekData, errors);
    validateFiberPresence(rawWeekData, errors);
    validateIngredientMacroTotals(weekData, macroTolerance, errors);
    validateUniqueBuildValues(weekData, "base", errors);
    validateUniqueBuildValues(weekData, "engine", errors);
    validateJunkCategories(weekData, errors);

    const shoppingList = deriveShoppingListFromMeals(
      weekData.meals,
      [],
      weekData.junkList,
      weekData.householdGoods ?? [],
    );
    validateIngredientZones(
      weekData,
      errors,
      warnings,
      Boolean(options.allowShoppingFallbacks),
    );

    if (options.printShoppingOrder) {
      printShoppingOrder(shoppingList);
    }

    return {
      valid: errors.length === 0,
      filepath,
      weekData,
      shoppingList,
      errors,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      filepath,
      errors: [`Invalid meal plan structure: ${message}`],
      warnings,
    };
  }
}

export function printMealPlanValidationResult(
  result: MealPlanValidationResult,
) {
  for (const warning of result.warnings) {
    console.log(`⚠️  ${warning}`);
  }

  for (const error of result.errors) {
    console.log(`❌ ${error}`);
  }

  if (result.valid) {
    console.log("✅ Meal plan validation passed.");
  }
}

function parseRawWeekData(markdown: string): WeekData {
  const match = markdown.match(/```json\s*([\s\S]*?)```/i);

  if (!match) {
    throw new Error("Unable to find a ```json``` block.");
  }

  return JSON.parse(match[1]) as WeekData;
}

function validateMealCounts(weekData: WeekData, errors: string[]) {
  const counts = weekData.meals.reduce<Record<string, number>>((acc, meal) => {
    acc[meal.type] = (acc[meal.type] ?? 0) + 1;
    return acc;
  }, {});

  for (const [type, want] of Object.entries(EXPECTED_MEAL_COUNTS)) {
    const got = counts[type] ?? 0;
    if (got !== want) {
      errors.push(`Expected ${want} ${type}(s), found ${got}.`);
    }
  }

  const totalExpected = Object.values(EXPECTED_MEAL_COUNTS).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (weekData.meals.length !== totalExpected) {
    errors.push(
      `Expected ${totalExpected} total meals, found ${weekData.meals.length}.`,
    );
  }
}

function validateFiberPresence(weekData: WeekData, errors: string[]) {
  weekData.meals.forEach((meal, mealIndex) => {
    if (!hasNumericMacro(meal.macros, "fiber")) {
      errors.push(
        `meals[${mealIndex}] "${meal.name}" is missing numeric macros.fiber.`,
      );
    }

    meal.ingredients?.forEach((ingredient, ingredientIndex) => {
      if (!hasNumericMacro(ingredient.macros, "fiber")) {
        errors.push(
          `meals[${mealIndex}].ingredients[${ingredientIndex}] "${ingredient.name}" is missing numeric macros.fiber.`,
        );
      }
    });
  });
}

function validateIngredientMacroTotals(
  weekData: WeekData,
  tolerance: number,
  errors: string[],
) {
  weekData.meals.forEach((meal, mealIndex) => {
    if (!meal.ingredients?.length) {
      errors.push(
        `meals[${mealIndex}] "${meal.name}" must include ingredients for macro validation.`,
      );
      return;
    }

    const ingredientTotals = sumIngredientMacros(meal);
    for (const macroKey of MACRO_KEYS) {
      const diff = Math.abs(ingredientTotals[macroKey] - meal.macros[macroKey]);
      if (diff > tolerance) {
        errors.push(
          `meals[${mealIndex}] "${meal.name}" ${macroKey} total mismatch: ingredients=${round(ingredientTotals[macroKey])}, meal=${meal.macros[macroKey]}.`,
        );
      }
    }
  });
}

function validateUniqueBuildValues(
  weekData: WeekData,
  buildKey: "base" | "engine",
  errors: string[],
) {
  const seen = new Map<string, string>();

  weekData.meals.forEach((meal) => {
    for (const value of meal.build[buildKey]) {
      const normalized = normalizeComparableValue(value);
      const previousMeal = seen.get(normalized);

      if (previousMeal) {
        errors.push(
          `Duplicate ${buildKey} "${value}" in "${previousMeal}" and "${meal.name}".`,
        );
      } else {
        seen.set(normalized, meal.name);
      }
    }
  });
}

function validateJunkCategories(weekData: WeekData, errors: string[]) {
  const actual = weekData.junkList.map((category) => category.category);

  if (actual.length !== REQUIRED_JUNK_CATEGORIES.length) {
    errors.push(
      `Junk list must have ${REQUIRED_JUNK_CATEGORIES.length} categories, found ${actual.length}.`,
    );
  }

  REQUIRED_JUNK_CATEGORIES.forEach((category, index) => {
    if (actual[index] !== category) {
      errors.push(
        `Junk list category ${index + 1} must be "${category}", found "${actual[index] ?? "(missing)"}".`,
      );
    }
  });
}

function validateIngredientZones(
  weekData: WeekData,
  errors: string[],
  warnings: string[],
  allowShoppingFallbacks: boolean,
) {
  const invalidZoneItems = weekData.meals.flatMap((meal) =>
    (meal.ingredients ?? [])
      .filter((ingredient) => !isStoreZone(ingredient.zone))
      .map((ingredient) => ({
        mealName: meal.name,
        ingredientName: ingredient.name,
      })),
  );

  if (!invalidZoneItems.length) {
    return;
  }

  const message = `Ingredients missing a valid store zone: ${invalidZoneItems
    .map((item) => `"${item.ingredientName}" in "${item.mealName}"`)
    .join(", ")}.`;

  if (allowShoppingFallbacks) {
    warnings.push(message);
  } else {
    errors.push(message);
  }
}

function printShoppingOrder(shoppingList: ListCategory[]) {
  console.log("🛒 Derived Trader Joe's shopping order:");
  for (const category of shoppingList) {
    console.log(
      `  ${category.category}: ${category.items.map((item) => item.n).join(", ")}`,
    );
  }
}

function sumIngredientMacros(meal: MealInput): Macros {
  return meal.ingredients!.reduce<Macros>(
    (acc, ingredient) => ({
      cal: acc.cal + ingredient.macros.cal,
      p: acc.p + ingredient.macros.p,
      c: acc.c + ingredient.macros.c,
      f: acc.f + ingredient.macros.f,
      fiber: acc.fiber + ingredient.macros.fiber,
    }),
    { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
  );
}

function hasNumericMacro(
  macros: Partial<Macros> | undefined,
  macroKey: keyof Macros,
) {
  const value = macros?.[macroKey];
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeComparableValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
