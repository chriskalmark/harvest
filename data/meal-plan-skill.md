# /meal-plan Skill

## Trigger Command

`/meal-plan [command] [options]`

## System Context (Auto-Injected)

```
=== HARVEST MEAL ENGINE CONTEXT ===
You are operating the Harvest meal planning engine for Trader Joe's weeks.

✅ WEEK SHAPE (the unit we plan and shop for):
- A week is a FLAT list of 4 meals: 1 breakfast, 1 lunch, and 2 dinners.
- There are NO days and NO timeslots. Do not assign meals to Monday/Tuesday.
- The app stores `meals` as a flat array; the Menu view groups them by meal type.
- The 4-meal mix exists because it is a convenient one-trip shop.

✅ PRIMARY DINER MEALS (read `data/diner-preferences.md` every session — source of truth):
- All meals loosely 450–550 kcal. Fiber first-class on every ingredient and meal.
- 20–30 min cooks, up to two pans. Frozen entrées ≤1–2/week.
- ≥3 protein types/week. Vegetarian meals are fine when they fit the week, but not required.
- Hard no: pineapple. No duplicate engine or base across the week.
- No repeated cuisine profile in the same week. Vary breakfast style (not both sweet, not both oat-heavy).
- Lunch: assemble only — no cooking.
- Acid-reflux aware: no trigger stacking within a meal; ≤1 flagged risk meal/week.
- Engines: widely vary TJ's sauces/seasonings/dressings; check traderjoes.com and Fearless Flyer; no duplicate engine across week.

✅ MACROS ARE A GUIDE, NOT A GATE:
- Per-meal targets in `data/diner-preferences.md`. No hard daily targets or macro warnings.
- Getting calories exactly right is NOT required. Prioritize satisfying, varied, real Trader Joe's meals.

✅ FIBER IS A FIRST-CLASS MACRO:
- Every `macros` object (per-ingredient AND per-meal) must include `fiber` (grams), alongside `cal`, `p`, `c`, `f`.
- The meal's `macros.fiber` should equal the sum of its ingredients' fiber.
- Favor fiber-rich builds (legumes, whole grains, vegetables, fruit).

✅ THE 4-PILLAR BUILD SYSTEM (always):
  1. PRO: High density protein
  2. BASE: Complex carb / filler
  3. VEG: Fiber / micronutrients
  4. ENGINE: Signature Trader Joe's flavor anchor
- `build` values are arrays of strings. Total build items 4-7 (most 4-5).
- No repeated engine or base within a single meal. No duplicate engine or base across the week.
- Use at least 3 different protein types across the week.
- Do not repeat a full meal that was served in the last ~2 weeks.
- For the companion junk list, follow `data/companion-preferences.md`.

✅ FORMAT RULES:
- All output must use the EXACT JSON schema from existing meal plans (a top-level `meals` array; no `days`, no `dailyTarget`)
- Every `macros` object includes `fiber`
- No generic pantry fillers as named ingredients (no bare "olive oil", "salt", "garlic")
- Prefer real Trader Joe's product names; plain produce is fine for veg/fruit
- Do not author `shoppingList`; it is derived from meal ingredients and grouped by store layout order
- Always include the junk list — build it per `data/companion-preferences.md`
- Junk category strings must exactly match: Coffee/Creamer, Beer/Wine, Chips, Sweets, Frozen Food, Frozen Treats, Beverages/Drinks

✅ SHOPPING SECTION ORDER:
- Derived shopping lists use the home-store walk order documented in `data/shopping-areas.md`
- Vegan Items means the refrigerated vegan/plant-based area only. Beans/lentils stay Pantry Items; frozen vegan items stay Frozen Food.
- Dairy & Eggs is separate from Deli Meats & Cheeses.

✅ PIPELINE COMPATIBILITY:
- Generated plans go in data/mealplans/
- Filename format: mealplan-week-YYYY-MM-DD.md
- Always wrap JSON in fenced json code blocks
- Never break the JSON structure

✅ AESTHETIC:
- Meal names should sound like high-end cafe menu items
- Clean, professional, appetizing wording
- No emojis, no slang
```

## Keeping Trader Joe's Items Current

Every ingredient and junk-list item should be a real, currently available Trader Joe's product when possible. Consult the Fearless Flyer:

- **Source of truth for new/seasonal items:** [https://www.traderjoes.com/home/ff](https://www.traderjoes.com/home/ff)

How to use it:

- Before generating a week, check the flyer for new or seasonal items and work a few into meals and the junk list when they fit.
- Prefer flyer/seasonal items when they fit a pillar, but never sacrifice a valid 4-pillar build just to include one.
- Still prefer real TJ's product names (e.g. "Trader Joe's Soy Chorizo"), with plain produce allowed as veg/fruit.

## Preference Sources

| Role | File |
|---|---|
| Primary diner meals | `data/diner-preferences.md` |
| Companion junk list | `data/companion-preferences.md` |
| Product / quality context | `data/data_context.md` |
| Publish checklist | `data/MEAL_PLAN_PRODUCTION_WORKFLOW.md` |

Read the preference files at the start of every planning session. Do not duplicate their full rules here.

## Available Commands

| Command | Description |
|---|---|
| `/meal-plan new [YYYY-MM-DD]` | Scaffold a new week markdown file in `data/mealplans/` (1 breakfast / 1 lunch / 2 dinners) |
| `/meal-plan generate` | Scaffold a week plan ready to fill in |
| `/meal-plan validate [file]` | Validate meal shape, fiber, macro totals, duplicate bases/engines, junk categories, shopping order |
| `/meal-plan publish [file]` | Copy draft to `current-week.md` and run local sync + publish (reachable DB) |

> The CLI helpers in `scripts/mealPlanSkill.ts` are for local/dev use. Prefer `npm run meal-plan:sync` and `npm run meal-plan:publish` when you already have a finished markdown week.

## Local Publish Flow

```bash
npm run meal-plan -- validate data/mealplans/mealplan-week-YYYY-MM-DD.md
npm run test:meal-plan-tools
npm run meal-plan -- publish data/mealplans/mealplan-week-YYYY-MM-DD.md
```

Or sync/publish the current week directly:

```bash
npm run meal-plan:sync
npm run meal-plan:publish
```

Host-side DB scripts need `DATABASE_URL` (see `.env.example`). Use `docker-compose.dev.yml` so Postgres is on `localhost:5432`, or point at a reachable instance.

## Output Template

File: `data/mealplans/mealplan-week-YYYY-MM-DD.md`. The week is a flat list of 4 meals (1 breakfast, 1 lunch, 2 dinners) — no days, no timeslots. `build` values are arrays. Per-ingredient `macros` (including `fiber`) should sum to the meal `macros`. Do not author `shoppingList` — it is derived from `ingredients`.

```markdown
# Current Week Plan: [Month] [Day] — [Month] [Day]

Active week of food: one breakfast, one lunch, and two dinners — a full week shopped in one trip. There are no days or timeslots; `meals` is a flat list grouped by type in the app's Menu view. Fiber is a first-class macro on every ingredient and meal.

## Canonical JSON
```json
{
  "weekRange": "[start] — [end]",
  "meals": [
    {
      "type": "Breakfast",
      "name": "[Cafe-style Meal Name]",
      "build": {
        "pro": ["[TJ's Protein]"],
        "base": ["[TJ's Base]"],
        "veg": ["[Veg]"],
        "engine": ["[TJ's Flavor Engine]"]
      },
      "ingredients": [
        { "name": "[item]", "quantity": "[amount]", "category": "pro", "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 } }
      ],
      "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 }
    },
    { "type": "Lunch",     "name": "...", "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 } },
    { "type": "Dinner",    "name": "...", "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 } },
    { "type": "Dinner",    "name": "...", "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 } }
  ],
  "junkList": [
    { "category": "Coffee/Creamer", "items": [] },
    { "category": "Beer/Wine", "items": [] },
    { "category": "Chips", "items": [] },
    { "category": "Sweets", "items": [] },
    { "category": "Frozen Food", "items": [] },
    { "category": "Frozen Treats", "items": [] },
    { "category": "Beverages/Drinks", "items": [] }
  ]
}
```
