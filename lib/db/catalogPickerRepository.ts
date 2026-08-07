import { PoolClient } from "pg";
import { primaryMainIngredient } from "@/lib/catalog/picker";
import type { PickerRecipe } from "@/lib/catalog/types";

/**
 * Læsninger til vælgeren. Kun SELECT -- der er ikke én skrivning i denne fil,
 * og der skal ikke komme nogen: vælgeren viser kataloget, den ændrer det ikke.
 * Det er importøren i lib/services/skagenfoodCatalogService.ts der skriver.
 *
 * Kortet hentes uden trin, mængder, skab og redskaber. Det er bevidst: de
 * felter fylder mest i tabellen, og de skal først bruges når retten skal
 * laves -- ikke når man bladrer i 50 af dem på en telefon.
 */

interface PickerRow {
  recipe_id: string | number;
  name: string;
  image_url: string | null;
  url: string | null;
  total_minutes: number | null;
  portion_options: number[] | null;
  ingredient_count: string | number;
  ingredient_names: string[] | null;
  main_ingredients: string[] | null;
  recipe_types: string[] | null;
}

function mapPickerRow(row: PickerRow): PickerRecipe {
  const mainIngredients = (row.main_ingredients ?? []).filter(Boolean);

  return {
    recipeId: Number(row.recipe_id),
    name: row.name,
    imageUrl: row.image_url,
    url: row.url,
    totalMinutes: row.total_minutes === null ? null : Number(row.total_minutes),
    mainIngredient: primaryMainIngredient(mainIngredients),
    mainIngredients,
    recipeTypes: (row.recipe_types ?? []).filter(Boolean),
    ingredientCount: Number(row.ingredient_count),
    ingredientNames: (row.ingredient_names ?? []).filter(Boolean),
    portionOptions: (row.portion_options ?? []).map(Number),
  };
}

/**
 * Felterne kortet har brug for.
 *
 * Etiketterne ligger i tags-kolonnen som [{ group, values: [...] }], så
 * "hovedingrediens" og "opskriftstype" skal pakkes ud hver for sig.
 * COALESCE overalt: en opskrift uden etiketter skal give et tomt array,
 * ikke NULL -- ellers ville kortet mangle frem for at være tomt.
 */
const PICKER_COLUMNS = `
  r.recipe_id,
  r.name,
  r.image_url,
  r.url,
  r.total_minutes,
  r.portion_options,
  jsonb_array_length(r.ingredients) AS ingredient_count,
  COALESCE(
    (
      SELECT array_agg(i->>'name')
      FROM jsonb_array_elements(r.ingredients) i
      WHERE COALESCE(i->>'name', '') <> ''
    ),
    '{}'
  ) AS ingredient_names,
  COALESCE(
    (
      SELECT array_agg(v)
      FROM jsonb_array_elements(r.tags) t,
           jsonb_array_elements_text(t->'values') v
      WHERE t->>'group' = 'hovedingrediens'
    ),
    '{}'
  ) AS main_ingredients,
  COALESCE(
    (
      SELECT array_agg(v)
      FROM jsonb_array_elements(r.tags) t,
           jsonb_array_elements_text(t->'values') v
      WHERE t->>'group' = 'opskriftstype'
    ),
    '{}'
  ) AS recipe_types
`;

export interface CatalogWeekRow {
  id: number;
  displayName: string;
}

/** Skagenfood-ugen, eller null hvis den uge aldrig er hentet ned. */
export async function findCatalogWeek(
  client: PoolClient,
  year: number,
  week: number,
): Promise<CatalogWeekRow | null> {
  const result = await client.query<{
    id: string | number;
    display_name: string;
  }>(
    `
      SELECT id, display_name
      FROM skagenfood_weeks
      WHERE year = $1 AND week_number = $2
    `,
    [year, week],
  );
  const row = result.rows[0];
  return row ? { id: Number(row.id), displayName: row.display_name } : null;
}

/**
 * Ugens opskrifter, én gang hver.
 *
 * Den samme opskrift ligger i op til fire af ugens 15 kasser, så uden
 * DISTINCT ville uge 32 give 59 rækker for 50 retter. IN-undersøgningen
 * dedupérer på recipe_id, hvilket er nøglen -- ikke på navnet.
 */
export async function readWeekRecipes(
  client: PoolClient,
  weekId: number,
): Promise<PickerRecipe[]> {
  const result = await client.query<PickerRow>(
    `
      SELECT ${PICKER_COLUMNS}
      FROM skagenfood_recipes r
      WHERE r.recipe_id IN (
        SELECT br.recipe_id
        FROM skagenfood_box_recipes br
        INNER JOIN skagenfood_boxes b ON b.id = br.box_id
        WHERE b.week_id = $1
      )
      ORDER BY r.name ASC, r.recipe_id ASC
    `,
    [weekId],
  );
  return result.rows.map(mapPickerRow);
}

/** Hele kataloget -- alle uger der er hentet ned, én gang hver opskrift. */
export async function readAllRecipes(
  client: PoolClient,
): Promise<PickerRecipe[]> {
  const result = await client.query<PickerRow>(
    `
      SELECT ${PICKER_COLUMNS}
      FROM skagenfood_recipes r
      ORDER BY r.name ASC, r.recipe_id ASC
    `,
  );
  return result.rows.map(mapPickerRow);
}
