import {
  DEFAULT_STORE_ZONE,
  STORE_CATEGORY_ORDER,
  type StoreZone,
} from "@/lib/constants";
import type { ListCategory } from "@/lib/types";

export type { StoreZone };

/**
 * Zonen sættes af madplanens forfatter på hver ingrediens.
 * Denne funktion er kun en reserve for data uden gyldig zone.
 */
export function resolveStoreZone(zone?: string): StoreZone {
  return isStoreZone(zone) ? zone : DEFAULT_STORE_ZONE;
}

export function isStoreZone(value: unknown): value is StoreZone {
  return (
    typeof value === "string" &&
    (STORE_CATEGORY_ORDER as readonly string[]).includes(value)
  );
}

export function organizeShoppingListForStoreLayout(
  sections: ListCategory[],
): ListCategory[] {
  const byZone = new Map<StoreZone, ListCategory>();

  for (const section of sections) {
    const zone = resolveStoreZone(section.category);
    const existing = byZone.get(zone);

    if (existing) {
      existing.items.push(...section.items);
      continue;
    }

    byZone.set(zone, { category: zone, items: [...section.items] });
  }

  return STORE_CATEGORY_ORDER.map((zone) => byZone.get(zone)).filter(
    (section): section is ListCategory => Boolean(section),
  );
}
