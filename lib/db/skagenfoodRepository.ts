import { PoolClient } from "pg";
import type { CatalogBox, CatalogRecipe } from "@/lib/skagenfood/types";

/**
 * Rene databaseoperationer for Skagenfood-kataloget.
 * Ingen forretningslogik, ingen netværk, ingen validering — kun SQL.
 */

export async function upsertSkagenfoodRecipe(
  client: PoolClient,
  recipe: CatalogRecipe,
): Promise<void> {
  await client.query(
    `
      INSERT INTO skagenfood_recipes (
        recipe_id,
        name,
        url_name,
        url,
        image_url,
        total_minutes,
        portion_options,
        ingredients,
        pantry_items,
        equipment,
        steps,
        tags,
        energy,
        source,
        fetched_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::smallint[], $8::jsonb, $9::text[], $10::text[], $11::jsonb, $12::jsonb, $13::jsonb, $14, NOW())
      ON CONFLICT (recipe_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        url_name = EXCLUDED.url_name,
        url = EXCLUDED.url,
        image_url = EXCLUDED.image_url,
        total_minutes = EXCLUDED.total_minutes,
        portion_options = EXCLUDED.portion_options,
        ingredients = EXCLUDED.ingredients,
        pantry_items = EXCLUDED.pantry_items,
        equipment = EXCLUDED.equipment,
        steps = EXCLUDED.steps,
        tags = EXCLUDED.tags,
        energy = EXCLUDED.energy,
        source = EXCLUDED.source,
        fetched_at = EXCLUDED.fetched_at,
        updated_at = NOW()
    `,
    [
      recipe.recipeId,
      recipe.name,
      recipe.urlName,
      recipe.url,
      recipe.imageUrl,
      recipe.totalMinutes,
      recipe.portionOptions,
      JSON.stringify(recipe.ingredients),
      recipe.pantryItems,
      recipe.equipment,
      JSON.stringify(recipe.steps),
      JSON.stringify(recipe.tags),
      JSON.stringify(recipe.energy),
      recipe.source,
    ],
  );
}

export async function upsertSkagenfoodWeek(
  client: PoolClient,
  input: { year: number; week: number; displayName: string },
): Promise<number> {
  const result = await client.query<{ id: number | string }>(
    `
      INSERT INTO skagenfood_weeks (year, week_number, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (year, week_number)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        imported_at = NOW()
      RETURNING id
    `,
    [input.year, input.week, input.displayName],
  );
  if (!result.rows[0]) {
    throw new Error("Kunne ikke gemme ugen i Skagenfood-kataloget.");
  }
  return Number(result.rows[0].id);
}

export async function upsertSkagenfoodBox(
  client: PoolClient,
  weekId: number,
  box: CatalogBox,
): Promise<number> {
  const result = await client.query<{ id: number | string }>(
    `
      INSERT INTO skagenfood_boxes (
        week_id,
        package_id,
        sku,
        name,
        portions,
        days,
        image_url,
        teaser,
        sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (week_id, package_id)
      DO UPDATE SET
        sku = EXCLUDED.sku,
        name = EXCLUDED.name,
        portions = EXCLUDED.portions,
        days = EXCLUDED.days,
        image_url = EXCLUDED.image_url,
        teaser = EXCLUDED.teaser,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      RETURNING id
    `,
    [
      weekId,
      box.packageId,
      box.sku,
      box.name,
      box.portions,
      box.days,
      box.imageUrl,
      box.teaser,
      box.sortOrder,
    ],
  );
  if (!result.rows[0]) {
    throw new Error(`Kunne ikke gemme måltidskassen ${box.packageId}.`);
  }
  return Number(result.rows[0].id);
}

/**
 * Kassens retter skrives forfra hver gang. En kasse der skrumper fra fem til
 * tre dage må ikke efterlade to spøgelsesretter på plads 3 og 4.
 */
export async function replaceSkagenfoodBoxRecipes(
  client: PoolClient,
  boxId: number,
  slots: Array<{
    position: number;
    recipeId: number;
    dayName: string | null;
    boxTitle: string | null;
  }>,
): Promise<void> {
  await client.query(`DELETE FROM skagenfood_box_recipes WHERE box_id = $1`, [
    boxId,
  ]);

  for (const slot of slots) {
    await client.query(
      `
        INSERT INTO skagenfood_box_recipes (
          box_id,
          recipe_id,
          position,
          day_name,
          box_title
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [boxId, slot.recipeId, slot.position, slot.dayName, slot.boxTitle],
    );
  }
}

/** Kasser der ikke længere findes i ugen fjernes, så ugen matcher Skagenfood. */
export async function deleteSkagenfoodBoxesNotIn(
  client: PoolClient,
  weekId: number,
  packageIds: number[],
): Promise<number> {
  const result = await client.query(
    `
      DELETE FROM skagenfood_boxes
      WHERE week_id = $1
        AND NOT (package_id = ANY($2::bigint[]))
    `,
    [weekId, packageIds],
  );
  return result.rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Læsning
// ---------------------------------------------------------------------------

interface RecipeRow {
  recipe_id: string | number;
  name: string;
  url_name: string | null;
  url: string | null;
  image_url: string | null;
  total_minutes: number | null;
  portion_options: number[] | null;
  ingredients: CatalogRecipe["ingredients"] | null;
  pantry_items: string[] | null;
  equipment: string[] | null;
  steps: CatalogRecipe["steps"] | null;
  tags: CatalogRecipe["tags"] | null;
  energy: CatalogRecipe["energy"] | null;
  source: string;
}

/**
 * bigint kommer hjem som streng fra pg, og jsonb kommer hjem som objekt.
 * Kortlægningen her er det ene sted der ved det.
 */
function mapRecipeRow(row: RecipeRow): CatalogRecipe {
  return {
    recipeId: Number(row.recipe_id),
    name: row.name,
    urlName: row.url_name,
    url: row.url,
    imageUrl: row.image_url,
    totalMinutes: row.total_minutes === null ? null : Number(row.total_minutes),
    portionOptions: (row.portion_options ?? []).map(Number),
    ingredients: row.ingredients ?? [],
    pantryItems: row.pantry_items ?? [],
    equipment: row.equipment ?? [],
    steps: row.steps ?? [],
    tags: row.tags ?? [],
    energy: row.energy ?? [],
    source: row.source === "ssr" ? "ssr" : "search",
  };
}

const RECIPE_COLUMNS = `
  recipe_id,
  name,
  url_name,
  url,
  image_url,
  total_minutes,
  portion_options,
  ingredients,
  pantry_items,
  equipment,
  steps,
  tags,
  energy,
  source
`;

/** Én hel opskrift, eller null hvis id'et ikke findes i kataloget. */
export async function readSkagenfoodRecipe(
  client: PoolClient,
  recipeId: number,
): Promise<CatalogRecipe | null> {
  const result = await client.query<RecipeRow>(
    `SELECT ${RECIPE_COLUMNS} FROM skagenfood_recipes WHERE recipe_id = $1`,
    [recipeId],
  );
  const row = result.rows[0];
  return row ? mapRecipeRow(row) : null;
}

/**
 * Hele kataloget, sorteret efter navn.
 *
 * Kataloget er 93 opskrifter og vokser med ca. 50 om ugen der importeres, så
 * hele listen kan hentes i ét kald. Bliver det en dag til tusinder, er det her
 * sideinddelingen skal ind — ikke i skærmen.
 */
export async function listSkagenfoodRecipes(
  client: PoolClient,
): Promise<CatalogRecipe[]> {
  const result = await client.query<RecipeRow>(
    `SELECT ${RECIPE_COLUMNS} FROM skagenfood_recipes ORDER BY name ASC, recipe_id ASC`,
  );
  return result.rows.map(mapRecipeRow);
}

export async function countSkagenfoodRecipes(
  client: PoolClient,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM skagenfood_recipes`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function countSkagenfoodBoxRecipesForWeek(
  client: PoolClient,
  weekId: number,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM skagenfood_box_recipes sbr
      INNER JOIN skagenfood_boxes sb ON sb.id = sbr.box_id
      WHERE sb.week_id = $1
    `,
    [weekId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
