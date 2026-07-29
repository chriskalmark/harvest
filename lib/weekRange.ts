function pad2(value: number) {
  return value < 10 ? `0${value}` : String(value);
}

export function toDateOnlyString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromDateOnlyString(dateOnly: string): Date {
  // Modstykke til toDateOnlyString. Vi bygger datoen komponentvis, fordi
  // new Date("YYYY-MM-DD") fortolkes som UTC og kan rykke doegnet en dag.
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toSortValueFromDateOnly(dateOnly: string): number {
  // YYYY-MM-DD -> YYYYMMDD number
  const compact = dateOnly.replaceAll("-", "");
  return Number(compact);
}

export function getWeekStartDateOnly(reference: Date = new Date()): string {
  // Monday-start week
  const date = new Date(reference);
  const day = date.getDay(); // 0=Sun
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return toDateOnlyString(date);
}

const ENGLISH_TO_DANISH_MONTH: Record<string, string> = {
  january: "januar",
  february: "februar",
  march: "marts",
  april: "april",
  may: "maj",
  june: "juni",
  july: "juli",
  august: "august",
  september: "september",
  october: "oktober",
  november: "november",
  december: "december",
};

/**
 * Formats a stored weekRange (e.g. "July 27 — August 2" or
 * "July 27 — August 2, 2026") as Danish for display only.
 *
 * IMPORTANT: this is display-only. The stored/authored weekRange string
 * itself must stay in the "Month D — Month D[, YYYY]" English shape,
 * because deriveWeekStartDateOnlyFromWeekRange (used for week lookup and
 * sorting) parses English month names out of it. Do not feed the output
 * of this function back into storage or into that parser.
 */
export function formatWeekRangeDanish(weekRange: string): string {
  // Matches one or two "Month D[, YYYY]" segments separated by an en dash.
  const parts = weekRange.split("—").map((part) => part.trim());
  if (parts.length !== 2) return weekRange;

  const segmentPattern = /^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/;

  const formatted = parts.map((part) => {
    const match = part.match(segmentPattern);
    if (!match) return null;
    const [, monthName, dayStr, yearStr] = match;
    const danishMonth = ENGLISH_TO_DANISH_MONTH[monthName.toLowerCase()];
    if (!danishMonth) return null;
    const dayNumber = `${Number(dayStr)}.`;
    return yearStr
      ? `${dayNumber} ${danishMonth} ${yearStr}`
      : `${dayNumber} ${danishMonth}`;
  });

  if (formatted.some((value) => value === null)) return weekRange;

  return formatted.join(" — ");
}

export function deriveWeekStartDateOnlyFromWeekRange(
  weekRange: string,
  reference: Date = new Date(),
): string | null {
  // Accept:
  // - "April 27 — May 3"
  // - "April 27 — May 3, 2026"
  // - "April 27, 2026 — May 3, 2026"
  const match = weekRange.match(/([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?/);
  if (!match) return null;

  const [, monthName, dayStr, yearStr] = match;
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const monthIndex = months.indexOf(monthName.toLowerCase());
  if (monthIndex < 0) return null;

  const day = Number(dayStr);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;

  const year = yearStr ? Number(yearStr) : reference.getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 3000) return null;

  const start = new Date(year, monthIndex, day);
  if (Number.isNaN(start.getTime())) return null;

  return toDateOnlyString(start);
}
