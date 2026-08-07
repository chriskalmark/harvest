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
