"use client";

import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { MealPlanProvider } from "@/lib/MealPlanProvider";

/**
 * Appens ramme -- header og bundnavigation omkring hver skærm.
 *
 * Havde kortvarigt en undtagelse for /login, dengang koden lå i appen.
 * Adgangskontrollen ligger nu foran appen i Cloudflare Access, så der er
 * ingen skærme uden ramme længere.
 */
export default function AppRamme({ children }: { children: ReactNode }) {
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
