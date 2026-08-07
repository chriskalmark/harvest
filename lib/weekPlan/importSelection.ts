import { isoWeekOf, nextIsoWeek } from "@/lib/skagenfood/isoWeek";
import { WeekPlanError } from "@/lib/weekPlan/week";
import type { IsoWeek } from "@/lib/skagenfood/types";

/**
 * Oversætter det importruten får ind til en ISO-uge.
 *
 * Standarden er NÆSTE uge, ikke denne. Det er hele pointen med at kunne køre
 * importen fra produktionen: den kommende uges opskrifter skal i huset, mens
 * Skagenfood stadig har dem liggende.
 */
export function resolveImportWeek(
  weekRaw: unknown,
  yearRaw: unknown,
  now: Date = new Date(),
): IsoWeek {
  const hasYear = yearRaw !== undefined && yearRaw !== null && yearRaw !== "";

  if (weekRaw === undefined || weekRaw === null || weekRaw === "") {
    if (hasYear) {
      throw new WeekPlanError(
        "Et årstal kan kun bruges sammen med et ugenummer.",
      );
    }
    return nextIsoWeek(now);
  }

  if (typeof weekRaw === "string" && !/^\d+$/.test(weekRaw.trim())) {
    const value = weekRaw.trim().toLowerCase();
    if (hasYear) {
      throw new WeekPlanError(
        "Et årstal kan kun bruges sammen med et ugenummer.",
      );
    }
    if (["næste", "naeste", "next"].includes(value)) return nextIsoWeek(now);
    if (["denne", "nu", "current"].includes(value)) return isoWeekOf(now);
    throw new WeekPlanError(
      `Ugen skal være "næste", "denne" eller et ugenummer mellem 1 og 53. Fik "${weekRaw}".`,
    );
  }

  const week = typeof weekRaw === "string" ? Number(weekRaw.trim()) : weekRaw;
  if (
    typeof week !== "number" ||
    !Number.isInteger(week) ||
    week < 1 ||
    week > 53
  ) {
    throw new WeekPlanError(
      `Ugen skal være "næste", "denne" eller et ugenummer mellem 1 og 53. Fik "${String(weekRaw)}".`,
    );
  }

  const year = hasYear
    ? typeof yearRaw === "string"
      ? Number(yearRaw.trim())
      : yearRaw
    : isoWeekOf(now).year;

  if (
    typeof year !== "number" ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    throw new WeekPlanError(
      `Årstallet skal være et helt tal mellem 2020 og 2100. Fik "${String(yearRaw)}".`,
    );
  }

  return { year, week };
}
