-- Afkrydsninger på ugens indkøbsliste.
--
-- Selve listen gemmes IKKE. Den regnes ud af de retter der ligger på ugen,
-- hver gang den læses. Det er derfor der ikke findes en tabel med varer:
-- en vare til en ret man har fjernet, ville aldrig kunne blive hængende.
--
-- Kun det der ikke kan udledes, står her -- hvad man allerede har lagt i
-- kurven. Nøglen er varens navn og enhed, den samme nøgle listen bygger,
-- så afkrydsningen overlever at listen regnes forfra.
--
-- Tilstedeværelse ER afkrydsningen. At fjerne fluebenet sletter rækken.
-- Der er derfor ingen boolean to skærme kan skrive oven i hinanden.
--
-- Denne migration er ADDITIV. Hverken meals, meal_plans, meal_plan_meals,
-- week_plans eller week_plan_days røres. Ingen DROP, TRUNCATE eller ALTER.

CREATE TABLE IF NOT EXISTS week_plan_shopping_checks (
  id BIGSERIAL PRIMARY KEY,
  week_plan_id BIGINT NOT NULL REFERENCES week_plans(id) ON DELETE CASCADE,
  -- "<normaliseret navn>::<enhed>", fx "små kartofler::g".
  item_key TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Samme vare kan ikke krydses af to gange. Gør sætningen idempotent,
  -- så to hurtige tryk fra samme telefon ikke bliver til to rækker.
  UNIQUE (week_plan_id, item_key),
  CONSTRAINT week_plan_shopping_checks_key_not_blank
    CHECK (btrim(item_key) <> '')
);

CREATE INDEX IF NOT EXISTS idx_week_plan_shopping_checks_plan
  ON week_plan_shopping_checks (week_plan_id);
