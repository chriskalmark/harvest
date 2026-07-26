import assert from "node:assert/strict";
import {
  classifyShoppingItem,
  getItemStoreZone,
  TraderJoesStoreZone,
} from "@/lib/shoppingListOrder";

const cases: Array<{
  itemName: string;
  expectedZone: TraderJoesStoreZone;
  expectedConfidence?: "exact" | "keyword" | "fallback";
}> = [
  {
    itemName: "Trader Joe's Whole Wheat English Muffins",
    expectedZone: "Bread & Tortillas",
    expectedConfidence: "exact",
  },
  {
    itemName: "Trader Joe's Steamed Lentils",
    expectedZone: "Pantry Items",
    expectedConfidence: "exact",
  },
  {
    itemName: "Trader Joe's Garlic Shrimp Chips",
    expectedZone: "Chips",
    expectedConfidence: "exact",
  },
  {
    itemName: "Trader Joe's Lemon Tiramisu",
    expectedZone: "Frozen Food",
    expectedConfidence: "exact",
  },
  {
    itemName: "Trader Joe's Gözlemes",
    expectedZone: "Frozen Food",
    expectedConfidence: "exact",
  },
  {
    itemName: "Trader Joe's Vanilla Mascarpone",
    expectedZone: "Deli Meats & Cheeses",
    expectedConfidence: "exact",
  },
  { itemName: "Trader Joe's Mini Bouquet", expectedZone: "Flowers" },
  { itemName: "Trader Joe's Southwestern Chopped Salad Kit", expectedZone: "Prepped Salads" },
  { itemName: "Trader Joe's Fresh Basil", expectedZone: "Herbs" },
  { itemName: "Trader Joe's Baby Spinach", expectedZone: "Vegetables" },
  { itemName: "Trader Joe's Honeycrisp Apples", expectedZone: "Fruit" },
  { itemName: "Trader Joe's Sweet Potatoes", expectedZone: "Roots" },
  { itemName: "Trader Joe's Sparkling Water", expectedZone: "Beverages" },
  { itemName: "Trader Joe's Unexpected Cheddar", expectedZone: "Deli Meats & Cheeses" },
  { itemName: "Trader Joe's Greek Yogurt", expectedZone: "Dairy & Eggs" },
  { itemName: "Trader Joe's Soy Chorizo", expectedZone: "Vegan Items" },
  { itemName: "Trader Joe's Everything But the Bagel Seasoning", expectedZone: "Pantry Items" },
  { itemName: "Trader Joe's Chicken Tikka Masala", expectedZone: "Frozen Food" },
  { itemName: "Trader Joe's Dark Chocolate Peanut Butter Cups", expectedZone: "Sweets" },
  { itemName: "Trader Joe's Ground Turkey", expectedZone: "Meats & Seafood" },
  { itemName: "Trader Joe's Flour Tortillas", expectedZone: "Bread & Tortillas" },
  { itemName: "Trader Joe's Restaurant Style Tortilla Chips", expectedZone: "Chips" },
  { itemName: "Trader Joe's Pinot Noir", expectedZone: "Beer/Wine" },
];

for (const testCase of cases) {
  const classification = classifyShoppingItem(testCase.itemName);

  assert.equal(
    classification.zone,
    testCase.expectedZone,
    `${testCase.itemName} should classify to ${testCase.expectedZone}`
  );
  assert.equal(
    getItemStoreZone(testCase.itemName),
    testCase.expectedZone,
    `${testCase.itemName} getItemStoreZone wrapper should match classification`
  );

  if (testCase.expectedConfidence) {
    assert.equal(
      classification.confidence,
      testCase.expectedConfidence,
      `${testCase.itemName} should classify with ${testCase.expectedConfidence} confidence`
    );
  }
}

console.log(`Shopping list order tests passed (${cases.length} cases).`);
