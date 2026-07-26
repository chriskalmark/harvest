"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, Loader2 } from "lucide-react";
import MealEditorModal from "@/components/MealEditorModal";
import MealCardView from "@/components/MealCardView";
import { StoredMeal } from "@/lib/types";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildHref } from "@/lib/urlState";
import { MEAL_TYPES } from "@/lib/constants";
import { useExploreFilters, useMealsInfiniteQuery } from "@/lib/hooks/useExploreMeals";
import { sectionLabelColorClass } from "@/lib/uiClasses";

const sortOptions = [
  { value: "lastServedAt", label: "Recently Served" },
  { value: "heartCount", label: "Most Loved" },
  { value: "appearanceCount", label: "Most Served" },
  { value: "p", label: "Highest Protein" },
  { value: "cal", label: "Calories" },
  { value: "name", label: "Name A-Z" },
];

export default function ExplorePage() {
  const { refresh } = useMealPlan();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeMeal, setActiveMeal] = useState<StoredMeal | undefined>(undefined);
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  const {
    search,
    searchDraft,
    updateSearchDraft,
    selectedType,
    setSelectedType,
    minProtein,
    setMinProtein,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
  } = useExploreFilters();

  const mealQueryFilters = useMemo(
    () => ({ selectedType, minProtein, search, sortBy, sortDirection }),
    [selectedType, minProtein, search, sortBy, sortDirection]
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
  } = useMealsInfiniteQuery(mealQueryFilters);

  const requestedMealId = (() => {
    const raw = searchParams.get("mealId");
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  })();

  const handleMealChanged = async () => {
    await refresh();
    await refreshMeals();
  };

  const openCreateMeal = () => {
    setActiveMeal(undefined);
    setIsEditorOpen(true);
  };

  const openEditMeal = (meal: StoredMeal) => {
    setActiveMeal(meal);
    setIsEditorOpen(true);
    const currentHref = queryString ? `${pathname}?${queryString}` : pathname;
    const nextHref = buildHref(pathname, queryString, { mealId: meal.mealId });
    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  };

  // If URL requests a meal editor, open it once it's present in loaded results.
  useEffect(() => {
    if (!requestedMealId) return;
    if (isEditorOpen && activeMeal?.mealId === requestedMealId) return;
    const found = meals.find((m) => m.mealId === requestedMealId);
    if (found) {
      queueMicrotask(() => {
        setActiveMeal(found);
        setIsEditorOpen(true);
      });
    }
  }, [requestedMealId, meals, isEditorOpen, activeMeal]);

  return (
    <div className="max-w-md mx-auto px-4 pb-[120px] pt-6">
      <div className="mb-6">
        <p className={sectionLabelColorClass.terracotta}>
          Meal Library
        </p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-harvest-green">
          Explore Meals
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-text)]">
          {total} meals in database
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={openCreateMeal}
            className="w-full rounded-[22px] border border-[var(--card-border)] bg-harvest-green px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(45,90,39,0.10)] transition active:scale-[0.99]"
          >
            Add meal
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-text)]" />
        <input
          type="text"
          placeholder="Search meals..."
          value={searchDraft}
          onChange={(e) => updateSearchDraft(e.target.value)}
           className="w-full rounded-[22px] border border-[var(--card-border)] bg-[var(--card-bg)] py-3 pl-12 pr-4 text-base shadow-[0_10px_30px_rgba(45,90,39,0.05)] outline-none transition focus:border-harvest-green"
        />
      </div>

      {/* Meal Type Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedType(null)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${
            selectedType === null
               ? "bg-harvest-green text-white shadow"
               : "bg-[var(--card-border)] text-[var(--muted-text)]"
          }`}
        >
          All
        </button>
        {MEAL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(selectedType === type ? null : type)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${
              selectedType === type
                ? "bg-harvest-green text-white shadow"
                : "bg-[var(--card-border)] text-[var(--muted-text)]"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Sort & Filter Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-semibold outline-none transition focus:border-harvest-green appearance-none"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
           className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] transition active:scale-95"
        >
          <ChevronDown
            size={18}
            className={`transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`}
          />
        </button>

         <div className="flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted-text)]">
            Min Protein
          </span>
          <input
            type="number"
            min="0"
            max="100"
            value={minProtein}
            onChange={(e) => setMinProtein(parseInt(e.target.value, 10) || 0)}
            className="w-12 bg-transparent text-center text-sm font-bold outline-none"
          />
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted-text)]">
            g
          </span>
        </div>
      </div>

      {/* Meals List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-harvest-green" />
          <p className="mt-3 text-sm text-[var(--muted-text)]">Loading meals...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-harvest-terracotta">{error}</p>
        </div>
      ) : meals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--muted-text)]">No meals found matching your filters</p>
        </div>
      ) : (
        <>
          {meals.map((meal) => (
            <MealCardView
              key={meal.mealId}
              meal={meal}
              onOpenEditor={() => openEditMeal(meal)}
            />
          ))}
          
          {hasMore && (
            <div
              ref={loaderRef}
              className="py-8 text-center"
            >
              {loadingMore && (
                <Loader2 size={24} className="animate-spin mx-auto text-harvest-green" />
              )}
            </div>
          )}
        </>
      )}

      <MealEditorModal
        key={activeMeal?.mealId ?? "new"}
        meal={activeMeal}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setActiveMeal(undefined);
          const currentHref = queryString ? `${pathname}?${queryString}` : pathname;
          const nextHref = buildHref(pathname, queryString, { mealId: null });
          if (nextHref !== currentHref) {
            router.replace(nextHref);
          }
        }}
        onSaved={handleMealChanged}
      />
    </div>
  );
}