"use client";

import { useState } from "react";
import { StoredMeal } from "@/lib/types";
import MealEditorModal from "@/components/MealEditorModal";
import MenuMealCard from "@/components/MenuMealCard";

interface MealCardProps {
  mealPlanId: number;
  meal: StoredMeal;
  onChanged: () => Promise<void>;
  isOpen?: boolean;
  onOpen?: (mealId: number) => void;
  onClose?: () => void;
}

export default function MealCard({
  mealPlanId,
  meal,
  onChanged,
  isOpen,
  onOpen,
  onClose,
}: MealCardProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  function openEditor() {
    if (typeof isOpen === "boolean") {
      onOpen?.(meal.mealId);
      return;
    }
    setIsEditorOpen(true);
  }

  return (
    <>
      <MenuMealCard
        meal={meal}
        mealPlanId={mealPlanId}
        onOpenMeal={openEditor}
        onSwap={() => {}}
        onRemove={() => {}}
        onChanged={onChanged}
      />

      <MealEditorModal
        meal={meal}
        isOpen={typeof isOpen === "boolean" ? isOpen : isEditorOpen}
        onClose={() => {
          if (typeof isOpen === "boolean") {
            onClose?.();
            return;
          }
          setIsEditorOpen(false);
        }}
        onSaved={async () => {
          await onChanged();
          if (typeof isOpen === "boolean") {
            onClose?.();
            return;
          }
          setIsEditorOpen(false);
        }}
      />
    </>
  );
}
