/**
 * System-wide constants for Harvest Meal Engine
 * Single source of truth for all hardcoded values
 */

import type { MealType } from "@/lib/types";

// Week shape — single source of truth for meal counts per type
export const EXPECTED_MEAL_COUNTS = {
  Breakfast: 1,
  Lunch: 1,
  Dinner: 2,
} as const;

export const EXPECTED_MEAL_TOTAL = Object.values(EXPECTED_MEAL_COUNTS).reduce(
  (sum, count) => sum + count,
  0
);

// Trader Joe's home-store layout category order
// Keep aligned with lib/shoppingListOrder.ts.
export const STORE_CATEGORY_ORDER = [
  "Flowers",
  "Prepped Salads",
  "Herbs",
  "Vegetables",
  "Fruit",
  "Roots",
  "Beverages",
  "Deli Meats & Cheeses",
  "Dairy & Eggs",
  "Vegan Items",
  "Pantry Items",
  "Frozen Food",
  "Sweets",
  "Meats & Seafood",
  "Bread & Tortillas",
  "Chips",
  "Beer/Wine"
] as const;

// Meal Type Ordering
export const MEAL_TYPES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack"
] as const satisfies readonly MealType[];

export const MEAL_TYPE_ORDER = [
  "breakfast",
  "lunch",
  "dinner",
  "snack"
] as const;

export const HOUSEHOLD_GOODS_SECTION = "Household Goods" as const;

export const HOUSEHOLD_GOODS_CATALOG = [
  {
    category: "Dishwasher Pods",
    n: "Trader Joe's Automatic Dishwasher Detergent Packs",
  },
  {
    category: "Dish Soap",
    n: "Trader Joe's Liquid Dish Soap",
  },
  {
    category: "Laundry Detergent",
    n: "Trader Joe's Liquid Laundry Detergent",
  },
  {
    category: "3-in-1 Shampoo",
    n: "Trader Joe's Formula No. 3 \"All For One, One For All\" Shampoo, Conditioner & Body Wash",
  },
  {
    category: "Face Sunscreen",
    n: "Trader Joe's Daily Facial Sunscreen SPF 40",
  },
  {
    category: "Tissues",
    n: "Trader Joe's Unscented White Tissue Paper",
  },
  {
    category: "Toilet Paper",
    n: "Trader Joe's Super Soft Bath Tissue",
  },
  {
    category: "Paper Towels",
    n: "Trader Joe's Slim Size Paper Towels",
  },
] as const;

// Junk category ordering
export const JUNK_CATEGORY_ORDER = [
  "Coffee/Creamer",
  "Beer/Wine",
  "Chips",
  "Sweets",
  "Frozen Food",
  "Frozen Treats",
  "Beverages/Drinks"
] as const;

// Brand Colors (matching Tailwind config)
export const COLORS = {
  HARVEST_GREEN: "#2d5a27",
  HARVEST_GOLD: "#f0c05a",
  HARVEST_TERRACOTTA: "#cd664d",
  HARVEST_PURPLE: "#6b5b95",
  BACKGROUND: "#fdfcf8"
} as const;

// Database Constants
export const DB_CONSTANTS = {
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT: 45000,
  CONNECTION_TIMEOUT: 20000
} as const;

// UI Constants
export const UI_CONSTANTS = {
  MOBILE_BREAKPOINT: 768,
  DEFAULT_PAGE_SIZE: 50,
  MAX_HEART_DISPLAY: 99
} as const;