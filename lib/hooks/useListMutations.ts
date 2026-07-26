"use client";

import { useCallback, useMemo, useState } from "react";

type ListType = "shopping" | "junk" | "household";

interface UseListMutationsOptions {
  type: ListType;
  weekRange?: string;
  mealPlanId?: number;
  onUpdate?: () => void | Promise<void>;
}

export function useListMutations({
  type,
  weekRange,
  mealPlanId,
  onUpdate,
}: UseListMutationsOptions) {
  const endpoint = useMemo(() => {
    if (type === "junk") return "/api/mealplan/junk";
    if (type === "household") return "/api/mealplan/household-goods";
    return "/api/mealplan/shopping";
  }, [type]);
  const [isSaving, setIsSaving] = useState(false);
  const [pantrySavingItem, setPantrySavingItem] = useState<string | null>(null);
  const [heartSavingItem, setHeartSavingItem] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingHeartState, setPendingHeartState] = useState<
    Record<string, { liked: boolean; heartCount: number }>
  >({});

  const notifyUpdated = useCallback(async () => {
    await onUpdate?.();
  }, [onUpdate]);

  const mutateList = useCallback(
    async (method: "POST" | "PATCH" | "DELETE", body: unknown) => {
      setMutationError(null);
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to update list.";
        throw new Error(message);
      }

      await notifyUpdated();
    },
    [endpoint, notifyUpdated]
  );

  const toggleJunkHeart = useCallback(
    async (itemName: string, currentLiked: boolean, currentHeartCount: number) => {
      if (type !== "junk" || !mealPlanId || heartSavingItem) return;

      const nextLiked = !currentLiked;
      const nextCount = Math.max(0, currentHeartCount + (nextLiked ? 1 : -1));

      setHeartSavingItem(itemName);
      setMutationError(null);
      setPendingHeartState((prev) => ({
        ...prev,
        [itemName]: { liked: nextLiked, heartCount: nextCount },
      }));

      try {
        const response = await fetch("/api/mealplan/junk/ratings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mealPlanId,
            itemName,
            liked: nextLiked,
          }),
        });

        if (!response.ok) {
          throw new Error("Unable to save junk heart.");
        }

        await notifyUpdated();
      } catch (error) {
        setMutationError(
          error instanceof Error ? error.message : "Unable to save junk heart."
        );
        setPendingHeartState((prev) => {
          const next = { ...prev };
          delete next[itemName];
          return next;
        });
      } finally {
        setHeartSavingItem(null);
      }
    },
    [heartSavingItem, mealPlanId, notifyUpdated, type]
  );

  const togglePantry = useCallback(
    async ({
      category,
      itemName,
      pantry,
      onOptimisticUpdate,
      onRollback,
    }: {
      category: string;
      itemName: string;
      pantry: boolean;
      onOptimisticUpdate: () => void;
      onRollback: () => void;
    }) => {
      if (pantrySavingItem) return;
      setPantrySavingItem(`${category}::${itemName}`);
      onOptimisticUpdate();

      try {
        await mutateList("PATCH", {
          weekRange,
          category,
          itemName,
          pantry,
        });
      } catch {
        setMutationError("Unable to update pantry status.");
        onRollback();
      } finally {
        setPantrySavingItem(null);
      }
    },
    [mutateList, pantrySavingItem, weekRange]
  );

  const deleteItem = useCallback(
    async (category: string, itemName?: string) => {
      if (isSaving) return;
      setIsSaving(true);

      try {
        if (type === "household") {
          await mutateList("DELETE", { weekRange, category });
        } else {
          await mutateList("DELETE", {
            weekRange,
            category,
            itemName,
          });
        }
      } catch (error) {
        setMutationError(
          error instanceof Error ? error.message : "Unable to delete item."
        );
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, mutateList, type, weekRange]
  );

  const addItem = useCallback(
    async (category: string, itemName?: string, itemQty?: string) => {
      if (isSaving) return false;
      setIsSaving(true);

      try {
        if (type === "household") {
          await mutateList("POST", { weekRange, category });
        } else {
          if (!itemName?.trim()) return false;
          await mutateList("POST", {
            weekRange,
            category,
            item: {
              n: itemName.trim(),
              ...(itemQty?.trim() ? { q: itemQty.trim() } : {}),
            },
          });
        }
        return true;
      } catch (error) {
        setMutationError(
          error instanceof Error ? error.message : "Unable to add item."
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, mutateList, type, weekRange]
  );

  const resetMutationState = useCallback(() => {
    setPendingHeartState({});
    setHeartSavingItem(null);
    setPantrySavingItem(null);
    setIsSaving(false);
    setMutationError(null);
  }, []);

  return {
    isSaving,
    pantrySavingItem,
    heartSavingItem,
    mutationError,
    pendingHeartState,
    resetMutationState,
    toggleJunkHeart,
    togglePantry,
    deleteItem,
    addItem,
  };
}
