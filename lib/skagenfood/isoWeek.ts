import type { IsoWeek } from "@/lib/skagenfood/types";

/**
 * ISO-8601-ugenumre.
 *
 * Skagenfood navngiver deres uger med ISO-ugenummeret ("Uge 32"), selvom
 * deres leveringsuge løber søndag–lørdag. Det er verificeret mod deres eget
 * svar: 2026-08-07 er ISO-uge 32, og Skagenfood kalder den uge "32".
 *
 * Alt regnes i UTC, så sommertid aldrig kan flytte en dato en dag.
 */

const MS_PER_DAY = 86_400_000;

function toUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/** Mandagen i den ISO-uge datoen ligger i. */
export function isoWeekStart(date: Date): Date {
  const utc = toUtcMidnight(date);
  // getUTCDay: 0 = søndag. ISO regner mandag som 1 og søndag som 7.
  const isoDay = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
  return new Date(utc.getTime() - (isoDay - 1) * MS_PER_DAY);
}

export function isoWeekOf(date: Date): IsoWeek {
  const monday = isoWeekStart(date);
  // ISO-ugen tilhører det år torsdagen i ugen ligger i.
  const thursday = new Date(monday.getTime() + 3 * MS_PER_DAY);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstMonday = isoWeekStart(
    new Date(
      firstThursday.getUTCFullYear(),
      firstThursday.getUTCMonth(),
      firstThursday.getUTCDate(),
    ),
  );
  const week =
    Math.round((monday.getTime() - firstMonday.getTime()) / (7 * MS_PER_DAY)) +
    1;
  return { year, week };
}

/** Ugen efter den givne dato — det henteren kører på hver søndag. */
export function nextIsoWeek(date: Date): IsoWeek {
  const monday = isoWeekStart(date);
  const nextMonday = new Date(monday.getTime() + 7 * MS_PER_DAY);
  return isoWeekOf(
    new Date(
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth(),
      nextMonday.getUTCDate(),
    ),
  );
}

export function formatIsoWeek(week: IsoWeek): string {
  return `uge ${week.week} ${week.year}`;
}

export function isoWeekEquals(a: IsoWeek, b: IsoWeek): boolean {
  return a.year === b.year && a.week === b.week;
}
