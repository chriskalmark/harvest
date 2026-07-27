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
assert.notEqual(
  normalizeShoppingName("rødløg"),
  normalizeShoppingName("hvidløg"),
);

console.log("shopping aggregation: OK");
