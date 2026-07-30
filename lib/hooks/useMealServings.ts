/**
 * Persists the servings stepper on /meal/[id].
 *
 * Mirrors useMealHeart: optimistic local state, a PATCH to save, and a
 * rollback if the save fails. The rescaled shopping-list quantities are not
 * computed here — they come for free the next time the meal plan is
 * refetched, since deriveShoppingListFromMeals always re-derives from the
 * meals' current servings.
 */

import { useState } from "react";

interface UseMealServingsOptions {
  mealId: number;
  initialServings: number;
  onChanged: () => Promise<void>;
}

export function useMealServings({
  mealId,
  initialServings,
  onChanged,
}: UseMealServingsOptions) {
  const [servings, setServings] = useState(initialServings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeServings(next: number) {
    const clamped = Math.max(1, Math.round(next));
    if (clamped === servings) return;

    const previous = servings;
    setServings(clamped);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servings: clamped }),
      });

      if (!response.ok) {
        throw new Error("Unable to save servings right now.");
      }

      await onChanged();
    } catch (err) {
      setServings(previous);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save servings right now.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return { servings, isSaving, error, changeServings };
}
