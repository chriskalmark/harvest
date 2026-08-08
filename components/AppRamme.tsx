"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { MealPlanProvider } from "@/lib/MealPlanProvider";

/**
 * Appens ramme -- header og bundnavigation omkring hver skærm.
 *
 * Loginsiden får den IKKE. To grunde, og begge er praktiske:
 *
 *   1. Faner til skærme man ikke må se endnu, er et løfte der brydes ved
 *      første tryk.
 *   2. MealPlanProvider henter /api/mealplan med det samme. Bag låsen
 *      svarer den 401, og loginsiden ville tegne en fejl inden man havde
 *      nået at taste et eneste tegn.
 */
export default function AppRamme({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return (
      <div className="relative mx-auto min-h-screen max-w-md pb-10">
        {children}
      </div>
    );
  }

  return (
    <MealPlanProvider>
      <div className="relative mx-auto min-h-screen max-w-md pb-[calc(170px+env(safe-area-inset-bottom))]">
        <Header />
        {children}
        <BottomNav />
      </div>
    </MealPlanProvider>
  );
}
