/**
 * Vælgerens typer: det katalogkortet skal vide for at kunne vises og søges i.
 *
 * Dette er bevidst IKKE hele opskriften. En uge er ~50 retter, og de skal alle
 * over tråden på én gang, så telefonen kan filtrere uden at spørge serveren
 * igen. Derfor kun det der står på kortet, plus det der skal kunne søges på.
 * Trin, mængder og redskaber hentes først når retten skal laves.
 */

export interface PickerRecipe {
  recipeId: number;
  name: string;
  imageUrl: string | null;
  url: string | null;
  totalMinutes: number | null;
  /**
   * Skagenfoods egen hovedingrediens-etiket, fx "Fisk" eller "Fjerkræ".
   * En ret kan have flere; mainIngredient er den ene vi sorterer den under.
   */
  mainIngredient: string | null;
  mainIngredients: string[];
  /** "Hurtige kødretter", "Salater" osv. Vises ikke, men kan søges på. */
  recipeTypes: string[];
  /** Antal ingredienser i selve opskriften -- uden skab og redskaber. */
  ingredientCount: number;
  ingredientNames: string[];
  /** De portionsantal opskriften HAR mængder for, fx [2,3,4]. */
  portionOptions: number[];
}

/** "uge" = kun ugens kasser. "alle" = hele kataloget. */
export type PickerScope = "uge" | "alle";

export interface PickerCatalog {
  /** Det omfang svaret faktisk har -- ikke nødvendigvis det der blev bedt om. */
  scope: PickerScope;
  /** Mandagen der blev spurgt om, YYYY-MM-DD. */
  weekStart: string;
  isoYear: number;
  isoWeek: number;
  /** Skagenfoods egen ugetekst, fx "Uge 32 - sø 2/8 - lø 8/8". */
  weekDisplayName: string | null;
  /** Falsk når ugen ikke er hentet ned endnu. Så er recipes hele kataloget. */
  weekInCatalog: boolean;
  /**
   * Dansk forklaring, når svaret ikke er det der blev bedt om. Vises som den
   * er. Null når intet skal forklares.
   */
  notice: string | null;
  recipes: PickerRecipe[];
}
