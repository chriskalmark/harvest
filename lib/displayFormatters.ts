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

/** Dansk ental/flertal: 1 -> singular, alt andet -> plural. */
export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return count === 1 ? singular : plural;
}

/**
 * Fjerner en eventuel autoriseret "1. "/"2) "-præfiks fra et opskrifttrin.
 * Trinnets nummer vises allerede som separat, stylet talelement — teksten
 * skal ikke gentage det.
 */
export function stripStepPrefix(step: string): string {
  return step.replace(/^\s*\d+[.)]\s*/, "");
}
