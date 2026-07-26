"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MEAL_TYPES } from "@/lib/constants";
import { buildHref } from "@/lib/urlState";
import type { MealType, StoredMeal } from "@/lib/types";

export type ExploreSortBy =
  | "lastServedAt"
  | "heartCount"
  | "appearanceCount"
  | "p"
  | "cal"
  | "name";

export type ExploreSortDirection = "asc" | "desc";

const PAGE_SIZE = 20;

function parseMealType(raw: string | null): MealType | null {
  return MEAL_TYPES.includes(raw as MealType) ? (raw as MealType) : null;
}

function parseSortBy(raw: string | null): ExploreSortBy {
  const allowed: ExploreSortBy[] = [
    "lastServedAt",
    "heartCount",
    "appearanceCount",
    "p",
    "cal",
    "name",
  ];
  return allowed.includes(raw as ExploreSortBy) ? (raw as ExploreSortBy) : "lastServedAt";
}

export function useExploreFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  const urlFilters = useMemo(
    () => ({
      search: searchParams.get("search") ?? "",
      selectedType: parseMealType(searchParams.get("type")),
      minProtein: Number(searchParams.get("minProtein") ?? "0") || 0,
      sortBy: parseSortBy(searchParams.get("sortBy")),
      sortDirection:
        searchParams.get("sortDirection") === "asc" ? ("asc" as const) : ("desc" as const),
    }),
    [searchParams]
  );

  const [search, setSearch] = useState(urlFilters.search);
  const [searchDraft, setSearchDraft] = useState(urlFilters.search);
  const [selectedType, setSelectedType] = useState<MealType | null>(urlFilters.selectedType);
  const [minProtein, setMinProtein] = useState(urlFilters.minProtein);
  const [sortBy, setSortBy] = useState<ExploreSortBy>(urlFilters.sortBy);
  const [sortDirection, setSortDirection] = useState<ExploreSortDirection>(
    urlFilters.sortDirection
  );
  const searchDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setSearch(urlFilters.search);
      setSearchDraft(urlFilters.search);
      setSelectedType(urlFilters.selectedType);
      setMinProtein(urlFilters.minProtein);
      setSortBy(urlFilters.sortBy);
      setSortDirection(urlFilters.sortDirection);
    });
  }, [urlFilters]);

  useEffect(() => {
    const currentHref = queryString ? `${pathname}?${queryString}` : pathname;
    const nextHref = buildHref(pathname, queryString, {
      search: search.trim() ? search.trim() : null,
      type: selectedType,
      minProtein: minProtein > 0 ? minProtein : null,
      sortBy,
      sortDirection,
    });
    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  }, [router, pathname, queryString, search, selectedType, minProtein, sortBy, sortDirection]);

  useEffect(
    () => () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    },
    []
  );

  const updateSearchDraft = useCallback((next: string) => {
    setSearchDraft(next);
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = window.setTimeout(() => {
      setSearch(next);
    }, 250);
  }, []);

  return {
    queryString,
    search,
    searchDraft,
    updateSearchDraft,
    selectedType,
    setSelectedType,
    minProtein,
    setMinProtein,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
  };
}

export function useMealsInfiniteQuery(filters: {
  selectedType: MealType | null;
  minProtein: number;
  search: string;
  sortBy: ExploreSortBy;
  sortDirection: ExploreSortDirection;
}) {
  const [meals, setMeals] = useState<StoredMeal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loaderRef = useRef<HTMLDivElement>(null);
  const loadedOffsets = useRef<Set<number>>(new Set());

  const fetchMeals = useCallback(
    async (newOffset = 0, append = false) => {
      if (loadedOffsets.current.has(newOffset) && append) return;

      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          loadedOffsets.current.clear();
        }

        const params = new URLSearchParams();
        if (filters.selectedType) params.set("type", filters.selectedType);
        if (filters.minProtein > 0) params.set("minProtein", String(filters.minProtein));
        if (filters.search.trim()) params.set("search", filters.search.trim());
        params.set("sortBy", filters.sortBy);
        params.set("sortDirection", filters.sortDirection);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(newOffset));

        const response = await fetch(`/api/meals?${params}`);
        if (!response.ok) {
          throw new Error("Failed to load meals");
        }

        const result = await response.json();
        const data = result?.data ?? result;
        loadedOffsets.current.add(newOffset);

        setMeals((current) => (append ? [...current, ...data.meals] : data.meals));
        setTotal(data.total);
        setHasMore(data.meals.length === PAGE_SIZE && newOffset + PAGE_SIZE < data.total);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load meals");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setOffset(0);
      void fetchMeals(0, false);
    });
  }, [fetchMeals]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const nextOffset = offset + PAGE_SIZE;
          setOffset(nextOffset);
          void fetchMeals(nextOffset, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, offset, fetchMeals]);

  const refreshMeals = useCallback(async () => {
    loadedOffsets.current.clear();
    setOffset(0);
    await fetchMeals(0, false);
  }, [fetchMeals]);

  return {
    meals,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loaderRef,
    refreshMeals,
  };
}
