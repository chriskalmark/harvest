"use client";

import { ArrowLeftRight, Heart, Loader2, Trash2 } from "lucide-react";
import PhotoPlaceholder from "@/components/PhotoPlaceholder";
import { useMealHeart } from "@/lib/hooks/useMealHeart";
import { StoredMeal } from "@/lib/types";

export default function MenuMealCard({
  meal,
  mealPlanId,
  isLead = false,
  isActionSaving = false,
  onOpenMeal,
  onSwap,
  onRemove,
  onChanged,
}: {
  meal: StoredMeal;
  mealPlanId: number;
  isLead?: boolean;
  isActionSaving?: boolean;
  onOpenMeal: () => void;
  onSwap: () => void;
  onRemove: () => void;
  onChanged: () => Promise<void>;
}) {
  const {
    liked,
    isSaving: isHeartSaving,
    toggleHeart,
  } = useMealHeart({
    mealId: meal.mealId,
    mealPlanId,
    currentLiked: meal.likedForCurrentWeek,
    onChanged,
  });

  const photoSize = isLead ? 104 : 60;

  if (isLead) {
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
        className="flex w-full items-center gap-4 border-b border-[var(--border-subtle)] pb-5 pt-1 text-left"
      >
        <PhotoPlaceholder imageUrl={meal.imageUrl} size={photoSize} />
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[1.3rem] font-bold leading-[1.15] tracking-[-0.015em] text-[var(--foreground)]">
            {meal.name}
          </h3>
          <p className="mt-1.5 text-[0.86rem] leading-[1.45] text-[var(--muted-text)]">
            {meal.macros.cal} kcal · {meal.macros.p} g protein
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <RemoveButton onClick={onRemove} disabled={isActionSaving} />
            <SwapButton onClick={onSwap} disabled={isActionSaving} />
            <HeartButton
              liked={liked}
              count={meal.heartCount}
              saving={isHeartSaving || isActionSaving}
              onToggle={() => void toggleHeart()}
            />
          </div>
        </div>
      </div>
    );
  }

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
      className="flex w-full items-center gap-4 border-b border-[var(--border-subtle)] py-4 text-left last:border-b-0"
    >
      <PhotoPlaceholder
        imageUrl={meal.imageUrl}
        size={photoSize}
        label="Foto"
      />
      <div className="min-w-0 flex-1">
        <h4 className="font-serif text-[1.02rem] font-semibold leading-[1.2] text-[var(--foreground)]">
          {meal.name}
        </h4>
        <p className="mt-0.5 text-[0.8rem] text-[var(--muted-text)]">
          {meal.macros.cal} kcal · {meal.macros.p} g protein
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <SwapButton onClick={onSwap} disabled={isActionSaving} compact />
        <RemoveButton onClick={onRemove} disabled={isActionSaving} compact />
        <HeartButton
          liked={liked}
          count={meal.heartCount}
          saving={isHeartSaving || isActionSaving}
          onToggle={() => void toggleHeart()}
          compact
        />
      </div>
    </div>
  );
}

function HeartButton({
  liked,
  count,
  saving,
  onToggle,
  compact = false,
}: {
  liked: boolean;
  count: number;
  saving: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`flex items-center gap-1 rounded-full text-[1.05rem] transition-transform active:scale-95 disabled:opacity-50 ${
        liked ? "text-harvest-gold" : "text-[var(--card-border)]"
      } ${compact ? "px-1" : "px-1.5 py-1"}`}
      aria-label={liked ? "Fjern hjerte" : "Sæt hjerte på retten"}
    >
      {saving ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Heart size={compact ? 16 : 18} fill="currentColor" />
      )}
      {!compact ? (
        <span className="text-xs font-bold text-[var(--muted-text)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SwapButton({
  onClick,
  disabled,
  compact = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`flex items-center justify-center rounded-full text-harvest-green transition active:scale-95 disabled:opacity-50 ${
        compact ? "h-8 w-8" : "h-8 w-8 bg-[var(--tint-green)]"
      }`}
      aria-label="Byt retten ud"
      title="Byt ret"
    >
      <ArrowLeftRight size={15} />
    </button>
  );
}

function RemoveButton({
  onClick,
  disabled,
  compact = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`flex items-center justify-center rounded-full text-harvest-terracotta transition active:scale-95 disabled:opacity-50 ${
        compact ? "h-8 w-8" : "h-8 w-8"
      }`}
      aria-label="Fjern retten fra menuen"
      title="Fjern ret"
    >
      <Trash2 size={15} />
    </button>
  );
}
