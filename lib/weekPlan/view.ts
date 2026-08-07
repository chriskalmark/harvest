import {
  addDays,
  DAYS_IN_WEEK,
  isoWeekOfDateOnly,
  MONTH_NAMES,
  mondayOf,
  parseDateOnly,
  requireMonday,
  todayDateOnly,
} from "@/lib/weekPlan/week";
import type { WeekPlan, WeekPlanDay } from "@/lib/weekPlan/types";

/**
 * Ugeplan-skærmens sprog.
 *
 * Alt herinde er rent: ind kommer en uge eller en dagsplads, ud kommer den
 * danske tekst skærmen skriver. Ingen database, intet netværk, ingen React --
 * saa hver eneste sætning brugeren læser kan efterprøves i en test.
 *
 * To ting er bevidste valg og ikke tilfældigheder:
 *
 *   1. En tom dag hedder "Åben aften", ikke "Ingen ret valgt". Tom er den
 *      normale tilstand mandag morgen, ikke en fejl -- og teksten skal invitere.
 *   2. Overskriften taeller i ord ("Tre aftener"), mens linjen under taeller i
 *      tal ("3 af 7"). Ordene er tonen, tallet er sandheden.
 */

/** Ordet for et tal fra 0 til 7. Over det er tallet selv tydeligere. */
const COUNT_WORDS = [
  "Nul",
  "Én",
  "To",
  "Tre",
  "Fire",
  "Fem",
  "Seks",
  "Syv",
] as const;

export function danishCount(value: number): string {
  return COUNT_WORDS[value] ?? String(value);
}

export interface WeekHeadline {
  line1: string;
  line2: string;
}

/** De to linjer i den store overskrift paa den grønne flade. */
export function weekHeadline(plannedDays: number): WeekHeadline {
  if (plannedDays <= 0) return { line1: "Ugen ligger", line2: "åben." };
  if (plannedDays >= DAYS_IN_WEEK) {
    return { line1: "Hele ugen", line2: "er på plads." };
  }
  const word = danishCount(plannedDays).toLowerCase();
  const noun = plannedDays === 1 ? "aften" : "aftener";
  return {
    line1: `${word.charAt(0).toUpperCase()}${word.slice(1)} ${noun}`,
    line2: "er på plads.",
  };
}

/** Linjen under overskriften. Her staar tallet, ikke ordet. */
export function weekSummary(plannedDays: number): string {
  if (plannedDays <= 0) return `Syv aftener at fylde ud`;
  if (plannedDays >= DAYS_IN_WEEK) return "Syv af syv. Ingen tvivl.";
  return `${plannedDays} af ${DAYS_IN_WEEK} aftener planlagt`;
}

/** Mandagen et helt antal uger frem eller tilbage. */
export function shiftWeek(monday: string, deltaWeeks: number): string {
  requireMonday(monday);
  return addDays(monday, deltaWeeks * DAYS_IN_WEEK);
}

/** "Denne uge" / "Næste uge" / "Sidste uge" -- eller null for alt andet. */
export function relativeWeekName(
  monday: string,
  now: Date = new Date(),
): string | null {
  requireMonday(monday);
  const thisMonday = mondayOf(todayDateOnly(now));
  if (monday === thisMonday) return "Denne uge";
  if (monday === shiftWeek(thisMonday, 1)) return "Næste uge";
  if (monday === shiftWeek(thisMonday, -1)) return "Sidste uge";
  return null;
}

/** "Uge 33". Ugenummeret alene, til den lille overskrift i toppen. */
export function weekNumberLabel(monday: string): string {
  requireMonday(monday);
  return `Uge ${isoWeekOfDateOnly(monday).week}`;
}

/**
 * "10.–16. august" -- datoerne uden aarstal, for de fylder paa en telefon.
 * Krydser ugen et aarsskifte, kommer aarstallene alligevel med: der er den
 * eneste gang de faktisk fortæller noget.
 */
export function weekRangeLabel(monday: string): string {
  requireMonday(monday);
  const start = parseDateOnly(monday);
  const end = parseDateOnly(addDays(monday, DAYS_IN_WEEK - 1));

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTH_NAMES[start.getUTCMonth()];
  const endMonth = MONTH_NAMES[end.getUTCMonth()];

  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${startDay}. ${startMonth} ${start.getUTCFullYear()} – ${endDay}. ${endMonth} ${end.getUTCFullYear()}`;
  }
  if (startMonth !== endMonth) {
    return `${startDay}. ${startMonth} – ${endDay}. ${endMonth}`;
  }
  return `${startDay}.–${endDay}. ${endMonth}`;
}

/** "13. august" */
export function formatDayDate(dateOnly: string): string {
  const date = parseDateOnly(dateOnly);
  return `${date.getUTCDate()}. ${MONTH_NAMES[date.getUTCMonth()]}`;
}

export function isToday(dateOnly: string, now: Date = new Date()): boolean {
  return dateOnly === todayDateOnly(now);
}

/** Ligger dagen bag os? I dag er ikke fortid. */
export function isPast(dateOnly: string, now: Date = new Date()): boolean {
  return dateOnly < todayDateOnly(now);
}

/**
 * Hvilken dag der faar den store plads.
 *
 * Ligger i dag i ugen, er det i dag -- det er den aften man staar og skal
 * lave mad til. Ellers er det mandag, ugens begyndelse.
 */
export function leadWeekday(plan: WeekPlan, now: Date = new Date()): number {
  const today = todayDateOnly(now);
  const match = plan.days.find((day) => day.date === today);
  return match ? match.weekday : 1;
}

export function formatMinutes(totalMinutes: number | null): string | null {
  if (totalMinutes === null || !Number.isFinite(totalMinutes)) return null;
  if (totalMinutes <= 0) return null;
  return `${Math.round(totalMinutes)} min`;
}

export function portionsLabel(portions: number): string {
  return `${portions} pers.`;
}

/** Det der staar med stort paa dagens raekke. Tom dag inviterer. */
export function dayTitle(day: WeekPlanDay): string {
  return day.title ?? "Åben aften";
}

/**
 * Den lille linje under titlen.
 *
 * Tom dag: en invitation, ikke en mangel. Fyldt dag: tid og portioner, adskilt
 * med den samme prik resten af appen bruger.
 */
export function daySubtitle(day: WeekPlanDay): string {
  if (day.slotKind === "empty") return "Vælg en ret, eller skriv jeres egen";
  const parts = [
    formatMinutes(day.recipe?.totalMinutes ?? null),
    portionsLabel(day.portions),
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

/** "Mandag 10. august" -- overskriften i dagens ark. */
export function dayHeading(day: WeekPlanDay): string {
  return `${day.dayName} ${formatDayDate(day.date)}`;
}
