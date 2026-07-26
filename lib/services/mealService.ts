import { pool, withTransaction } from "@/lib/db";
import * as mealRepository from "@/lib/db/mealRepository";
import { mapMeal, mealInputToRow } from "@/lib/domain/mealMappers";
import { MealIngredient, MealInput, MealRow, MealType, StoredMeal, UpdateMealInput } from "@/lib/types";
import { ApiError } from "@/lib/apiUtils";
import { requireNumber, requireString } from "@/lib/routeValidation";

function parseMealInput(value: unknown): MealInput {
  if (!value || typeof value !== "object") {
    throw new ApiError("Meal payload must be an object.", 400);
  }
  const obj = value as Record<string, unknown>;

  const name = requireString(obj.name, "name");
  const type = requireString(obj.type, "type") as MealType;

  const buildRaw = obj.build;
  if (!buildRaw || typeof buildRaw !== "object") {
    throw new ApiError("build is required.", 400);
  }
  const buildObj = buildRaw as Record<string, unknown>;

  const normalizeStringArray = (v: unknown, field: string) => {
    if (typeof v === "string") {
      const t = v.trim();
      if (!t) throw new ApiError(`${field} must be non-empty.`, 400);
      return [t];
    }
    if (Array.isArray(v)) {
      const arr = v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
      if (!arr.length) throw new ApiError(`${field} must be non-empty.`, 400);
      return arr;
    }
    throw new ApiError(`${field} must be a string or string[].`, 400);
  };

  const build = {
    pro: normalizeStringArray(buildObj.pro, "build.pro"),
    base: normalizeStringArray(buildObj.base, "build.base"),
    veg: normalizeStringArray(buildObj.veg, "build.veg"),
    engine: normalizeStringArray(buildObj.engine, "build.engine"),
  };

  const parseIngredients = (raw: unknown): MealIngredient[] | undefined => {
    if (raw === undefined) {
      return undefined;
    }

    if (!Array.isArray(raw)) {
      throw new ApiError("ingredients must be an array.", 400);
    }

    return raw.map((ingredient, index) => {
      if (!ingredient || typeof ingredient !== "object") {
        throw new ApiError(`ingredients[${index}] must be an object.`, 400);
      }

      const ingredientObj = ingredient as Record<string, unknown>;
      const macrosRaw = ingredientObj.macros;
      if (!macrosRaw || typeof macrosRaw !== "object") {
        throw new ApiError(`ingredients[${index}].macros is required.`, 400);
      }
      const macrosObj = macrosRaw as Record<string, unknown>;

      return {
        name: requireString(ingredientObj.name, `ingredients[${index}].name`),
        quantity: typeof ingredientObj.quantity === "string" ? ingredientObj.quantity.trim() : "",
        category: requireString(ingredientObj.category, `ingredients[${index}].category`) as MealIngredient["category"],
        macros: {
          cal: requireNumber(macrosObj.cal, `ingredients[${index}].macros.cal`),
          p: requireNumber(macrosObj.p, `ingredients[${index}].macros.p`),
          c: requireNumber(macrosObj.c, `ingredients[${index}].macros.c`),
          f: requireNumber(macrosObj.f, `ingredients[${index}].macros.f`),
          fiber: optionalNumber(macrosObj.fiber, 0),
        },
      };
    });
  };

  const macrosRaw = obj.macros;
  if (!macrosRaw || typeof macrosRaw !== "object") {
    throw new ApiError("macros is required.", 400);
  }
  const macrosObj = macrosRaw as Record<string, unknown>;

  return {
    name,
    type,
    build,
    ingredients: parseIngredients(obj.ingredients),
    macros: {
      cal: requireNumber(macrosObj.cal, "macros.cal"),
      p: requireNumber(macrosObj.p, "macros.p"),
      c: requireNumber(macrosObj.c, "macros.c"),
      f: requireNumber(macrosObj.f, "macros.f"),
      fiber: optionalNumber(macrosObj.fiber, 0),
    },
  };
}

function optionalNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export type MealSortField = "name" | "cal" | "p" | "heartCount" | "appearanceCount" | "lastServedAt";
export type MealSortDirection = "asc" | "desc";

export interface MealFilters {
  type?: MealType;
  minProtein?: number;
  search?: string;
  protein?: string;
  base?: string;
  veg?: string;
  engine?: string;
}

export async function listMeals(
  filters: MealFilters = {},
  sortBy: MealSortField = "lastServedAt",
  sortDirection: MealSortDirection = "desc",
  limit = 50,
  offset = 0
): Promise<{ meals: StoredMeal[]; total: number }> {
  const client = await pool.connect();
  try {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.type) {
      whereClauses.push(`meal_type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (typeof filters.minProtein === "number" && Number.isFinite(filters.minProtein)) {
      whereClauses.push(`protein_grams >= $${paramIndex++}`);
      params.push(filters.minProtein);
    }

    if (filters.search) {
      whereClauses.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filters.search}%`);
    }

    if (filters.protein) {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM unnest(protein) AS v WHERE v ILIKE $${paramIndex++})`
      );
      params.push(`%${filters.protein}%`);
    }

    if (filters.base) {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM unnest(base) AS v WHERE v ILIKE $${paramIndex++})`
      );
      params.push(`%${filters.base}%`);
    }

    if (filters.veg) {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM unnest(veg) AS v WHERE v ILIKE $${paramIndex++})`
      );
      params.push(`%${filters.veg}%`);
    }

    if (filters.engine) {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM unnest(engine) AS v WHERE v ILIKE $${paramIndex++})`
      );
      params.push(`%${filters.engine}%`);
    }

    const sortMap: Record<MealSortField, string> = {
      name: "name",
      cal: "calories",
      p: "protein_grams",
      heartCount: "heart_count",
      appearanceCount: "appearance_count",
      lastServedAt: "last_served_at",
    };

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderClause = `ORDER BY ${sortMap[sortBy]} ${
      sortDirection === "desc" ? "DESC NULLS LAST" : "ASC NULLS FIRST"
    }, id ASC`;

    const countResult = await client.query(`SELECT COUNT(*) FROM meals ${whereClause}`, params);
    const total = Number(countResult.rows[0].count);

    const result = await client.query<MealRow>(
      `SELECT * FROM meals ${whereClause} ${orderClause} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return {
      meals: result.rows.map((row) => mapMeal(row)),
      total,
    };
  } finally {
    client.release();
  }
}

export async function createMeal(input: unknown): Promise<{ mealId: number }> {
  const parsed = parseMealInput(input);
  return withTransaction(async (client) => {
    const inserted = await mealRepository.insertMeal(client, mealInputToRow(parsed));
    return { mealId: Number(inserted.id) };
  });
}

export async function updateMealById(mealId: number, input: unknown): Promise<void> {
  const parsed = parseMealInput(input);
  await withTransaction(async (client) => {
    const updated = await mealRepository.updateMeal(client, {
      id: mealId,
      ...mealInputToRow(parsed),
    });
    if (!updated) {
      throw new Error("Meal not found");
    }
  });
}

export async function updateMeal(input: UpdateMealInput): Promise<StoredMeal> {
  const client = await pool.connect();

  try {
    const row = await mealRepository.updateMeal(client, {
      id: input.id,
      ...mealInputToRow(input),
    });

    if (!row) {
      throw new Error("Meal not found.");
    }

    return mapMeal(row);
  } finally {
    client.release();
  }
}

export async function insertMeal(input: Omit<UpdateMealInput, "id">): Promise<StoredMeal> {
  const client = await pool.connect();

  try {
    const row = await mealRepository.insertMealReturningRow(client, mealInputToRow(input));
    return mapMeal(row);
  } finally {
    client.release();
  }
}

