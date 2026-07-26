"use client";

import { MealIngredient, StoredMeal } from "@/lib/types";
import { cardInteractiveClass } from "@/lib/uiClasses";
import { stripTraderJoesForDisplay } from "@/lib/displayFormatters";

export default function MealCardView({
  meal,
  onOpenEditor,
}: {
  meal: StoredMeal;
  onOpenEditor: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenEditor}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenEditor();
        }
      }}
      className={`mb-2.5 w-full p-4 text-left ${cardInteractiveClass}`}
    >
      <div className="min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-harvest-green">
          {meal.type}
        </span>
        <h3 className="mt-1.5 font-serif text-[1.2rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--foreground)]">
          {meal.name}
        </h3>
      </div>

      <MealCardBody meal={meal} />
    </div>
  );
}

export function MealCardBody({
  meal,
  compact = false,
}: {
  meal: StoredMeal;
  compact?: boolean;
}) {
  const buildLabels = getMealBuildLabels(meal);

  return (
    <>
      <div className={`${compact ? "mt-3" : "mt-4"} flex flex-wrap gap-2`}>
        {buildLabels.map((item, idx) => {
          return (
            <span
              key={`${item.label}-${idx}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] ${
                mealCardBuildPillClassByLabel[item.label] ??
                "rounded-full bg-[var(--border-subtle)] text-[var(--text-muted)]"
              }`}
            >
              <IngredientGlyph category={item.category} />
              <span>{stripTraderJoesForDisplay(item.value)}</span>
              {item.quantity ? (
                <span className="rounded-full bg-[var(--tint-stone)] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.04em] text-[var(--text-muted)]">
                  {item.quantity}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <MacroRow meal={meal} />
    </>
  );
}

type MacroTone = "cal" | "protein" | "carb" | "fat" | "fiber";

const macroToneClasses: Record<MacroTone, string> = {
  cal: "bg-[var(--c-cal-tint)] text-[var(--c-cal)]",
  protein: "bg-[var(--c-pro-tint)] text-[var(--c-pro)]",
  carb: "bg-[var(--c-carb-tint)] text-[var(--c-carb)]",
  fat: "bg-[var(--c-fat-tint)] text-[var(--c-fat)]",
  fiber: "bg-[var(--c-fat-tint)] text-[var(--c-fat)]",
};

export function MacroInline({ meal }: { meal: StoredMeal }) {
  return (
    <span className="shrink-0 text-[10px] font-semibold tracking-[-0.01em] text-[var(--muted-text)]">
      <span className="text-[var(--c-cal)]">{meal.macros.cal} cal</span>
      {" · "}
      <span className="text-[var(--c-pro)]">{meal.macros.p}g pro</span>
      {" · "}
      <span className="text-[var(--c-carb)]">{meal.macros.c}g carb</span>
      {" · "}
      <span className="text-[var(--c-fat)]">{meal.macros.f}g fat</span>
      {" · "}
      <span className="text-[var(--c-pro)]">{meal.macros.fiber}g fiber</span>
    </span>
  );
}

export function MacroRow({ meal }: { meal: StoredMeal }) {
  return (
    <div className="mt-4 grid grid-cols-5 gap-2 border-t border-[var(--border-subtle)] pt-3 text-center">
      <MacroStat tone="cal" label="Cal" value={meal.macros.cal} />
      <MacroStat tone="protein" label="Pro" value={`${meal.macros.p}g`} />
      <MacroStat tone="carb" label="Carb" value={`${meal.macros.c}g`} />
      <MacroStat tone="fat" label="Fat" value={`${meal.macros.f}g`} />
      <MacroStat tone="fiber" label="Fiber" value={`${meal.macros.fiber}g`} highlight />
    </div>
  );
}

function MacroStat({
  tone,
  label,
  value,
  highlight = false,
}: {
  tone: MacroTone;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl px-2 py-2 ${macroToneClasses[tone]} ${
        highlight ? "ring-1 ring-inset ring-[var(--c-pro)]/40" : ""
      }`}
    >
      <span className="relative block text-sm font-black">
        {value}
      </span>
      <span className="relative block text-[9px] font-black uppercase tracking-[0.18em] opacity-75">
        {label}
      </span>
    </div>
  );
}

type BuildLabel = {
  label: string;
  value: string;
  quantity?: string;
  category: MealIngredient["category"];
};

const ingredientCategoryLabel: Record<MealIngredient["category"], string> = {
  pro: "Protein",
  base: "Base",
  veg: "Veg",
  engine: "Engine",
};

const mealCardBuildPillClassByLabel: Record<string, string> = {
  Protein:
    "rounded-full border border-[var(--c-pro)]/30 bg-[var(--c-pro-tint)] text-[var(--c-pro)]",
  Base:
    "rounded-full border border-[var(--c-carb)]/30 bg-[var(--c-carb-tint)] text-[var(--c-carb)]",
  Veg:
    "rounded-full border border-[var(--c-pro)]/30 bg-[var(--c-pro-tint)] text-[var(--c-pro)]",
  Engine:
    "rounded-full border border-[var(--c-fat)]/30 bg-[var(--c-fat-tint)] font-semibold text-[var(--c-fat)]",
};

function getMealBuildLabels(meal: StoredMeal): BuildLabel[] {
  const ingredients = meal.ingredients?.filter((ingredient) => ingredient.name.trim()) ?? [];
  if (ingredients.length > 0) {
    return ingredients.map((ingredient) => ({
      label: ingredientCategoryLabel[ingredient.category],
      value: ingredient.name,
      quantity: ingredient.quantity.trim() || undefined,
      category: ingredient.category,
    }));
  }

  const labels: BuildLabel[] = [];

  const proItems = Array.isArray(meal.build.pro) ? meal.build.pro : [meal.build.pro];
  proItems.forEach((item) => labels.push({ label: "Protein", value: item, category: "pro" }));

  const baseItems = Array.isArray(meal.build.base) ? meal.build.base : [meal.build.base];
  baseItems.forEach((item) => labels.push({ label: "Base", value: item, category: "base" }));

  const vegItems = Array.isArray(meal.build.veg) ? meal.build.veg : [meal.build.veg];
  vegItems.forEach((item) => labels.push({ label: "Veg", value: item, category: "veg" }));

  const engineItems = Array.isArray(meal.build.engine) ? meal.build.engine : [meal.build.engine];
  engineItems.forEach((item) => labels.push({ label: "Engine", value: item, category: "engine" }));

  return labels;
}

function IngredientGlyph({ category }: { category: MealIngredient["category"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {category === "pro" ? (
        <>
          <path d="M5.3 3.2c1.6-1.7 4.1-1.3 5.5.3 1.7 1.9 1.6 5.1-.2 7.1-1.8 2-4.8 2.3-6.5.6-1.5-1.5-1.3-4.2 1.2-8Z" />
          <path d="M7 6.2h2.1" />
        </>
      ) : category === "base" ? (
        <>
          <path d="M3 10.5h10" />
          <path d="M4.5 10.5 3.7 4.2h8.6l-.8 6.3" />
          <path d="M6 6.4h4" />
        </>
      ) : category === "veg" ? (
        <>
          <path d="M8 12.5V6.2" />
          <path d="M8 7C5.1 6.8 3.6 5.4 3.2 3.3 5.6 3.3 7.3 4.4 8 7Z" />
          <path d="M8 8.5c2.8-.3 4.2-1.7 4.7-3.8-2.4 0-4.1 1.1-4.7 3.8Z" />
        </>
      ) : (
        <>
          <path d="M8 2.8v10.4" />
          <path d="M3.5 5.2h9" />
          <path d="M4.7 10.8h6.6" />
          <path d="M5.6 3.7 10.4 12.3" />
        </>
      )}
    </svg>
  );
}
