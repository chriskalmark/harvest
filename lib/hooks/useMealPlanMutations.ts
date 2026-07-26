"use client";

import { useCallback, useState } from "react";
import type { MealType } from "@/lib/types";

interface UseMealPlanMutationsOptions {
  weekRange?: string;
  onUpdate?: () => void | Promise<void>;
}

export function useMealPlanMutations({
  weekRange,
  onUpdate,
}: UseMealPlanMutationsOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body: Record<string, unknown>) => {
      if (!weekRange) {
        throw new Error("No week selected.");
      }

      setMutationError(null);
      setIsSaving(true);

      try {
        const response = await fetch("/api/mealplan/meals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekRange, ...body }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload.error === "string"
              ? payload.error
              : "Unable to update menu.";
          throw new Error(message);
        }

        await onUpdate?.();
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to update menu.";
        setMutationError(message);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [onUpdate, weekRange]
  );

  const swapMeal = useCallback(
    (slotOrder: number, mealId: number) => mutate({ action: "swap", slotOrder, mealId }),
    [mutate]
  );

  const removeMeal = useCallback(
    (slotOrder: number) => mutate({ action: "remove", slotOrder }),
    [mutate]
  );

  const addMeal = useCallback(
    (type: MealType, mealId: number) => mutate({ action: "add", type, mealId }),
    [mutate]
  );

  const resetMutationState = useCallback(() => {
    setMutationError(null);
  }, []);

  return {
    isSaving,
    mutationError,
    swapMeal,
    removeMeal,
    addMeal,
    resetMutationState,
  };
}
