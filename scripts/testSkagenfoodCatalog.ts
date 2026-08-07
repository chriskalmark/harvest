import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isoWeekOf, nextIsoWeek } from "../lib/skagenfood/isoWeek";
import {
  assertCatalogRecipe,
  countSlots,
  isEquipmentGroup,
  isPantryGroup,
  listAvailableWeeks,
  normalizeRecipe,
  parseBoxDays,
  parseBoxPortions,
  selectCatalogWeek,
  SkagenfoodImportError,
  stripHtml,
  uniqueSlots,
} from "../lib/skagenfood/normalize";
import type {
  CatalogRecipe,
  WireRecipe,
  WireWeeklyPackagesResponse,
} from "../lib/skagenfood/types";

/**
 * Test af Skagenfood-henteren.
 *
 * Fikstur-filerne under data/fixtures/ er ægte svar fra Skagenfood, trimmet
 * til tre kasser. De findes, så testen måler mod virkeligheden og ikke mod en
 * hjemmelavet forestilling om, hvordan deres JSON ser ud.
 */

const fixtureDir = path.join(process.cwd(), "data/fixtures");

function readFixture<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as T;
}

// ---------------------------------------------------------------------------
// ISO-uger — grundlaget for at kunne hente en KOMMENDE uge
// ---------------------------------------------------------------------------

// 2026-08-07 er ISO-uge 32, og Skagenfood kalder netop den uge "32"
// ("Uge 32 - sø 2/8 - lø 8/8"). Det er ankeret der binder vores ugenummer
// til deres.
assert.deepEqual(isoWeekOf(new Date(2026, 7, 7)), { year: 2026, week: 32 });
assert.deepEqual(isoWeekOf(new Date(2026, 7, 3)), { year: 2026, week: 32 });
assert.deepEqual(isoWeekOf(new Date(2026, 7, 9)), { year: 2026, week: 32 });
assert.deepEqual(isoWeekOf(new Date(2026, 7, 10)), { year: 2026, week: 33 });

// Søndag er sidste dag i ISO-ugen. Hentes der søndag aften, skal "næste uge"
// være ugen der begynder dagen efter — ikke den uge søndagen selv ligger i.
assert.deepEqual(nextIsoWeek(new Date(2026, 7, 9)), { year: 2026, week: 33 });
assert.deepEqual(nextIsoWeek(new Date(2026, 7, 7)), { year: 2026, week: 33 });

// Årsskifter: 2026 har 53 ISO-uger (1. januar 2026 er en torsdag).
assert.deepEqual(isoWeekOf(new Date(2026, 0, 1)), { year: 2026, week: 1 });
assert.deepEqual(isoWeekOf(new Date(2025, 11, 29)), { year: 2026, week: 1 });
assert.deepEqual(isoWeekOf(new Date(2026, 11, 31)), { year: 2026, week: 53 });
assert.deepEqual(nextIsoWeek(new Date(2026, 11, 31)), { year: 2027, week: 1 });
assert.deepEqual(isoWeekOf(new Date(2027, 0, 4)), { year: 2027, week: 1 });

// ---------------------------------------------------------------------------
// Ugevalg — hele pointen: en kommende uge, ikke kun den nuværende
// ---------------------------------------------------------------------------

const packages = readFixture<WireWeeklyPackagesResponse>(
  "skagenfood-week-packages.json",
);

assert.deepEqual(listAvailableWeeks(packages), [
  { year: 2026, week: 32 },
  { year: 2026, week: 33 },
  { year: 2026, week: 34 },
]);

const week32 = selectCatalogWeek(packages, { year: 2026, week: 32 });
const week34 = selectCatalogWeek(packages, { year: 2026, week: 34 });

assert.equal(week32.week, 32);
assert.equal(week34.week, 34);
assert.equal(week32.boxes.length, 3);
assert.equal(week32.displayName, "Uge 32 - sø 2/8 - lø 8/8");
assert.equal(week34.displayName, "Uge 34 - sø 16/8 - lø 22/8");

// Uge 34 er en kommende uge set fra uge 32, og den skal give andre retter.
const idsIn32 = new Set(uniqueSlots(week32).map((slot) => slot.recipeId));
const idsIn34 = uniqueSlots(week34).map((slot) => slot.recipeId);
assert.ok(idsIn34.length > 0, "uge 34 skal have retter");
assert.ok(
  idsIn34.some((id) => !idsIn32.has(id)),
  "en kommende uge skal give andre opskrifter end den nuværende",
);

// Uger Skagenfood ikke leverer skal fejle højlydt og fortælle hvad der findes.
assert.throws(
  () => selectCatalogWeek(packages, { year: 2026, week: 35 }),
  (error: unknown) =>
    error instanceof SkagenfoodImportError &&
    error.message.includes("uge 35 2026") &&
    error.message.includes("uge 32 2026"),
  "en uge uden data skal fejle og liste de uger der faktisk findes",
);

// Dubletter på tværs af kasser: Skagen-kassen og Lynkassen deler retter.
assert.ok(
  countSlots(week32) > uniqueSlots(week32).length,
  "fiksturen skal indeholde mindst én ret der går igen i to kasser",
);
assert.equal(
  new Set(uniqueSlots(week32).map((slot) => slot.recipeId)).size,
  uniqueSlots(week32).length,
  "uniqueSlots må ikke give det samme opskrifts-id to gange",
);

// Portioner og dage læses af kassens navn.
assert.equal(parseBoxPortions("Lynkassen by Louisa Lorang 4 dage/2 pers"), 2);
assert.equal(parseBoxDays("Lynkassen by Louisa Lorang 4 dage/2 pers"), 4);
assert.equal(parseBoxPortions("Vegetar Måltidskassen 3 dage/ 3 pers."), 3);
assert.equal(parseBoxDays("Tjæpt Kassen Tjæpt 1 dag/2 pers"), 1);
assert.equal(parseBoxPortions("Kasse uden tal"), null);
assert.equal(parseBoxDays("Kasse uden tal"), null);

// ---------------------------------------------------------------------------
// Gruppeklassifikation — det sted en halv opskrift ellers ville opstå
// ---------------------------------------------------------------------------

for (const name of [
  "Du skal selv have:",
  "Du skal selv have",
  "Basisvarer (ikke inkluderet):",
  "Basisvarer (medfølger ikke):",
]) {
  assert.ok(
    isPantryGroup(name),
    `"${name}" skal tælle som "du skal selv have"`,
  );
}
for (const name of ["Redskaber:", "Redskaber"]) {
  assert.ok(isEquipmentGroup(name), `"${name}" skal tælle som redskaber`);
}
for (const name of ["", "Sovs", "Topping", "ingredienser", "Kylling"]) {
  assert.ok(!isPantryGroup(name), `"${name}" er ikke "du skal selv have"`);
  assert.ok(!isEquipmentGroup(name), `"${name}" er ikke redskaber`);
}

// ---------------------------------------------------------------------------
// Normalisering af en ægte opskrift
// ---------------------------------------------------------------------------

const wire = readFixture<WireRecipe>("skagenfood-recipe-13677.json");
const recipe = normalizeRecipe(wire, {
  source: "search",
  imageUrl: "https://recipes.skagenfood.dk/media/9621/img_4667.jpeg",
  url: "/da-dk/opskrifter/fish-and-chips-med-aertemash-og-salat-med-fennikel-13677",
});

assert.equal(recipe.recipeId, 13677);
assert.equal(recipe.name, "Fish & chips med ærtemash og salat med fennikel");
assert.equal(recipe.totalMinutes, 30);
assert.equal(
  recipe.imageUrl,
  "https://recipes.skagenfood.dk/media/9621/img_4667.jpeg",
  "det rå billede fra ugesvaret skal vinde over søgesvarets beskårne",
);

// Portionsantal: Skagenfood leverer op til fem færdigskalerede sæt mængder,
// men ikke altid alle fem. Netop denne opskrift har kun 2-5 — 1-portions-
// posterne står med hasValue: false. Derfor udledes portionsantallet af
// dataene i stedet for at blive antaget.
assert.deepEqual(recipe.portionOptions, [2, 3, 4, 5]);

// De tre lister skal være adskilt og alle tre fyldte.
assert.ok(recipe.ingredients.length >= 5, "opskriften skal have ingredienser");
assert.ok(recipe.pantryItems.length > 0, '"du skal selv have" skal med');
assert.ok(recipe.equipment.length > 0, "redskaber skal med");
assert.ok(recipe.pantryItems.includes("salt"));
assert.ok(recipe.equipment.includes("ovn"));

// Intet fra "du skal selv have" eller "Redskaber:" må lække ind i ingredienserne.
const ingredientNames = new Set(recipe.ingredients.map((i) => i.name));
for (const leaked of [...recipe.pantryItems, ...recipe.equipment]) {
  assert.ok(
    !ingredientNames.has(leaked),
    `"${leaked}" hører ikke til i ingredienslisten`,
  );
}

// Mængder: færdige danske linjer med korrekt bøjning og decimalkomma.
const potatoes = recipe.ingredients.find((i) => i.name === "bagekartofler");
assert.ok(potatoes, "bagekartofler skal være i opskriften");
const forTwo = potatoes!.amounts.find((a) => a.portions === 2);
assert.ok(forTwo, "bagekartofler skal have en mængde til 2 personer");
assert.equal(forTwo!.amount, 400);
assert.equal(forTwo!.unitKey, "g");
assert.equal(forTwo!.line, "400 g bagekartofler");
assert.deepEqual(
  potatoes!.amounts.map((a) => a.portions),
  [...potatoes!.amounts.map((a) => a.portions)].sort((a, b) => a - b),
  "mængder skal ligge sorteret efter portionsantal",
);

// Trin: tidsstemplede, i rækkefølge, med læsbar tekst.
assert.ok(recipe.steps.length >= 5, "opskriften skal have trin");
assert.equal(recipe.steps[0].minute, 0);
assert.ok(
  recipe.steps.every((step) => step.text.length > 0),
  "hvert trin skal have tekst",
);
assert.ok(
  recipe.steps.some(
    (step) => typeof step.minute === "number" && step.minute > 0,
  ),
  "mindst ét trin skal have et tidsstempel over nul",
);

// ---------------------------------------------------------------------------
// Trin uden tidsstempel — 38 af 186 trin i uge 33/2026 manglede minutesInTimeline
// ---------------------------------------------------------------------------

const untimed = normalizeRecipe(
  {
    id: 1,
    name: "Uden tidsstempel",
    ingredientGroups: [
      {
        name: "",
        ingredients: [
          {
            name: "ris",
            amounts: [
              {
                numberOfPortions: 2,
                hasValue: true,
                amount: 150,
                unitKey: "g",
                formattedIngredientLine: "150 g ris",
              },
            ],
          },
        ],
      },
    ],
    steps: [{ title: "Kog", textStripped: "Kog risene." }],
  },
  { source: "ssr" },
);
assert.equal(
  untimed.steps[0].minute,
  null,
  "et trin uden minutesInTimeline skal gemmes som null, ikke som 0",
);
assert.doesNotThrow(() => assertCatalogRecipe(untimed, 1));

// Et trin uden textStripped skal falde tilbage til HTML-teksten frem for at
// blive tomt — et tomt trin ville få hele importen til at fejle.
assert.equal(stripHtml("<p>Skyl <strong>grønt</strong>.</p>"), "Skyl grønt.");
const htmlOnly = normalizeRecipe(
  {
    id: 2,
    name: "Kun HTML",
    ingredientGroups: [
      {
        name: "",
        ingredients: [
          {
            name: "ris",
            amounts: [
              {
                numberOfPortions: 2,
                hasValue: true,
                amount: 150,
                unitKey: "g",
              },
            ],
          },
        ],
      },
    ],
    steps: [{ title: "Kog", text: "<p>Kog risene i 12 min.</p>" }],
  },
  { source: "ssr" },
);
assert.equal(htmlOnly.steps[0].text, "Kog risene i 12 min.");

// ---------------------------------------------------------------------------
// Ukendte gruppenavne må ALDRIG tabes stiltiende
// ---------------------------------------------------------------------------

const sectioned = normalizeRecipe(
  {
    id: 3,
    name: "Ret med afsnit",
    ingredientGroups: [
      {
        name: "Sovs",
        ingredients: [
          {
            name: "fløde",
            amounts: [
              { numberOfPortions: 2, hasValue: true, amount: 2, unitKey: "dl" },
            ],
          },
          // "sort peber" uden mængde findes rigtigt i deres data (id 16303).
          {
            name: "sort peber",
            amounts: [{ numberOfPortions: 2, hasValue: false }],
          },
        ],
      },
      {
        name: "Topping",
        ingredients: [
          {
            name: "persille",
            amounts: [
              {
                numberOfPortions: 2,
                hasValue: true,
                amount: 1,
                unitKey: "bundt",
              },
            ],
          },
        ],
      },
      { name: "Redskaber:", ingredients: [{ name: "gryde" }] },
    ],
    steps: [
      { minutesInTimeline: 0, title: "Sovs", textStripped: "Kog fløden." },
    ],
  },
  { source: "search" },
);

assert.deepEqual(
  sectioned.ingredients.map((i) => i.name),
  ["fløde", "sort peber", "persille"],
  "ingredienser i navngivne afsnit skal med i kataloget, ikke smides væk",
);
assert.deepEqual(
  sectioned.ingredients.map((i) => i.section),
  ["Sovs", "Sovs", "Topping"],
  "afsnitsnavnet skal følge med ingrediensen",
);
assert.deepEqual(sectioned.equipment, ["gryde"]);
assert.doesNotThrow(() => assertCatalogRecipe(sectioned, 3));

// ---------------------------------------------------------------------------
// Fejl højlydt: en halv opskrift må aldrig nå databasen
// ---------------------------------------------------------------------------

function brokenBy(change: Partial<CatalogRecipe>): CatalogRecipe {
  return { ...recipe, ...change };
}

const brokenCases: Array<[string, CatalogRecipe, number, string]> = [
  ["forkert id i svaret", brokenBy({}), 9999, "id 9999"],
  ["intet navn", brokenBy({ name: "" }), 13677, "intet navn"],
  [
    "ingen ingredienser",
    brokenBy({ ingredients: [] }),
    13677,
    "ingen ingredienser",
  ],
  [
    "intet portionsantal",
    brokenBy({ portionOptions: [] }),
    13677,
    "portionsantal",
  ],
  ["ingen trin", brokenBy({ steps: [] }), 13677, "ingen trin"],
  [
    "et tomt trin",
    brokenBy({
      steps: [
        {
          minute: 0,
          title: "A",
          text: "Skyl grønt.",
          html: "",
          ingredients: [],
        },
        { minute: 4, title: "B", text: "", html: "", ingredients: [] },
      ],
    }),
    13677,
    "trin 2 er tomt",
  ],
];

for (const [label, broken, expectedId, needle] of brokenCases) {
  assert.throws(
    () => assertCatalogRecipe(broken, expectedId),
    (error: unknown) =>
      error instanceof SkagenfoodImportError && error.message.includes(needle),
    `en opskrift med ${label} skal afvises højlydt`,
  );
}

// Den hele opskrift slipper igennem.
assert.doesNotThrow(() => assertCatalogRecipe(recipe, 13677));

// ---------------------------------------------------------------------------
// Genkørsel uden dubletter — statisk tjek af skrivevejen
// ---------------------------------------------------------------------------

// Samme mønster som testMealRepositoryWrites.ts: uden en database kan vi stadig
// kræve, at INSERT'et rummer hvert felt normaliseringen producerer, og at
// konflikten på Skagenfoods eget id fører til en opdatering — ikke til en ny
// række, og ikke til en række hvor kun halvdelen af felterne er friske.

const repositorySource = fs.readFileSync(
  path.join(process.cwd(), "lib/db/skagenfoodRepository.ts"),
  "utf8",
);

const insertMatch = repositorySource.match(
  /INSERT INTO skagenfood_recipes\s*\(([\s\S]*?)\)\s*VALUES/,
);
assert.ok(
  insertMatch,
  "skagenfoodRepository skal have et INSERT i skagenfood_recipes",
);
const insertColumns = insertMatch![1]
  .split(",")
  .map((column) => column.trim())
  .filter(Boolean);

const updateMatch = repositorySource.match(
  /ON CONFLICT \(recipe_id\)\s*DO UPDATE SET([\s\S]*?)`/,
);
assert.ok(
  updateMatch,
  "skagenfood_recipes skal opdatere ved konflikt på recipe_id, ellers bliver genkørsler til dubletter",
);
const updateColumns = updateMatch![1]
  .split(",")
  .map((part) => part.trim().split("=")[0].trim())
  .filter(Boolean);

const catalogToColumn: Record<keyof CatalogRecipe, string> = {
  recipeId: "recipe_id",
  name: "name",
  urlName: "url_name",
  url: "url",
  imageUrl: "image_url",
  totalMinutes: "total_minutes",
  portionOptions: "portion_options",
  ingredients: "ingredients",
  pantryItems: "pantry_items",
  equipment: "equipment",
  steps: "steps",
  tags: "tags",
  energy: "energy",
  source: "source",
};

for (const [field, column] of Object.entries(catalogToColumn)) {
  assert.ok(
    insertColumns.includes(column),
    `INSERT i skagenfood_recipes mangler "${column}" (${field} ville blive tabt ved skrivning). Kolonner fundet: ${insertColumns.join(", ")}`,
  );
  if (column === "recipe_id") continue; // Konfliktnøglen opdateres ikke.
  assert.ok(
    updateColumns.includes(column),
    `DO UPDATE i skagenfood_recipes mangler "${column}" (${field} ville blive forældet ved genkørsel). Kolonner fundet: ${updateColumns.join(", ")}`,
  );
}

// Kassens retter skal skrives forfra, ellers overlever spøgelsesretter en uge
// hvor kassen er skrumpet.
assert.ok(
  /DELETE FROM skagenfood_box_recipes WHERE box_id = \$1/.test(
    repositorySource,
  ),
  "kassens retter skal ryddes før de skrives, så en skrumpet kasse ikke efterlader gamle pladser",
);

// Migrationen skal have de CHECK-regler der er databasens eget værn mod en halv opskrift.
const migration = fs.readFileSync(
  path.join(process.cwd(), "db/init/004_skagenfood_catalog.sql"),
  "utf8",
);
for (const constraint of [
  "skagenfood_recipes_name_not_blank",
  "skagenfood_recipes_has_ingredients",
  "skagenfood_recipes_has_steps",
  "skagenfood_recipes_has_portions",
]) {
  assert.ok(
    migration.includes(constraint),
    `migrationen skal have CHECK-reglen ${constraint}`,
  );
}
assert.ok(
  migration.includes("recipe_id BIGINT PRIMARY KEY"),
  "Skagenfoods eget opskrifts-id skal være primærnøgle, ellers kan genkørsler lave dubletter",
);

console.log(
  "Skagenfood-katalogets tests bestået " +
    `(ISO-uger, ugevalg for en kommende uge, ${recipe.ingredients.length} ingredienser + ` +
    `${recipe.pantryItems.length} "du skal selv have" + ${recipe.equipment.length} redskaber + ` +
    `${recipe.steps.length} trin i opskrift 13677, ${brokenCases.length} fejl-højlydt-tilfælde, ` +
    "og skrivevejens genkørselsgaranti).",
);
