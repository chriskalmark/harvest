import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

/**
 * Opsætning af Bilka ToGo-integrationen fra ende til anden.
 *
 * Kør: npm run bilka:setup
 *
 * Den gør alt det mekaniske, og kun det:
 *  1. Opretter data/bilkatogo-overrides.json fra eksemplet hvis den mangler.
 *  2. Installerer Playwright hvis den ikke er der.
 *  3. Åbner et browservindue mod bilkatogo.dk. Du logger selv ind. Bilka bruger
 *     et Gigya-login, og hverken scriptet eller Claude rører dit kodeord.
 *  4. Beder dig lægge én vare i kurven, opsnapper det kald browseren sender, og
 *     læser add-to-cart-stien ud af det. Så matcher vores kald browserens eget.
 *  5. Gemmer sessionen i .bilka-session.json og skriver lib/bilkatogo/session.ts
 *     med den fundne sti og den gemte session.
 *  6. Kører en dry-run så du kan se at det virker.
 *
 * Derefter fylder du faste varer i override-filen, og `npm run bilka:push --
 * --push` lægger en liste i kurven.
 */

// Minimal form af de Playwright-dele vi rører, så filen kan type-tjekke uden at
// Playwright er installeret endnu. Scriptet installerer den selv i trin 2.
interface PwRequest {
  url(): string;
  method(): string;
  postData(): string | null;
  headers(): Record<string, string>;
}
interface PwAPIResponse {
  ok(): boolean;
  status(): number;
  statusText(): string;
}
interface PwContextRequest {
  post(
    url: string,
    opts: { data: unknown; headers?: Record<string, string> },
  ): Promise<PwAPIResponse>;
}
interface PwContext {
  request: PwContextRequest;
  newPage(): Promise<PwPage>;
  storageState(opts: { path: string }): Promise<unknown>;
  on(event: "request", cb: (req: PwRequest) => void): void;
  off(event: "request", cb: (req: PwRequest) => void): void;
}
interface PwPage {
  goto(url: string, opts?: { waitUntil?: string }): Promise<unknown>;
}
interface PwBrowser {
  newContext(opts?: { storageState?: string }): Promise<PwContext>;
  close(): Promise<void>;
}
interface Chromium {
  launch(opts?: { headless?: boolean }): Promise<PwBrowser>;
}

const ROOT = process.cwd();
const SESSION_FILE = path.join(ROOT, "lib/bilkatogo/session.ts");
const SESSION_EXAMPLE = path.join(ROOT, "lib/bilkatogo/session.example.ts");
const OVERRIDES_FILE = path.join(ROOT, "data/bilkatogo-overrides.json");
const OVERRIDES_EXAMPLE = path.join(ROOT, "data/bilkatogo-overrides.example.json");
const STORAGE_FILE = path.join(ROOT, ".bilka-session.json");
const START_URL = "https://www.bilkatogo.dk/";

function log(msg: string): void {
  console.log(msg);
}

/** Kopiér override-eksemplet til den rigtige fil hvis den ikke findes endnu. */
function ensureOverrides(): void {
  if (fs.existsSync(OVERRIDES_FILE)) {
    log("Override-fil findes allerede, rører den ikke.");
    return;
  }
  if (!fs.existsSync(OVERRIDES_EXAMPLE)) {
    log("Fandt ikke override-eksemplet, springer over.");
    return;
  }
  fs.copyFileSync(OVERRIDES_EXAMPLE, OVERRIDES_FILE);
  log("Oprettede data/bilkatogo-overrides.json fra eksemplet.");
}

/** Playwright-navnet som variabel, så tsc ikke kræver pakken ved type-tjek. */
const PLAYWRIGHT = "playwright";

async function ensurePlaywright(): Promise<Chromium> {
  try {
    const mod = (await import(PLAYWRIGHT)) as { chromium: Chromium };
    return mod.chromium;
  } catch {
    log("Playwright mangler. Installerer (playwright + chromium)...");
    execSync("npm i -D playwright", { stdio: "inherit" });
    execSync("npx playwright install chromium", { stdio: "inherit" });
    const mod = (await import(PLAYWRIGHT)) as { chromium: Chromium };
    return mod.chromium;
  }
}

/**
 * Vaerter der aldrig er kurven: sporing, maaling og reklame.
 *
 * Foerste forsoeg filtrerede paa "url indeholder bilkatogo" OG metode
 * POST/PUT/PATCH. Begge dele var mine antagelser, og de skjulte netop det
 * kald vi ledte efter -- alt hvad der kom frem, var Datadog, Google
 * Analytics og DoubleClick. Nu vendes det om: ALT vises, undtagen det vi
 * med sikkerhed ved er stoej.
 */
const STØJ = [
  "datadoghq",
  "google-analytics",
  "analytics.google",
  "googletagmanager",
  "doubleclick",
  "google.com/ads",
  "googleadservices",
  "facebook.",
  "hotjar",
  "clarity.ms",
  "sentry.io",
  "cookiebot",
  "onetrust",
  "segment.io",
  "braze",
  "adform",
  "criteo",
];

/** Filer, ikke kald. En skrifttype er ikke en kurv. */
const FILENDELSER =
  /\.(js|mjs|css|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|ico|map)(\?|$)/i;

function erStøj(url: string): boolean {
  const lav = url.toLowerCase();
  if (STØJ.some((v) => lav.includes(v))) return true;
  return FILENDELSER.test(lav);
}

/**
 * Hvor godt ligner det her et "laeg i kurv"-kald?
 *
 * Ingen krav om metode og ingen krav om vaert -- kun point. Et GET med
 * product_id i adressen taeller lige saa meget som et POST.
 */
function scoreAddCall(req: PwRequest): number {
  const url = req.url();
  if (erStøj(url)) return 0;

  const lav = url.toLowerCase();
  const body = (req.postData() ?? "").toLowerCase();
  let score = 0;

  if (/product_?id/.test(body) || /product_?id/.test(lav)) score += 4;
  if (/\bcart\b|\bbasket\b|kurv/.test(lav)) score += 3;
  if (/\bcart\b|\bbasket\b/.test(body)) score += 2;
  if (lav.includes("bilkatogo") || lav.includes("salling")) score += 2;
  if (lav.includes("/shop/")) score += 1;
  if (["POST", "PUT", "PATCH"].includes(req.method().toUpperCase())) score += 1;

  return score;
}

/** Point nok til at vi tør vaelge den uden at spoerge. */
const SIKKER_SCORE = 7;

/** De headers værd at gentage: Bilkas egne x-headers. Cookie klarer konteksten. */
function notableHeaders(req: PwRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers())) {
    const k = key.toLowerCase();
    if (k.startsWith("x-") && !k.startsWith("x-forwarded")) out[k] = value;
  }
  return out;
}

interface Captured {
  url: string;
  headers: Record<string, string>;
}

/**
 * Lyt efter det første add-to-cart-kald efter at have bedt brugeren om at lægge
 * én vare i kurven. Handleren sættes lige før prompten, så kun nye kald tæller.
 */
async function captureAddCall(
  context: PwContext,
  rl: readline.Interface,
): Promise<Captured> {
  return new Promise<Captured>((resolve, reject) => {
    /** Alt der overhovedet ligner, saa intet er usynligt. */
    const set: { score: number; captured: Captured; linje: string }[] = [];

    const timeout = setTimeout(() => {
      context.off("request", handler);

      if (set.length === 0) {
        reject(
          new Error(
            "Så ingen kald til bilkatogo overhovedet inden for 3 minutter.\n" +
              "Blev varen lagt i kurven i DET vindue scriptet åbnede? Et andet\n" +
              "browservindue tæller ikke -- scriptet lytter kun på sit eget.",
          ),
        );
        return;
      }

      set.sort((a, b) => b.score - a.score);
      log("\nIngen kald ramte mønsteret sikkert. Her er hvad jeg så:\n");
      set.slice(0, 12).forEach((k, i) => log(`  ${i + 1}. ${k.linje}`));
      reject(
        new Error(
          "\nKopiér den linje der ligner 'læg i kurv', og send den til Claude -- " +
            "så retter vi mønsteret.",
        ),
      );
    }, 180_000);

    const handler = (req: PwRequest): void => {
      if (erStøj(req.url())) return;
      const score = scoreAddCall(req);

      const body = (req.postData() ?? "").slice(0, 160).replace(/\s+/g, " ");
      const linje = `[${score}] ${req.method()} ${req.url()}${body ? `  krop: ${body}` : "  (ingen krop)"}`;

      set.push({
        score,
        linje,
        captured: { url: req.url(), headers: notableHeaders(req) },
      });

      // Vis det med det samme. Sidder man og venter, skal man kunne se at
      // der SKER noget -- ikke stirre paa en tavs prompt.
      log(`  set: ${linje}`);

      if (score >= SIKKER_SCORE) {
        clearTimeout(timeout);
        context.off("request", handler);
        resolve({ url: req.url(), headers: notableHeaders(req) });
      }
    };

    context.on("request", handler);
    void rl.question(
      "\nLæg nu ÉN vare i kurven i browservinduet. Jeg lytter og viser alt jeg ser...\n",
    );
  });
}

/** Skriv en færdig session.ts med den fundne sti og den gemte session. */
function writeSession(captured: Captured): void {
  const headerLine =
    Object.keys(captured.headers).length > 0
      ? `\nconst EXTRA_HEADERS = ${JSON.stringify(captured.headers, null, 2)};\n`
      : "\nconst EXTRA_HEADERS: Record<string, string> = {};\n";

  const content = `import type {
  AddToCartBody,
  AddToCartResponse,
  CartPoster,
} from "@/lib/bilkatogo/types";
import { chromium } from "playwright";

/**
 * Genereret af scripts/bilkaSetup.ts. Redigér ved at køre npm run bilka:setup
 * igen, eller ret ADD_TO_CART_URL i hånden hvis Bilka skifter version.
 *
 * Leverer en CartPoster oven på en gemt, logget-ind session (.bilka-session.json).
 * Login blev lavet i en rigtig browser; her genbruges kun cookies.
 */

const ADD_TO_CART_URL = ${JSON.stringify(captured.url)};
const STORAGE_STATE = ".bilka-session.json";
${headerLine}
export async function createCartPoster(): Promise<{
  post: CartPoster;
  close: () => Promise<void>;
}> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STORAGE_STATE });

  const post: CartPoster = async (
    body: AddToCartBody,
  ): Promise<AddToCartResponse> => {
    const response = await context.request.post(ADD_TO_CART_URL, {
      data: body,
      headers: EXTRA_HEADERS,
    });
    if (!response.ok()) {
      throw new Error(\`HTTP \${response.status()} \${response.statusText()}\`);
    }
    return (await response.json()) as AddToCartResponse;
  };

  return { post, close: () => browser.close() };
}
`;
  fs.writeFileSync(SESSION_FILE, content, "utf8");
  log(`Skrev ${path.relative(ROOT, SESSION_FILE)} med stien:\n  ${captured.url}`);
}

async function main(): Promise<void> {
  log("Bilka ToGo-opsætning\n");

  if (!fs.existsSync(SESSION_EXAMPLE)) {
    throw new Error(
      "Fandt ikke lib/bilkatogo/session.example.ts. Kør fra harvest-roden.",
    );
  }

  ensureOverrides();

  if (fs.existsSync(SESSION_FILE)) {
    log(
      `\n${path.relative(ROOT, SESSION_FILE)} findes allerede. ` +
        "Sletter du den, genskaber en ny kørsel den.",
    );
    log("Fortsætter med at (gen)fange sti og session.\n");
  }

  const chromium = await ensurePlaywright();

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext(
      fs.existsSync(STORAGE_FILE) ? { storageState: STORAGE_FILE } : undefined,
    );
    const page = await context.newPage();
    await page.goto(START_URL, { waitUntil: "domcontentloaded" });

    log("Et browservindue er åbnet mod bilkatogo.dk.");
    await rl.question(
      "Log ind hvis du ikke allerede er (Gigya). Tryk Enter når du er klar. ",
    );

    const captured = await captureAddCall(context, rl);
    log(`\nFangede add-to-cart-kaldet.`);

    await context.storageState({ path: STORAGE_FILE });
    log(`Gemte sessionen i ${path.relative(ROOT, STORAGE_FILE)}.`);

    writeSession(captured);
  } finally {
    rl.close();
    await browser.close();
  }

  log("\nKører dry-run...\n");
  execSync("npm run bilka:push", { stdio: "inherit" });

  log(
    "\nFærdig. Fyld faste varer i data/bilkatogo-overrides.json ud fra dry-run, " +
      "og kør `npm run bilka:push -- --push` for at lægge en liste i kurven.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
