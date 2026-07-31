"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Heart, Loader2, Minus, Pencil, Plus } from "lucide-react";
import MealEditorModal from "@/components/MealEditorModal";
import MealPlanGate from "@/components/MealPlanGate";
import PhotoPlaceholder from "@/components/PhotoPlaceholder";
import { useMealHeart } from "@/lib/hooks/useMealHeart";
import { useMealServings } from "@/lib/hooks/useMealServings";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { MealIngredient, StoredMeal } from "@/lib/types";
import { cardClass } from "@/lib/uiClasses";
import { pluralize, stripStepPrefix } from "@/lib/displayFormatters";
import { buildHref } from "@/lib/urlState";

const categoryLabel: Record<MealIngredient["category"], string> = {
  pro: "Protein",
  base: "Base",
  veg: "Grønt",
  engine: "Energi",
};

const mealTypeLabel: Record<StoredMeal["type"], string> = {
  Breakfast: "Morgenmad",
  Lunch: "Frokost",
  Dinner: "Aftensmad",
  Snack: "Mellemmåltid",
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
      loadingMessage="Henter retten..."
      onSeeded={refresh}
    >
      {(readyPlan) => {
        const meal = readyPlan.meals.find((m) => m.mealId === mealId);

        return (
          <main>
            {/* No extra bottom padding here — the root layout already
                reserves clearance for the fixed week picker + nav (see
                app/layout.tsx). Adding more on top of that left a large
                empty green band below short recipes. */}
            <div className="px-4 pt-1 mb-4">
              <button
                type="button"
                onClick={() => router.push(buildHref("/menu", queryString))}
                className="relative -my-3 inline-flex items-center gap-1.5 py-3 text-sm font-semibold text-[var(--muted-text)] transition-colors hover:text-harvest-green before:absolute before:inset-x-[-8px] before:inset-y-0 before:content-['']"
              >
                <ArrowLeft size={16} />
                Menuen
              </button>
            </div>

            {meal ? (
              <MealDetail
                mealPlanId={readyPlan.id}
                meal={meal}
                onChanged={refresh}
              />
            ) : (
              <p className="px-4 text-sm text-[var(--muted-text)]">
                Den ret er ikke en del af den valgte uge.
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
  const {
    servings,
    isSaving: isSavingServings,
    error: servingsError,
    changeServings,
  } = useMealServings({
    mealId: meal.mealId,
    initialServings: meal.servings,
    onChanged,
  });
  const { liked, isSaving, toggleHeart } = useMealHeart({
    mealId: meal.mealId,
    mealPlanId,
    currentLiked: meal.likedForCurrentWeek,
    onChanged,
  });

  const ingredients = meal.ingredients?.filter((i) => i.name.trim()) ?? [];
  const scale = meal.servings > 0 ? servings / meal.servings : 1;

  return (
    <>
      {/* Grøn flade med foto i sømmen mellem flade og plade.
          Deep variant (not the brighter --harvest-green) so the white
          label text below clears 4.5:1 — plain white on the lighter
          green only reached ~3.5:1. */}
      <div className="relative rounded-[34px] bg-[var(--harvest-green-deep)] px-4 pb-20 pt-2 text-white">
        <div className="flex items-start justify-between gap-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-90">
            {mealTypeLabel[meal.type]}
          </span>
          <button
            type="button"
            onClick={() => void toggleHeart()}
            disabled={isSaving}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-out active:scale-95 before:absolute before:inset-[-2px] before:content-[''] ${
              liked
                ? "bg-white/25 text-harvest-gold"
                : "bg-white/15 text-white/80"
            }`}
            aria-label={liked ? "Fjern hjerte" : "Sæt hjerte på retten"}
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Heart
                size={18}
                fill="currentColor"
                className={liked ? "scale-110" : ""}
              />
            )}
          </button>
        </div>
      </div>

      {/* Hvid plade — fotoet bryder sømmen mellem flade og plade */}
      <div className="relative -mt-8 rounded-[34px] bg-[var(--surface-1)] pb-6 pt-20">
        <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-[60%] justify-center">
          <PhotoPlaceholder
            imageUrl={meal.imageUrl}
            size={148}
            label="Foto på vej"
            priority
            className="border-[5px] border-[var(--surface-1)] shadow-[0_14px_34px_-8px_oklch(0.35_0.05_150_/_0.35)]"
          />
        </div>

        <div className="px-4">
          <h1 className="font-serif text-[1.75rem] font-extrabold leading-[1.1] tracking-[-0.025em] text-[var(--foreground)]">
            {meal.name}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
            <span className="rounded-full bg-[var(--tint-green)] px-3 py-1 text-[var(--harvest-green-ink)]">
              {meal.appearanceCount}{" "}
              {pluralize(meal.appearanceCount, "gang", "gange")} på menuen
            </span>
            <span className="rounded-full bg-[var(--tint-gold)] px-3 py-1 text-[var(--harvest-gold-ink)]">
              {meal.heartCount}{" "}
              {pluralize(meal.heartCount, "hjerte", "hjerter")}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-5 border-b border-[var(--border-subtle)] pb-4">
            <Fact value={meal.macros.cal} label="kcal" />
            <Fact value={`${meal.macros.p} g`} label="protein" />
            <div className="ml-auto flex h-fit items-center gap-4 rounded-full bg-[var(--tint-stone)] px-3 py-1.5">
              <button
                type="button"
                onClick={() => void changeServings(servings - 1)}
                disabled={isSavingServings || servings <= 1}
                className="relative flex h-7 w-7 items-center justify-center rounded-full text-[var(--harvest-green-deep)] transition before:absolute before:inset-[-8px] before:content-[''] active:scale-90 disabled:opacity-40"
                aria-label="Færre portioner"
              >
                <Minus size={15} />
              </button>
              <span className="font-serif text-[1rem] font-bold text-[var(--foreground)]">
                {isSavingServings ? (
                  <Loader2 size={14} className="inline animate-spin" />
                ) : (
                  `${servings} pers.`
                )}
              </span>
              <button
                type="button"
                onClick={() => void changeServings(servings + 1)}
                disabled={isSavingServings}
                className="relative flex h-7 w-7 items-center justify-center rounded-full text-[var(--harvest-green-deep)] transition before:absolute before:inset-[-8px] before:content-[''] active:scale-90 disabled:opacity-40"
                aria-label="Flere portioner"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {servingsError ? (
            <p className="pt-2 text-sm text-harvest-terracotta">
              {servingsError}
            </p>
          ) : null}

          {/* Trin — læses på en meters afstand, ved komfuret */}
          {meal.steps.length > 0 ? (
            <div className="mt-1">
              {meal.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 border-b border-[var(--border-subtle)] py-5 last:border-b-0"
                >
                  <span className="w-8 shrink-0 font-serif text-[1.55rem] font-extrabold leading-none text-[var(--harvest-green-bright)]">
                    {idx + 1}
                  </span>
                  <p className="max-w-[34ch] text-[1.05rem] leading-[1.55] text-[var(--foreground)]">
                    {stripStepPrefix(step)}
                  </p>
                </div>
              ))}
              {servings !== meal.servings ? (
                <p className="py-4 text-sm leading-relaxed text-[var(--muted-text)]">
                  Mængderne herunder er skaleret til {servings} personer (×
                  {scale.toFixed(2)}).
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={`mt-4 p-4 ${cardClass}`}>
            <span className="mb-3 block text-[11px] font-black uppercase tracking-[0.18em] text-[var(--harvest-gold-ink)]">
              Ingredienser
            </span>
            {ingredients.length > 0 ? (
              <ul className="space-y-2.5">
                {ingredients.map((ingredient, idx) => (
                  <li
                    key={`${ingredient.name}-${idx}`}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">
                        {ingredient.name}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {categoryLabel[ingredient.category]}
                        {ingredient.quantity ? ` · ${ingredient.quantity}` : ""}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--c-pro-tint)] px-2 py-1 text-[11px] font-black text-[var(--c-pro)]">
                      {ingredient.macros.fiber}g fiber
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1.5 text-sm text-[var(--foreground)]">
                {[
                  ...meal.build.pro,
                  ...meal.build.base,
                  ...meal.build.veg,
                  ...meal.build.engine,
                ].map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-1)] px-4 py-3 text-sm font-semibold text-harvest-green transition active:scale-[0.99]"
          >
            <Pencil size={16} />
            Ret retten til
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
        </div>
      </div>
    </>
  );
}

function Fact({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <span className="block font-serif text-[1.22rem] font-bold leading-[1.1] text-[var(--foreground)]">
        {value}
      </span>
      <span className="text-[0.74rem] font-medium text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}
