import { normalizeShoppingName } from "@/lib/domain/shoppingUsage";
import type { MealIngredient, MealIngredientUnit } from "@/lib/types";
import type { StoreZone } from "@/lib/constants";

export interface AggregatableMeal {
  servings: number;
  ingredients?: MealIngredient[];
}

export interface AggregatedIngredient {
  name: string;
  amount: number;
  unit: MealIngredientUnit;
  zone: StoreZone;
}

/** Enheder hvor en brøkdel ikke giver mening i en indkøbskurv. */
const WHOLE_UNITS: ReadonlySet<MealIngredientUnit> = new Set([
  "stk",
  "bundt",
  "dåse",
  "pakke",
]);

export function aggregateShoppingQuantities(
  meals: AggregatableMeal[],
): AggregatedIngredient[] {
  const byKey = new Map<string, AggregatedIngredient>();

  for (const meal of meals) {
    if (meal.servings <= 0) {
      continue;
    }

    for (const ingredient of meal.ingredients ?? []) {
      const name = normalizeShoppingName(ingredient.name);
      if (
        !name ||
        !Number.isFinite(ingredient.amount) ||
        ingredient.amount <= 0
      ) {
        continue;
      }

      const key = `${name}::${ingredient.unit}`;
      const scaled = ingredient.amount * meal.servings;
      const existing = byKey.get(key);

      if (existing) {
        existing.amount += scaled;
        continue;
      }

      byKey.set(key, {
        name,
        amount: scaled,
        unit: ingredient.unit,
        zone: ingredient.zone,
      });
    }
  }

  return Array.from(byKey.values()).map((item) => ({
    ...item,
    amount: WHOLE_UNITS.has(item.unit)
      ? Math.ceil(item.amount)
      : Math.round(item.amount * 10) / 10,
  }));
}
