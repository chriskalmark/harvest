import { normalizeShoppingName } from "@/lib/domain/shoppingUsage";
import type { MealIngredient, MealIngredientUnit } from "@/lib/types";
import type { StoreZone } from "@/lib/constants";

export interface AggregatableMeal {
  servings: number;
  ingredients?: MealIngredient[];
}

export interface AggregatedIngredient {
  /** Normaliseret nøgle — bruges til at lægge ens varer sammen. */
  name: string;
  /** Navnet som forfatteren skrev det. Det er dette, brugeren læser. */
  displayName: string;
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
    if (!Number.isFinite(meal.servings) || meal.servings <= 0) {
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
        // Første forekomst vinder — samme princip som zonen nedenfor.
        displayName: ingredient.name.trim(),
        amount: scaled,
        unit: ingredient.unit,
        // Ved modstridende zoner for samme vare vinder den først sete.
        // Bevidst og deterministisk — prisen er én forkert gang i butikken,
        // ikke en manglende vare.
        zone: ingredient.zone,
      });
    }
  }

  return Array.from(byKey.values()).map((item) => ({
    ...item,
    amount: roundForUnit(item.amount, item.unit),
  }));
}

/**
 * Runder til noget, man kan stå med i en indkøbskurv.
 *
 * En positiv mængde må aldrig blive til 0: en ingrediens, der er kommet med i
 * en opskrift, skal kunne ses på listen. Små mængder klemmes derfor op til
 * mindste trin i stedet for at forsvinde.
 */
function roundForUnit(amount: number, unit: MealIngredientUnit): number {
  if (WHOLE_UNITS.has(unit)) {
    // Flydende-komma-drift (fx tre 1/3-dele der summerer til 1.0000000000000002)
    // må ikke skubbe en hel enhed op — støjen fjernes før der rundes op.
    return Math.max(1, Math.ceil(Number(amount.toFixed(6))));
  }

  return Math.max(0.1, Math.round(amount * 10) / 10);
}
