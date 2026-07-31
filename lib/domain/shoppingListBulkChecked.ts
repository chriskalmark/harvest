import type { ListCategory } from "@/lib/types";

/**
 * Returns a new shopping list with `checked` set on every item, in every
 * category. Used by PATCH /api/mealplan/shopping's `{ all: true, checked }`
 * branch — the mechanism behind "clear the shopping list": items can't be
 * deleted (they're re-derived from the week's meals on every read), but
 * `checked` is genuinely persisted per item, so marking everything checked
 * and hiding checked items ("Skjul klaret") is what actually sticks.
 */
export function setAllItemsChecked(
  shoppingList: ListCategory[],
  checked: boolean,
): ListCategory[] {
  return shoppingList.map((categoryGroup) => ({
    ...categoryGroup,
    items: categoryGroup.items.map((item) => ({ ...item, checked })),
  }));
}
