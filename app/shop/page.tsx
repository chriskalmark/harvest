"use client";

import { useMemo } from "react";
import ListSection from "@/components/ListSection";
import MealPlanGate from "@/components/MealPlanGate";
import { useMealPlan } from "@/lib/MealPlanProvider";
import { getShoppingItemUsage } from "@/lib/domain/shoppingUsage";

export default function ShopPage() {
  const { plan, isLoading, error, refresh } = useMealPlan();
  const shoppingItemUsage = useMemo(
    () => (plan ? getShoppingItemUsage(plan) : {}),
    [plan],
  );

  return (
    <MealPlanGate
      plan={plan}
      isLoading={isLoading}
      error={error}
      loadingMessage="Henter indkøbslisten..."
      onSeeded={refresh}
    >
      {(readyPlan) => (
        <main className="px-4 pb-12">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-harvest-green">
            Indkøb
          </p>
          <h1 className="mb-6 font-serif text-2xl font-bold leading-tight text-[var(--foreground)]">
            Turen rundt i butikken
          </h1>

          <ListSection
            data={readyPlan.shoppingList}
            colorClass="bg-harvest-green"
            editable={true}
            weekRange={readyPlan.weekRange}
            type="shopping"
            itemUsageByKey={shoppingItemUsage}
            onUpdate={refresh}
          />
        </main>
      )}
    </MealPlanGate>
  );
}
