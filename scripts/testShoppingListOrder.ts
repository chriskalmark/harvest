import assert from "node:assert/strict";
import { organizeShoppingListForStoreLayout } from "@/lib/shoppingListOrder";
import { DEFAULT_STORE_ZONE, STORE_CATEGORY_ORDER } from "@/lib/constants";

// Zoner sorteres i butikkens gå-rækkefølge, uanset hvilken rækkefølge de kom i.
{
  const organised = organizeShoppingListForStoreLayout([
    { category: "Frost", items: [{ n: "ærter" }] },
    { category: "Frugt & grønt", items: [{ n: "gulerod" }] },
    { category: "Kød & fjerkræ", items: [{ n: "kyllingelår" }] },
  ]);

  assert.deepEqual(
    organised.map((section) => section.category),
    ["Frugt & grønt", "Kød & fjerkræ", "Frost"],
  );
}

// Varer i samme zone samles i én sektion.
{
  const organised = organizeShoppingListForStoreLayout([
    { category: "Frugt & grønt", items: [{ n: "gulerod" }] },
    { category: "Frugt & grønt", items: [{ n: "porre" }] },
  ]);

  assert.equal(organised.length, 1);
  assert.equal(organised[0].items.length, 2);
}

// En ukendt zone havner i reservezonen frem for at forsvinde.
{
  const organised = organizeShoppingListForStoreLayout([
    { category: "Ukendt Afdeling", items: [{ n: "mystisk vare" }] },
  ]);

  assert.equal(organised.length, 1);
  assert.equal(organised[0].category, DEFAULT_STORE_ZONE);
  assert.ok(STORE_CATEGORY_ORDER.includes(organised[0].category));
}

console.log("shopping list order: OK");
