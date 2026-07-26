/**
 * Pure business logic for macro calculations
 * All functions are pure, testable, no side effects
 */

import { Macros, MealIngredient, MealInput, StoredMeal } from "@/lib/types";

const EMPTY_MACROS: Macros = { cal: 0, p: 0, c: 0, f: 0, fiber: 0 };

type MacroBearing = Pick<MealInput | StoredMeal, "macros">;

/**
 * Sum macros across an arbitrary list of meals (e.g. the whole week).
 */
export function sumMealMacros(meals: MacroBearing[]): Macros {
  return meals.reduce(
    (acc, meal) => ({
      cal: acc.cal + meal.macros.cal,
      p: acc.p + meal.macros.p,
      c: acc.c + meal.macros.c,
      f: acc.f + meal.macros.f,
      fiber: acc.fiber + meal.macros.fiber,
    }),
    { ...EMPTY_MACROS }
  );
}

/**
 * Calculate total macros for a meal by summing ingredient macros
 */
export function calculateMealMacrosFromIngredients(ingredients: MealIngredient[]): Macros {
  return ingredients.reduce(
    (acc, ingredient) => ({
      cal: acc.cal + ingredient.macros.cal,
      p: acc.p + ingredient.macros.p,
      c: acc.c + ingredient.macros.c,
      f: acc.f + ingredient.macros.f,
      fiber: acc.fiber + ingredient.macros.fiber,
    }),
    { ...EMPTY_MACROS }
  );
}

/**
 * Validate meal macros match sum of ingredients
 * Returns true if totals are within 5 calorie tolerance
 */
export function validateMealIngredientMacros(meal: MealInput): boolean {
  if (!meal.ingredients || meal.ingredients.length === 0) return true;

  const calculated = calculateMealMacrosFromIngredients(meal.ingredients);
  const tolerance = 5;

  return Math.abs(calculated.cal - meal.macros.cal) <= tolerance &&
         Math.abs(calculated.p - meal.macros.p) <= tolerance;
}

/**
 * Get ingredient count validation (5-7 ingredients max per meal)
 */
export function validateIngredientCount(ingredients: MealIngredient[]): { valid: boolean; message?: string } {
  if (ingredients.length < 3) {
    return { valid: false, message: "Meal should have at least 3 ingredients" };
  }
  if (ingredients.length > 7) {
    return { valid: false, message: "Meal should have maximum 7 ingredients" };
  }
  return { valid: true };
}
