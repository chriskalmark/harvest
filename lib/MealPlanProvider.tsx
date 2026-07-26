"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StoredMealPlan, WeekOption } from "@/lib/types";
import { buildHref } from "@/lib/urlState";

interface MealPlanState {
  plan: StoredMealPlan | null;
  weeks: WeekOption[];
  selectedWeekRange: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectWeek: (weekRange: string) => void;
}

const MealPlanContext = createContext<MealPlanState | undefined>(undefined);

export function MealPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<StoredMealPlan | null>(null);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const planRef = useRef<StoredMealPlan | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  const weekRangeFromUrl = searchParams.get("weekRange");
  const selectedWeekRange = weekRangeFromUrl ?? plan?.weekRange ?? null;

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        setIsLoading(planRef.current === null);
        setError(null);
        const payload = await fetchMealPlan(weekRangeFromUrl);
        if (!isMounted) {
          return;
        }

        setPlan(payload.mealPlan);
        setWeeks(payload.weeks);

        if (!weekRangeFromUrl && payload.mealPlan) {
          const nextUrl = buildHref(pathname, queryString, {
            weekRange: payload.mealPlan.weekRange,
          });
          window.history.replaceState(null, "", nextUrl);
        }
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the latest meal plan."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [weekRangeFromUrl, pathname, queryString]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const payload = await fetchMealPlan(weekRangeFromUrl);
      setPlan(payload.mealPlan);
      setWeeks(payload.weeks);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load the latest meal plan."
      );
    }
  }, [weekRangeFromUrl]);

  const selectWeek = useCallback(
    (weekRange: string) => {
      setIsLoading(true);
      router.replace(buildHref(pathname, queryString, { weekRange }));
    },
    [router, pathname, queryString]
  );

  const value = useMemo(
    () => ({
      plan,
      weeks,
      selectedWeekRange,
      isLoading,
      error,
      refresh,
      selectWeek,
    }),
    [plan, weeks, selectedWeekRange, isLoading, error, refresh, selectWeek]
  );

  return (
    <MealPlanContext.Provider value={value}>
      {children}
    </MealPlanContext.Provider>
  );
}

export function useMealPlan(): MealPlanState {
  const context = useContext(MealPlanContext);
  if (context === undefined) {
    throw new Error("useMealPlan must be used within a MealPlanProvider");
  }
  return context;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 800
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.8);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.8);
    }
    throw error;
  }
}

async function fetchMealPlan(
  weekRange?: string | null
): Promise<{ mealPlan: StoredMealPlan | null; weeks: WeekOption[] }> {
  const searchParams = new URLSearchParams();

  if (weekRange) {
    searchParams.set("weekRange", weekRange);
  }

  const response = await fetchWithRetry(
    searchParams.size ? `/api/mealplan?${searchParams.toString()}` : "/api/mealplan",
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load the latest meal plan.");
  }

  const result = await response.json();
  return {
    mealPlan: result.data.mealPlan,
    weeks: result.data.weeks
  };
}
