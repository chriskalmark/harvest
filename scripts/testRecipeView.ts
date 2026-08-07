import assert from "node:assert/strict";
import {
  absoluteRecipeUrl,
  buildIngredientSections,
  buildRecipeView,
  buildSteps,
  DEFAULT_PORTIONS,
  foldDanish,
  formatEnergyValue,
  formatTimelineLabel,
  formatTotalMinutes,
  headlineNutrition,
  ingredientLineFor,
  matchesRecipeSearch,
  portionsLabel,
  resolvePortions,
  shiftPortions,
  stepIngredientLines,
  stepParagraphs,
  tagValue,
  toRecipeCard,
} from "@/lib/recipe/view";
import type {
  CatalogIngredient,
  CatalogRecipe,
  CatalogStep,
} from "@/lib/skagenfood/types";

/**
 * Proever opskriftsvisningens regnestykker af.
 *
 * Fixturen er ikke opfundet: den er "Kikærter og aubergine i tomat med sprød
 * kål og syltede løg" (id 9113), som den faktisk ligger i produktionsbasen --
 * samme maengder, samme tidsstempler, samme trin-ingredienser. Naar en test
 * herinde er groen, er det den rigtige form for data der er proevet af.
 */

function ingredient(
  name: string,
  lines: Array<[number, string]>,
  extra: Partial<CatalogIngredient> = {},
): CatalogIngredient {
  return {
    name,
    section: "",
    baseGroup: "3. Frugt, grønsager & snitgrønt",
    mainIngredient: false,
    allergenic: false,
    imageUrl: null,
    amounts: lines.map(([portions, line]) => ({
      portions,
      amount: 1,
      unitKey: "stk",
      line,
    })),
    ...extra,
  };
}

function step(
  minute: number | null,
  title: string,
  text: string,
  ingredients: string[] = [],
): CatalogStep {
  return { minute, title, text, html: `<p>${text}</p>`, ingredients };
}

const aubergine = ingredient("aubergine", [
  [1, "1 stk aubergine"],
  [2, "1 stk aubergine"],
  [3, "2 stk aubergine"],
  [4, "2 stk aubergine"],
]);

const spidskaal = ingredient("spidskål", [
  [1, "0,25 stk spidskål"],
  [2, "0,5 stk spidskål"],
  [3, "1 stk spidskål"],
  [4, "1 stk spidskål"],
]);

const mynte = ingredient(
  "mynte",
  [
    [1, "10 g mynte"],
    [2, "10 g mynte"],
    [3, "10 g mynte"],
    [4, "10 g mynte"],
  ],
  { section: "Dressing", allergenic: true },
);

const recipe: CatalogRecipe = {
  recipeId: 9113,
  name: "Kikærter og aubergine i tomat med sprød kål og syltede løg",
  urlName: "kikaerter-og-aubergine",
  url: "/da-dk/opskrifter/kikaerter-og-aubergine-9113",
  imageUrl: "https://recipes.skagenfood.dk/media/4586/kikaerter.jpg",
  totalMinutes: 30,
  portionOptions: [1, 2, 3, 4],
  ingredients: [aubergine, spidskaal, mynte],
  pantryItems: ["salt", "sort peber", "olivenolie, EVOO"],
  equipment: ["skærebræt & kniv", "sigte", "Gryde"],
  steps: [
    step(
      0,
      "Lad os starte med:",
      "Skyl grønt, frugt og krydderurter.\nFind alle ingredienser og redskaber frem.",
    ),
    step(1, "Aubergine og kikærter", "Skær aubergine i grove tern.", [
      "aubergine",
      "Aubergine",
    ]),
    step(20, "Spidskål", "Snit spidskål super tyndt.", [
      "spidskål",
      "hemmelig ingrediens",
    ]),
    step(null, "Anretning", "Anret det hele i en dyb tallerken."),
  ],
  tags: [
    { group: "forfatter", values: ["Peter Nøhr Christensen"] },
    { group: "opskriftstype", values: ["Vegetarretter"] },
    { group: "hovedingrediens", values: ["Grøntsager"] },
  ],
  energy: [
    { name: "Energi", amount: 674, unit: "kcal" },
    { name: "Fedt", amount: 32.6, unit: "g" },
    { name: "Protein", amount: 23.9, unit: "g" },
  ],
  source: "search",
};

// ---------------------------------------------------------------------------
// Portionsantal
// ---------------------------------------------------------------------------

assert.equal(DEFAULT_PORTIONS, 2, "husstanden er to voksne");
assert.equal(resolvePortions([1, 2, 3, 4]), 2, "standarden er to personer");
assert.equal(resolvePortions([2, 3, 4, 5]), 2);
assert.equal(
  resolvePortions([3, 4, 5]),
  3,
  "kan opskriften ikke to, tages det naermeste",
);
assert.equal(
  resolvePortions([1, 3]),
  3,
  "staar to lige naert, vinder det stoerste",
);
assert.equal(
  resolvePortions([], 4),
  DEFAULT_PORTIONS,
  "tom liste falder tilbage",
);
assert.equal(resolvePortions([1, 2, 3, 4], 4), 4, "oensket antal respekteres");
assert.equal(
  resolvePortions([1, 2, 3, 4], 9),
  4,
  "et oensket antal uden for listen klodses",
);
assert.equal(resolvePortions([1, 2, 3, 4], null), 2);

assert.equal(shiftPortions([1, 2, 3, 4], 2, 1), 3);
assert.equal(shiftPortions([1, 2, 3, 4], 2, -1), 1);
assert.equal(shiftPortions([1, 2, 3, 4], 4, 1), 4, "stopper i toppen");
assert.equal(shiftPortions([1, 2, 3, 4], 1, -1), 1, "stopper i bunden");
assert.equal(
  shiftPortions([2, 4, 5], 2, 1),
  4,
  "springer til naeste MULIGE antal, ikke til +1",
);

assert.equal(portionsLabel(1), "1 person");
assert.equal(portionsLabel(2), "2 personer");

// ---------------------------------------------------------------------------
// Ingredienser
// ---------------------------------------------------------------------------

assert.equal(ingredientLineFor(spidskaal, 1), "0,25 stk spidskål");
assert.equal(ingredientLineFor(spidskaal, 3), "1 stk spidskål");
assert.equal(
  ingredientLineFor(spidskaal, 5),
  null,
  "intet portionsantal, ingen linje -- vi ganger ikke selv",
);
assert.equal(
  ingredientLineFor(ingredient("tom", [[2, "   "]]), 2),
  null,
  "en tom linje er ingen linje",
);

{
  const sections = buildIngredientSections(recipe.ingredients, 2);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, null, "hovedlisten har ingen overskrift");
  assert.deepEqual(
    sections[0].items.map((item) => item.line),
    ["1 stk aubergine", "0,5 stk spidskål"],
  );
  assert.equal(sections[1].title, "Dressing");
  assert.equal(sections[1].items[0].allergenic, true);
}

{
  // Hovedlisten skal ligge foerst, ogsaa naar Skagenfood sender den sidst.
  const sections = buildIngredientSections([mynte, aubergine], 2);
  assert.equal(sections[0].title, null);
  assert.equal(sections[1].title, "Dressing");
}

{
  // "ingredienser" som gruppenavn er den samme hovedliste, ikke en ny sektion.
  const sections = buildIngredientSections(
    [
      { ...aubergine, section: "Ingredienser" },
      { ...spidskaal, section: "" },
    ],
    2,
  );
  assert.equal(sections.length, 1);
  assert.equal(sections[0].items.length, 2);
}

{
  const sections = buildIngredientSections(recipe.ingredients, 5);
  assert.equal(
    sections[0].items[0].line,
    null,
    "uden maengde for 5 personer staar navnet alene",
  );
  assert.equal(sections[0].items[0].name, "aubergine");
}

// ---------------------------------------------------------------------------
// Trin
// ---------------------------------------------------------------------------

assert.equal(formatTimelineLabel(0), "0 min");
assert.equal(formatTimelineLabel(10), "10 min");
assert.equal(
  formatTimelineLabel(null),
  null,
  "51 af 399 trin er uden tidsstempel -- de faar ingen tid paa",
);
assert.equal(formatTimelineLabel(-1), null);

assert.deepEqual(stepParagraphs("Et.\nTo.\n\nTre."), ["Et.", "To.", "Tre."]);
assert.deepEqual(stepParagraphs("   "), []);

assert.deepEqual(
  stepIngredientLines(recipe.steps[1], recipe.ingredients, 3),
  ["2 stk aubergine"],
  "samme ingrediens naevnt to gange giver én linje",
);
assert.deepEqual(
  stepIngredientLines(recipe.steps[2], recipe.ingredients, 1),
  ["0,25 stk spidskål", "hemmelig ingrediens"],
  "et navn uden match staar som det er",
);

{
  const steps = buildSteps(recipe.steps, recipe.ingredients, 2);
  assert.equal(steps.length, 4);
  assert.deepEqual(
    steps.map((s) => s.number),
    [1, 2, 3, 4],
  );
  assert.deepEqual(steps[0].paragraphs, [
    "Skyl grønt, frugt og krydderurter.",
    "Find alle ingredienser og redskaber frem.",
  ]);
  assert.equal(steps[3].timeLabel, null);
  assert.deepEqual(steps[2].ingredients, [
    "0,5 stk spidskål",
    "hemmelig ingrediens",
  ]);
}

// ---------------------------------------------------------------------------
// Tid, tal og maerkater
// ---------------------------------------------------------------------------

assert.equal(formatTotalMinutes(30), "30 min");
assert.equal(formatTotalMinutes(null), null);
assert.equal(formatTotalMinutes(0), null);

assert.equal(formatEnergyValue(674), "674");
assert.equal(formatEnergyValue(32.6), "32,6", "dansk decimalkomma");
assert.equal(formatEnergyValue(0.1), "0,1");
assert.equal(formatEnergyValue(23.94), "23,9");

assert.deepEqual(headlineNutrition(recipe.energy), [
  { label: "Energi", value: "674 kcal" },
  { label: "Protein", value: "23,9 g" },
]);
assert.deepEqual(
  headlineNutrition([]),
  [],
  "ingen tal er ingen raekke, ikke en nul-raekke",
);

assert.equal(tagValue(recipe.tags, "opskriftstype"), "Vegetarretter");
assert.equal(tagValue(recipe.tags, "OPSKRIFTSTYPE"), "Vegetarretter");
assert.equal(tagValue(recipe.tags, "findes-ikke"), null);

assert.equal(
  absoluteRecipeUrl("/da-dk/opskrifter/x-1"),
  "https://www.skagenfood.dk/da-dk/opskrifter/x-1",
);
assert.equal(
  absoluteRecipeUrl("https://www.skagenfood.dk/da-dk/x"),
  "https://www.skagenfood.dk/da-dk/x",
);
assert.equal(absoluteRecipeUrl(null), null);
assert.equal(
  absoluteRecipeUrl("javascript:alert(1)"),
  null,
  "kun stier og hele http-adresser -- intet andet skema slipper igennem",
);

// ---------------------------------------------------------------------------
// Hele visningen
// ---------------------------------------------------------------------------

{
  const view = buildRecipeView(recipe);
  assert.equal(view.portions, 2);
  assert.equal(view.timeLabel, "30 min");
  assert.equal(view.kind, "Vegetarretter");
  assert.equal(view.mainIngredient, "Grøntsager");
  assert.equal(view.author, "Peter Nøhr Christensen");
  assert.equal(view.pantryItems.length, 3);
  assert.equal(view.equipment.length, 3);
  assert.equal(view.steps.length, 4);
  assert.equal(view.nutrition.length, 3);
  assert.equal(view.sourceUrl, "https://www.skagenfood.dk" + recipe.url);
}

{
  // Portionsantallet skal slaa igennem BEGGE steder: i ingredienslisten og i
  // trinnenes egne maengder. Det er hele pointen med skalering.
  const view = buildRecipeView(recipe, 4);
  assert.equal(view.portions, 4);
  assert.equal(view.sections[0].items[0].line, "2 stk aubergine");
  assert.deepEqual(view.steps[1].ingredients, ["2 stk aubergine"]);
}

// ---------------------------------------------------------------------------
// Oversigten
// ---------------------------------------------------------------------------

{
  const card = toRecipeCard(recipe);
  assert.equal(card.recipeId, 9113);
  assert.equal(card.kind, "Vegetarretter");
  assert.equal(card.stepCount, 4);
  assert.equal(card.ingredientCount, 3);

  assert.equal(matchesRecipeSearch(card, ""), true);
  assert.equal(matchesRecipeSearch(card, "AUBERGINE"), true);
  assert.equal(
    matchesRecipeSearch(card, "kikaerter"),
    true,
    "man skal kunne finde kikærter uden at taste æ",
  );
  assert.equal(matchesRecipeSearch(card, "vegetar"), true, "typen taeller med");
  assert.equal(
    matchesRecipeSearch(card, "aubergine tomat"),
    true,
    "flere ord skal alle findes",
  );
  assert.equal(matchesRecipeSearch(card, "aubergine laks"), false);
  assert.equal(matchesRecipeSearch(card, "laks"), false);
}

assert.equal(foldDanish("Spidskål"), "spidskaal");
assert.equal(foldDanish("Rødløg Æg"), "roedloeg aeg");

console.log("testRecipeView: alle tjek grønne");
