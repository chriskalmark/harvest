import type { StoreZone } from "@/lib/constants";

export interface Macros {
  cal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
}

export const MEAL_INGREDIENT_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "dl",
  "stk",
  "tsk",
  "spsk",
  "bundt",
  "dåse",
  "pakke",
] as const;

export type MealIngredientUnit = (typeof MEAL_INGREDIENT_UNITS)[number];

export interface MealIngredient {
  name: string;
  quantity?: string;
  amount: number;
  unit: MealIngredientUnit;
  zone: StoreZone;
  category: "pro" | "base" | "veg" | "engine";
  macros: Macros;
}

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface MealBuild {
  pro: string[];
  base: string[];
  veg: string[];
  engine: string[];
}

export interface MealInput {
  type: MealType;
  name: string;
  build: MealBuild;
  ingredients?: MealIngredient[];
  macros: Macros;
  servings: number;
  steps: string[];
  imageUrl: string | null;
}

export interface StoredMeal extends MealInput {
  mealId: number;
  slotOrder: number;
  appearanceCount: number;
  heartCount: number;
  likedForCurrentWeek: boolean;
  lastServedAt: string | null;
}

export type MealPlanCompositionAction = "swap" | "remove" | "add";

export interface MutateMealPlanCompositionInput {
  weekRange: string;
  action: MealPlanCompositionAction;
  slotOrder?: number;
  mealId?: number;
  type?: MealType;
}

export interface HouseholdGoodsItem {
  category: string;
  n: string;
}

export interface ListItem {
  n: string;
  q?: string;
  pantry?: boolean;
  checked?: boolean;
  zone?: string;
  shoppingSource?: "junk" | "household";
  // Junk-only enrichment fields (safe to be absent for shopping items)
  junkItemId?: number;
  heartCount?: number;
  likedForCurrentWeek?: boolean;
}

export interface ListCategory {
  category: string;
  items: ListItem[];
}

export interface WeekData<TMeal = MealInput> {
  id?: number | string;
  weekRange: string;
  meals: TMeal[];
  shoppingList?: ListCategory[];
  junkList: ListCategory[];
  householdGoods?: HouseholdGoodsItem[];
  feedback?: MealFeedback[];
}

export interface MealFeedback {
  id: number;
  mealPlanId: number;
  mealId: number;
  liked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WeekOption {
  id: number;
  weekRange: string;
  displayLabel: string;
  sortValue: number; // YYYYMMDD (week start date) for sorting
  updatedAt: string;
}

export interface StoredMealPlan {
  id: number;
  weekRange: string;
  meals: StoredMeal[];
  shoppingList: ListCategory[];
  junkList: ListCategory[];
  householdGoods: HouseholdGoodsItem[];
  source: string;
  status: string;
  generationContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  mealFeedback: MealFeedback[];
}

export interface SaveMealHeartInput {
  mealPlanId: number;
  mealId: number;
  liked: boolean;
}

export interface UpdateMealInput {
  id: number;
  type: MealType;
  name: string;
  build: MealBuild;
  ingredients?: MealIngredient[];
  macros: Macros;
  servings: number;
  steps: string[];
  imageUrl: string | null;
}

// Database Row Types
export interface MealPlanRow {
  id: number | string;
  week_range: string;
  plan_data: {
    shoppingList: StoredMealPlan["shoppingList"];
    junkList: StoredMealPlan["junkList"];
    householdGoods?: StoredMealPlan["householdGoods"];
  };
  source: string;
  status: string;
  generation_context: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface MealRow {
  id: number | string;
  name: string;
  meal_type: MealInput["type"];
  protein: string[];
  base: string[];
  veg: string[];
  engine: string[];
  ingredients: MealIngredient[];
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  fiber_grams: number;
  servings: number;
  steps: string[];
  image_url: string | null;
  heart_count: number;
  appearance_count: number;
  last_served_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MealPlanMealRow extends MealRow {
  slot_order: number;
  meal_id: number | string;
  liked: boolean | null;
}

export interface MealFeedbackRow {
  id: number | string;
  meal_plan_id: number | string;
  meal_id: number | string;
  liked: boolean;
  created_at: Date;
  updated_at: Date;
}
