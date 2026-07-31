"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

/**
 * Rydder hele indkoebslisten.
 *
 * Bekraeftelsen er to trin i selve siden frem for en modal — den er nemmere
 * at ramme med en tommelfinger og nemmere at fortryde ved at scrolle vaek.
 *
 * Teksten siger sandheden om, hvad der sker: varer fra ugens retter kommer
 * igen, naar listen udledes paa ny, fordi listen er afledt af maaltiderne.
 * Kun haandtilfoejede varer forsvinder permanent.
 */
export default function ClearShoppingListButton({
  weekRange,
  itemCount,
  onCleared,
}: {
  weekRange: string;
  itemCount: number;
  onCleared: () => Promise<void> | void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (itemCount === 0) {
    return null;
  }

  const clear = async () => {
    setIsClearing(true);
    setError(null);

    try {
      const response = await fetch("/api/mealplan/shopping", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, weekRange }),
      });

      if (!response.ok) {
        throw new Error(`Serveren svarede ${response.status}`);
      }

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
          <Trash2 className="h-4 w-4" aria-hidden="true" />
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
        Alle {itemCount} varer forsvinder fra listen. Varerne fra ugens retter
        kommer igen, naar listen genberegnes — kun dem, du selv har tilfoejet,
        er væk for altid.
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
