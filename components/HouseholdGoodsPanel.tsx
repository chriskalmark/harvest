"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Undo2, X } from "lucide-react";
import { HOUSEHOLD_GOODS_CATALOG } from "@/lib/constants";
import { useListMutations } from "@/lib/hooks/useListMutations";
import { HouseholdGoodsItem } from "@/lib/types";

export default function HouseholdGoodsPanel({
  data,
  weekRange,
  onUpdate,
}: {
  data: HouseholdGoodsItem[];
  weekRange?: string;
  onUpdate?: () => void | Promise<void>;
}) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [recentlyDeleted, setRecentlyDeleted] = useState<HouseholdGoodsItem | null>(null);
  const {
    isSaving,
    mutationError,
    resetMutationState,
    deleteItem,
    addItem,
  } = useListMutations({ type: "household", weekRange, onUpdate });

  const availableOptions = useMemo(
    () =>
      HOUSEHOLD_GOODS_CATALOG.filter(
        (entry) => !data.some((item) => item.category === entry.category)
      ),
    [data]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedCategory("");
      resetMutationState();
    });
  }, [data, resetMutationState, weekRange]);

  useEffect(() => {
    if (!recentlyDeleted) return;
    const timer = setTimeout(() => setRecentlyDeleted(null), 6000);
    return () => clearTimeout(timer);
  }, [recentlyDeleted]);

  async function handleAdd() {
    if (!selectedCategory) return;
    const saved = await addItem(selectedCategory);
    if (saved) {
      setSelectedCategory("");
    }
  }

  async function removeItem(item: HouseholdGoodsItem) {
    await deleteItem(item.category);
    setRecentlyDeleted(item);
  }

  async function undoDelete() {
    if (!recentlyDeleted) return;
    const restored = await addItem(recentlyDeleted.category);
    if (restored) {
      setRecentlyDeleted(null);
    }
  }

  return (
    <div className="space-y-4">
      {mutationError ? (
        <div className="rounded-2xl border border-harvest-terracotta/25 bg-harvest-terracotta/10 px-4 py-3 text-sm font-medium text-harvest-terracotta">
          {mutationError}
        </div>
      ) : null}

      <section className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)]">
        <div className="divide-y divide-[var(--border-subtle)]">
          {data.map((item) => (
            <div key={item.category} className="flex items-center gap-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">
                {item.category}
              </p>
              <button
                type="button"
                onClick={() => void removeItem(item)}
                disabled={isSaving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                aria-label={`Remove ${item.category}`}
              >
                <X size={15} />
              </button>
            </div>
          ))}

          {data.length === 0 ? (
            <p className="py-2 text-sm text-[var(--text-muted)]">Nothing here yet.</p>
          ) : null}
        </div>

        {availableOptions.length > 0 ? (
          <div className="mt-3 flex gap-2">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <option value="">Add item...</option>
              {availableOptions.map((entry) => (
                <option key={entry.category} value={entry.category}>
                  {entry.category}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isSaving || !selectedCategory}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--text-muted)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Add
            </button>
          </div>
        ) : data.length > 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">All catalog items are on this week&apos;s list.</p>
        ) : null}
      </section>

      {recentlyDeleted ? (
        <div className="fixed inset-x-0 bottom-[150px] z-40 mx-auto flex max-w-md items-center justify-between gap-3 px-4">
          <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3 shadow-[var(--shadow-elevated)] backdrop-blur">
            <span className="min-w-0 truncate text-sm text-[var(--foreground)]">
              Removed <strong className="font-semibold">{recentlyDeleted.category}</strong>
            </span>
            <button
              type="button"
              onClick={() => void undoDelete()}
              disabled={isSaving}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--text-muted)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white disabled:opacity-60"
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
