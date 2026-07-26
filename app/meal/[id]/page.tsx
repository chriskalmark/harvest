"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Heart, Loader2, Pencil } from "lucide-react";
import MealEditorModal from "@/components/MealEditorModal";
import { MacroRow } from "@/components/MealCardView";
import MealPlanGate from "@/components/MealPlanGate";
import { useMealHeart } from "@/lib/hooks/useMealHeart";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { MealIngredient, StoredMeal } from "@/lib/types";
import { stripTraderJoesForDisplay } from "@/lib/displayFormatters";
import { cardClass } from "@/lib/uiClasses";
import { buildHref } from "@/lib/urlState";

const categoryLabel: Record<MealIngredient["category"], string> = {
  pro: "Protein",
  base: "Base",
  veg: "Veg",
  engine: "Engine",
};

export default function MealDetailPage() {
  const { plan, isLoading, error, refresh } = useMealPlan();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  const mealId = Number(Array.isArray(params.id) ? params.id[0] : params.id);

  return (
    <MealPlanGate
      plan={plan}
      isLoading={isLoading}
      error={error}
      loadingMessage="Loading this meal..."
      onSeeded={refresh}
    >
      {(readyPlan) => {
        const meal = readyPlan.meals.find((m) => m.mealId === mealId);

        return (
          <main className="px-4 pb-12">
            <button
              type="button"
              onClick={() => router.push(buildHref("/menu", queryString))}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted-text)] transition-colors hover:text-harvest-green"
            >
              <ArrowLeft size={16} />
              The Menu
            </button>

            {meal ? (
              <MealDetail mealPlanId={readyPlan.id} meal={meal} onChanged={refresh} />
            ) : (
              <p className="text-sm text-[var(--muted-text)]">
                This meal isn&apos;t part of the selected week.
              </p>
            )}
          </main>
        );
      }}
    </MealPlanGate>
  );
}

function MealDetail({
  mealPlanId,
  meal,
  onChanged,
}: {
  mealPlanId: number;
  meal: StoredMeal;
  onChanged: () => Promise<void>;
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { liked, isSaving, toggleHeart } = useMealHeart({
    mealId: meal.mealId,
    mealPlanId,
    currentLiked: meal.likedForCurrentWeek,
    onChanged,
  });

  const ingredients = meal.ingredients?.filter((i) => i.name.trim()) ?? [];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-harvest-green">
            {meal.type}
          </span>
          <h1 className="mt-1.5 font-serif text-3xl font-semibold leading-tight tracking-[-0.01em] text-[var(--foreground)]">
            {meal.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void toggleHeart()}
          disabled={isSaving}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 ease-out active:scale-95 ${
            liked
              ? "border-harvest-terracotta/20 bg-harvest-terracotta/10 text-harvest-terracotta shadow-[0_8px_20px_rgba(205,102,77,0.16)]"
              : "border-[var(--card-border)] bg-[var(--tint-stone)] text-[var(--muted-text)] dark:bg-[var(--card-bg)]"
          }`}
          aria-label={liked ? "Remove heart" : "Heart this meal"}
        >
          {isSaving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Heart size={18} fill="currentColor" className={liked ? "scale-110" : ""} />
          )}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
        <span className="rounded-full bg-harvest-green/10 px-3 py-1 text-harvest-green">
          {meal.appearanceCount} appearances
        </span>
        <span className="rounded-full bg-harvest-terracotta/10 px-3 py-1 text-harvest-terracotta">
          {meal.heartCount} hearts
        </span>
      </div>

      <MacroRow meal={meal} />

      <div className={`mt-4 p-4 ${cardClass}`}>
        <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.18em] text-harvest-terracotta">
          Ingredients
        </span>
        {ingredients.length > 0 ? (
          <ul className="space-y-2.5">
            {ingredients.map((ingredient, idx) => (
              <li key={`${ingredient.name}-${idx}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    {stripTraderJoesForDisplay(ingredient.name)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {categoryLabel[ingredient.category]}
                    {ingredient.quantity ? ` · ${ingredient.quantity}` : ""}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-[#dfeacb] px-2 py-1 text-[10px] font-black text-[#5f7a3a] dark:bg-[#8fae5a]/16 dark:text-[#a9c47a]">
                  {ingredient.macros.fiber}g fiber
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1.5 text-sm text-[var(--foreground)]">
            {[...meal.build.pro, ...meal.build.base, ...meal.build.veg, ...meal.build.engine].map(
              (item, idx) => (
                <li key={`${item}-${idx}`}>{stripTraderJoesForDisplay(item)}</li>
              )
            )}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsEditorOpen(true)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-1)] px-4 py-3 text-sm font-semibold text-harvest-green transition active:scale-[0.99]"
      >
        <Pencil size={16} />
        Edit meal
      </button>

      <MealEditorModal
        meal={meal}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSaved={async () => {
          await onChanged();
          setIsEditorOpen(false);
        }}
      />
    </>
  );
}
