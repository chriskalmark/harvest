/**
 * System-wide constants for Harvest Meal Engine
 * Single source of truth for all hardcoded values
 */

import type { MealType } from "@/lib/types";

// Week shape — single source of truth for meal counts per type
export const EXPECTED_MEAL_COUNTS = {
  Breakfast: 1,
  Lunch: 1,
  Dinner: 4,
} as const;

export const EXPECTED_MEAL_TOTAL = Object.values(EXPECTED_MEAL_COUNTS).reduce(
  (sum, count) => sum + count,
  0,
);

// Nettos gå-rækkefølge. Skal stemme med data/shopping-areas.md.
// Verificér ved første indkøbstur og ret her, hvis butikken går anderledes.
export const STORE_CATEGORY_ORDER = [
  "Frugt & grønt",
  "Brød",
  "Køl",
  "Ost & pålæg",
  "Kød & fjerkræ",
  "Fisk",
  "Kolonial",
  "Frost",
  "Drikkevarer",
  "Slik & snacks",
  "Non-food",
] as const;

export type StoreZone = (typeof STORE_CATEGORY_ORDER)[number];

export const DEFAULT_STORE_ZONE: StoreZone = "Kolonial";

// Meal Type Ordering
export const MEAL_TYPES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
] as const satisfies readonly MealType[];

export const MEAL_TYPE_ORDER = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const;

export const HOUSEHOLD_GOODS_SECTION = "Household Goods" as const;

export const HOUSEHOLD_GOODS_CATALOG = [
  {
    category: "Opvasketabs",
    n: "Neutral Opvasketabs",
  },
  {
    category: "Opvaskemiddel",
    n: "Neutral Opvaskemiddel",
  },
  {
    category: "Vaskemiddel",
    n: "Neutral Vaskemiddel",
  },
  {
    category: "2-i-1 Shampoo",
    n: "Neutral 2-i-1 Shampoo & Balsam",
  },
  {
    category: "Ansigtssolcreme",
    n: "Nivea Sun Ansigt SPF 50",
  },
  {
    category: "Lommetørklæder",
    n: "Nettorama Papirlommetørklæder",
  },
  {
    category: "Toiletpapir",
    n: "Nettorama Toiletpapir",
  },
  {
    category: "Køkkenrulle",
    n: "Nettorama Køkkenrulle",
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
  "Beverages/Drinks",
] as const;

// Brand Colors (matching Tailwind config)
export const COLORS = {
  HARVEST_GREEN: "#2d5a27",
  HARVEST_GOLD: "#f0c05a",
  HARVEST_TERRACOTTA: "#cd664d",
  HARVEST_PURPLE: "#6b5b95",
  BACKGROUND: "#fdfcf8",
} as const;

// Database Constants
export const DB_CONSTANTS = {
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT: 45000,
  CONNECTION_TIMEOUT: 20000,
} as const;

// UI Constants
export const UI_CONSTANTS = {
  MOBILE_BREAKPOINT: 768,
  DEFAULT_PAGE_SIZE: 50,
  MAX_HEART_DISPLAY: 99,
} as const;
