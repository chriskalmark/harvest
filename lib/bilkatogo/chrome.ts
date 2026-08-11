import type {
  AddToCartBody,
  AddToCartResponse,
  CartPoster,
} from "@/lib/bilkatogo/types";
import { execSync, spawn } from "node:child_process";
import { chromium } from "playwright";

/**
 * Kurv-poster der bruger DIN EGEN browser.
 *
 * Chrome, Brave eller Edge -- alle tre er Chromium og taler samme
 * fejlfindingsprotokol. Filen hed oprindeligt chrome.ts, fordi Chrome blev
 * antaget; paa maskinen her findes kun Brave og Edge.
 *
 * Baggrund: en Playwright-browser kunne ikke få en Bilka-session. Der blev
 * logget ud og ind, og API'et svarede uid -1 hver gang. Gigya afviser
 * efter alt at dømme den automatiserede browser -- login ser ud til at
 * lykkes i vinduet, men serveren udsteder ingen session.
 *
 * Her forbindes i stedet til den Chrome du allerede sidder med. Det er
 * ikke en kopi af din session; det ER den. Der er intet at logge ind på og
 * intet der kan afvises, fordi det er præcis den browser Bilka allerede
 * har godkendt.
 *
 * Prisen: Chrome skal startes med en fejlfindingsport. Se docs/bilka.md.
 */

const CDP_URL = process.env.CHROME_CDP_URL ?? "http://localhost:9222";
const PORT = Number(new URL(CDP_URL).port || 9222);

/** Chromium-browsere i den raekkefoelge de proeves. Alle taler CDP. */
const BROWSERE = ["Brave Browser", "Google Chrome", "Microsoft Edge"];

function koerer(navn: string): boolean {
  try {
    execSync(`pgrep -f ${JSON.stringify(navn)}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installeret(navn: string): boolean {
  try {
    execSync(`test -d "/Applications/${navn}.app"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function svarerCDP(): Promise<boolean> {
  try {
    const r = await fetch(`${CDP_URL}/json/version`, {
      signal: AbortSignal.timeout(1500),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Start browseren med fejlfindingsporten, hvis den ikke allerede koerer.
 *
 * macOS' `open -a ... --args` virker KUN naar appen er lukket. Koerer den
 * allerede uden porten, bliver flaget stille ignoreret -- derfor siges det
 * hoejt frem for at proeve i blinde.
 */
async function startBrowser(): Promise<string | null> {
  const valgt = BROWSERE.filter(installeret);
  if (valgt.length === 0) return null;

  const allerede = valgt.find(koerer);
  if (allerede) {
    throw new Error(
      `${allerede} kører allerede uden fejlfindingsporten.\n\n` +
        `Luk den HELT med ⌘Q, og kør kommandoen igen -- så starter jeg den selv.\n` +
        "(macOS ignorerer porten, hvis appen allerede er åben.)",
    );
  }

  const navn = valgt[0];
  spawn(
    "open",
    ["-a", navn, "--args", `--remote-debugging-port=${PORT}`],
    { detached: true, stdio: "ignore" },
  ).unref();

  // Browseren skal naa at komme op og aabne porten.
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await svarerCDP()) return navn;
  }
  return null;
}

const BASE_URL =
  "https://api.bilkatogo.dk/api/shop/v6/ChangeLineCount?u=w&fullCart=0";

function urlFor(body: AddToCartBody): string {
  const url = new URL(BASE_URL);
  url.searchParams.set("productId", body.product_id);
  url.searchParams.set("count", String(body.count));
  return url.toString();
}

/**
 * Hvad staar der i kurven paa sitet?
 *
 * Det er den eneste paalidelige proeve. API'ets svar siger 200 OK og
 * rigtige tal, ogsaa naar varen ryger et sted hen ingen kan se.
 */
async function læsKurv(context: {
  newPage(): Promise<{
    goto(u: string, o?: { waitUntil?: string }): Promise<unknown>;
    innerText(s: string): Promise<string>;
    waitForTimeout(n: number): Promise<void>;
    close(): Promise<void>;
  }>;
}): Promise<string> {
  const page = await context.newPage();
  try {
    await page.goto("https://www.bilkatogo.dk/kurv/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);
    const tekst = (await page.innerText("body")).replace(/\s+/g, " ");
    if (/din kurv er tom/i.test(tekst)) return "TOM";
    const beløb = /(\d+[.,]\d{2})\s*(?:kr)?/.exec(tekst)?.[1];
    return beløb ? `${beløb} kr i kurven` : "kurven har indhold";
  } finally {
    await page.close();
  }
}

export async function createChromeCartPoster(): Promise<{
  post: CartPoster;
  læsKurv: () => Promise<string>;
  close: () => Promise<void>;
}> {
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch {
    // Ikke oppe? Start den selv. Det er den friktion der gjorde, at et
    // push mislykkedes, fordi browseren var blevet lukket i mellemtiden.
    const startet = await startBrowser();
    if (startet) {
      console.log(`Startede ${startet} med fejlfindingsporten.`);
      browser = await chromium.connectOverCDP(CDP_URL);
    }
  }

  if (!browser) {
    throw new Error(
      `Fik ikke fat i en browser på ${CDP_URL}.\n\n` +
        "Luk browseren HELT (⌘Q) og kør igen -- så starter jeg den selv.",
    );
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    await browser.close();
    throw new Error("Chrome svarede, men havde ingen vinduer åbne.");
  }
  const context = contexts[0];

  /*
   * Der spaerres IKKE paa uid.
   *
   * Fire runder gik med at afvise pushet, fordi uid var -1. Maalt i Chris'
   * egen indloggede browser: uid er -1 ogsaa naar varen lander i den
   * rigtige kurv. Feltet betyder ingenting, og spaerringen var det eneste
   * der stod i vejen.
   *
   * Sandheden staar i kurven. Den laeses efter pushet.
   */

  const post: CartPoster = async (
    body: AddToCartBody,
  ): Promise<AddToCartResponse> => {
    const response = await context.request.fetch(urlFor(body), {
      method: "POST",
    });
    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()} ${response.statusText()}`);
    }
    return (await response.json()) as AddToCartResponse;
  };

  // Browseren lukkes IKKE -- det er hans egen. Kun forbindelsen.
  return { post, læsKurv: () => læsKurv(context), close: () => browser.close() };
}
