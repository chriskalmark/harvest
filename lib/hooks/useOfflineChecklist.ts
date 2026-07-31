"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Local-first checklist for the in-store shopping run.
 *
 * Why: grocery stores have weak/no signal, so checking off items must never
 * depend on a network round-trip. Checked state lives in localStorage and
 * renders instantly. A background queue best-effort syncs each change to the
 * server (so other devices and the published plan stay in step) and retries
 * automatically when connectivity returns. Taps are never dropped.
 *
 * When `enabled` is false (e.g. the junk list) it degrades to in-memory,
 * session-only state with no persistence or syncing.
 */

const SHOPPING_ENDPOINT = "/api/mealplan/shopping";

interface SyncOp {
  weekRange: string;
  category: string;
  itemName: string;
  checked: boolean;
}

function itemKey(category: string, itemName: string) {
  return `${category}::${itemName}`;
}

function checklistStorageKey(weekRange: string) {
  return `harvest-checklist:${weekRange}`;
}

const QUEUE_STORAGE_KEY = "harvest-shopping-sync-queue";

function readChecklist(weekRange: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(checklistStorageKey(weekRange));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : null;
  } catch {
    return null;
  }
}

function writeChecklist(weekRange: string, keys: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      checklistStorageKey(weekRange),
      JSON.stringify(keys),
    );
  } catch {
    // Storage full or unavailable; UI state still works for the session.
  }
}

function readQueue(): SyncOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: SyncOp[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(ops));
  } catch {
    // Ignore; sync is best-effort.
  }
}

interface UseOfflineChecklistOptions {
  weekRange?: string;
  enabled: boolean;
  initialCheckedKeys: string[];
}

export function useOfflineChecklist({
  weekRange,
  enabled,
  initialCheckedKeys,
}: UseOfflineChecklistOptions) {
  const week = weekRange ?? "";
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set());
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const seededWeekRef = useRef<string | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkedKeysRef = useRef<Set<string>>(new Set());

  // Seed checked state once per week: prefer the local snapshot (the user's
  // in-store progress), otherwise fall back to what the server reported.
  useEffect(() => {
    if (seededWeekRef.current === week) return;
    seededWeekRef.current = week;

    if (!enabled) {
      queueMicrotask(() => setCheckedKeys(new Set(initialCheckedKeys)));
      return;
    }

    const stored = readChecklist(week);
    if (stored) {
      queueMicrotask(() => setCheckedKeys(new Set(stored)));
    } else {
      writeChecklist(week, initialCheckedKeys);
      queueMicrotask(() => setCheckedKeys(new Set(initialCheckedKeys)));
    }
  }, [week, enabled, initialCheckedKeys]);

  // Keep a ref mirror of checkedKeys so async handlers (clearChecked) can
  // read the latest value for rollback without depending on stale closures.
  useEffect(() => {
    checkedKeysRef.current = checkedKeys;
  }, [checkedKeys]);

  // Applies a fully-resolved set of checked keys to local state + storage.
  // Shared by markAllChecked and clearChecked's success/rollback paths so
  // both take the same shape: the network write (if any) is the caller's
  // responsibility, this just makes local state agree with it.
  const applyLocalKeys = useCallback(
    (keys: string[]) => {
      setCheckedKeys(new Set(keys));
      if (enabled) {
        writeChecklist(week, keys);
      }
    },
    [enabled, week],
  );

  const refreshPendingCount = useCallback(() => {
    setPendingSyncCount(readQueue().length);
  }, []);

  const flushQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    let queue = readQueue();
    while (queue.length > 0) {
      const op = queue[0];
      try {
        const response = await fetch(SHOPPING_ENDPOINT, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekRange: op.weekRange,
            category: op.category,
            itemName: op.itemName,
            checked: op.checked,
          }),
        });
        if (!response.ok && response.status !== 404) {
          // Server-side trouble; stop and retry the whole queue later.
          break;
        }
      } catch {
        // Offline / network error: stop, retry later.
        break;
      }

      queue = readQueue().slice(1);
      writeQueue(queue);
    }

    refreshPendingCount();
  }, [refreshPendingCount]);

  const enqueue = useCallback(
    (op: SyncOp) => {
      const queue = readQueue().filter(
        (existing) =>
          !(
            existing.weekRange === op.weekRange &&
            existing.category === op.category &&
            existing.itemName === op.itemName
          ),
      );
      queue.push(op);
      writeQueue(queue);
      refreshPendingCount();
      void flushQueue();
    },
    [flushQueue, refreshPendingCount],
  );

  // Retry sync on reconnect, when the app regains focus, and on a slow interval.
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    queueMicrotask(() => {
      setIsOnline(navigator.onLine);
      refreshPendingCount();
    });

    const handleOnline = () => {
      setIsOnline(true);
      void flushQueue();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisible = () => {
      if (document.visibilityState === "visible") void flushQueue();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);
    flushTimerRef.current = setInterval(() => {
      if (readQueue().length > 0) void flushQueue();
    }, 15000);

    queueMicrotask(() => void flushQueue());

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [enabled, flushQueue, refreshPendingCount]);

  const toggle = useCallback(
    (category: string, itemName: string) => {
      const key = itemKey(category, itemName);
      setCheckedKeys((prev) => {
        const next = new Set(prev);
        const nowChecked = !next.has(key);
        if (nowChecked) {
          next.add(key);
        } else {
          next.delete(key);
        }

        if (enabled) {
          writeChecklist(week, Array.from(next));
          enqueue({ weekRange: week, category, itemName, checked: nowChecked });
        }
        return next;
      });
    },
    [enabled, enqueue, week],
  );

  const isChecked = useCallback(
    (category: string, itemName: string) =>
      checkedKeys.has(itemKey(category, itemName)),
    [checkedKeys],
  );

  // Resets every checked item in one request instead of one PATCH per item.
  //
  // Why not the per-item queue: `enqueue` fires one `PATCH .../shopping` per
  // item, and each of those reads the whole meal plan, flips one item, and
  // writes the entire shopping list back. For a handful of ticks that's fine
  // — for "uncheck all 46", the 46 writes race each other and overwrite one
  // another (a lost update): measured live, only a few survived on the
  // server while local state showed everything cleared. The bulk endpoint
  // (`{ all: true, checked: false }`, the same one "Ryd hele listen" uses to
  // set everything checked) writes once, so there is nothing to race.
  //
  // Offline: a single bulk request can't be queued the same way a per-item
  // op can (there is no partial/merge semantics for "the whole list, minus
  // whatever changed while offline"). Rather than silently pretend it
  // queued and later surprise the user with stale state, we refuse up
  // front with a clear message and change nothing locally.
  //
  // Local state: optimistic-clear-then-rollback. The screen clears
  // instantly (matches how `toggle` feels), but if the request fails we
  // restore the previous checked set both in memory and in localStorage, so
  // local and server never disagree for longer than the round trip.
  const clearChecked = useCallback(async (): Promise<{
    ok: boolean;
    message?: string;
  }> => {
    if (!enabled) {
      setCheckedKeys(new Set());
      return { ok: true };
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return {
        ok: false,
        message:
          "Offline: Nulstil kraever forbindelse. Proev igen naar du er online.",
      };
    }

    const previousKeys = Array.from(checkedKeysRef.current);
    setIsClearing(true);
    applyLocalKeys([]);

    try {
      const response = await fetch(SHOPPING_ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, checked: false, weekRange: week }),
      });
      if (!response.ok) {
        throw new Error(`Serveren svarede ${response.status}`);
      }
      return { ok: true };
    } catch {
      applyLocalKeys(previousKeys);
      return {
        ok: false,
        message: "Nulstil kunne ikke gemmes. Proev igen.",
      };
    } finally {
      setIsClearing(false);
    }
  }, [applyLocalKeys, enabled, week]);

  // Marks every given item as checked locally, instantly, without going
  // through the sync queue or making its own request. Used by the "clear
  // list" action (ClearShoppingListButton), which already persists the bulk
  // change to the server itself (PATCH { all: true, checked: true }) before
  // calling this — so this only needs to update the local, offline-first
  // source of truth that `isChecked` reads from, so the "Skjul klaret"
  // filter can hide the items right away instead of waiting for a round
  // trip. It shares `applyLocalKeys` with `clearChecked`'s local-state step,
  // but intentionally does not call `clearChecked` (or vice versa): the two
  // differ in who performs the network write and with which `checked`
  // value, only the "make local state agree" shape is common.
  const markAllChecked = useCallback(
    (keys: string[]) => {
      applyLocalKeys(keys);
    },
    [applyLocalKeys],
  );

  return {
    checkedCount: checkedKeys.size,
    isChecked,
    toggle,
    clearChecked,
    isClearing,
    markAllChecked,
    pendingSyncCount,
    isOnline,
  };
}
