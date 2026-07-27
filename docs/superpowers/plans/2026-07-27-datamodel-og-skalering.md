# Datamodel og portionsskalering — implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give hver ingrediens en numerisk mængde, en enhed og en butikszone, så indkøbslisten kan skalere efter portionstal og lægge ens varer sammen på tværs af ugens retter.

**Architecture:** Ingredienser bliver strukturerede data (`amount` + `unit` + `zone`) i stedet for fritekst. En ny ren funktion, `aggregateShoppingQuantities`, ganger med rettens `servings` og summerer pr. (navn, enhed). `deriveShoppingListFromMeals` kalder den og beholder ellers sin nuværende opførsel omkring afkrydsning og bevarede varer. Zonen kommer fra dataene i stedet for fra en klassifikator, så `lib/shoppingListOrder.ts` reduceres til en reservemekanisme.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, PostgreSQL 16 via `pg`, tests som `tsx`-scripts med `node:assert/strict`. Ingen testramme — det er med vilje, se specen.

**Spec:** `docs/superpowers/specs/2026-07-27-harvest-dansk-hellofresh-design.md`

---

## Filstruktur

| Fil | Ansvar | Handling |
|---|---|---|
| `lib/constants.ts` | Nettos zoneliste, ugeform | Modificeres |
| `lib/types.ts` | `MealIngredient`, `StoreZone`, `MealIngredientUnit`, `servings`/`steps`/`imageUrl` | Modificeres |
| `lib/domain/shoppingUsage.ts` | `normalizeShoppingName` — dansk-sikker nøgle | Modificeres |
| `lib/domain/shoppingAggregation.ts` | **Ny.** Skalering og sammenlægning. Ren funktion | Oprettes |
| `lib/domain/shoppingListDerivation.ts` | Kalder aggregeringen, bevarer afkrydsning | Modificeres |
| `lib/domain/mealMappers.ts` | Række ↔ domæneobjekt for de nye felter | Modificeres |
| `lib/shoppingListOrder.ts` | Reduceres til reservezone | Modificeres |
| `db/init/003_danish_quantities.sql` | **Ny.** Kolonner + tømning af demodata | Oprettes |
| `scripts/testShoppingAggregation.ts` | **Ny.** Tests for skalering og sammenlægning | Oprettes |
| `scripts/testShoppingListOrder.ts` | Erstattes: reservezone i stedet for TJ-produktnavne | Modificeres |

Aggregeringen får sin egen fil frem for at bo i `shoppingListDerivation.ts`, fordi den er ren ind/ud og dermed den eneste del af kæden, der kan testes uden database. Det er også der, en fejl gør mest skade — en forkert mængde opdages først i Netto.

---

### Task 1: Nettos zoner og ugeform

**Files:**
- Modify: `lib/constants.ts`

- [ ] **Step 1: Erstat butikkens zoneliste**

I `lib/constants.ts`, erstat blokken `STORE_CATEGORY_ORDER` (linje 20-38, inklusive kommentaren om Trader Joe's) med:

```ts
// Nettos gå-rækkefølge. Skal stemme med data/shopping-areas.md.
// Verificér ved første indkøbstur og ret her, hvis butikken går anderledes.
export const STORE_CATEGORY_ORDER = [
  "Frugt & grønt",
  "Brød",
  "Køl",
  "Ost & pålæg",
  "Kød & fjerkræ",
  "Fisk",
  "Kolonial",
  "Frost",
  "Drikkevarer",
  "Slik & snacks",
  "Non-food",
] as const;

export type StoreZone = (typeof STORE_CATEGORY_ORDER)[number];

export const DEFAULT_STORE_ZONE: StoreZone = "Kolonial";
```

- [ ] **Step 2: Ret ugeformen**

Erstat `EXPECTED_MEAL_COUNTS` med:

```ts
export const EXPECTED_MEAL_COUNTS = {
  Breakfast: 1,
  Lunch: 1,
  Dinner: 4,
} as const;
```

Måltidstypernes nøgler bliver på engelsk med vilje — se specen. Kun visningen oversættes, og det sker i en senere plan.

- [ ] **Step 3: Bekræft at det oversætter**

Run: `npx tsc --noEmit`
Expected: fejl i `lib/shoppingListOrder.ts` og `lib/domain/shoppingListDerivation.ts` om zonenavne, der ikke findes. Det er forventet — de rettes i Task 5 og 7. Der må **ikke** være fejl i `lib/constants.ts` selv.

- [ ] **Step 4: Commit**

```bash
git add lib/constants.ts
git commit -m "Replace Trader Joe's zones with Netto walk order"
```

---

### Task 2: Typer for mængde, enhed og zone

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Tilføj enhedstypen og udvid MealIngredient**

I `lib/types.ts`, tilføj øverst efter `import`-fri toppen:

```ts
import type { StoreZone } from "@/lib/constants";

export const MEAL_INGREDIENT_UNITS = [
  "g", "kg", "ml", "l", "dl", "stk", "tsk", "spsk", "bundt", "dåse", "pakke",
] as const;

export type MealIngredientUnit = (typeof MEAL_INGREDIENT_UNITS)[number];
```

Erstat `MealIngredient` med:

```ts
export interface MealIngredient {
  name: string;
  quantity: string;
  amount: number;
  unit: MealIngredientUnit;
  zone: StoreZone;
  category: "pro" | "base" | "veg" | "engine";
  macros: Macros;
}
```

`quantity` bliver stående. Den er fritekst til visning ("et godt nip"), og at fjerne den ville tvinge en oversættelse af felter, der ikke har med skalering at gøre.

Bemærk: `constants.ts` importerer allerede `MealType` fra `types.ts`, så denne import lukker en cirkel. Begge veje er `import type` og forsvinder ved oversættelse, så der opstår ingen kørselstidscirkel. Brug `import type` — ikke almindelig `import` — når du henter `StoreZone`.

- [ ] **Step 2: Tilføj opskrift, portioner og billede**

Tilføj til `MealInput`:

```ts
export interface MealInput {
  type: MealType;
  name: string;
  build: MealBuild;
  ingredients?: MealIngredient[];
  macros: Macros;
  servings: number;
  steps: string[];
  imageUrl: string | null;
}
```

Tilføj de tilsvarende kolonner til `MealRow`:

```ts
  servings: number;
  steps: string[];
  image_url: string | null;
```

og til `UpdateMealInput`:

```ts
  servings: number;
  steps: string[];
  imageUrl: string | null;
```

- [ ] **Step 3: Se hvor det brænder**

Run: `npx tsc --noEmit`
Expected: fejl i `lib/domain/mealMappers.ts` (manglende felter i `mapMeal` og `mealInputToRow`) og i de scripts, der bygger `MealInput`. Noter listen — Task 6 rydder op i mappers, resten i Task 8.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "Add amount, unit and zone to ingredients; servings, steps and image to meals"
```

---

### Task 3: Dansk-sikker normalisering

`normalizeShoppingName` er nøglen, ingredienser slås sammen på. I dag fjerner den alt uden for `[a-z0-9]`, så "kikærter" bliver til `kik rter`. Den skal rettes, før sammenlægningen bygges, ellers bygger vi ovenpå en stille fejl.

**Files:**
- Modify: `lib/domain/shoppingUsage.ts:23-48`
- Create: `scripts/testShoppingAggregation.ts`

- [ ] **Step 1: Skriv den fejlende test**

Opret `scripts/testShoppingAggregation.ts`:

```ts
import assert from "node:assert/strict";
import { normalizeShoppingName } from "@/lib/domain/shoppingUsage";

// Danske bogstaver skal overleve normaliseringen.
assert.equal(normalizeShoppingName("Kikærter"), "kikærter");
assert.equal(normalizeShoppingName("Rødløg"), "rødløg");
assert.equal(normalizeShoppingName("Smør"), "smør");

// Store og små bogstaver og ekstra mellemrum er samme vare.
assert.equal(normalizeShoppingName("  Frisk  Persille "), "frisk persille");

// Parenteser og tegnsætning fjernes.
assert.equal(normalizeShoppingName("Hvidløg (frisk)"), "hvidløg");

// Forskellige varer må ikke kollidere.
assert.notEqual(normalizeShoppingName("rødløg"), normalizeShoppingName("hvidløg"));

console.log("shopping aggregation: OK");
```

- [ ] **Step 2: Kør testen og se den fejle**

Run: `npx tsx scripts/testShoppingAggregation.ts`
Expected: FAIL på første påstand — faktisk værdi `kik rter`, forventet `kikærter`.

- [ ] **Step 3: Ret normaliseringen**

I `lib/domain/shoppingUsage.ts`, erstat hele `normalizeShoppingName` med:

```ts
export function normalizeShoppingName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
```

De engelske flertalsregler er fjernet. Dansk flertal (`-er`, `-e`, `-r`) kan ikke afkortes med samme trick uden at ødelægge "smør" og "peber", så vi afkorter ikke. Til gengæld skal agenten bruge konsekvent ental i ingrediensnavne — det skrives ind i `data/meal-plan-skill.md` i den næste plan.

Fjern samtidig importen af `stripTraderJoesForDisplay` øverst i filen; den bruges ikke længere.

- [ ] **Step 4: Kør testen igen**

Run: `npx tsx scripts/testShoppingAggregation.ts`
Expected: PASS, udskriver `shopping aggregation: OK`

- [ ] **Step 5: Commit**

```bash
git add lib/domain/shoppingUsage.ts scripts/testShoppingAggregation.ts
git commit -m "Make shopping name normalisation safe for Danish characters"
```

---

### Task 4: Skalering og sammenlægning

**Files:**
- Create: `lib/domain/shoppingAggregation.ts`
- Modify: `scripts/testShoppingAggregation.ts`

- [ ] **Step 1: Skriv de fejlende tests**

Tilføj til bunden af `scripts/testShoppingAggregation.ts`, over `console.log`-linjen:

```ts
import { aggregateShoppingQuantities } from "@/lib/domain/shoppingAggregation";
import type { MealIngredient } from "@/lib/types";

function ing(
  name: string,
  amount: number,
  unit: MealIngredient["unit"],
  zone: MealIngredient["zone"] = "Kolonial"
): MealIngredient {
  return {
    name,
    quantity: `${amount} ${unit}`,
    amount,
    unit,
    zone,
    category: "base",
    macros: { cal: 0, p: 0, c: 0, f: 0, fiber: 0 },
  };
}

// Mængden ganges med rettens portionstal.
{
  const result = aggregateShoppingQuantities([
    { servings: 2, ingredients: [ing("kyllingelår", 150, "g", "Kød & fjerkræ")] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 300);
  assert.equal(result[0].unit, "g");
  assert.equal(result[0].zone, "Kød & fjerkræ");
}

// Samme vare i to retter lægges sammen.
{
  const result = aggregateShoppingQuantities([
    { servings: 2, ingredients: [ing("kyllingelår", 150, "g", "Kød & fjerkræ")] },
    { servings: 4, ingredients: [ing("Kyllingelår", 100, "g", "Kød & fjerkræ")] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 700);
  assert.equal(result[0].name, "kyllingelår");
}

// Forskellig enhed for samme navn giver to linjer — vi gætter ikke.
{
  const result = aggregateShoppingQuantities([
    { servings: 2, ingredients: [ing("hvidløg", 1, "stk")] },
    { servings: 2, ingredients: [ing("hvidløg", 5, "g")] },
  ]);
  assert.equal(result.length, 2);
}

// Nul portioner giver ingen varer.
{
  const result = aggregateShoppingQuantities([
    { servings: 0, ingredients: [ing("persille", 1, "bundt")] },
  ]);
  assert.equal(result.length, 0);
}

// Brøkdele rundes op — man kan ikke købe 1,4 dåse.
{
  const result = aggregateShoppingQuantities([
    { servings: 3, ingredients: [ing("hakkede tomater", 0.5, "dåse")] },
  ]);
  assert.equal(result[0].amount, 2);
}
```

- [ ] **Step 2: Kør testen og se den fejle**

Run: `npx tsx scripts/testShoppingAggregation.ts`
Expected: FAIL — `Cannot find module '@/lib/domain/shoppingAggregation'`

- [ ] **Step 3: Skriv implementeringen**

Opret `lib/domain/shoppingAggregation.ts`:

```ts
import { normalizeShoppingName } from "@/lib/domain/shoppingUsage";
import type { MealIngredient, MealIngredientUnit } from "@/lib/types";
import type { StoreZone } from "@/lib/constants";

export interface AggregatableMeal {
  servings: number;
  ingredients?: MealIngredient[];
}

export interface AggregatedIngredient {
  name: string;
  amount: number;
  unit: MealIngredientUnit;
  zone: StoreZone;
}

/** Enheder hvor en brøkdel ikke giver mening i en indkøbskurv. */
const WHOLE_UNITS: ReadonlySet<MealIngredientUnit> = new Set([
  "stk",
  "bundt",
  "dåse",
  "pakke",
]);

export function aggregateShoppingQuantities(
  meals: AggregatableMeal[]
): AggregatedIngredient[] {
  const byKey = new Map<string, AggregatedIngredient>();

  for (const meal of meals) {
    if (meal.servings <= 0) {
      continue;
    }

    for (const ingredient of meal.ingredients ?? []) {
      const name = normalizeShoppingName(ingredient.name);
      if (!name || !Number.isFinite(ingredient.amount) || ingredient.amount <= 0) {
        continue;
      }

      const key = `${name}::${ingredient.unit}`;
      const scaled = ingredient.amount * meal.servings;
      const existing = byKey.get(key);

      if (existing) {
        existing.amount += scaled;
        continue;
      }

      byKey.set(key, {
        name,
        amount: scaled,
        unit: ingredient.unit,
        zone: ingredient.zone,
      });
    }
  }

  return Array.from(byKey.values()).map((item) => ({
    ...item,
    amount: WHOLE_UNITS.has(item.unit)
      ? Math.ceil(item.amount)
      : Math.round(item.amount * 10) / 10,
  }));
}
```

Afrundingen sker til sidst, ikke undervejs, så tre halve dåser bliver til 2 og ikke til 3.

- [ ] **Step 4: Kør testen igen**

Run: `npx tsx scripts/testShoppingAggregation.ts`
Expected: PASS

- [ ] **Step 5: Tilmeld testen i package.json**

I `package.json`, ret `scripts`:

```json
"test:aggregation": "tsx scripts/testShoppingAggregation.ts",
"test:meal-plan-tools": "npm run test:shopping && npm run test:meal-plans && npm run test:aggregation"
```

- [ ] **Step 6: Commit**

```bash
git add lib/domain/shoppingAggregation.ts scripts/testShoppingAggregation.ts package.json
git commit -m "Add serving-aware ingredient aggregation for the shopping list"
```

---

### Task 5: Reducér zoneklassifikatoren

Zonen kommer nu fra dataene. `lib/shoppingListOrder.ts` er i dag ~400 linjer eksakte Trader Joe's-produktnavne og nøgleordsregler, som alle er værdiløse for danske varer. Den skal ikke oversættes — den skal skrumpe til en reserve.

**Files:**
- Modify: `lib/shoppingListOrder.ts`
- Modify: `scripts/testShoppingListOrder.ts`

- [ ] **Step 1: Erstat testen**

Erstat hele indholdet af `scripts/testShoppingListOrder.ts` med:

```ts
import assert from "node:assert/strict";
import { organizeShoppingListForStoreLayout } from "@/lib/shoppingListOrder";
import { DEFAULT_STORE_ZONE, STORE_CATEGORY_ORDER } from "@/lib/constants";

// Zoner sorteres i butikkens gå-rækkefølge, uanset hvilken rækkefølge de kom i.
{
  const organised = organizeShoppingListForStoreLayout([
    { category: "Frost", items: [{ n: "ærter" }] },
    { category: "Frugt & grønt", items: [{ n: "gulerod" }] },
    { category: "Kød & fjerkræ", items: [{ n: "kyllingelår" }] },
  ]);

  assert.deepEqual(
    organised.map((section) => section.category),
    ["Frugt & grønt", "Kød & fjerkræ", "Frost"]
  );
}

// Varer i samme zone samles i én sektion.
{
  const organised = organizeShoppingListForStoreLayout([
    { category: "Frugt & grønt", items: [{ n: "gulerod" }] },
    { category: "Frugt & grønt", items: [{ n: "porre" }] },
  ]);

  assert.equal(organised.length, 1);
  assert.equal(organised[0].items.length, 2);
}

// En ukendt zone havner i reservezonen frem for at forsvinde.
{
  const organised = organizeShoppingListForStoreLayout([
    { category: "Ukendt Afdeling", items: [{ n: "mystisk vare" }] },
  ]);

  assert.equal(organised.length, 1);
  assert.equal(organised[0].category, DEFAULT_STORE_ZONE);
  assert.ok(STORE_CATEGORY_ORDER.includes(organised[0].category));
}

console.log("shopping list order: OK");
```

- [ ] **Step 2: Kør testen og se den fejle**

Run: `npx tsx scripts/testShoppingListOrder.ts`
Expected: FAIL — enten typefejl på den fjernede `TraderJoesStoreZone`, eller forkert sortering, fordi filen stadig bruger den gamle zoneliste.

- [ ] **Step 3: Skriv filen om**

Erstat hele `lib/shoppingListOrder.ts` med:

```ts
import { DEFAULT_STORE_ZONE, STORE_CATEGORY_ORDER, type StoreZone } from "@/lib/constants";
import type { ListCategory } from "@/lib/types";

export type { StoreZone };

/**
 * Zonen sættes af madplanens forfatter på hver ingrediens.
 * Denne funktion er kun en reserve for data uden gyldig zone.
 */
export function getItemStoreZone(zone?: string): StoreZone {
  return isStoreZone(zone) ? zone : DEFAULT_STORE_ZONE;
}

export function isStoreZone(value: unknown): value is StoreZone {
  return (
    typeof value === "string" &&
    (STORE_CATEGORY_ORDER as readonly string[]).includes(value)
  );
}

export function organizeShoppingListForStoreLayout(
  sections: ListCategory[]
): ListCategory[] {
  const byZone = new Map<StoreZone, ListCategory>();

  for (const section of sections) {
    const zone = getItemStoreZone(section.category);
    const existing = byZone.get(zone);

    if (existing) {
      existing.items.push(...section.items);
      continue;
    }

    byZone.set(zone, { category: zone, items: [...section.items] });
  }

  return STORE_CATEGORY_ORDER.map((zone) => byZone.get(zone)).filter(
    (section): section is ListCategory => Boolean(section)
  );
}
```

Bemærk signaturændringen: `getItemStoreZone` tog før et *varenavn* og gættede zonen. Nu tager den en *zone* og validerer den. Kaldestedet i `shoppingListDerivation.ts` rettes i Task 7.

- [ ] **Step 4: Kør testen igen**

Run: `npx tsx scripts/testShoppingListOrder.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/shoppingListOrder.ts scripts/testShoppingListOrder.ts
git commit -m "Reduce store zone classifier to a fallback now that zones come from data"
```

---

### Task 6: Mappers for de nye felter

**Files:**
- Modify: `lib/domain/mealMappers.ts`

- [ ] **Step 1: Ret ingrediensvalideringen**

I `lib/domain/mealMappers.ts`, erstat `normalizeIngredients` med:

```ts
import { isStoreZone } from "@/lib/shoppingListOrder";
import { MEAL_INGREDIENT_UNITS } from "@/lib/types";

function normalizeIngredients(value: unknown): MealIngredient[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((ingredient): ingredient is MealIngredient => {
    if (!ingredient || typeof ingredient !== "object") {
      return false;
    }

    const candidate = ingredient as Partial<MealIngredient>;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.amount === "number" &&
      Number.isFinite(candidate.amount) &&
      (MEAL_INGREDIENT_UNITS as readonly string[]).includes(
        candidate.unit as string
      ) &&
      isStoreZone(candidate.zone) &&
      typeof candidate.category === "string" &&
      Boolean(candidate.macros)
    );
  });
}
```

Ingredienser uden gyldig mængde, enhed eller zone frasorteres. Det er med vilje strengt: en ingrediens, der ikke kan regnes på, hører ikke hjemme på en indkøbsliste, og en stille nul-værdi ville give en forkert liste i butikken.

- [ ] **Step 2: Ret mapMeal**

Tilføj til objektet, `mapMeal` returnerer, lige efter `ingredients`-linjen:

```ts
    servings: row.servings,
    steps: Array.isArray(row.steps) ? row.steps.filter((s) => typeof s === "string") : [],
    imageUrl: row.image_url,
```

- [ ] **Step 3: Ret mealInputToRow og toMealInput**

I `mealInputToRow`, tilføj til det returnerede objekt:

```ts
    servings: mealInput.servings,
    steps: mealInput.steps,
    image_url: mealInput.imageUrl,
```

I `toMealInput`, tilføj til det returnerede objekt:

```ts
    servings: meal.servings,
    steps: meal.steps,
    imageUrl: meal.imageUrl,
```

- [ ] **Step 4: Oversæt**

Run: `npx tsc --noEmit`
Expected: ingen fejl i `lib/domain/mealMappers.ts`. Fejl må stadig stå i `shoppingListDerivation.ts` (Task 7) og i `scripts/` (Task 8).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/mealMappers.ts
git commit -m "Map servings, steps, image and structured ingredients"
```

---

### Task 7: Kobl aggregeringen på indkøbslisten

**Files:**
- Modify: `lib/domain/shoppingListDerivation.ts`

- [ ] **Step 1: Skriv den fejlende test**

Tilføj til `scripts/testShoppingAggregation.ts`, over `console.log`-linjen:

```ts
import { deriveShoppingListFromMeals } from "@/lib/domain/shoppingListDerivation";

// Mængder når hele vejen ud på listen, og afkrydsning overlever en genberegning.
{
  const meals = [
    {
      type: "Dinner" as const,
      name: "Kylling og pasta",
      build: { pro: [], base: [], veg: [], engine: [] },
      ingredients: [ing("kyllingelår", 150, "g", "Kød & fjerkræ")],
      macros: { cal: 500, p: 40, c: 40, f: 15, fiber: 5 },
      servings: 2,
      steps: [],
      imageUrl: null,
    },
  ];

  const first = deriveShoppingListFromMeals(meals);
  const chicken = first
    .flatMap((section) => section.items)
    .find((item) => item.n === "kyllingelår");

  assert.ok(chicken, "kyllingelår skal stå på listen");
  assert.equal(chicken.q, "300 g");

  chicken.checked = true;
  const second = deriveShoppingListFromMeals(meals, first);
  const recheck = second
    .flatMap((section) => section.items)
    .find((item) => item.n === "kyllingelår");

  assert.equal(recheck?.checked, true, "afkrydsning skal overleve genberegning");
}
```

- [ ] **Step 2: Kør testen og se den fejle**

Run: `npx tsx scripts/testShoppingAggregation.ts`
Expected: FAIL — `chicken.q` er `undefined`, fordi `buildShoppingItem` i dag kun henter `q` fra den forrige liste.

- [ ] **Step 3: Byg derivationen om**

I `lib/domain/shoppingListDerivation.ts`, erstat toppen af `deriveShoppingListFromMeals` — hele `for (const meal of meals)`-løkken — med et kald til aggregeringen:

```ts
import { aggregateShoppingQuantities } from "@/lib/domain/shoppingAggregation";
import { formatQuantity } from "@/lib/displayFormatters";

  for (const aggregated of aggregateShoppingQuantities(meals)) {
    const previous = previousByName.get(aggregated.name)?.item;

    derivedByName.set(aggregated.name, {
      ...buildShoppingItem(aggregated.name, previous),
      q: formatQuantity(aggregated.amount, aggregated.unit),
      zone: aggregated.zone,
    });
  }
```

Bemærk at `q` sættes **efter** spredningen af `buildShoppingItem`, så den beregnede mængde vinder over den gemte. `checked` og `pantry` kommer stadig fra den forrige liste — det er hele pointen med `buildShoppingItem`.

Ret kaldet til `getItemStoreZone` nederst i funktionen, så den får zonen fra varen i stedet for at gætte ud fra navnet:

```ts
  const storeLayoutList = organizeShoppingListForStoreLayout(
    Array.from(derivedByName.values()).map((item) => ({
      category: getItemStoreZone(item.zone),
      items: [item],
    }))
  );
```

Slet den nu ubrugte hjælpefunktion `getMealIngredientNames` nederst i filen.

- [ ] **Step 4: Tilføj de manglende felter**

Tilføj `zone?: string;` til `ListItem` i `lib/types.ts`.

Tilføj til `lib/displayFormatters.ts`:

```ts
import type { MealIngredientUnit } from "@/lib/types";

export function formatQuantity(amount: number, unit: MealIngredientUnit): string {
  const rounded = Number.isInteger(amount) ? amount : Math.round(amount * 10) / 10;
  return `${rounded.toString().replace(".", ",")} ${unit}`;
}
```

Kommaet er dansk decimaltegn — "1,5 dl", ikke "1.5 dl".

Fjern `stripTraderJoesForDisplay` fra samme fil og ret dens kaldesteder. Find dem med:

Run: `grep -rn "stripTraderJoesForDisplay" --include=*.ts --include=*.tsx .`

- [ ] **Step 5: Kør testen igen**

Run: `npx tsx scripts/testShoppingAggregation.ts`
Expected: PASS

- [ ] **Step 6: Kør hele testpakken og oversæt**

Run: `npm run test:meal-plan-tools && npx tsc --noEmit`
Expected: alle tre testscripts udskriver OK. Resterende typefejl må kun være i `scripts/` — de ryddes i Task 8.

- [ ] **Step 7: Commit**

```bash
git add lib/domain/shoppingListDerivation.ts lib/displayFormatters.ts lib/types.ts scripts/testShoppingAggregation.ts
git commit -m "Derive shopping quantities from servings instead of dropping them"
```

---

### Task 8: Migration og oprydning i scripts

**Files:**
- Create: `db/init/003_danish_quantities.sql`
- Modify: alle filer under `scripts/`, som `tsc` stadig klager over

- [ ] **Step 1: Skriv migrationen**

Opret `db/init/003_danish_quantities.sql`:

```sql
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS servings INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Trader Joe's-demodataet kan ikke konverteres: mængderne har aldrig
-- eksisteret som tal, og produktnavnene findes ikke i Netto.
DELETE FROM meal_plans;
DELETE FROM meals;
DELETE FROM junk_items;
```

`meal_plan_meals`, `meal_feedback`, `meal_ratings` og `junk_feedback` tømmes af sig selv via `ON DELETE CASCADE`.

- [ ] **Step 2: Kør migrationen mod den kørende database**

Migrationer i `db/init/` kører ikke automatisk, fordi Postgres-volumet allerede er initialiseret. Kør den manuelt:

```bash
docker exec -i harvest-postgres psql -U harvest -d harvest_db -v ON_ERROR_STOP=1 < db/init/003_danish_quantities.sql
```

Expected: `ALTER TABLE`, derefter tre `DELETE`-linjer.

- [ ] **Step 3: Bekræft skemaet**

```bash
docker exec harvest-postgres psql -U harvest -d harvest_db -c "\d meals" | grep -E "servings|steps|image_url"
```

Expected: tre linjer, én pr. ny kolonne.

- [ ] **Step 4: Ryd op i scripts**

Run: `npx tsc --noEmit`

Ret hver resterende fejl i `scripts/`. De vil alle være samme slags: et objektliteral, der mangler `servings`, `steps` eller `imageUrl`. Brug `servings: 2`, `steps: []` og `imageUrl: null` som værdier — de rigtige data kommer fra agenten i næste plan.

- [ ] **Step 5: Bekræft at alt oversætter og består**

Run: `npx tsc --noEmit && npm run lint && npm run test:meal-plan-tools`
Expected: ingen typefejl, ingen lint-fejl, tre OK-linjer fra testene.

- [ ] **Step 6: Commit**

```bash
git add db/init/003_danish_quantities.sql scripts/
git commit -m "Add migration for servings, steps and images; clear Trader Joe's demo data"
```

---

## Efter denne plan

Appen oversætter, testene består, og indkøbslisten regner rigtigt — men databasen er tom, og UI'et er stadig engelsk med det gamle udseende. Det er forventet. De næste tre planer er:

1. **Indhold** — `data/`-filerne på dansk, agent-kontrakten med mængder og trin, første rigtige uge
2. **Udseende** — den grønne retning fra `.impeccable.md`, inklusive indkøbsskærmens design
3. **Billeder** — nanobanana, volume på `/app/public/meals`, reserve-tilstand. Blokeret af spend-loftet
