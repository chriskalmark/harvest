"use client";

import { Loader2, Sprout } from "lucide-react";
import { useState } from "react";
import { cardClass } from "@/lib/uiClasses";

export default function SeedMealPlanButton({
  onSeeded,
}: {
  onSeeded: () => Promise<void>;
}) {
  const [isSeeding, setIsSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSeed() {
    try {
      setIsSeeding(true);
      setMessage(null);

      const response = await fetch("/api/mealplan/seed", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to seed from current-week.json.");
      }

      setMessage("Seeded from current-week.json.");
      await onSeeded();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to seed from current-week.json."
      );
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-harvest-gold/20 text-harvest-green flex items-center justify-center">
          <Sprout size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg text-harvest-green">Seed the current week</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Pull the latest Harvest week from <code>data/current-week.json</code> into Postgres.
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-muted)] min-h-5">{message}</span>
            <button
              type="button"
              onClick={handleSeed}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 rounded-xl bg-harvest-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSeeding ? <Loader2 size={16} className="animate-spin" /> : null}
              Seed plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
