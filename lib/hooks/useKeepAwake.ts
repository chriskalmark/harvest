"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Holder skaermen taendt, mens man laver mad.
 *
 * Telefonen ligger paa bordpladen med fedtede fingre omkring sig. En skaerm
 * der slukker efter 30 sekunder betyder, at man skal roere den for at laese
 * trin 4 -- praecis det, hele opskriftsvisningen er bygget for at undgaa.
 *
 * Screen Wake Lock findes ikke i alle browsere (Safari fik den i 16.4), og
 * systemet tager laasen tilbage naar fanen gaar i baggrunden. Derfor:
 * `supported` afgoer om knappen overhovedet vises, og laasen tages igen naar
 * fanen bliver synlig. Kan den ikke faas, slaar vi fra i stedet for at lade
 * knappen lyve om at skaermen bliver taendt.
 */

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

interface WakeLockLike {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

function wakeLockApi(): WakeLockLike | null {
  if (typeof navigator === "undefined") return null;
  const api = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  return api ?? null;
}

/**
 * Om browseren har API'et. Serveren svarer nej, browseren svarer for sig selv
 * -- laest som en butik, saa knappen ikke skal tegnes to gange for at komme
 * frem. Ingenting kan aendre svaret, saa der er intet at abonnere paa.
 */
const noopSubscribe = () => () => {};
const hasWakeLock = () => wakeLockApi() !== null;
const hasNoWakeLock = () => false;

export function useKeepAwake() {
  const canWakeLock = useSyncExternalStore(
    noopSubscribe,
    hasWakeLock,
    hasNoWakeLock,
  );
  // Sagde browseren ja, men naegtede at give laasen, er knappen en loegn.
  const [isRefused, setIsRefused] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const isSupported = canWakeLock && !isRefused;

  const release = useCallback(() => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel && !sentinel.released) {
      void sentinel.release().catch(() => {
        // Laasen er allerede vaek; der er intet at rydde op.
      });
    }
  }, []);

  const acquire = useCallback(async (): Promise<boolean> => {
    const api = wakeLockApi();
    if (!api) return false;
    try {
      const sentinel = await api.request("screen");
      sentinelRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Systemet slipper laasen naar fanen skjules. Er knappen slaaet til, tager
  // vi den igen naar man kommer tilbage til opskriften.
  useEffect(() => {
    if (!isEnabled || typeof document === "undefined") return;

    const handleVisible = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) {
        void acquire();
      }
    };

    document.addEventListener("visibilitychange", handleVisible);
    return () =>
      document.removeEventListener("visibilitychange", handleVisible);
  }, [acquire, isEnabled]);

  useEffect(() => release, [release]);

  const toggle = useCallback(async () => {
    if (isEnabled) {
      release();
      setIsEnabled(false);
      return;
    }
    const ok = await acquire();
    setIsEnabled(ok);
    if (!ok) setIsRefused(true);
  }, [acquire, isEnabled, release]);

  return { isSupported, isEnabled, toggle };
}
