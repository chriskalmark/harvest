/**
 * Ugeplanlæggerens typer.
 *
 * En planlagt uge er mandag til søndag, kun aftensmad, og har altid præcis
 * syv dagspladser -- også de dage der endnu er tomme. UI'et skal aldrig
 * gætte på om dag 5 findes; den findes, den er bare tom.
 */

/** 'empty' = ingen ret, 'catalog' = Skagenfood-opskrift, 'manual' = selvskrevet. */
export type WeekPlanSlotKind = "empty" | "catalog" | "manual";

/** Det kataloget kan fortælle om en opskrift uden at hele opskriften læses. */
export interface WeekPlanRecipeSummary {
  recipeId: number;
  name: string;
  imageUrl: string | null;
  url: string | null;
  totalMinutes: number | null;
  /** Portionsantal opskriften har mængder for, fx [1,2,3,4,5]. */
  portionOptions: number[];
}

/** Én dagsplads. Rå form fra databasen, før datoer og navne lægges på. */
export interface WeekPlanDayRow {
  /** 1 = mandag ... 7 = søndag. */
  weekday: number;
  slotKind: WeekPlanSlotKind;
  portions: number;
  manualTitle: string | null;
  note: string | null;
  recipe: WeekPlanRecipeSummary | null;
}

/** Én dagsplads, klar til skærmen. */
export interface WeekPlanDay extends WeekPlanDayRow {
  /** Dagens dato, YYYY-MM-DD. */
  date: string;
  /** "Mandag", "Tirsdag", ... */
  dayName: string;
  /** Det der skal stå på kortet. null når dagen er tom. */
  title: string | null;
}

/** En hel planlagt uge. days har altid længde 7. */
export interface WeekPlan {
  /** Mandagens dato, YYYY-MM-DD. Ugens identitet. */
  weekStart: string;
  /** Søndagens dato, YYYY-MM-DD. */
  weekEnd: string;
  /** "Uge 33 · 10.–16. august 2026" */
  label: string;
  isoYear: number;
  isoWeek: number;
  days: WeekPlanDay[];
  /** Hvor mange af de syv dage der har en ret. */
  plannedDays: number;
}
