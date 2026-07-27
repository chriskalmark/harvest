"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "harvest-theme";

/**
 * Lyst tema er udgangspunktet.
 *
 * Appen bruges to steder — i butikken med telefonen i hånden og ved komfuret
 * med den liggende på bordpladen — og begge er lyse rum. Mørkt tema findes,
 * men kun fordi nogen aktivt vælger det. Se .impeccable.md.
 */
function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
}

export function useTheme() {
  // null = endnu ikke hydreret. Vi renderer aldrig med et gættet tema.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initialDark = stored === "dark";

    queueMicrotask(() => setIsDark(initialDark));
    applyTheme(initialDark);

    // Andre faner kan skifte tema under os.
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      const nextDark = event.newValue === "dark";
      setIsDark(nextDark);
      applyTheme(nextDark);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const toggleTheme = () => {
    const nextDark = !(isDark ?? false);

    setIsDark(nextDark);
    applyTheme(nextDark);
    localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
  };

  return { isDark, toggleTheme };
}
