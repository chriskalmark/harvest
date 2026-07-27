"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, Plus, Undo2, X } from "lucide-react";
import { JUNK_CATEGORY_ORDER } from "@/lib/constants";
import { useListMutations } from "@/lib/hooks/useListMutations";
import { ListCategory } from "@/lib/types";
import { sectionLabelMutedClass } from "@/lib/uiClasses";

function displayJunkCategories(data: ListCategory[]) {
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
}

export default function JunkMenuPanel({
  data,
  weekRange,
  mealPlanId,
  onUpdate,
}: {
  data: ListCategory[];
  weekRange?: string;
  mealPlanId?: number;
  onUpdate?: () => void | Promise<void>;
}) {
  const categories = useMemo(() => displayJunkCategories(data), [data]);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [recentlyDeleted, setRecentlyDeleted] = useState<{
    category: string;
    name: string;
    q?: string;
  } | null>(null);
  const {
    isSaving,
    heartSavingItem,
    mutationError,
    pendingHeartState,
    resetMutationState,
    toggleJunkHeart,
    deleteItem,
    addItem,
  } = useListMutations({ type: "junk", weekRange, mealPlanId, onUpdate });

  useEffect(() => {
    queueMicrotask(() => {
      setAddingCategory(null);
      setNewItemName("");
      setNewItemQty("1");
      resetMutationState();
    });
  }, [data, resetMutationState, weekRange, mealPlanId]);

  useEffect(() => {
    if (!recentlyDeleted) return;
    const timer = setTimeout(() => setRecentlyDeleted(null), 6000);
    return () => clearTimeout(timer);
  }, [recentlyDeleted]);

  async function saveNewItem(category: string) {
    const saved = await addItem(category, newItemName, newItemQty);
    if (saved) {
      setNewItemName("");
      setNewItemQty("1");
      setAddingCategory(null);
    }
  }

  async function removeItem(category: string, name: string, q?: string) {
    await deleteItem(category, name);
    setRecentlyDeleted({ category, name, q });
  }

  async function undoDelete() {
    if (!recentlyDeleted) return;
    const restored = await addItem(
      recentlyDeleted.category,
      recentlyDeleted.name,
      recentlyDeleted.q,
    );
    if (restored) {
      setRecentlyDeleted(null);
    }
  }

  return (
    <div className="space-y-5">
      {mutationError ? (
        <div className="rounded-2xl border border-harvest-terracotta/25 bg-harvest-terracotta/10 px-4 py-3 text-sm font-medium text-harvest-terracotta">
          {mutationError}
        </div>
      ) : null}

      {categories.map((category) => (
        <section
          key={category.category}
          className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className={sectionLabelMutedClass}>{category.category}</h3>
            <span className="rounded-full bg-[var(--tint-stone)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
              {category.items.length}
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {category.items.map((item) => {
              const baseLiked = Boolean(item.likedForCurrentWeek);
              const baseHeartCount = item.heartCount ?? 0;
              const pending = pendingHeartState[item.n];
              const liked = pending?.liked ?? baseLiked;
              const heartCount = pending?.heartCount ?? baseHeartCount;
              const displayName = item.n;

              return (
                <div key={item.n} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {displayName}
                    </p>
                    {item.q ? (
                      <p className="text-xs font-medium text-[var(--text-muted)]">
                        {item.q}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void toggleJunkHeart(item.n, liked, heartCount)
                    }
                    disabled={!mealPlanId || Boolean(heartSavingItem)}
                    className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-black transition-colors ${
                      liked
                        ? "bg-harvest-terracotta/10 text-harvest-terracotta"
                        : "text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-harvest-terracotta"
                    } ${!mealPlanId || heartSavingItem ? "pointer-events-none opacity-50" : ""}`}
                    aria-label={
                      liked ? `Unheart ${displayName}` : `Heart ${displayName}`
                    }
                  >
                    {heartSavingItem === item.n ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Heart size={13} fill={liked ? "currentColor" : "none"} />
                    )}
                    {heartCount}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void removeItem(category.category, item.n, item.q)
                    }
                    disabled={isSaving}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                    aria-label={`Delete ${displayName}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}

            {category.items.length === 0 ? (
              <p className="py-2 text-sm text-[var(--text-muted)]">
                Nothing here yet.
              </p>
            ) : null}
          </div>

          {addingCategory === category.category ? (
            <div className="mt-3 space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--tint-stone)] p-3">
              <input
                type="text"
                placeholder="Item name..."
                value={newItemName}
                onChange={(event) => setNewItemName(event.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                autoFocus
              />
              <input
                type="text"
                placeholder="Quantity..."
                value={newItemQty}
                onChange={(event) => setNewItemQty(event.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveNewItem(category.category)}
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-harvest-purple py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCategory(null);
                    setNewItemName("");
                    setNewItemQty("1");
                  }}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 text-sm font-semibold text-[var(--text-muted)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCategory(category.category)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--border-subtle)] py-2.5 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--tint-stone)]"
            >
              <Plus size={15} />
              Add item
            </button>
          )}
        </section>
      ))}

      {recentlyDeleted ? (
        <div className="fixed inset-x-0 bottom-[150px] z-40 mx-auto flex max-w-md items-center justify-between gap-3 px-4">
          <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3 shadow-[var(--shadow-elevated)] backdrop-blur">
            <span className="min-w-0 truncate text-sm text-[var(--foreground)]">
              Removed{" "}
              <strong className="font-semibold">{recentlyDeleted.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => void undoDelete()}
              disabled={isSaving}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-harvest-purple px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white disabled:opacity-60"
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
