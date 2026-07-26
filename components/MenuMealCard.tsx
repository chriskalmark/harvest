"use client";

import { ReactNode } from "react";
import { ArrowLeftRight, Heart, Loader2, Repeat2, Trash2 } from "lucide-react";
import { MealCardBody } from "@/components/MealCardView";
import { useMealHeart } from "@/lib/hooks/useMealHeart";
import { StoredMeal } from "@/lib/types";
import { cardInteractiveClass } from "@/lib/uiClasses";

export default function MenuMealCard({
  meal,
  mealPlanId,
  isActionSaving = false,
  onOpenMeal,
  onSwap,
  onRemove,
  onChanged,
}: {
  meal: StoredMeal;
  mealPlanId: number;
  isActionSaving?: boolean;
  onOpenMeal: () => void;
  onSwap: () => void;
  onRemove: () => void;
  onChanged: () => Promise<void>;
}) {
  const { liked, isSaving: isHeartSaving, toggleHeart } = useMealHeart({
    mealId: meal.mealId,
    mealPlanId,
    currentLiked: meal.likedForCurrentWeek,
    onChanged,
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenMeal}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenMeal();
        }
      }}
      className={`mb-2.5 w-full p-4 text-left ${cardInteractiveClass}`}
    >
      <div className="relative">
        <div className="pr-11">
          <h3 className="font-serif text-[1.2rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--foreground)]">
            {meal.name}
          </h3>
          <MealCardBody meal={meal} compact />
        </div>

        <div className="absolute top-0 right-0 flex w-9 flex-col items-center gap-1.5">
          <button
            type="button"
            disabled={isHeartSaving || isActionSaving}
            onClick={(event) => {
              event.stopPropagation();
              void toggleHeart();
            }}
            className={`flex h-9 w-9 flex-col items-center justify-center rounded-xl border transition-all duration-200 ease-out active:scale-95 disabled:opacity-50 ${
              liked
                ? "border-harvest-terracotta/20 bg-harvest-terracotta/10 text-harvest-terracotta"
                : "border-[var(--card-border)] bg-[var(--tint-stone)] text-[var(--muted-text)] dark:bg-[var(--card-bg)]"
            }`}
            aria-label={liked ? "Remove heart" : "Heart this meal"}
          >
            {isHeartSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <Heart size={14} fill="currentColor" />
                <span className="text-[9px] font-black leading-none">{meal.heartCount}</span>
              </>
            )}
          </button>

          <MenuIconButton
            disabled={isActionSaving}
            onClick={onSwap}
            label="Swap meal"
            className="text-harvest-green"
          >
            <ArrowLeftRight size={16} />
          </MenuIconButton>

          <MenuIconButton
            disabled={isActionSaving}
            onClick={onRemove}
            label="Remove meal"
            className="text-harvest-terracotta"
          >
            <Trash2 size={16} />
          </MenuIconButton>

          <div
            className="flex h-9 w-9 flex-col items-center justify-center rounded-xl border border-harvest-green/20 bg-harvest-green/10 text-harvest-green"
            aria-label={`${meal.appearanceCount} times planned`}
          >
            <Repeat2 size={14} />
            <span className="text-[9px] font-black leading-none">{meal.appearanceCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuIconButton({
  children,
  disabled,
  onClick,
  label,
  className = "",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] transition active:scale-95 disabled:opacity-50 ${className}`}
      aria-label={label}
    >
      {children}
    </button>
  );
}
