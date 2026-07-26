/**
 * Custom hook for meal heart/like functionality
 * Extracts all heart toggle logic from MealCard
 */

import { useState } from "react";

interface UseMealHeartOptions {
  mealId: number;
  mealPlanId: number;
  currentLiked: boolean;
  onChanged: () => Promise<void>;
}

export function useMealHeart({ mealId, mealPlanId, currentLiked, onChanged }: UseMealHeartOptions) {
  const [pendingLiked, setPendingLiked] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liked = pendingLiked ?? currentLiked;

  async function toggleHeart() {
    const nextLiked = !liked;
    setPendingLiked(nextLiked);
    setError(null);

    try {
      setIsSaving(true);
      const response = await fetch("/api/mealplan/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mealPlanId,
          mealId,
          liked: nextLiked,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save meal heart right now.");
      }

      await onChanged();
    } catch (error) {
      setPendingLiked(null);
      setError(error instanceof Error ? error.message : "Unable to save meal heart right now.");
    } finally {
      setIsSaving(false);
    }
  }

  function reset() {
    setPendingLiked(null);
    setError(null);
    setIsSaving(false);
  }

  return {
    liked,
    isSaving,
    error,
    toggleHeart,
    reset
  };
}