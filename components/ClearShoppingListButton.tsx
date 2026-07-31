"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";

/**
 * Markerer alle varer i indkoebslisten som klaret og skjuler dem.
 *
 * Listen kan ikke tommes for rigtig: den er afledt af ugens retter (se
 * mealPlanService.buildStoredMealPlan), saa en DELETE bliver regenereret i
 * samme request. "Checked" derimod er rigtigt gemt pr. vare, ligesom
 * "Skjul klaret"-filteret i ListSection allerede bruger. Saa knappen her
 * markerer alt som klaret og taender filteret, i stedet for at forsoege at
 * slette noget, der bare kommer igen.
 *
 * Bekraeftelsen er to trin i selve siden frem for en modal — den er nemmere
 * at ramme med en tommelfinger og nemmere at fortryde ved at scrolle vaek.
 */
export default function ClearShoppingListButton({
  weekRange,
  uncheckedCount,
  onClearedLocally,
  onCleared,
}: {
  weekRange: string;
  uncheckedCount: number;
  /** Marks everything checked + hides them in ListSection, instantly. */
  onClearedLocally: () => void;
  onCleared: () => Promise<void> | void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (uncheckedCount === 0) {
    return null;
  }

  const clear = async () => {
    setIsClearing(true);
    setError(null);

    try {
      const response = await fetch("/api/mealplan/shopping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, checked: true, weekRange }),
      });

      if (!response.ok) {
        throw new Error(`Serveren svarede ${response.status}`);
      }

      onClearedLocally();
      await onCleared();
      setConfirming(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Listen blev ikke ryddet.",
      );
    } finally {
      setIsClearing(false);
    }
  };

  if (!confirming) {
    return (
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] px-4 text-[15px] font-semibold text-[var(--text-muted)] transition active:scale-[0.99]"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          Ryd hele listen
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
      <p className="font-serif text-[17px] font-bold leading-snug text-[var(--foreground)]">
        Er du sikker?
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-muted)]">
        Alt bliver markeret som klaret og forsvinder fra listen. Der bliver ikke
        slettet noget — tryk »Vis alle«, hvis du fortryder.
      </p>

      {error ? (
        <p className="mt-3 text-[14px] font-semibold text-[var(--harvest-terracotta)]">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={isClearing}
          className="min-h-11 flex-1 rounded-full bg-[var(--harvest-terracotta)] px-4 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {isClearing ? "Rydder..." : "Ja, ryd listen"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={isClearing}
          className="min-h-11 flex-1 rounded-full border border-[var(--border-subtle)] px-4 text-[15px] font-semibold text-[var(--foreground)] transition active:scale-[0.98] disabled:opacity-60"
        >
          Fortryd
        </button>
      </div>
    </div>
  );
}
