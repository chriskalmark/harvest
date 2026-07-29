import { addDays, fromDateOnlyString, toDateOnlyString } from "@/lib/weekRange";

/** Widgetten viser dagens ret plus de seks foelgende dage. */
export const WIDGET_WINDOW_DAYS = 7;

const DANISH_WEEKDAYS = [
  "Søndag",
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
];

export interface WidgetWeekDinners {
  /** Mandagen som ugeplanen starter paa, "YYYY-MM-DD". */
  weekStartDateOnly: string;
  /** Aftensretternes navne i slot-raekkefoelge. */
  dinnerNames: string[];
}

/** "I dag" / "I morgen" / "Torsdag 30/7" — dansk visningsformat. */
export function formatWidgetDayLabel(date: Date, today: Date): string {
  const dateOnly = toDateOnlyString(date);
  if (dateOnly === toDateOnlyString(today)) return "I dag";
  if (dateOnly === toDateOnlyString(addDays(today, 1))) return "I morgen";
  return `${DANISH_WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
}

/**
 * Madplanen gemmer ikke en dato pr. ret — den gemmer en uge (mandag-start) med
 * retter i slot-raekkefoelge. Aftensmaden fordeles derfor paa ugens dage i den
 * raekkefoelge, den staar paa menuen: foerste aftensret = mandag, osv.
 *
 * Resultatet er de naeste syv dages retter med dagens ret foerst. Dage uden en
 * ret udelades, saa listen aldrig indeholder tomme punkter.
 */
export function buildWidgetItems(
  weeks: WidgetWeekDinners[],
  today: Date,
): string[] {
  const firstDay = fromDateOnlyString(toDateOnlyString(today));
  const lastDay = addDays(firstDay, WIDGET_WINDOW_DAYS - 1);

  return weeks
    .flatMap((week) => {
      const weekStart = fromDateOnlyString(week.weekStartDateOnly);
      return week.dinnerNames.map((name, index) => ({
        date: addDays(weekStart, index),
        name,
      }));
    })
    .filter(
      (entry) =>
        entry.date.getTime() >= firstDay.getTime() &&
        entry.date.getTime() <= lastDay.getTime(),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(
      (entry) =>
        `${formatWidgetDayLabel(entry.date, firstDay)} · ${entry.name}`,
    );
}
