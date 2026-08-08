import type { PoolClient } from "pg";
import type { KatalogIngrediens, KatalogMængde } from "@/lib/weekPlan/indkoeb";

/**
 * Det indkøbslisten skal bruge fra basen, og ikke en tøddel mere.
 *
 * Ugens dage ligger allerede i weekPlanRepository, men de bærer kun
 * opskriftens navn og billede. Ingredienserne bliver hentet her, for ét
 * opslag med alle ugens opskrifter på én gang -- ikke syv opslag.
 */

export interface OpskriftIndhold {
  recipeId: number;
  name: string;
  ingredients: KatalogIngrediens[];
  pantryItems: string[];
}

interface IngrediensRække {
  name?: unknown;
  amounts?: unknown;
}

interface MængdeRække {
  portions?: unknown;
  amount?: unknown;
  unitKey?: unknown;
}

/**
 * JSONB kommer ind som ukendt. Alt der ikke har form som en mængde, bliver
 * kasseret her frem for at give NaN længere fremme.
 */
function læsMængder(rå: unknown): KatalogMængde[] {
  if (!Array.isArray(rå)) return [];

  const mængder: KatalogMængde[] = [];
  for (const post of rå as MængdeRække[]) {
    const portions = Number(post?.portions);
    const amount = Number(post?.amount);
    if (!Number.isFinite(portions) || portions <= 0) continue;
    if (!Number.isFinite(amount)) continue;
    mængder.push({
      portions,
      amount,
      unitKey: typeof post.unitKey === "string" ? post.unitKey : null,
    });
  }
  return mængder;
}

function læsIngredienser(rå: unknown): KatalogIngrediens[] {
  if (!Array.isArray(rå)) return [];

  const ingredienser: KatalogIngrediens[] = [];
  for (const post of rå as IngrediensRække[]) {
    const name = typeof post?.name === "string" ? post.name.trim() : "";
    if (!name) continue;
    ingredienser.push({ name, amounts: læsMængder(post.amounts) });
  }
  return ingredienser;
}

/** Ugens opskrifter i ét opslag. Ukendte id'er springes bare over. */
export async function readRecipeContents(
  client: PoolClient,
  recipeIds: readonly number[],
): Promise<Map<number, OpskriftIndhold>> {
  const unikke = Array.from(new Set(recipeIds)).filter((id) =>
    Number.isSafeInteger(id),
  );
  if (unikke.length === 0) return new Map();

  const result = await client.query(
    `SELECT recipe_id, name, ingredients, pantry_items
       FROM skagenfood_recipes
      WHERE recipe_id = ANY($1::bigint[])`,
    [unikke],
  );

  const kort = new Map<number, OpskriftIndhold>();
  for (const row of result.rows) {
    kort.set(Number(row.recipe_id), {
      recipeId: Number(row.recipe_id),
      name: String(row.name),
      ingredients: læsIngredienser(row.ingredients),
      pantryItems: Array.isArray(row.pantry_items)
        ? row.pantry_items.filter(
            (post: unknown): post is string =>
              typeof post === "string" && post.trim() !== "",
          )
        : [],
    });
  }
  return kort;
}

/** Nøglerne på de varer der allerede er lagt i kurven. */
export async function readCheckedKeys(
  client: PoolClient,
  weekPlanId: number,
): Promise<Set<string>> {
  const result = await client.query(
    `SELECT item_key FROM week_plan_shopping_checks WHERE week_plan_id = $1`,
    [weekPlanId],
  );
  return new Set(result.rows.map((row) => String(row.item_key)));
}

/**
 * Sætter eller fjerner flueben.
 *
 * ON CONFLICT DO NOTHING gør sætningen idempotent: to hurtige tryk på den
 * samme vare giver ét flueben, ikke en fejl.
 */
export async function setChecked(
  client: PoolClient,
  weekPlanId: number,
  itemKeys: readonly string[],
  checked: boolean,
): Promise<void> {
  const nøgler = Array.from(
    new Set(itemKeys.map((key) => key.trim()).filter(Boolean)),
  );
  if (nøgler.length === 0) return;

  if (checked) {
    await client.query(
      `INSERT INTO week_plan_shopping_checks (week_plan_id, item_key)
       SELECT $1, unnest($2::text[])
       ON CONFLICT (week_plan_id, item_key) DO NOTHING`,
      [weekPlanId, nøgler],
    );
    return;
  }

  await client.query(
    `DELETE FROM week_plan_shopping_checks
      WHERE week_plan_id = $1 AND item_key = ANY($2::text[])`,
    [weekPlanId, nøgler],
  );
}

/** Fjerner alle flueben på ugen. Til "start forfra". */
export async function clearAllChecks(
  client: PoolClient,
  weekPlanId: number,
): Promise<void> {
  await client.query(
    `DELETE FROM week_plan_shopping_checks WHERE week_plan_id = $1`,
    [weekPlanId],
  );
}
