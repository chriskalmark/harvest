"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import MealEditorModal from "@/components/MealEditorModal";
import { useMealsInfiniteQuery } from "@/lib/hooks/useExploreMeals";
import { Macros, MealType, StoredMeal } from "@/lib/types";
import { cardClass, inputClass } from "@/lib/uiClasses";
import { pluralize } from "@/lib/displayFormatters";

type PickerMode = "swap" | "add";

const mealTypeLabel: Record<MealType, string> = {
  Breakfast: "morgenmad",
  Lunch: "frokost",
  Dinner: "aftensmad",
  Snack: "mellemmåltid",
};

export default function MealSwapPickerModal({
  isOpen,
  mode,
  slotType,
  currentMealId,
  weekMealIds,
  onClose,
  onConfirm,
  isSaving = false,
}: {
  isOpen: boolean;
  mode: PickerMode;
  slotType: MealType;
  currentMealId?: number;
  weekMealIds: number[];
  onClose: () => void;
  onConfirm: (mealId: number) => Promise<boolean>;
  isSaving?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      selectedType: slotType,
      minProtein: 0,
      search,
      sortBy: "lastServedAt" as const,
      sortDirection: "desc" as const,
    }),
    [search, slotType],
  );

  const {
    meals,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refreshMeals,
  } = useMealsInfiniteQuery(filters);

  const excludedIds = useMemo(() => {
    const ids = new Set(weekMealIds);
    if (currentMealId !== undefined) {
      ids.delete(currentMealId);
    }
    return ids;
  }, [currentMealId, weekMealIds]);

  const visibleMeals = useMemo(
    () => meals.filter((meal) => !excludedIds.has(meal.mealId)),
    [excludedIds, meals],
  );

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setSearch("");
      setSearchDraft("");
      setSelectedMealId(null);
      setConfirmError(null);
    });
  }, [isOpen, mode, slotType]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft), 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  if (!isOpen) {
    return null;
  }

  const typeLabel = mealTypeLabel[slotType];
  const title =
    mode === "swap"
      ? `Byt ${typeLabel.toLowerCase()}`
      : `Tilføj ${typeLabel.toLowerCase()}`;

  async function handleConfirm() {
    if (selectedMealId === null) return;
    setConfirmError(null);
    const success = await onConfirm(selectedMealId);
    if (!success) {
      setConfirmError("Kunne ikke opdatere menuen. Prøv igen.");
    }
  }

  async function handleMealCreated() {
    await refreshMeals();
    setIsEditorOpen(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--surface-0)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-harvest-green">
              {title}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              {total} {pluralize(total, "ret", "retter")} at vælge mellem
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tint-stone)] text-[var(--muted-text)]"
            aria-label="Luk"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-text)]"
            />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={`Søg efter ${mealTypeLabel[slotType]}`}
              className={`${inputClass} pl-11`}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="mt-3 text-sm font-semibold text-harvest-green"
          >
            Opret ny ret
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error ? (
            <p className="rounded-2xl border border-harvest-terracotta/25 bg-harvest-terracotta/10 px-4 py-3 text-sm text-harvest-terracotta">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-harvest-green" />
            </div>
          ) : (
            <div className={`overflow-hidden ${cardClass}`}>
              {visibleMeals.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[var(--muted-text)]">
                  Ingen retter matcher.
                </p>
              ) : (
                visibleMeals.map((meal) => (
                  <PickerRow
                    key={meal.mealId}
                    meal={meal}
                    selected={selectedMealId === meal.mealId}
                    onSelect={() => setSelectedMealId(meal.mealId)}
                  />
                ))
              )}
            </div>
          )}

          <div ref={loaderRef} className="h-8" />
          {loadingMore ? (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-harvest-green" size={18} />
            </div>
          ) : null}
          {!loading && !hasMore && visibleMeals.length > 0 ? (
            <p className="py-3 text-center text-xs text-[var(--muted-text)]">
              Det var alle
            </p>
          ) : null}
        </div>

        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-0)] px-4 py-4">
          {confirmError ? (
            <p className="mb-3 text-sm font-medium text-harvest-terracotta">
              {confirmError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={selectedMealId === null || isSaving}
            onClick={() => void handleConfirm()}
            className="w-full rounded-[22px] bg-harvest-green px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Gemmer
              </span>
            ) : mode === "swap" ? (
              "Bekræft bytning"
            ) : (
              "Læg på menuen"
            )}
          </button>
        </div>
      </div>

      <MealEditorModal
        isOpen={isEditorOpen}
        defaultType={slotType}
        onClose={() => setIsEditorOpen(false)}
        onSaved={handleMealCreated}
      />
    </>
  );
}

function PickerRow({
  meal,
  selected,
  onSelect,
}: {
  meal: StoredMeal;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col gap-1.5 border-b border-[var(--border-subtle)] px-4 py-3 text-left transition last:border-b-0 ${
        selected ? "bg-harvest-green/10" : "hover:bg-[var(--tint-stone)]"
      }`}
    >
      <span className="font-medium leading-snug text-[var(--foreground)]">
        {meal.name}
      </span>
      <PickerMacroInline macros={meal.macros} />
    </button>
  );
}

function PickerMacroInline({ macros }: { macros: Macros }) {
  return (
    <span className="text-xs font-semibold leading-relaxed tracking-[-0.01em] text-[var(--muted-text)]">
      <span className="text-[var(--c-cal)]">{macros.cal} kcal</span>
      {" · "}
      <span className="text-[var(--c-pro)]">{macros.p}g protein</span>
      {" · "}
      <span className="text-[var(--c-carb)]">{macros.c}g kulhydrat</span>
      {" · "}
      <span className="text-[var(--c-fat)]">{macros.f}g fedt</span>
      {" · "}
      <span className="text-[var(--c-pro)]">{macros.fiber}g fibre</span>
    </span>
  );
}
