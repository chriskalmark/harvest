import {
  MealIngredient,
  MealType,
  StoredMeal,
  StoredMealPlan,
} from "@/lib/types";

export interface ShoppingUsageMeal {
  mealId: number;
  name: string;
  type: MealType;
}

export interface ShoppingItemUsage {
  mealCount: number;
  mealTypes: Record<MealType, number>;
  meals: ShoppingUsageMeal[];
}

export type ShoppingUsageByKey = Record<string, ShoppingItemUsage>;

const mealTypeOrder: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export function getShoppingUsageKey(category: string, itemName: string) {
  return `${category}::${normalizeShoppingName(itemName)}`;
}

export function normalizeShoppingName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function shoppingItemMatchesMealIngredient(
  itemName: string,
  ingredientName: string,
) {
  const item = normalizeShoppingName(itemName);
  const ingredient = normalizeShoppingName(ingredientName);

  if (!item || !ingredient) {
    return false;
  }

  return (
    item === ingredient ||
    item.includes(ingredient) ||
    ingredient.includes(item)
  );
}

export function getShoppingItemUsage(plan: StoredMealPlan): ShoppingUsageByKey {
  const meals = plan.meals;

  return Object.fromEntries(
    plan.shoppingList.flatMap((category) =>
      category.items.map((item) => [
        getShoppingUsageKey(category.category, item.n),
        getUsageForItem(item.n, meals),
      ]),
    ),
  );
}

function getUsageForItem(
  itemName: string,
  meals: StoredMeal[],
): ShoppingItemUsage {
  const usedMeals = meals.filter((meal) => {
    const ingredients = getMealIngredientNames(meal);
    return ingredients.some((ingredient) =>
      shoppingItemMatchesMealIngredient(itemName, ingredient),
    );
  });

  return {
    mealCount: usedMeals.length,
    mealTypes: mealTypeOrder.reduce(
      (counts, mealType) => ({
        ...counts,
        [mealType]: usedMeals.filter((meal) => meal.type === mealType).length,
      }),
      {} as Record<MealType, number>,
    ),
    meals: usedMeals.map((meal) => ({
      mealId: meal.mealId,
      name: meal.name,
      type: meal.type,
    })),
  };
}

function getMealIngredientNames(meal: StoredMeal) {
  const structured = meal.ingredients
    ?.map((ingredient: MealIngredient) => ingredient.name)
    .filter(Boolean);

  if (structured?.length) {
    return structured;
  }

  return [
    ...meal.build.pro,
    ...meal.build.base,
    ...meal.build.veg,
    ...meal.build.engine,
  ];
}
