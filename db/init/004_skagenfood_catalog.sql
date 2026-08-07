-- Skagenfood-kataloget.
--
-- En uge hos Skagenfood er 15 måltidskasser, som tilsammen rummer ca. 60
-- ret-slots og ca. 50 unikke opskrifter -- den samme opskrift kan ligge i op
-- til fire kasser. Derfor er opskriften og kasse-medlemskabet adskilt:
--
--   skagenfood_recipes      selve opskriften, nøglet på Skagenfoods eget id
--   skagenfood_weeks        en uge (år + ugenummer)
--   skagenfood_boxes        en måltidskasse i den uge
--   skagenfood_box_recipes  hvilke retter kassen indeholder, i rækkefølge
--
-- Idempotens: skagenfood_recipes.recipe_id er Skagenfoods id og primærnøgle,
-- så den samme opskrift hentet to gange opdaterer sin række i stedet for at
-- lave en dublet.
--
-- CHECK-reglerne nedenfor er anden linje i forsvaret mod en halv opskrift:
-- selv hvis en fremtidig kaldsvej glemmer at validere, afviser databasen en
-- opskrift uden navn, uden ingredienser, uden trin eller uden portionsantal.

CREATE TABLE IF NOT EXISTS skagenfood_recipes (
  recipe_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  url_name TEXT,
  url TEXT,
  image_url TEXT,
  total_minutes INTEGER,
  -- Hvilke portionsantal opskriften har mængder for, fx {1,2,3,4,5}.
  portion_options SMALLINT[] NOT NULL DEFAULT '{}',
  -- [{ name, section, mainIngredient, allergenic, imageUrl,
  --    amounts: [{ portions, amount, unitKey, line }] }]
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- "Du skal selv have:" / "Basisvarer (medfølger ikke):"
  pantry_items TEXT[] NOT NULL DEFAULT '{}',
  -- "Redskaber:"
  equipment TEXT[] NOT NULL DEFAULT '{}',
  -- [{ minute, title, text, html, ingredients: [navn] }] -- de tidsstemplede trin
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  energy JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- 'search' (gateway-API) eller 'ssr' (opskriftssiden) -- hvor den kom fra.
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skagenfood_recipes_name_not_blank
    CHECK (btrim(name) <> ''),
  CONSTRAINT skagenfood_recipes_has_ingredients
    CHECK (jsonb_typeof(ingredients) = 'array' AND jsonb_array_length(ingredients) > 0),
  CONSTRAINT skagenfood_recipes_has_steps
    CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) > 0),
  CONSTRAINT skagenfood_recipes_has_portions
    CHECK (COALESCE(array_length(portion_options, 1), 0) > 0),
  CONSTRAINT skagenfood_recipes_source
    CHECK (source IN ('search', 'ssr'))
);

CREATE INDEX IF NOT EXISTS idx_skagenfood_recipes_name
  ON skagenfood_recipes (name ASC, recipe_id ASC);

CREATE TABLE IF NOT EXISTS skagenfood_weeks (
  id BIGSERIAL PRIMARY KEY,
  year SMALLINT NOT NULL,
  week_number SMALLINT NOT NULL,
  display_name TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, week_number),
  CONSTRAINT skagenfood_weeks_week_number_range
    CHECK (week_number BETWEEN 1 AND 53)
);

CREATE TABLE IF NOT EXISTS skagenfood_boxes (
  id BIGSERIAL PRIMARY KEY,
  week_id BIGINT NOT NULL REFERENCES skagenfood_weeks(id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  -- Udlæst af kassens navn ("3 dage/2 pers."); NULL når navnet ikke siger det.
  portions SMALLINT,
  days SMALLINT,
  image_url TEXT,
  teaser TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_skagenfood_boxes_week_id
  ON skagenfood_boxes (week_id, sort_order, package_id);

CREATE TABLE IF NOT EXISTS skagenfood_box_recipes (
  id BIGSERIAL PRIMARY KEY,
  box_id BIGINT NOT NULL REFERENCES skagenfood_boxes(id) ON DELETE CASCADE,
  recipe_id BIGINT NOT NULL REFERENCES skagenfood_recipes(recipe_id) ON DELETE CASCADE,
  position SMALLINT NOT NULL,
  -- "Dag 1", "Dag 2", ... som Skagenfood selv skriver det.
  day_name TEXT,
  -- Kassens egen overskrift for dagen, fx "Mørksejfilet uden skind".
  box_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (box_id, position),
  CONSTRAINT skagenfood_box_recipes_position_range
    CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS idx_skagenfood_box_recipes_recipe_id
  ON skagenfood_box_recipes (recipe_id);
