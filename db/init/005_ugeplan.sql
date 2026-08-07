-- Ugeplanlæggeren.
--
-- Den planlagte uge er mandag til søndag og kun aftensmad. Ingen morgenmad,
-- ingen frokost, ingen snacks -- det er en beslutning, ikke en mangel, og
-- derfor har tabellen ingen kolonne til måltidstype.
--
--   week_plans       én planlagt uge, nøglet på mandagens dato
--   week_plan_days   præcis syv dagspladser i den uge
--
-- Denne migration er ADDITIV. Den rører ikke meals, meal_plans eller
-- meal_plan_meals -- de bærer den uge der ligger på mad.lmar.io lige nu, og
-- den skal overleve. Der er hverken DROP, TRUNCATE, DELETE eller ALTER her.
--
-- En dagsplads kan være tre ting, og slot_kind siger hvilken:
--
--   'empty'    ingen ret endnu
--   'catalog'  en opskrift fra Skagenfood-kataloget
--   'manual'   en ret man selv har skrevet -- et navn er nok ("Lasagne")
--
-- CHECK-reglen week_plan_days_shape er databasens eget forsvar mod en
-- halv dagsplads: en katalogdag UDEN opskrift, eller en manuel dag uden navn,
-- bliver afvist, også hvis en fremtidig kaldsvej glemmer at validere.

CREATE TABLE IF NOT EXISTS week_plans (
  id BIGSERIAL PRIMARY KEY,
  -- Mandagens dato identificerer ugen. Én række per uge.
  monday_date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ISODOW: 1 = mandag. En uge der begynder en onsdag findes ikke.
  CONSTRAINT week_plans_starts_on_monday
    CHECK (EXTRACT(ISODOW FROM monday_date) = 1)
);

CREATE TABLE IF NOT EXISTS week_plan_days (
  id BIGSERIAL PRIMARY KEY,
  week_plan_id BIGINT NOT NULL REFERENCES week_plans(id) ON DELETE CASCADE,
  -- 1 = mandag ... 7 = søndag, samme tælling som ISODOW.
  weekday SMALLINT NOT NULL,
  slot_kind TEXT NOT NULL DEFAULT 'empty',
  -- ON DELETE RESTRICT, ikke SET NULL: forsvinder en opskrift fra kataloget,
  -- skal det fejle højlydt frem for stille at tømme en planlagt dag.
  skagenfood_recipe_id BIGINT
    REFERENCES skagenfood_recipes(recipe_id) ON DELETE RESTRICT,
  -- Den selvskrevne ret. Kun et navn er nok.
  manual_title TEXT,
  note TEXT,
  -- Portionsantal per dag. Standard 2 -- husstanden er to personer.
  portions SMALLINT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Præcis syv pladser: UNIQUE spærrer for den ottende mandag,
  -- og CHECK spærrer for dag 0 og dag 8.
  UNIQUE (week_plan_id, weekday),
  CONSTRAINT week_plan_days_weekday_range
    CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT week_plan_days_portions_range
    CHECK (portions BETWEEN 1 AND 12),
  CONSTRAINT week_plan_days_kind
    CHECK (slot_kind IN ('empty', 'catalog', 'manual')),
  CONSTRAINT week_plan_days_shape
    CHECK (
      (
        slot_kind = 'empty'
        AND skagenfood_recipe_id IS NULL
        AND manual_title IS NULL
      )
      OR (
        slot_kind = 'catalog'
        AND skagenfood_recipe_id IS NOT NULL
        AND manual_title IS NULL
      )
      OR (
        slot_kind = 'manual'
        AND skagenfood_recipe_id IS NULL
        AND manual_title IS NOT NULL
        AND btrim(manual_title) <> ''
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_week_plan_days_week_plan_id
  ON week_plan_days (week_plan_id, weekday);

-- "Hvornår har vi sidst spist den her ret?" -- opslaget går den anden vej.
CREATE INDEX IF NOT EXISTS idx_week_plan_days_recipe_id
  ON week_plan_days (skagenfood_recipe_id)
  WHERE skagenfood_recipe_id IS NOT NULL;
