# Companion Junk List — AI Planning Instructions

> Referenced by: `data/data_context.md`, `data/MEAL_PLAN_PRODUCTION_WORKFLOW.md`

Demo preferences for a secondary household shopper. The junk list is published alongside each week's meal plan: beer/wine, chips, a weekly sweet, quick frozen meals, a weekend frozen treat, biweekly coffee, weekly seasonal creamer, and flavored unsweetened sparkling water — with variety and a flyer-first mindset.

---

## General Approach

- **[Fearless Flyer](https://www.traderjoes.com/home/ff)** — always check first.
- Prioritize what's new and interesting over repeating the same standbys.
- Fill gaps with staples from the pools below when the flyer doesn't cover a category.
- Vary week to week. Avoid repeating the exact same product two weeks in a row when practical.

---

## Dislikes (avoid across all categories)

- ❌ Licorice/anise/fennel flavor profile
- ❌ Overly sweet dessert wines (ports, late-harvest styles)
- ❌ Artificial-tasting diet/sugar-free sweets and snacks
- ❌ Rosé wine
- ❌ Mandarin Orange Chicken
- ❌ Cauliflower Crust Pizza
- ❌ Cowboy Caviar

---

## Categories & Rules

Use these exact category strings, in this order:

1. Coffee/Creamer
2. Beer/Wine
3. Chips
4. Sweets
5. Frozen Food
6. Frozen Treats
7. Beverages/Drinks

---

### Coffee/Creamer

- **Coffee:** Trader Joe's whole bean, **light roast**. Pantry item — **every other week** only.
- **Creamer:** Always seasonal, always weekly. Favor sweet/dessert-y seasonal flavors. Never repeat the same creamer two weeks running if you can avoid it.

---

### Beer/Wine

**Beer:** No wheat beers or hefeweizens. Lean toward Hazy IPAs and IPAs. Prefer seasonal picks; otherwise Boatswain IPA / Double IPA / Amber Ale, Stockyard Oatmeal Stout, or a solid lager 6-pack.

**Wine:** No rosé or dessert wines. Weight toward reds, with white and sparkling for variety. Always 1 bottle.

---

### Chips

Rotate freely (1 bag). Example pool:

- Quinoa & Black Bean Infused Tortilla Chips
- Restaurant-Style Tortilla Chips
- Peanut Butter Filled Pretzel Nuggets
- Organic Elote Corn Chip Dippers
- Sea Salted Saddle Potato Crisps
- Ridge Cut Kettle Cooked Potato Chips
- Ode to the Classic Potato Chip

Flyer wildcards welcome.

---

### Sweets

Pick **1 item per week**. Mix chocolate and non-chocolate. Avoid licorice/anise/fennel and artificial diet sweets. Check the flyer before defaulting to the standing pool (PB cups, Joe-Joe's, Cookie Butter, Speculoos, Pound Plus, dried mango, mochi, etc.).

---

### Frozen Food

Pick **1–2** quick heat-and-eat Mexican or Indian frozen meals. Lean Mexican more often than not; still mix in Indian. No Mandarin Orange Chicken or Cauliflower Crust Pizza.

---

### Frozen Treats

Pick 1 weekend item. Default to **savory** (bulgogi, pulled pork, spinach artichoke dip, mac & cheese with pepperoni); dessert is an occasional swap.

---

### Beverages/Drinks

Default: flavored, unsweetened sparkling water in cans. Avoid diet/artificially sweetened sodas. Rotate flavors week to week.

---

## Output Format

```json
{
  "junkList": [
    { "category": "Coffee/Creamer", "items": [...] },
    { "category": "Beer/Wine", "items": [...] },
    { "category": "Chips", "items": [...] },
    { "category": "Sweets", "items": [...] },
    { "category": "Frozen Food", "items": [...] },
    { "category": "Frozen Treats", "items": [...] },
    { "category": "Beverages/Drinks", "items": [...] }
  ]
}
```

Each item: `{ "n": "full TJ's product name", "q": "quantity" }`
