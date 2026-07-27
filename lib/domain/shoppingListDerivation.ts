import { HOUSEHOLD_GOODS_SECTION } from "@/lib/constants";
import {
  ListCategory,
  ListItem,
  MealInput,
  StoredMeal,
  HouseholdGoodsItem,
} from "@/lib/types";
import {
  resolveStoreZone,
  organizeShoppingListForStoreLayout,
} from "@/lib/shoppingListOrder";
import { normalizeShoppingName } from "@/lib/domain/shoppingUsage";
import { aggregateShoppingQuantities } from "@/lib/domain/shoppingAggregation";
import { formatQuantity } from "@/lib/displayFormatters";

type DerivableMeal = MealInput | StoredMeal;

interface PreservedShoppingItem {
  item: ListItem;
}

export function deriveShoppingListFromMeals(
  meals: DerivableMeal[],
  previousShoppingList: ListCategory[] = [],
  junkList: ListCategory[] = [],
  householdGoods: HouseholdGoodsItem[] = [],
  options?: { pruneOrphans?: boolean },
): ListCategory[] {
  const previousByName = getPreviousItemsByName(previousShoppingList);
  const derivedByName = new Map<string, ListItem>();

  for (const aggregated of aggregateShoppingQuantities(meals)) {
    const previous = previousByName.get(aggregated.name)?.item;

    derivedByName.set(aggregated.name, {
      ...buildShoppingItem(aggregated.displayName, previous),
      q: formatQuantity(aggregated.amount, aggregated.unit),
      zone: aggregated.zone,
    });
  }

  mergeJunkItems(derivedByName, junkList, previousByName);

  if (!options?.pruneOrphans) {
    preserveOrphanItems(derivedByName, previousByName);
  }

  const storeLayoutList = organizeShoppingListForStoreLayout(
    Array.from(derivedByName.values()).map((item) => ({
      category: resolveStoreZone(item.zone),
      items: [item],
    })),
  );

  const householdSection = buildHouseholdGoodsSection(
    householdGoods,
    previousShoppingList,
  );
  if (!householdSection) {
    return storeLayoutList;
  }

  return [...storeLayoutList, householdSection];
}

function buildHouseholdGoodsSection(
  householdGoods: HouseholdGoodsItem[],
  previousShoppingList: ListCategory[],
): ListCategory | null {
  if (householdGoods.length === 0) {
    return null;
  }

  const previousHousehold = previousShoppingList.find(
    (category) => category.category === HOUSEHOLD_GOODS_SECTION,
  );
  const previousByName = new Map(
    (previousHousehold?.items ?? []).map((item) => [
      normalizeShoppingName(item.n),
      item,
    ]),
  );

  return {
    category: HOUSEHOLD_GOODS_SECTION,
    items: householdGoods.map((item) => {
      const previous = previousByName.get(normalizeShoppingName(item.n));
      return buildShoppingItem(item.n, previous, {
        shoppingSource: "household",
      });
    }),
  };
}

function buildShoppingItem(
  itemName: string,
  previous?: ListItem,
  options: { q?: string; shoppingSource?: "junk" | "household" } = {},
): ListItem {
  return {
    n: itemName,
    q: previous?.q ?? options.q,
    pantry: previous?.pantry,
    checked: previous?.checked,
    ...(options.shoppingSource
      ? { shoppingSource: options.shoppingSource }
      : {}),
  };
}

function mergeJunkItems(
  derivedByName: Map<string, ListItem>,
  junkList: ListCategory[],
  previousByName: Map<string, PreservedShoppingItem>,
): void {
  for (const junkCategory of junkList) {
    for (const junkItem of junkCategory.items) {
      const itemName = junkItem.n.trim();
      const normalizedName = normalizeShoppingName(itemName);
      if (!normalizedName || derivedByName.has(normalizedName)) {
        continue;
      }

      const previous = previousByName.get(normalizedName)?.item;
      derivedByName.set(
        normalizedName,
        buildShoppingItem(itemName, previous, {
          q: junkItem.q,
          shoppingSource: "junk",
        }),
      );
    }
  }
}

function preserveOrphanItems(
  derivedByName: Map<string, ListItem>,
  previousByName: Map<string, PreservedShoppingItem>,
): void {
  for (const [normalizedName, preserved] of previousByName) {
    if (
      !derivedByName.has(normalizedName) &&
      preserved.item.shoppingSource !== "junk" &&
      preserved.item.shoppingSource !== "household"
    ) {
      derivedByName.set(normalizedName, preserved.item);
    }
  }
}

function getPreviousItemsByName(shoppingList: ListCategory[]) {
  const itemsByName = new Map<string, PreservedShoppingItem>();

  for (const category of shoppingList) {
    if (category.category === HOUSEHOLD_GOODS_SECTION) {
      continue;
    }

    for (const item of category.items) {
      const normalizedName = normalizeShoppingName(item.n);
      if (!normalizedName || itemsByName.has(normalizedName)) {
        continue;
      }

      // The zone lived only in which category the item was filed under.
      // Stamp it onto the item so a later recalculation doesn't relocate
      // it to the fallback zone.
      itemsByName.set(normalizedName, {
        item: item.zone ? item : { ...item, zone: category.category },
      });
    }
  }

  return itemsByName;
}
