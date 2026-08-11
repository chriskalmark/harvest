import fs from "node:fs";
import path from "node:path";
import {
  matchList,
  matchedProductIds,
  type OverrideMap,
  type ShoppingLineInput,
} from "../lib/bilkatogo/matching";
import { addLines } from "../lib/bilkatogo/cart";
import { formatMatchReport, formatPushReport } from "../lib/bilkatogo/report";
import type { CartPoster } from "../lib/bilkatogo/types";
import { hentUgeliste, harAccessToken } from "../lib/bilkatogo/ugeliste";

/**
 * Læg en indkøbsliste i kurven på Bilka ToGo.
 *
 * To trin, adskilt med vilje:
 *  - Match: hver vare kobles til et produkt-id. Sker mod en offentlig søgning,
 *    kræver ingen login, og er derfor det der køres som standard (dry-run).
 *  - Push: de matchede varer lægges i kurven. Kræver en session du selv har
 *    logget ind, leveret af lib/bilkatogo/session.ts.
 *
 * Standard er dry-run: den slår alt op og viser hvad der ville ryge i kurven,
 * uden at røre den. Det er sådan du bygger din override-fil op: kør, se hvilke
 * søgninger der ramte forkert, og læg det rigtige id ind som fast vare.
 *
 * Brug:
 *   npm run bilka:push                          # dry-run på sample-listen
 *   npm run bilka:push -- --week 2026-08-17     # din egen uge fra Harvest
 *   npm run bilka:push -- --file min-liste.json
 *   npm run bilka:push -- --push                # læg i kurv (kræver session.ts)
 *
 * --week tager MANDAGENS DATO (ÅÅÅÅ-MM-DD), ikke den gamle models weekRange.
 * De to modeller tæller uger på hver sin måde, og ugeplanen -- den der har
 * halvfabrikata foldet ud og varerne i Nettos rækkefølge -- er nøglet på
 * mandagen. Se lib/bilkatogo/ugeliste.ts for hvorfor det ikke er
 * /api/mealplan/shopping.
 *
 * Listeformat (JSON): [{ "n": "letmælk", "q": "2" }, { "n": "rugbrød" }]
 * q er valgfri. Et ledende heltal bliver til stykantal; vægt/volumen -> 1 stk.
 */

interface Args {
  file: string | null;
  week: string | null;
  base: string;
  overrides: string | null;
  push: boolean;
  medSkabet: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    file: null,
    week: null,
    base: process.env.HARVEST_BASE_URL ?? "https://mad.lmar.io",
    overrides: null,
    push: false,
    medSkabet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--push") args.push = true;
    else if (a === "--med-skabet") args.medSkabet = true;
    else if (a === "--file") args.file = argv[++i] ?? null;
    else if (a === "--week" || a === "--uge") args.week = argv[++i] ?? null;
    else if (a === "--base") args.base = argv[++i] ?? args.base;
    else if (a === "--overrides") args.overrides = argv[++i] ?? null;
  }

  if (args.week && args.file) {
    throw new Error("Brug enten --week eller --file, ikke begge.");
  }
  if (args.week && !/^\d{4}-\d{2}-\d{2}$/.test(args.week)) {
    throw new Error(
      `--week skal være mandagens dato som ÅÅÅÅ-MM-DD, fik "${args.week}".`,
    );
  }
  return args;
}

/** En lille liste så dry-run virker uden at du først skal lave en fil. */
const SAMPLE_LIST: ShoppingLineInput[] = [
  { n: "letmælk", q: "2" },
  { n: "rugbrød" },
  { n: "æg", q: "1 pakke" },
  { n: "smør" },
  { n: "hakket oksekød", q: "2" },
];

function readJsonFile<T>(file: string): T {
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
}

function loadList(file: string | null): ShoppingLineInput[] {
  if (!file) {
    console.log("Ingen --file angivet, bruger sample-listen.\n");
    return SAMPLE_LIST;
  }
  const raw = readJsonFile<unknown>(file);
  if (!Array.isArray(raw)) {
    throw new Error(`${file} skal være en JSON-liste af {n, q}.`);
  }
  return raw
    .map((item) => item as ShoppingLineInput)
    .filter((item) => typeof item.n === "string" && item.n.trim().length > 0);
}

/**
 * Override-mapping fra fil. Standardstien er data/bilkatogo-overrides.json;
 * findes den ikke, køres uden faste varer. Nøgler der starter med _ (fx
 * _comment i eksempelfilen) og tomme værdier springes over.
 */
function loadOverrides(file: string | null): OverrideMap {
  const target =
    file ?? path.join(process.cwd(), "data/bilkatogo-overrides.json");
  const abs = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
  if (!fs.existsSync(abs)) {
    if (file) throw new Error(`Override-fil ikke fundet: ${abs}`);
    return {};
  }
  const raw = readJsonFile<Record<string, unknown>>(abs);
  const map: OverrideMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "string" && value.trim().length > 0) {
      map[key.trim().toLowerCase()] = value.trim();
    }
  }
  return map;
}

/**
 * Hent posteren fra session.ts. Ligger bevidst i et dynamisk import, så
 * dry-run ikke afhænger af at sessionen er sat op. Er den ikke det, får du en
 * klar besked frem for et modulfejl-brøl.
 */
async function loadCartPoster(): Promise<{
  post: CartPoster;
  close: () => Promise<void>;
}> {
  /*
   * Din egen Chrome foerst.
   *
   * Playwrights egen browser kunne ikke faa en Bilka-session -- uid -1
   * hver gang, ogsaa efter log ud og ind. Chrome er allerede godkendt.
   */
  if (process.env.BILKA_VIA_CHROME !== "0") {
    const { createChromeCartPoster } = await import(
      "../lib/bilkatogo/chrome"
    );
    return createChromeCartPoster();
  }

  const sessionFile = path.join(process.cwd(), "lib/bilkatogo/session.ts");
  if (!fs.existsSync(sessionFile)) {
    throw new Error(
      "Fandt ikke lib/bilkatogo/session.ts. Kopiér session.example.ts til " +
        "session.ts og sæt din session op før --push.",
    );
  }
  // moduleName er annoteret som string, ikke literal, så tsc ikke kan resolve
  // stien statisk. Så er en manglende (git-ignoreret) session.ts ingen
  // oversætterfejl. Eksistensen er tjekket lige ovenfor; her importeres modulet.
  const moduleName: string = "session";
  const mod: {
    createCartPoster?: () => Promise<{
      post: CartPoster;
      close: () => Promise<void>;
    }>;
  } = await import(`../lib/bilkatogo/${moduleName}`);
  if (typeof mod.createCartPoster !== "function") {
    throw new Error("session.ts skal eksportere createCartPoster().");
  }
  return mod.createCartPoster();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let list: ShoppingLineInput[];
  if (args.week) {
    if (!harAccessToken()) {
      console.log(
        "Bemærk: CF_ACCESS_CLIENT_ID/SECRET er ikke sat. Harvest ligger bag\n" +
          "Cloudflare Access, og uden service-token svarer den med login-siden.\n",
      );
    }
    const uge = await hentUgeliste({
      uge: args.week,
      base: args.base,
      medSkabet: args.medSkabet,
    });
    console.log(`Henter fra Harvest: ${uge.ugeTitel}\n`);
    list = uge.linjer;
  } else {
    list = loadList(args.file);
  }

  const overrides = loadOverrides(args.overrides);

  const overrideCount = Object.keys(overrides).length;
  console.log(
    `${list.length} varer, ${overrideCount} faste i override-filen.` +
      (overrideCount === 0
        ? " (data/bilkatogo-overrides.json ikke fundet eller tom)"
        : ""),
  );
  console.log("Slår op mod Bilkas søgning...\n");

  const matches = await matchList(list, overrides);
  console.log(formatMatchReport(matches));

  const lines = matchedProductIds(matches);

  if (!args.push) {
    console.log(
      `\nDry-run. ${lines.length} vare(r) ville ryge i kurven. ` +
        "Kør igen med --push for at lægge dem i (kræver session.ts).",
    );
    return;
  }

  if (lines.length === 0) {
    console.log("\nIngen varer at lægge i kurven. Stopper.");
    return;
  }

  console.log(`\nLægger ${lines.length} vare(r) i kurven...`);
  const { post, close } = await loadCartPoster();
  try {
    const results = await addLines(post, lines);
    console.log(formatPushReport(results));
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
