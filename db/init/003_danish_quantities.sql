ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS servings INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Trader Joe's-demodataet kan ikke konverteres: mængderne har aldrig
-- eksisteret som tal, og produktnavnene findes ikke i Netto.
DELETE FROM meal_plans;
DELETE FROM meals;
DELETE FROM junk_items;
