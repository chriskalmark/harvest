-- Flere husstande.
--
-- Indtil nu havde Harvest én madplan. Nu hører planen til en husstand, og
-- personer hører til en husstand. Chris og Malene deler som før; en anden
-- familie får sin egen.
--
-- Kataloget er IKKE delt op. De 137 Skagenfood-opskrifter er de samme for
-- alle, og søndagsimporten kører én gang for alle. Kun planen er privat.
--
-- Migrationen er bygget så den ikke kan vælte den uge der ligger nu:
-- kolonnen får en DEFAULT, så eksisterende rækker udfyldes af sig selv i
-- samme sætning som de får kolonnen. Der er ingen rækkefølge at huske.

CREATE TABLE IF NOT EXISTS brugere (
  -- Access sender e-mailen som brugeren skrev den. Den gemmes med små
  -- bogstaver, ellers ville "K@lmar.io" blive en anden person end
  -- "k@lmar.io" -- to husstande til den samme mand.
  email TEXT PRIMARY KEY,
  husstand TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brugere_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT brugere_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT brugere_husstand_not_blank CHECK (btrim(husstand) <> '')
);

CREATE INDEX IF NOT EXISTS idx_brugere_husstand ON brugere (husstand);

-- Husstanden på planen.
--
-- DEFAULT 'stormosegaard' gør, at den uge der ligger lige nu, lander i den
-- rigtige husstand uden en UPDATE bagefter. Nye rækker skriver altid
-- husstanden eksplicit, så standardværdien er kun en migrationshjælp.
ALTER TABLE week_plans
  ADD COLUMN IF NOT EXISTS husstand TEXT NOT NULL DEFAULT 'stormosegaard';

-- Den gamle regel sagde, at der kun kunne findes ÉN uge 34 i verden. Med
-- flere husstande skal hver husstand kunne have sin egen. Uden det her
-- ville den anden familie få en fejl, første gang de lagde en ret på en
-- uge Chris allerede havde.
ALTER TABLE week_plans DROP CONSTRAINT IF EXISTS week_plans_monday_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'week_plans_husstand_monday'
  ) THEN
    ALTER TABLE week_plans
      ADD CONSTRAINT week_plans_husstand_monday UNIQUE (husstand, monday_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_week_plans_husstand
  ON week_plans (husstand, monday_date);

-- week_plan_days og week_plan_shopping_checks peger på week_plans.id og
-- følger med af sig selv. De rører vi ikke.
--
-- Den gamle model (meals, meal_plans, meal_plan_meals) rører vi heller
-- ikke. Den er ikke husstandsopdelt, og den bruges kun af /menu.

INSERT INTO brugere (email, husstand)
VALUES ('k@lmar.io', 'stormosegaard')
ON CONFLICT (email) DO NOTHING;
