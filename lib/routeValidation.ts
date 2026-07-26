import { ApiError } from "@/lib/apiUtils";
import { MealType } from "@/lib/types";
import { MealSortDirection, MealSortField } from "@/lib/services/mealService";

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(`${field} is required.`, 400);
  }
  return value;
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(`${field} must be a number.`, 400);
  }
  return value;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiError(`${field} must be a boolean.`, 400);
  }
  return value;
}

export function parseOptionalBoundedInt(
  raw: string | null,
  { min, max }: { min: number; max: number }
): number | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  const int = Math.trunc(value);
  return Math.min(max, Math.max(min, int));
}

export function parseMealType(raw: string | null): MealType | undefined {
  if (!raw) return undefined;
  const allowed: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
  return allowed.includes(raw as MealType) ? (raw as MealType) : undefined;
}

export function parseMealSortField(raw: string | null): MealSortField | undefined {
  if (!raw) return undefined;
  const allowed: MealSortField[] = [
    "name",
    "cal",
    "p",
    "heartCount",
    "appearanceCount",
    "lastServedAt",
  ];
  return allowed.includes(raw as MealSortField) ? (raw as MealSortField) : undefined;
}

export function parseMealSortDirection(raw: string | null): MealSortDirection | undefined {
  if (!raw) return undefined;
  return raw === "asc" || raw === "desc" ? (raw as MealSortDirection) : undefined;
}

