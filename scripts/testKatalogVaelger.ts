import assert from "node:assert/strict";
import {
  bucketOf,
  EMPTY_FILTERS,
  filterRecipes,
  groupRecipes,
  hasActiveFilters,
  ingredientCountLabel,
  MAIN_INGREDIENT_ORDER,
  mainIngredientFacets,
  matchesQuery,
  missingPortionsNote,
  OTHER_MAIN_INGREDIENT,
  primaryMainIngredient,
  QUICK_MINUTES,
  searchHaystack,
  supportsPortions,
} from "../lib/catalog/picker";
import type { PickerRecipe } from "../lib/catalog/types";

/**
 * Test af retvælgerens regnestykker.
 *
 * Alt herinde er rent -- ingen database, intet netværk, ingen React. Det der
 * testes er de fire løfter vælgeren giver, når man står med ~50 retter på en
 * telefon:
 *
 *   1. Ingen ret forsvinder. Heller ikke en uden hovedingrediens-etiket, og
 *      heller ikke en med to.
 *   2. Søgningen rammer ingredienserne, ikke kun titlen -- og æ/ø/å skal
 *      kunne skrives begge veje.
 *   3. Chippernes tal passer med det man faktisk får at se, når man trykker.
 *   4. Rækkefølgen er forudsigelig: hurtigst først, så alfabetisk. Det er
 *      DEN regel der gør den store ret øverst i hvert afsnit meningsfuld.
 */

function ret(
  input: Partial<PickerRecipe> & { recipeId: number },
): PickerRecipe {
  return {
    name: `Ret ${input.recipeId}`,
    imageUrl: null,
    url: null,
    totalMinutes: 30,
    mainIngredient: null,
    mainIngredients: [],
    recipeTypes: [],
    ingredientCount: 8,
    ingredientNames: [],
    portionOptions: [1, 2, 3, 4],
    ...input,
  };
}

// ---------------------------------------------------------------------------
// Hovedingrediensen: den ene etiket retten sorteres under
// ---------------------------------------------------------------------------

assert.equal(primaryMainIngredient([]), null);
assert.equal(primaryMainIngredient(["Fisk"]), "Fisk");
assert.equal(primaryMainIngredient(["  Fisk  "]), "Fisk");

// Raekkefølgen i MAIN_INGREDIENT_ORDER afgør, ikke den raekkefølge
// Skagenfood tilfaeldigvis skrev etiketterne i.
assert.equal(primaryMainIngredient(["Gris", "Fjerkræ"]), "Fjerkræ");
assert.equal(primaryMainIngredient(["Fjerkræ", "Gris"]), "Fjerkræ");
assert.equal(primaryMainIngredient(["Grøntsager", "Fisk"]), "Fisk");

// En etiket vi ikke kender falder tilbage paa alfabetisk -- den forsvinder ikke.
assert.equal(primaryMainIngredient(["Vildt", "Struds"]), "Struds");

// En ret uden etiket havner i "Andet", aldrig i ingenting.
assert.equal(bucketOf(ret({ recipeId: 1 })), OTHER_MAIN_INGREDIENT);
assert.equal(bucketOf(ret({ recipeId: 2, mainIngredient: "Okse" })), "Okse");

// ---------------------------------------------------------------------------
// Søgningen: ingredienser taeller med, og æ/ø/å skrives begge veje
// ---------------------------------------------------------------------------

const laks = ret({
  recipeId: 10,
  name: "Stegt laks med kartofler i basilikumpesto",
  mainIngredient: "Fisk",
  mainIngredients: ["Fisk"],
  recipeTypes: ["Hurtige fiskeretter"],
  ingredientNames: ["Laksefilet", "Bagekartofler", "Spidskål"],
});

const blomkaal = ret({
  recipeId: 11,
  name: "Stegt blomkål på blød polenta",
  mainIngredient: "Grøntsager",
  mainIngredients: ["Grøntsager"],
  ingredientNames: ["Blomkål", "Polenta", "Portobello"],
});

// Titlen
assert.equal(matchesQuery(laks, "laks"), true);
// Ingrediensen -- ordet staar IKKE i titlen
assert.equal(matchesQuery(laks, "spidskål"), true);
assert.equal(matchesQuery(laks, "spidskaal"), true);
assert.equal(matchesQuery(blomkaal, "portobello"), true);
// Opskriftstypen
assert.equal(matchesQuery(laks, "fiskeretter"), true);
// Store bogstaver er ligegyldige
assert.equal(matchesQuery(blomkaal, "BLOMKÅL"), true);
assert.equal(matchesQuery(blomkaal, "blomkaal"), true);
// Flere ord: alle skal findes, raekkefølgen er ligegyldig
assert.equal(matchesQuery(laks, "kartofler laks"), true);
assert.equal(matchesQuery(laks, "laks lasagne"), false);
// Tom søgning viser alt
assert.equal(matchesQuery(laks, ""), true);
assert.equal(matchesQuery(laks, "    "), true);

// Høstakken foldes, saa den kan sammenlignes -- og indeholder ingredienserne
assert.ok(searchHaystack(laks).includes("spidskaal"));
assert.ok(searchHaystack(laks).includes("hurtige fiskeretter"));

// ---------------------------------------------------------------------------
// Filtrene
// ---------------------------------------------------------------------------

const katalog: PickerRecipe[] = [
  ret({
    recipeId: 1,
    name: "Kylling i karry",
    mainIngredient: "Fjerkræ",
    totalMinutes: 25,
  }),
  ret({
    recipeId: 2,
    name: "Andebryst",
    mainIngredient: "Fjerkræ",
    totalMinutes: 45,
  }),
  ret({
    recipeId: 3,
    name: "Bøf med løg",
    mainIngredient: "Okse",
    totalMinutes: 20,
  }),
  ret({
    recipeId: 4,
    name: "Torsk med dild",
    mainIngredient: "Fisk",
    totalMinutes: 30,
  }),
  ret({
    recipeId: 5,
    name: "Rester",
    mainIngredient: null,
    totalMinutes: null,
  }),
];

const ids = (list: PickerRecipe[]) => list.map((item) => item.recipeId);

// Uden filtre er alt med, ogsaa retten uden etiket og uden tid.
assert.deepEqual(ids(filterRecipes(katalog, EMPTY_FILTERS)), [1, 2, 3, 4, 5]);
assert.equal(hasActiveFilters(EMPTY_FILTERS), false);

// Hovedingrediens
assert.deepEqual(
  ids(filterRecipes(katalog, { ...EMPTY_FILTERS, mainIngredient: "Fjerkræ" })),
  [1, 2],
);
assert.deepEqual(
  ids(
    filterRecipes(katalog, {
      ...EMPTY_FILTERS,
      mainIngredient: OTHER_MAIN_INGREDIENT,
    }),
  ),
  [5],
);

// Tid. Retten uden tid kan ikke love at vaere under graensen, saa den falder
// ud -- den bliver ikke vist som noget den maaske ikke er.
assert.deepEqual(
  ids(filterRecipes(katalog, { ...EMPTY_FILTERS, maxMinutes: QUICK_MINUTES })),
  [1, 3, 4],
);
assert.equal(
  hasActiveFilters({ ...EMPTY_FILTERS, maxMinutes: QUICK_MINUTES }),
  true,
);

// Tid og hovedingrediens samtidig
assert.deepEqual(
  ids(
    filterRecipes(katalog, {
      ...EMPTY_FILTERS,
      mainIngredient: "Fjerkræ",
      maxMinutes: QUICK_MINUTES,
    }),
  ),
  [1],
);

// ---------------------------------------------------------------------------
// Chippernes tal
// ---------------------------------------------------------------------------

const alleFacets = mainIngredientFacets(katalog, EMPTY_FILTERS);
assert.deepEqual(
  alleFacets.map((facet) => [facet.value, facet.count]),
  [
    ["Fjerkræ", 2],
    ["Okse", 1],
    ["Fisk", 1],
    [OTHER_MAIN_INGREDIENT, 1],
  ],
);

// Chip-tallene taelles FØR hovedingrediens-valget. Ellers stod den valgte
// chip med sit tal og alle andre med nul, og man kunne ikke se hvad man
// skiftede til.
const medValgtChip = mainIngredientFacets(katalog, {
  ...EMPTY_FILTERS,
  mainIngredient: "Okse",
});
assert.deepEqual(medValgtChip, alleFacets);

// ... men søgning og tid taeller med, for de indsnaevrer det hele.
const hurtigeFacets = mainIngredientFacets(katalog, {
  ...EMPTY_FILTERS,
  maxMinutes: QUICK_MINUTES,
});
assert.deepEqual(
  hurtigeFacets.map((facet) => [facet.value, facet.count]),
  [
    ["Fjerkræ", 1],
    ["Okse", 1],
    ["Fisk", 1],
  ],
);

// Summen af chippernes tal er praecis det man faar at se uden chip-valg.
assert.equal(
  hurtigeFacets.reduce((sum, facet) => sum + facet.count, 0),
  filterRecipes(katalog, { ...EMPTY_FILTERS, maxMinutes: QUICK_MINUTES })
    .length,
);

// Hver chip lover praecis det tal, trykket giver.
for (const facet of alleFacets) {
  assert.equal(
    filterRecipes(katalog, { ...EMPTY_FILTERS, mainIngredient: facet.value })
      .length,
    facet.count,
    `Chippen "${facet.value}" lovede ${facet.count} retter.`,
  );
}

// ---------------------------------------------------------------------------
// Afsnittene og raekkefølgen
// ---------------------------------------------------------------------------

const afsnit = groupRecipes(katalog);
assert.deepEqual(
  afsnit.map((section) => section.label),
  ["Fjerkræ", "Okse", "Fisk", OTHER_MAIN_INGREDIENT],
);

// Ingen ret gaar tabt i grupperingen.
assert.equal(
  afsnit.reduce((sum, section) => sum + section.recipes.length, 0),
  katalog.length,
);

// Hurtigst først -- det er den regel der gør den store ret øverst i hvert
// afsnit meningsfuld: den ER afsnittets hurtigste.
assert.deepEqual(ids(afsnit[0].recipes), [1, 2]);

// Lige lange retter staar alfabetisk paa dansk, og aa sorteres sidst.
const ligeLange = groupRecipes([
  ret({
    recipeId: 20,
    name: "Ærter",
    mainIngredient: "Fisk",
    totalMinutes: 20,
  }),
  ret({
    recipeId: 21,
    name: "Blomkål",
    mainIngredient: "Fisk",
    totalMinutes: 20,
  }),
  ret({
    recipeId: 22,
    name: "Åleburger",
    mainIngredient: "Fisk",
    totalMinutes: 20,
  }),
]);
assert.deepEqual(
  ligeLange[0].recipes.map((recipe) => recipe.name),
  ["Blomkål", "Ærter", "Åleburger"],
);

// En ret uden tid staar sidst i sit afsnit -- aldrig først, hvor den ville
// blive vist som afsnittets hurtigste.
const udenTid = groupRecipes([
  ret({
    recipeId: 30,
    name: "Ukendt",
    mainIngredient: "Okse",
    totalMinutes: null,
  }),
  ret({
    recipeId: 31,
    name: "Hurtig",
    mainIngredient: "Okse",
    totalMinutes: 15,
  }),
]);
assert.deepEqual(ids(udenTid[0].recipes), [31, 30]);

// Alle kendte etiketter har en plads i raekkefølgen.
const allKnown = groupRecipes(
  MAIN_INGREDIENT_ORDER.map((label, index) =>
    ret({ recipeId: 100 + index, mainIngredient: label }),
  ),
);
assert.deepEqual(
  allKnown.map((section) => section.label),
  [...MAIN_INGREDIENT_ORDER],
);

// ---------------------------------------------------------------------------
// Portionsantal: sig fra frem for at rykke dagen i stilhed
// ---------------------------------------------------------------------------

const kunToTreFire = ret({ recipeId: 40, portionOptions: [2, 3, 4] });
assert.equal(supportsPortions(kunToTreFire, 2), true);
assert.equal(supportsPortions(kunToTreFire, 4), true);
assert.equal(supportsPortions(kunToTreFire, 1), false);
assert.equal(supportsPortions(kunToTreFire, 5), false);

assert.equal(missingPortionsNote(kunToTreFire, 2), null);
assert.equal(missingPortionsNote(kunToTreFire, 5), "Ingen mængder til 5 pers.");

// Ved vi ingenting om portionsantallene, paastaar vi ingenting.
const ukendtePortioner = ret({ recipeId: 41, portionOptions: [] });
assert.equal(supportsPortions(ukendtePortioner, 9), true);
assert.equal(missingPortionsNote(ukendtePortioner, 9), null);

// ---------------------------------------------------------------------------
// Smaating der staar paa skaermen
// ---------------------------------------------------------------------------

assert.equal(ingredientCountLabel(1), "1 ingrediens");
assert.equal(ingredientCountLabel(10), "10 ingredienser");
assert.equal(ingredientCountLabel(0), "0 ingredienser");

console.log("testKatalogVaelger: alle tjek gik igennem");
