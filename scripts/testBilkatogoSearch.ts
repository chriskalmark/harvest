import assert from "node:assert/strict";
import { searchProducts } from "../lib/bilkatogo/algolia";
import { addToCartBody } from "../lib/bilkatogo/cart";
import {
  matchLine,
  matchedProductIds,
  normalizeKey,
  parseCount,
} from "../lib/bilkatogo/matching";

/**
 * Test af Bilka ToGo-søgningen og matching.
 *
 * Søgedelen rammer det ægte Algolia-indeks. Den er offentlig og kræver ingen
 * login, så testen kan måle mod virkeligheden. Slår Bilka nøglen fra eller
 * ændrer indeksnavnet, fejler den her, og det er netop meningen: så ved vi det,
 * i stedet for at matching stille falder tilbage til ingenting.
 *
 * De rene funktioner (parseCount, override) testes uden netværk.
 */

// ---------------------------------------------------------------------------
// parseCount: stykantal ja, vægt/volumen nej
// ---------------------------------------------------------------------------

assert.equal(parseCount(undefined), 1, "ingen mængde giver 1");
assert.equal(parseCount(""), 1);
assert.equal(parseCount("2"), 2);
assert.equal(parseCount("2 stk"), 2);
assert.equal(parseCount("3 pakker"), 3);
assert.equal(parseCount("500 g"), 1, "vægt er ikke et stykantal");
assert.equal(parseCount("1,5 l"), 1, "volumen er ikke et stykantal");
assert.equal(parseCount("1 kg"), 1);
assert.equal(parseCount("nogle få"), 1, "fritekst uden tal giver 1");

// ---------------------------------------------------------------------------
// normalizeKey: samme form for mapping og opslag
// ---------------------------------------------------------------------------

assert.equal(normalizeKey(" Letmælk "), "letmælk");
assert.equal(normalizeKey("HAKKET Oksekød"), "hakket oksekød");

// ---------------------------------------------------------------------------
// Kurv-kroppen: præcis den form sitet sender
// ---------------------------------------------------------------------------

assert.deepEqual(
  addToCartBody({ productId: "84120", count: 2 }),
  { product_id: "84120", count: 2, fullCart: 0, cartVersion: 6 },
  "kurv-kroppen skal matche browserens eget kald",
);

/*
 * Resten kraever netvaerk og dermed await.
 *
 * Den laa som top-level await, og tsx oversaetter scripts her i repoet til
 * CJS -- saa fejlede den med "Top-level await is currently not supported"
 * og naaede aldrig at maale noget. Samme moenster som repoets oevrige
 * testscripts: alt i main(), og en catch der saetter exit-koden.
 */
async function main(): Promise<void> {
  // ---------------------------------------------------------------------------
  // Override vinder over søgning og springer netværket over
  // ---------------------------------------------------------------------------

  const overridden = await matchLine(
    { n: "Letmælk", q: "2" },
    { letmælk: "84120" },
  );
  assert.equal(overridden.source, "override");
  assert.equal(overridden.match?.productId, "84120");
  assert.equal(overridden.count, 2);
  assert.equal(overridden.alternatives.length, 0, "override har ingen alternativer");

  // ---------------------------------------------------------------------------
  // Ægte søgning: kendte danske varer skal give hits med produkt-id
  // ---------------------------------------------------------------------------

  for (const query of ["letmælk", "rugbrød", "æg", "smør"]) {
    const hits = await searchProducts(query);
    assert.ok(
      hits.length > 0,
      `"${query}" skal give mindst ét hit fra Bilkas indeks`,
    );
    assert.ok(
      hits.every((h) => h.productId.length > 0),
      `alle hits for "${query}" skal have et produkt-id`,
    );
    assert.equal(hits[0].rank, 0, "bedste hit skal have rang 0");
  }

  // En streng der ikke findes skal give nul hits, ikke et tilfældigt produkt.
  const nonsense = await searchProducts("xqzptvwkjunforvare123");
  assert.equal(nonsense.length, 0, "en meningsløs søgning skal give nul hits");

  // ---------------------------------------------------------------------------
  // Matching af en lille liste ende til ende, uden override
  // ---------------------------------------------------------------------------

  const matches = [
    await matchLine({ n: "letmælk", q: "2" }),
    await matchLine({ n: "rugbrød" }),
    await matchLine({ n: "xqzptvwkjunforvare123" }), // findes ikke: skal blive "none"
  ];

  assert.equal(matches[0].source, "search");
  assert.ok(
    (matches[0].match?.productId?.length ?? 0) > 0,
    "et søgetræf skal have et produkt-id",
  );
  assert.equal(matches[2].source, "none");
  assert.equal(matches[2].match, null, "en vare uden hit må ikke få et gættet id");

  // Kun de matchede varer må ende som kurvlinjer.
  const lines = matchedProductIds(matches);
  assert.equal(
    lines.length,
    2,
    "kun de to varer der blev fundet skal blive til kurvlinjer",
  );
  assert.ok(
    lines.every((l) => l.productId.length > 0 && l.count >= 1),
    "hver kurvlinje skal have et id og et antal på mindst 1",
  );

  console.log(
    `Bilka ToGo-søgning bestået (parseCount + override rent, ` +
      `ægte hits for letmælk/rugbrød/æg/smør, nul hits for vås, ` +
      `og ${lines.length} kurvlinjer ud af en 3-varers liste).`,
  );
}

main().catch((fejl: unknown) => {
  console.error(fejl instanceof Error ? fejl.message : String(fejl));
  process.exitCode = 1;
});
