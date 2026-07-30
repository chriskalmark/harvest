import type { MealType } from "@/lib/types";

/**
 * Vises naar der ikke er lagt en madplan for indevaerende uge. En venlig
 * linje er bedre end et tomt kort — den fortaeller at widgetten virker.
 */
export const NO_MEAL_PLAN_ITEM = "Ingen madplan for denne uge endnu";

export interface WidgetMeal {
  type: MealType;
  name: string;
  slotOrder: number;
}

/**
 * Ugens retter som en flad liste i slot-raekkefoelge.
 *
 * Madplanen har ingen datoer: slot_order er positionen i ugen, ikke en dag
 * (se db/init/001_init.sql). Widgetten opfinder derfor ikke dage — den viser
 * ugens retter i den raekkefoelge, de staar paa menuen.
 *
 * Kun aftensmad. Morgenmad og frokost er én fast ret hver, som gaelder hele
 * ugen; aftensmaden er de fire retter, der rent faktisk skifter. I en flad
 * liste uden maaltidstype kunne man ikke se forskel paa dem, og et
 * typepraefiks ville fylde linjen op paa en koekkentablet.
 */
export function buildWidgetItems(meals: WidgetMeal[]): string[] {
  const dinners = meals
    .filter((meal) => meal.type === "Dinner")
    .sort((a, b) => a.slotOrder - b.slotOrder)
    .map((meal) => meal.name);

  return dinners.length > 0 ? dinners : [NO_MEAL_PLAN_ITEM];
}
