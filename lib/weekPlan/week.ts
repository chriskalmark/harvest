import { isoWeekOf } from "@/lib/skagenfood/isoWeek";
import type {
  WeekPlan,
  WeekPlanDay,
  WeekPlanDayRow,
  WeekPlanSlotKind,
} from "@/lib/weekPlan/types";

/**
 * Ugeplanlæggerens rene regnestykker: datoer, ugenumre, validering og
 * sammensætningen af de syv dagspladser.
 *
 * Ingen database, intet netværk. Alt herinde kan testes uden at starte noget.
 * Datoerne regnes i UTC, så sommertid aldrig kan flytte mandagen en dag.
 */

export class WeekPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeekPlanError";
  }
}

export const DAYS_IN_WEEK = 7;
export const DEFAULT_PORTIONS = 2;
export const MIN_PORTIONS = 1;
export const MAX_PORTIONS = 12;
export const MAX_TITLE_LENGTH = 120;
export const MAX_NOTE_LENGTH = 500;

/** Index 0 = mandag, index 6 = søndag. */
export const WEEKDAY_NAMES = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
] as const;

const MONTH_NAMES = [
  "januar",
  "februar",
  "marts",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "december",
] as const;

const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  return formatDateOnly(parseDateOnlyUnchecked(value)) === value;
}

function parseDateOnlyUnchecked(value: string): Date {
  const match = value.match(DATE_ONLY);
  if (!match) return new Date(NaN);
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

/** YYYY-MM-DD -> UTC-midnat. Kaster på alt andet, også 2026-02-31. */
export function parseDateOnly(value: unknown): Date {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    throw new WeekPlanError(
      `Datoen skal skrives som ÅÅÅÅ-MM-DD. Fik "${String(value)}".`,
    );
  }
  const date = parseDateOnlyUnchecked(value);
  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new WeekPlanError(`"${value}" er ikke en rigtig dato.`);
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

export function addDays(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly);
  return formatDateOnly(new Date(date.getTime() + days * MS_PER_DAY));
}

/** 1 = mandag ... 7 = søndag. Samme tælling som Postgres' ISODOW. */
export function isoWeekdayOf(dateOnly: string): number {
  const day = parseDateOnly(dateOnly).getUTCDay();
  return day === 0 ? DAYS_IN_WEEK : day;
}

/** Mandagen i den uge datoen ligger i. */
export function mondayOf(dateOnly: string): string {
  return addDays(dateOnly, -(isoWeekdayOf(dateOnly) - 1));
}

/** Kaster hvis datoen ikke er en mandag. Ugens identitet er mandagens dato. */
export function requireMonday(dateOnly: string): string {
  if (isoWeekdayOf(dateOnly) !== 1) {
    throw new WeekPlanError(
      `En planlagt uge begynder om mandagen. ${dateOnly} er en ${WEEKDAY_NAMES[
        isoWeekdayOf(dateOnly) - 1
      ].toLowerCase()}.`,
    );
  }
  return dateOnly;
}

/** Dagens dato i lokal tid, som YYYY-MM-DD. */
export function todayDateOnly(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * Oversætter det brugeren eller URL'en siger til en mandag.
 *
 *   udeladt / "" / "denne"  -> mandagen i indeværende uge
 *   "næste"                 -> mandagen i næste uge
 *   "forrige"               -> mandagen i sidste uge
 *   "2026-08-05"            -> mandagen i den uge datoen ligger i (2026-08-03)
 */
export function normalizeWeekStart(
  raw: unknown,
  now: Date = new Date(),
): string {
  const thisMonday = mondayOf(todayDateOnly(now));

  if (raw === undefined || raw === null || raw === "") return thisMonday;

  if (typeof raw !== "string") {
    throw new WeekPlanError(
      "Ugen skal angives som en dato (ÅÅÅÅ-MM-DD) eller som denne, næste eller forrige.",
    );
  }

  const value = raw.trim().toLowerCase();
  if (["denne", "nu", "current"].includes(value)) return thisMonday;
  if (["næste", "naeste", "next"].includes(value))
    return addDays(thisMonday, 7);
  if (["forrige", "sidste", "previous"].includes(value)) {
    return addDays(thisMonday, -7);
  }

  const trimmed = raw.trim();
  parseDateOnly(trimmed);
  return mondayOf(trimmed);
}

/** De syv datoer i ugen, mandag først. */
export function weekDates(monday: string): string[] {
  requireMonday(monday);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) =>
    addDays(monday, index),
  );
}

export function weekLabel(monday: string): string {
  requireMonday(monday);
  const start = parseDateOnly(monday);
  const end = parseDateOnly(addDays(monday, DAYS_IN_WEEK - 1));
  const { week } = isoWeekOf(
    new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTH_NAMES[start.getUTCMonth()];
  const endMonth = MONTH_NAMES[end.getUTCMonth()];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  let range: string;
  if (startYear !== endYear) {
    range = `${startDay}. ${startMonth} ${startYear} – ${endDay}. ${endMonth} ${endYear}`;
  } else if (startMonth !== endMonth) {
    range = `${startDay}. ${startMonth} – ${endDay}. ${endMonth} ${endYear}`;
  } else {
    range = `${startDay}.–${endDay}. ${endMonth} ${endYear}`;
  }

  return `Uge ${week} · ${range}`;
}

export function requireWeekday(value: unknown): number {
  const day = typeof value === "string" ? Number(value) : value;
  if (
    typeof day !== "number" ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > DAYS_IN_WEEK
  ) {
    throw new WeekPlanError(
      `Ugedagen skal være et helt tal fra 1 (mandag) til 7 (søndag). Fik "${String(value)}".`,
    );
  }
  return day;
}

export function requirePortions(value: unknown): number {
  const portions = typeof value === "string" ? Number(value) : value;
  if (
    typeof portions !== "number" ||
    !Number.isInteger(portions) ||
    portions < MIN_PORTIONS ||
    portions > MAX_PORTIONS
  ) {
    throw new WeekPlanError(
      `Portionsantallet skal være et helt tal mellem ${MIN_PORTIONS} og ${MAX_PORTIONS}. Fik "${String(value)}".`,
    );
  }
  return portions;
}

/** undefined betyder "lad portionsantallet stå" -- ikke "sæt det til 2". */
export function optionalPortions(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requirePortions(value);
}

export function requireRecipeId(value: unknown): number {
  const id = typeof value === "string" ? Number(value) : value;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new WeekPlanError(
      `Opskriftens id skal være et helt positivt tal. Fik "${String(value)}".`,
    );
  }
  return id;
}

/** Et navn er nok. "Lasagne" er en gyldig ret. */
export function normalizeManualTitle(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WeekPlanError("Retten skal have et navn.");
  }
  const title = value.trim().replace(/\s+/g, " ");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new WeekPlanError(
      `Rettens navn må højst være på ${MAX_TITLE_LENGTH} tegn. Fik ${title.length}.`,
    );
  }
  return title;
}

export function normalizeNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new WeekPlanError("Noten skal være tekst.");
  }
  const note = value.trim();
  if (!note) return null;
  if (note.length > MAX_NOTE_LENGTH) {
    throw new WeekPlanError(
      `Noten må højst være på ${MAX_NOTE_LENGTH} tegn. Fik ${note.length}.`,
    );
  }
  return note;
}

export function slotTitle(row: WeekPlanDayRow): string | null {
  if (row.slotKind === "catalog") return row.recipe?.name ?? null;
  if (row.slotKind === "manual") return row.manualTitle;
  return null;
}

function emptyRow(weekday: number): WeekPlanDayRow {
  return {
    weekday,
    slotKind: "empty",
    portions: DEFAULT_PORTIONS,
    manualTitle: null,
    note: null,
    recipe: null,
  };
}

function assertRowShape(row: WeekPlanDayRow): void {
  const kinds: WeekPlanSlotKind[] = ["empty", "catalog", "manual"];
  if (!kinds.includes(row.slotKind)) {
    throw new WeekPlanError(
      `Dagsplads ${row.weekday} har en ukendt slags "${String(row.slotKind)}".`,
    );
  }
  if (row.slotKind === "catalog" && !row.recipe) {
    throw new WeekPlanError(
      `Dagsplads ${row.weekday} peger på en opskrift fra kataloget, men opskriften mangler.`,
    );
  }
  if (row.slotKind === "manual" && !row.manualTitle?.trim()) {
    throw new WeekPlanError(
      `Dagsplads ${row.weekday} er en selvskrevet ret uden navn.`,
    );
  }
}

/**
 * Bygger de præcis syv dagspladser.
 *
 * Rækker der ikke findes i basen bliver tomme pladser -- ugen har altid syv
 * dage, uanset hvad databasen nåede at gemme. Rækker der modsiger sig selv
 * fejler højlydt frem for at blive vist halve.
 */
export function buildWeekPlan(
  monday: string,
  rows: WeekPlanDayRow[],
): WeekPlan {
  requireMonday(monday);

  const byWeekday = new Map<number, WeekPlanDayRow>();
  for (const row of rows) {
    const weekday = requireWeekday(row.weekday);
    if (byWeekday.has(weekday)) {
      throw new WeekPlanError(
        `Ugen har to rækker for dag ${weekday}. Der er præcis syv dagspladser.`,
      );
    }
    assertRowShape(row);
    byWeekday.set(weekday, row);
  }

  const dates = weekDates(monday);
  const days: WeekPlanDay[] = dates.map((date, index) => {
    const weekday = index + 1;
    const row = byWeekday.get(weekday) ?? emptyRow(weekday);
    return {
      ...row,
      weekday,
      date,
      dayName: WEEKDAY_NAMES[index],
      title: slotTitle(row),
    };
  });

  const start = parseDateOnly(monday);
  const { year, week } = isoWeekOf(
    new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );

  return {
    weekStart: monday,
    weekEnd: dates[DAYS_IN_WEEK - 1],
    label: weekLabel(monday),
    isoYear: year,
    isoWeek: week,
    days,
    plannedDays: days.filter((day) => day.slotKind !== "empty").length,
  };
}
