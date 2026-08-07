import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isAutoImportEnabled,
  shouldSkipRetry,
  AUTO_IMPORT_ENV_VAR,
} from "../lib/services/skagenfoodAutoImportService";
import {
  selectCatalogWeek,
  SkagenfoodImportError,
} from "../lib/skagenfood/normalize";
import type { WireWeeklyPackagesResponse } from "../lib/skagenfood/types";

/**
 * Test af det selvhelbredende Skagenfood-tjek.
 *
 * Ingen database og intet netvaerk herinde -- ligesom testWeekPlan.ts og
 * testSkagenfoodCatalog.ts testes kun de rene beslutningsfunktioner, plus et
 * statisk tjek af koden der IKKE kan proeves uden en koerende container: at
 * spaerren, tavshedsforbuddet og fravaeret af farlige operationer rent
 * faktisk staar i kildekoden.
 */

const fixtureDir = path.join(process.cwd(), "data/fixtures");

function readFixture<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as T;
}

// ---------------------------------------------------------------------------
// Env-knappen: skal kunne slaas fra, og standarden skal vaere slaaet til
// ---------------------------------------------------------------------------

assert.equal(AUTO_IMPORT_ENV_VAR, "SKAGENFOOD_AUTO_IMPORT");

// Testens egen env-boks -- process.env kraever NODE_ENV, en test-boks goer ikke.
function envWith(value?: string): NodeJS.ProcessEnv {
  return (
    value === undefined ? {} : { [AUTO_IMPORT_ENV_VAR]: value }
  ) as NodeJS.ProcessEnv;
}

assert.equal(
  isAutoImportEnabled(envWith()),
  true,
  "uden variablen sat skal den selvhelbredende hentning vaere slaaet til",
);
assert.equal(isAutoImportEnabled(envWith("")), true);

for (const off of [
  "false",
  "0",
  "off",
  "nej",
  "fra",
  "disabled",
  "FALSE",
  " Off ",
]) {
  assert.equal(
    isAutoImportEnabled(envWith(off)),
    false,
    `"${off}" skal slaa den selvhelbredende hentning fra`,
  );
}
for (const on of ["true", "1", "on", "ja", "hvad som helst"]) {
  assert.equal(
    isAutoImportEnabled(envWith(on)),
    true,
    `"${on}" skal lade den selvhelbredende hentning staa til`,
  );
}

// ---------------------------------------------------------------------------
// Afkoeling: et forsoeg maa ikke gentages for tit
// ---------------------------------------------------------------------------

const now = new Date("2026-08-09T20:00:00Z");
const cooldownMs = 60 * 60 * 1000; // en time, samme vaerdi som RETRY_COOLDOWN_MS

assert.equal(
  shouldSkipRetry(null, now, cooldownMs),
  false,
  "intet tidligere forsoeg skal aldrig blokere det foerste",
);

for (const status of ["success", "error", "unavailable", "running"] as const) {
  assert.equal(
    shouldSkipRetry(
      { status, startedAt: new Date(now.getTime() - 5 * 60 * 1000) },
      now,
      cooldownMs,
    ),
    true,
    `et ${status}-forsoeg fra for fem minutter siden skal blokere et nyt forsoeg`,
  );
  assert.equal(
    shouldSkipRetry(
      { status, startedAt: new Date(now.getTime() - 2 * cooldownMs) },
      now,
      cooldownMs,
    ),
    false,
    `et ${status}-forsoeg fra for to afkoelingsperioder siden skal IKKE blokere et nyt forsoeg`,
  );
}

// Et haengende "running"-forsoeg -- fx efter en genstart midt i en koersel --
// skal ikke spaerre for evigt. Efter afkoelingsperioden er den lige saa fri
// som et fejlet forsoeg.
assert.equal(
  shouldSkipRetry(
    { status: "running", startedAt: new Date(now.getTime() - cooldownMs - 1) },
    now,
    cooldownMs,
  ),
  false,
  "et haengende running-forsoeg maa ikke spaerre for evigt",
);

// ---------------------------------------------------------------------------
// "week_unavailable" -- den normale tilstand, ikke en fejl
// ---------------------------------------------------------------------------

const packages = readFixture<WireWeeklyPackagesResponse>(
  "skagenfood-week-packages.json",
);

// Fiksturen har uge 32-34. Uge 35 findes ikke hos dem -- det skal give koden
// "week_unavailable", saa det selvhelbredende tjek kan skelne det fra en
// rigtig fejl uden at lede efter tekst i beskeden.
assert.throws(
  () => selectCatalogWeek(packages, { year: 2026, week: 35 }),
  (error: unknown) => {
    assert.ok(error instanceof SkagenfoodImportError);
    assert.equal(
      error.code,
      "week_unavailable",
      'en uge Skagenfood ikke har lagt op skal have code "week_unavailable"',
    );
    return true;
  },
);

// Svarer Skagenfood uden en eneste maaltidskasse overhovedet, er det en
// rigtig fejl -- ikke bare en uge der endnu ikke findes.
assert.throws(
  () =>
    selectCatalogWeek({ subscriptionPackages: [] }, { year: 2026, week: 32 }),
  (error: unknown) => {
    assert.ok(error instanceof SkagenfoodImportError);
    assert.equal(
      error.code,
      undefined,
      "et svar helt uden maaltidskasser er en rigtig fejl, ikke week_unavailable",
    );
    return true;
  },
);

// En gyldig uge skal stadig kunne vaelges uden at kaste noget.
assert.doesNotThrow(() =>
  selectCatalogWeek(packages, { year: 2026, week: 33 }),
);

// ---------------------------------------------------------------------------
// Statisk tjek af koden: spaerren, tavshedsforbuddet og de to forbud
// ---------------------------------------------------------------------------

const autoImportSource = fs.readFileSync(
  path.join(process.cwd(), "lib/services/skagenfoodAutoImportService.ts"),
  "utf8",
);

assert.ok(
  autoImportSource.includes(
    "CREATE TABLE IF NOT EXISTS skagenfood_auto_import_runs",
  ),
  "tabellen skal oprette sig selv med IF NOT EXISTS -- db/init koerer ikke igen paa produktionens database",
);
assert.ok(
  autoImportSource.includes("CREATE INDEX IF NOT EXISTS"),
  "indekset skal ogsaa oprettes med IF NOT EXISTS",
);
for (const forbidden of [
  "DROP TABLE",
  "TRUNCATE",
  "DELETE FROM",
  "ALTER TABLE",
]) {
  assert.ok(
    !autoImportSource.includes(forbidden),
    `det selvhelbredende tjek maa ikke indeholde "${forbidden}" -- kun additive DDL er tilladt`,
  );
}
for (const forbidden of [
  "node:vm",
  'require("vm")',
  " eval(",
  "new Function(",
]) {
  assert.ok(
    !autoImportSource.includes(forbidden),
    `det selvhelbredende tjek maa ikke indeholde "${forbidden}" -- ingen udfoerelse af fremmed kode`,
  );
}
assert.ok(
  autoImportSource.includes(`console.error`),
  "en fejlet automatisk hentning skal logges hoejlydt, ikke forsvinde tavst",
);
assert.ok(
  autoImportSource.includes("importSkagenfoodWeekExclusive"),
  "det selvhelbredende tjek skal dele spaerren med den manuelle importrute",
);

const ugeplanRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/ugeplan/route.ts"),
  "utf8",
);
assert.ok(
  ugeplanRouteSource.includes("scheduleAutoImportCheck()"),
  "GET /api/ugeplan skal udloese det selvhelbredende tjek",
);
assert.ok(
  !ugeplanRouteSource.includes("await scheduleAutoImportCheck"),
  "kaldet maa IKKE afventes -- en side-indlaesning maa aldrig vente paa Skagenfood",
);

const catalogServiceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/services/skagenfoodCatalogService.ts"),
  "utf8",
);
assert.ok(
  catalogServiceSource.includes("let importInFlight"),
  "der skal vaere én delt spaerre-variabel for al Skagenfood-import",
);
assert.ok(
  catalogServiceSource.includes("export function isSkagenfoodImportRunning"),
  "spaerrens tilstand skal kunne laeses udefra",
);

const importRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/ugeplan/import/route.ts"),
  "utf8",
);
assert.ok(
  importRouteSource.includes("export const GET"),
  "status for den automatiske hentning skal kunne slaas op -- en fejl maa aldrig kun leve i logs, den skal ogsaa kunne ses her",
);
assert.ok(
  importRouteSource.includes("importSkagenfoodWeekExclusive") &&
    importRouteSource.includes("isSkagenfoodImportRunning"),
  "den manuelle rute skal bruge den samme spaerre som det selvhelbredende tjek",
);

console.log(
  "testSkagenfoodAutoImportService: alle tjek gik igennem " +
    "(env-knap, afkoeling, week_unavailable-koden, og de statiske sikkerhedstjek).",
);
