CREATE TABLE IF NOT EXISTS meal_plans (
  id BIGSERIAL PRIMARY KEY,
  week_range TEXT NOT NULL UNIQUE,
  week_start_date DATE,
  plan_data JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed_json',
  status TEXT NOT NULL DEFAULT 'active',
  generation_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_week_start_date
  ON meal_plans (week_start_date);

CREATE TABLE IF NOT EXISTS meals (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  protein TEXT[] NOT NULL DEFAULT '{}',
  base TEXT[] NOT NULL DEFAULT '{}',
  veg TEXT[] NOT NULL DEFAULT '{}',
  engine TEXT[] NOT NULL DEFAULT '{}',
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  calories INTEGER NOT NULL,
  protein_grams INTEGER NOT NULL,
  carbs_grams INTEGER NOT NULL,
  fat_grams INTEGER NOT NULL,
  fiber_grams INTEGER NOT NULL DEFAULT 0,
  heart_count INTEGER NOT NULL DEFAULT 0,
  appearance_count INTEGER NOT NULL DEFAULT 0,
  last_served_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_meal_type
  ON meals (meal_type);

CREATE INDEX IF NOT EXISTS idx_meals_protein_grams
  ON meals (protein_grams);

CREATE INDEX IF NOT EXISTS idx_meals_last_served_at
  ON meals (last_served_at DESC NULLS LAST, id ASC);

CREATE INDEX IF NOT EXISTS idx_meals_heart_count
  ON meals (heart_count DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_meals_appearance_count
  ON meals (appearance_count DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_meals_name
  ON meals (name ASC, id ASC);

-- A week is a flat, ordered list of meals (1 breakfast, 1 lunch, 2 dinners).
-- slot_order is the position within the week (0..3); there are no days.
CREATE TABLE IF NOT EXISTS meal_plan_meals (
  id BIGSERIAL PRIMARY KEY,
  meal_plan_id BIGINT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  slot_order INTEGER NOT NULL,
  meal_id BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meal_plan_id, slot_order)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_meals_meal_plan_id
  ON meal_plan_meals (meal_plan_id, slot_order);

CREATE INDEX IF NOT EXISTS idx_meal_plan_meals_meal_id
  ON meal_plan_meals (meal_id);

CREATE TABLE IF NOT EXISTS meal_feedback (
  id BIGSERIAL PRIMARY KEY,
  meal_plan_id BIGINT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  meal_id BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  liked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meal_plan_id, meal_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_feedback_meal_id
  ON meal_feedback (meal_id);

CREATE INDEX IF NOT EXISTS idx_meal_feedback_meal_plan_id
  ON meal_feedback (meal_plan_id);

CREATE TABLE IF NOT EXISTS meal_ratings (
  id BIGSERIAL PRIMARY KEY,
  meal_plan_id BIGINT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  meal_name TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meal_plan_id, day, meal_name, meal_type)
);

-- Junk list: global hearting (favorites) across weeks
CREATE TABLE IF NOT EXISTS junk_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  heart_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS junk_feedback (
  id BIGSERIAL PRIMARY KEY,
  meal_plan_id BIGINT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  junk_item_id BIGINT NOT NULL REFERENCES junk_items(id) ON DELETE CASCADE,
  liked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meal_plan_id, junk_item_id)
);

CREATE INDEX IF NOT EXISTS idx_junk_feedback_item_id
  ON junk_feedback (junk_item_id);

CREATE INDEX IF NOT EXISTS idx_junk_feedback_meal_plan_id
  ON junk_feedback (meal_plan_id);
