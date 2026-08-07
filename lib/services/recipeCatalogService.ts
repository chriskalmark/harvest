import { pool } from "@/lib/db";
import * as skagenfoodRepository from "@/lib/db/skagenfoodRepository";
import { toRecipeCard } from "@/lib/recipe/view";
import type { RecipeCard } from "@/lib/recipe/types";
import type { CatalogRecipe } from "@/lib/skagenfood/types";

/**
 * Laesesiden af Skagenfood-kataloget.
 *
 * Henteren (skagenfoodCatalogService.ts) skriver. Det her laeser -- og skriver
 * aldrig. Opskriftsvisningen maa ikke kunne aendre kataloget ved et uheld.
 */

/** Én hel opskrift. Null naar id'et ikke findes i kataloget. */
export async function getCatalogRecipe(
  recipeId: number,
): Promise<CatalogRecipe | null> {
  if (!Number.isInteger(recipeId) || recipeId <= 0) return null;
  const client = await pool.connect();
  try {
    return await skagenfoodRepository.readSkagenfoodRecipe(client, recipeId);
  } finally {
    client.release();
  }
}

/** Hele kataloget som kort, sorteret efter navn. */
export async function listCatalogRecipeCards(): Promise<RecipeCard[]> {
  const client = await pool.connect();
  try {
    const recipes = await skagenfoodRepository.listSkagenfoodRecipes(client);
    return recipes.map(toRecipeCard);
  } finally {
    client.release();
  }
}
