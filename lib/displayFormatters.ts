import type { MealIngredientUnit } from "@/lib/types";

export function formatQuantity(
  amount: number,
  unit: MealIngredientUnit,
): string {
  const rounded = Number.isInteger(amount)
    ? amount
    : Math.round(amount * 10) / 10;
  return `${rounded.toString().replace(".", ",")} ${unit}`;
}
