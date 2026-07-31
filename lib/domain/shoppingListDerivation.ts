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

/**
 * `derivedByName` is keyed by `${normalizedName}::${discriminator}`, not by
 * name alone. The same ingredient can legitimately appear in two units (an
 * onion at "1 stk" in one meal and "50 g" in another) and both must survive
 * as separate lines — keying by name alone let the second overwrite the
 * first with no warning. The discriminator is the unit for meal-derived
 * lines, and a fixed tag for junk/orphan lines, which have no unit of their
 * own. Cross-writer de-duplication (so a junk item doesn't duplicate a meal
 * ingredient of the same name) is done separately via `derivedNames`, a set
 * of normalized names already represented — not via key equality, since the
 * key shapes differ by discriminator on purpose.
 */
function derivationKey(normalizedName: string, discriminator: string): string {
  return `${normalizedName}::${discriminator}`;
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
  const derivedNames = new Set<string>();

  const aggregated = aggregateShoppingQuantities(meals);
  const unitCountByName = new Map<string, number>();
  for (const item of aggregated) {
    unitCountByName.set(item.name, (unitCountByName.get(item.name) ?? 0) + 1);
  }

  for (const item of aggregated) {
    const previous = findPreviousItem(
      previousByName,
      item.name,
      item.unit,
      unitCountByName.get(item.name) === 1,
    );

    derivedByName.set(derivationKey(item.name, item.unit), {
      ...buildShoppingItem(item.displayName, previous),
      q: formatQuantity(item.amount, item.unit),
      zone: item.zone,
      unit: item.unit,
    });
    derivedNames.add(item.name);
  }

  mergeJunkItems(derivedByName, derivedNames, junkList, previousByName.byName);

  if (!options?.pruneOrphans) {
    preserveOrphanItems(derivedByName, derivedNames, previousByName.byName);
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
  derivedNames: Set<string>,
  junkList: ListCategory[],
  previousByName: Map<string, PreservedShoppingItem>,
): void {
  for (const junkCategory of junkList) {
    for (const junkItem of junkCategory.items) {
      const itemName = junkItem.n.trim();
      const normalizedName = normalizeShoppingName(itemName);
      // A meal ingredient of the same name already covers this line —
      // regardless of which unit-discriminated key it landed under.
      if (!normalizedName || derivedNames.has(normalizedName)) {
        continue;
      }

      const previous = previousByName.get(normalizedName)?.item;
      derivedByName.set(
        derivationKey(normalizedName, "junk"),
        buildShoppingItem(itemName, previous, {
          q: junkItem.q,
          shoppingSource: "junk",
        }),
      );
      derivedNames.add(normalizedName);
    }
  }
}

function preserveOrphanItems(
  derivedByName: Map<string, ListItem>,
  derivedNames: Set<string>,
  previousByName: Map<string, PreservedShoppingItem>,
): void {
  for (const [normalizedName, preserved] of previousByName) {
    if (
      !derivedNames.has(normalizedName) &&
      preserved.item.shoppingSource !== "junk" &&
      preserved.item.shoppingSource !== "household"
    ) {
      derivedByName.set(
        derivationKey(normalizedName, "orphan"),
        preserved.item,
      );
      derivedNames.add(normalizedName);
    }
  }
}

interface PreviousItemsIndex {
  /** First-seen item per name — used for junk/orphan/household matching,
   * which have no unit of their own, and as the legacy fallback below. */
  byName: Map<string, PreservedShoppingItem>;
  /** Every previous item that has a stored `unit`, keyed by name+unit, so a
   * tick can be matched to the exact line it belongs to. */
  byNameAndUnit: Map<string, PreservedShoppingItem>;
}

function getPreviousItemsByName(
  shoppingList: ListCategory[],
): PreviousItemsIndex {
  const byName = new Map<string, PreservedShoppingItem>();
  const byNameAndUnit = new Map<string, PreservedShoppingItem>();

  for (const category of shoppingList) {
    if (category.category === HOUSEHOLD_GOODS_SECTION) {
      continue;
    }

    for (const item of category.items) {
      const normalizedName = normalizeShoppingName(item.n);
      if (!normalizedName) {
        continue;
      }

      // The zone lived only in which category the item was filed under.
      // Stamp it onto the item so a later recalculation doesn't relocate
      // it to the fallback zone.
      const preserved: PreservedShoppingItem = {
        item: item.zone ? item : { ...item, zone: category.category },
      };

      if (!byName.has(normalizedName)) {
        byName.set(normalizedName, preserved);
      }

      if (item.unit) {
        byNameAndUnit.set(derivationKey(normalizedName, item.unit), preserved);
      }
    }
  }

  return { byName, byNameAndUnit };
}

/**
 * Matches a derived line to its previous `checked`/`pantry` state.
 *
 * Exact name+unit matches take priority — that's how two lines sharing a
 * name but differing in unit (oil in tsk vs spsk) each keep their own tick,
 * unambiguously, regardless of how many units the name resolves to.
 *
 * When no exact match exists, fall back to the first name-only match, but
 * only if that stored item has no `unit` of its own (data written before
 * this change shipped) AND the name currently resolves to exactly one unit.
 * That fallback exists so a single-unit legacy line keeps its tick — it must
 * not fire when the name has just split into multiple units, because then a
 * single old undifferentiated tick can't be attributed to either new line
 * without guessing, and guessing wrong is worse than dropping it.
 */
function findPreviousItem(
  index: PreviousItemsIndex,
  normalizedName: string,
  unit: string,
  isUnambiguousName: boolean,
): ListItem | undefined {
  const exact = index.byNameAndUnit.get(derivationKey(normalizedName, unit));
  if (exact) {
    return exact.item;
  }

  if (!isUnambiguousName) {
    return undefined;
  }

  const byNameOnly = index.byName.get(normalizedName)?.item;
  if (byNameOnly && byNameOnly.unit === undefined) {
    return byNameOnly;
  }

  return undefined;
}
