import type { CatalogRecipe } from "@/lib/skagenfood/types";

/**
 * Opskriftsvisningens egne typer.
 *
 * CatalogRecipe (lib/skagenfood/types.ts) er hele opskriften, som den ligger i
 * kataloget. Typerne herinde er det skaermen faktisk skal bruge: et kort til
 * oversigten, og de lister view.ts har regnet faerdige for ét portionsantal.
 */

/** Én opskrift i oversigten. Nok til et kort -- ikke hele opskriften. */
export interface RecipeCard {
  recipeId: number;
  name: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  portionOptions: number[];
  /** Fx "Vegetarretter" fra tag-gruppen opskriftstype. Null når den mangler. */
  kind: string | null;
  /** Fx "Grøntsager" fra tag-gruppen hovedingrediens. */
  mainIngredient: string | null;
  stepCount: number;
  ingredientCount: number;
}

/** Én ingrediens, klar til skærmen for ét bestemt portionsantal. */
export interface RecipeIngredientLine {
  name: string;
  /**
   * Skagenfoods egen danske linje for det valgte portionsantal, fx
   * "400 g små kartofler". Null når opskriften ikke har en mængde for
   * netop det antal -- så viser skærmen navnet alene i stedet for at
   * finde på et tal.
   */
  line: string | null;
  allergenic: boolean;
  mainIngredient: boolean;
}

/** Ingredienserne under én overskrift. title = null er hovedlisten. */
export interface RecipeIngredientSection {
  title: string | null;
  items: RecipeIngredientLine[];
}

/** Ét trin, klar til skærmen: tidsstempel, afsnit og mængder for netop det trin. */
export interface RecipeStepView {
  /** 1-baseret trinnummer, som det vises. */
  number: number;
  /** "0 min", "10 min" -- eller null når Skagenfood ikke har tidsstemplet trinnet. */
  timeLabel: string | null;
  title: string;
  paragraphs: string[];
  /** Trinnets egne ingredienser med mængde for det valgte portionsantal. */
  ingredients: string[];
}

/** Hele opskriften regnet færdig for ét portionsantal. */
export interface RecipeView {
  recipe: CatalogRecipe;
  portions: number;
  timeLabel: string | null;
  kind: string | null;
  mainIngredient: string | null;
  author: string | null;
  sections: RecipeIngredientSection[];
  steps: RecipeStepView[];
  pantryItems: string[];
  equipment: string[];
  /** kcal og protein pr. portion, til den diskrete talrække. */
  headlineNutrition: Array<{ label: string; value: string }>;
  nutrition: Array<{ label: string; value: string }>;
  sourceUrl: string | null;
}
