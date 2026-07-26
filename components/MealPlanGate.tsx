"use client";

import { ReactNode } from "react";
import SeedMealPlanButton from "@/components/SeedMealPlanButton";
import { StoredMealPlan } from "@/lib/types";

interface MealPlanGateProps {
  plan: StoredMealPlan | null;
  isLoading: boolean;
  error: string | null;
  loadingMessage: string;
  onSeeded: () => Promise<void>;
  children: (plan: StoredMealPlan) => ReactNode;
}

export default function MealPlanGate({
  plan,
  isLoading,
  error,
  loadingMessage,
  onSeeded,
  children,
}: MealPlanGateProps) {
  if (isLoading) {
    return <main className="px-4 text-sm text-stone-500">{loadingMessage}</main>;
  }

  if (error) {
    return <main className="px-4 text-sm text-harvest-terracotta">{error}</main>;
  }

  if (!plan) {
    return (
      <main className="px-4">
        <SeedMealPlanButton onSeeded={onSeeded} />
      </main>
    );
  }

  return <>{children(plan)}</>;
}
