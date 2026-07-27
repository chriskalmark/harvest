"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Heart, Loader2, Plus, Undo2, WifiOff, X } from "lucide-react";
import { ListCategory, MealType } from "@/lib/types";
import {
  getShoppingUsageKey,
  ShoppingItemUsage,
  ShoppingUsageByKey,
} from "@/lib/domain/shoppingUsage";
import { sectionLabelMutedClass } from "@/lib/uiClasses";
import { useListMutations } from "@/lib/hooks/useListMutations";
import { useOfflineChecklist } from "@/lib/hooks/useOfflineChecklist";
import { JUNK_CATEGORY_ORDER, STORE_CATEGORY_ORDER } from "@/lib/constants";

function listItemKey(category: string, itemName: string) {
  return `${category}::${itemName}`;
}

export default function ListSection({
  data,
  colorClass = "bg-harvest-green",
  editable = false,
  weekRange,
  mealPlanId,
  type = "shopping",
  itemUsageByKey,
  onUpdate,
}: {
  data: ListCategory[];
  colorClass?: string;
  editable?: boolean;
  weekRange?: string;
  mealPlanId?: number;
  type?: "shopping" | "junk";
  itemUsageByKey?: ShoppingUsageByKey;
  onUpdate?: () => void | Promise<void>;
}) {
  const displayData = useMemo(() => {
    if (type === "shopping") {
      const order = new Map(
        STORE_CATEGORY_ORDER.map((category, index) => [category, index]),
      );
      return [...data].sort((a, b) => {
        const aIndex =
          order.get(a.category as (typeof STORE_CATEGORY_ORDER)[number]) ??
          Number.MAX_SAFE_INTEGER;
        const bIndex =
          order.get(b.category as (typeof STORE_CATEGORY_ORDER)[number]) ??
          Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });
    }

    if (!editable) {
      return data;
    }

    const existing = new Map(
      data.map((category) => [category.category, category]),
    );
    const defaults = JUNK_CATEGORY_ORDER.map(
      (category) => existing.get(category) ?? { category, items: [] },
    );
    const customCategories = data.filter(
      (category) =>
        !JUNK_CATEGORY_ORDER.includes(
          category.category as (typeof JUNK_CATEGORY_ORDER)[number],
        ),
    );

    return [...defaults, ...customCategories];
  }, [data, editable, type]);

  const initialPantryItems = useMemo(
    () =>
      displayData.flatMap((category) =>
        category.items
          .filter((item) => item.pantry)
          .map((item) => listItemKey(category.category, item.n)),
      ),
    [displayData],
  );
  const [pantryItems, setPantryItems] = useState<string[]>(initialPantryItems);
  const initialCheckedItems = useMemo(
    () =>
      displayData.flatMap((category) =>
        category.items
          .filter((item) => item.checked)
          .map((item) => listItemKey(category.category, item.n)),
      ),
    [displayData],
  );
  const {
    isChecked,
    toggle: toggleChecklist,
    clearChecked,
    pendingSyncCount,
    isOnline,
  } = useOfflineChecklist({
    weekRange,
    enabled: type === "shopping",
    initialCheckedKeys: initialCheckedItems,
  });
  const [hideChecked, setHideChecked] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<{
    category: string;
    name: string;
    q?: string;
  } | null>(null);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const {
    isSaving,
    pantrySavingItem,
    heartSavingItem,
    mutationError,
    pendingHeartState,
    resetMutationState,
    toggleJunkHeart,
    togglePantry: savePantryToggle,
    deleteItem: saveDeleteItem,
    addItem: saveAddItem,
  } = useListMutations({ type, weekRange, mealPlanId, onUpdate });

  const totalItemCount = useMemo(
    () => displayData.reduce((sum, category) => sum + category.items.length, 0),
    [displayData],
  );
  const checkedVisibleCount = useMemo(
    () =>
      displayData.reduce(
        (sum, category) =>
          sum +
          category.items.filter((item) => isChecked(category.category, item.n))
            .length,
        0,
      ),
    [displayData, isChecked],
  );
  const pantryCount = useMemo(
    () =>
      displayData.reduce(
        (sum, category) =>
          sum +
          category.items.filter((item) =>
            pantryItems.includes(listItemKey(category.category, item.n)),
          ).length,
        0,
      ),
    [displayData, pantryItems],
  );
  const progressPercent =
    totalItemCount > 0
      ? Math.round((checkedVisibleCount / totalItemCount) * 100)
      : 0;

  useEffect(() => {
    // When week/data changes, derived UI state must re-sync to avoid stale pantry/heart state.
    queueMicrotask(() => {
      setPantryItems(initialPantryItems);
      setAddingCategory(null);
      setNewItemName("");
      resetMutationState();
    });
  }, [initialPantryItems, resetMutationState, weekRange, mealPlanId, type]);

  useEffect(() => {
    if (!recentlyDeleted) return;
    const timer = setTimeout(() => setRecentlyDeleted(null), 6000);
    return () => clearTimeout(timer);
  }, [recentlyDeleted]);

  const toggle = (category: string, itemName: string) => {
    toggleChecklist(category, itemName);
  };

  const togglePantry = async (category: string, itemName: string) => {
    const key = listItemKey(category, itemName);
    const newPantryStatus = !pantryItems.includes(key);
    await savePantryToggle({
      category,
      itemName,
      pantry: newPantryStatus,
      onOptimisticUpdate: () =>
        setPantryItems((prev) =>
          prev.includes(key)
            ? prev.filter((item) => item !== key)
            : [...prev, key],
        ),
      onRollback: () =>
        setPantryItems((prev) =>
          newPantryStatus
            ? prev.filter((item) => item !== key)
            : [...prev, key],
        ),
    });
  };

  const deleteItem = async (category: string, itemName: string, q?: string) => {
    await saveDeleteItem(category, itemName);
    setRecentlyDeleted({ category, name: itemName, q });
  };

  const undoDelete = async () => {
    if (!recentlyDeleted) return;
    const restored = await saveAddItem(
      recentlyDeleted.category,
      recentlyDeleted.name,
      recentlyDeleted.q,
    );
    if (restored) {
      setRecentlyDeleted(null);
    }
  };

  const addItem = async (category: string) => {
    const saved = await saveAddItem(category, newItemName);
    if (saved) {
      setNewItemName("");
      setAddingCategory(null);
    }
  };

  return (
    <div className="space-y-6">
      {mutationError ? (
        <div className="rounded-2xl border border-harvest-terracotta/25 bg-harvest-terracotta/10 px-4 py-3 text-sm font-medium text-harvest-terracotta">
          {mutationError}
        </div>
      ) : null}

      {type === "shopping" && totalItemCount > 0 ? (
        <div className="sticky top-0 z-20 -mx-4 rounded-b-2xl border-b border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-[var(--foreground)]">
                {checkedVisibleCount}
                <span className="text-[var(--text-muted)]">
                  {" "}
                  / {totalItemCount}
                </span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {checkedVisibleCount >= totalItemCount ? "All set" : "in cart"}
              </span>
              {pantryCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-harvest-gold/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-harvest-gold">
                  {pantryCount} pantry
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              {!isOnline || pendingSyncCount > 0 ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-harvest-gold/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]"
                  title={
                    isOnline
                      ? `${pendingSyncCount} change${pendingSyncCount === 1 ? "" : "s"} syncing`
                      : "Offline — changes saved on this device and will sync later"
                  }
                >
                  <WifiOff size={11} />
                  {isOnline ? "Syncing" : "Offline"}
                </span>
              ) : null}
              {checkedVisibleCount > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setHideChecked((prev) => !prev)}
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-harvest-green hover:bg-harvest-green/10"
                  >
                    {hideChecked ? "Show all" : "Hide done"}
                  </button>
                  <button
                    type="button"
                    onClick={clearChecked}
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] hover:bg-[var(--border-subtle)]"
                  >
                    Reset
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
            <div
              className="h-full rounded-full bg-harvest-green transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {displayData.map((category) => {
        const visibleItems =
          type === "shopping" && hideChecked
            ? category.items.filter(
                (item) => !isChecked(category.category, item.n),
              )
            : category.items;

        if (
          visibleItems.length === 0 &&
          (!editable || (type === "shopping" && hideChecked))
        ) {
          return null;
        }

        return (
          <section key={category.category}>
            <h3 className={`mb-3 px-1 ${sectionLabelMutedClass}`}>
              {category.category}
            </h3>
            <div className="space-y-2">
              {visibleItems.map((item) => {
                const key = listItemKey(category.category, item.n);
                const checked = isChecked(category.category, item.n);
                const isPantry = pantryItems.includes(key);
                const baseLiked = Boolean(item.likedForCurrentWeek);
                const baseHeartCount = item.heartCount ?? 0;
                const pending = pendingHeartState[item.n];
                const liked = pending?.liked ?? baseLiked;
                const heartCount = pending?.heartCount ?? baseHeartCount;
                const itemUsage =
                  itemUsageByKey?.[
                    getShoppingUsageKey(category.category, item.n)
                  ];
                const displayName = item.n;
                const isPantrySaving = pantrySavingItem === key;

                return (
                  <div
                    key={key}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 transition-all group ${
                      checked
                        ? "border-[var(--border-subtle)] bg-[var(--border-subtle)] opacity-50"
                        : isPantry
                          ? "border-harvest-gold/60 bg-[var(--tint-gold)] shadow-[0_6px_18px_rgba(240,192,90,0.1)]"
                          : "border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-[0_6px_18px_rgba(45,90,39,0.05)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(category.category, item.n)}
                      aria-pressed={checked}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors shrink-0 ${
                          checked
                            ? `${colorClass} border-transparent text-white`
                            : "border-[var(--border-subtle)]"
                        }`}
                      >
                        {checked ? <Check size={16} strokeWidth={3} /> : null}
                      </div>
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="min-w-0 text-left">
                          <span
                            className={`block text-sm font-medium text-[var(--foreground)] ${checked ? "line-through" : ""}`}
                          >
                            {displayName}
                          </span>
                          {item.q && type !== "shopping" ? (
                            <span className="mt-0.5 block text-xs font-medium text-[var(--text-muted)]">
                              {item.q}
                            </span>
                          ) : null}
                          {type === "shopping" &&
                          item.shoppingSource !== "household" ? (
                            <ShoppingSourcePills
                              usage={itemUsage}
                              isJunk={item.shoppingSource === "junk"}
                            />
                          ) : null}
                        </span>
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      {type === "junk" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleJunkHeart(item.n, liked, heartCount);
                          }}
                          disabled={!mealPlanId || Boolean(heartSavingItem)}
                          className={`h-7 px-2 flex items-center justify-center rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                            liked
                              ? "bg-harvest-terracotta/10 text-harvest-terracotta"
                              : "text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-harvest-terracotta"
                          } ${!mealPlanId || heartSavingItem ? "opacity-50 pointer-events-none" : ""}`}
                          title={liked ? "Unheart" : "Heart"}
                          aria-label={liked ? "Unheart" : "Heart"}
                        >
                          {heartSavingItem === item.n ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Heart
                              size={12}
                              fill={liked ? "currentColor" : "none"}
                              className={liked ? "scale-110" : "scale-100"}
                            />
                          )}
                          <span className="ml-1">{heartCount}</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePantry(category.category, item.n);
                        }}
                        className={`h-9 px-2.5 flex items-center justify-center rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                          isPantry
                            ? "bg-harvest-gold/20 text-harvest-gold"
                            : "text-[var(--text-muted)] hover:bg-[var(--border-subtle)]"
                        } ${isPantrySaving ? "opacity-50 pointer-events-none" : ""}`}
                        title="Mark to check pantry"
                      >
                        Pantry
                      </button>
                      {type !== "shopping" &&
                      item.shoppingSource !== "household" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(category.category, item.n, item.q);
                          }}
                          disabled={isSaving}
                          className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Delete item"
                          aria-label={`Delete ${displayName}`}
                        >
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {editable && type !== "shopping" && (
              <div className="mt-2">
                {addingCategory === category.category ? (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 space-y-3 shadow-[var(--shadow-card)]">
                    <input
                      type="text"
                      placeholder="Item name..."
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-[var(--border-subtle)] rounded-lg bg-[var(--tint-stone)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addItem(category.category)}
                        disabled={isSaving}
                        className={`flex-1 text-sm font-medium rounded-lg ${colorClass} text-white py-2 disabled:opacity-50`}
                      >
                        {isSaving ? "Saving..." : "Add Item"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingCategory(null);
                          setNewItemName("");
                        }}
                        className="px-4 text-sm text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-lg bg-[var(--surface-1)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingCategory(category.category)}
                    className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-2xl hover:bg-[var(--tint-stone)] transition-colors"
                  >
                    <Plus size={15} />
                    Add item to {category.category}
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      {displayData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 text-sm text-[var(--text-muted)]">
          No items yet.
        </div>
      ) : null}

      {recentlyDeleted ? (
        <div className="fixed inset-x-0 bottom-[150px] z-40 mx-auto flex max-w-md items-center justify-between gap-3 px-4">
          <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3 shadow-[var(--shadow-elevated)] backdrop-blur">
            <span className="min-w-0 truncate text-sm text-[var(--foreground)]">
              Removed{" "}
              <strong className="font-semibold">{recentlyDeleted.name}</strong>
            </span>
            <button
              type="button"
              onClick={undoDelete}
              disabled={isSaving}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-harvest-green px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white disabled:opacity-60"
            >
              <Undo2 size={13} />
              Undo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const mealTypeUsageDisplay: Record<
  MealType,
  { label: string; shortLabel: string; chipClass: string }
> = {
  Breakfast: {
    label: "Breakfast",
    shortLabel: "B",
    chipClass:
      "bg-[var(--tint-gold)] text-[#a06a3a] dark:bg-[#e5a06f]/16 dark:text-[#e5a06f]",
  },
  Lunch: {
    label: "Lunch",
    shortLabel: "L",
    chipClass:
      "bg-[var(--tint-green)] text-[#4f6b58] dark:bg-[#6e8b76]/18 dark:text-[#8aa493]",
  },
  Dinner: {
    label: "Dinner",
    shortLabel: "D",
    chipClass:
      "bg-[#dde8ec] text-[#5b7382] dark:bg-[#7b97a6]/18 dark:text-[#9fb9c6]",
  },
  Snack: {
    label: "Snack",
    shortLabel: "S",
    chipClass:
      "bg-[#e6dfec] text-[#7d6f8c] dark:bg-[#9b8aa6]/18 dark:text-[#b9a9c6]",
  },
};

function ShoppingSourcePills({
  usage,
  isJunk,
}: {
  usage?: ShoppingItemUsage;
  isJunk: boolean;
}) {
  const uniqueMeals = useMemo(() => {
    const seen = new Map<string, { name: string; type: MealType }>();
    for (const meal of usage?.meals ?? []) {
      const key = `${meal.type}::${meal.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, { name: meal.name, type: meal.type });
      }
    }
    return Array.from(seen.values());
  }, [usage?.meals]);

  if (uniqueMeals.length === 0 && !isJunk) {
    return null;
  }

  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {isJunk ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-[#e6dfec] px-2 py-0.5 text-[10px] font-semibold text-[#7d6f8c] dark:bg-[#9b8aa6]/18 dark:text-[#b9a9c6]"
          title="Junk"
        >
          <span aria-hidden="true" className="font-black">
            J
          </span>
          <span className="font-medium">Junk</span>
        </span>
      ) : null}
      {uniqueMeals.map((meal) => {
        const display = mealTypeUsageDisplay[meal.type];
        return (
          <span
            key={`${meal.type}-${meal.name}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${display.chipClass}`}
            title={`${display.label}: ${meal.name}`}
          >
            <span aria-hidden="true" className="font-black">
              {display.shortLabel}
            </span>
            <span className="font-medium">{meal.name}</span>
          </span>
        );
      })}
    </span>
  );
}
