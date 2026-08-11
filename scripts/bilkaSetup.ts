import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  LOGGET_IND,
  PROFIL_MAPPE,
  profilFindes,
  profilSti,
} from "../lib/bilkatogo/profil";

/**
 * Log ind på Bilka ToGo én gang.
 *
 * Kør: npm run bilka:setup
 *
 * Herefter kører `npm run bilka:push -- --push` uden vindue og uden
 * spørgsmål, indtil Bilka selv lader sessionen udløbe.
 *
 * DEN VIGTIGE FORSKEL fra første udgave: der gemmes en rigtig
 * browserprofil, ikke en storageState. Bilkas login går gennem Gigya, som
 * holder sin tilstand på sit eget domæne i en iframe -- storageState tager
 * kun de origins browseren selv besøgte, så login blev tabt. Sessionen så
 * gyldig ud, svarede 200 OK på alt, og skrev til en anonym kurv. Pushet
 * meldte "19/19 lagt i" over en kurv der stod tom.
 *
 * Derfor kontrolleres login her, i stedet for at blive antaget. Et tryk på
 * Enter er ikke et bevis.
 *
 * Scriptet rører aldrig dit kodeord eller loginfelterne. Du logger ind
 * selv, i et rigtigt browservindue.
 */

const ROOT = process.cwd();
const OVERRIDES_FILE = path.join(ROOT, "data/bilkatogo-overrides.json");
const OVERRIDES_EXAMPLE = path.join(
  ROOT,
  "data/bilkatogo-overrides.example.json",
);
const START_URL = "https://www.bilkatogo.dk/";
const PLAYWRIGHT = "playwright";

interface PwPage {
  goto(url: string, opts?: { waitUntil?: string }): Promise<unknown>;
  reload(opts?: { waitUntil?: string }): Promise<unknown>;
  innerText(selector: string): Promise<string>;
  waitForTimeout(ms: number): Promise<void>;
}
interface PwContext {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
interface Chromium {
  launchPersistentContext(
    dir: string,
    opts?: { headless?: boolean },
  ): Promise<PwContext>;
}

function log(msg: string): void {
  console.log(msg);
}

function ensureOverrides(): void {
  if (fs.existsSync(OVERRIDES_FILE)) return;
  if (!fs.existsSync(OVERRIDES_EXAMPLE)) return;
  fs.copyFileSync(OVERRIDES_EXAMPLE, OVERRIDES_FILE);
  log(`Oprettede ${path.relative(ROOT, OVERRIDES_FILE)} fra eksemplet.`);
}

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

/** Er profilen allerede logget ind? Så skal der ikke spørges om noget. */
async function alleredeLoggetInd(chromium: Chromium): Promise<boolean> {
  if (!profilFindes()) return false;

  const context = await chromium.launchPersistentContext(profilSti(), {
    headless: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(START_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    return LOGGET_IND.test(await page.innerText("body"));
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  log("Bilka ToGo-opsætning\n");
  ensureOverrides();

  const chromium = await ensurePlaywright();

  log("Tjekker om du allerede er logget ind...");
  if (await alleredeLoggetInd(chromium)) {
    log("Du ER logget ind. Der er ikke mere at gøre.\n");
    log("Kører dry-run...\n");
    execSync("npm run bilka:push", { stdio: "inherit" });
    return;
  }

  log("Ikke logget ind. Åbner et browservindue.\n");

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const context = await chromium.launchPersistentContext(profilSti(), {
    headless: false,
  });

  try {
    const page = await context.newPage();
    await page.goto(START_URL, { waitUntil: "domcontentloaded" });

    log("Der er åbnet et browservindue mod bilkatogo.dk.");
    log("Log ind i DET vindue -- ikke i Chrome eller Safari.\n");

    for (;;) {
      await rl.question("Tryk Enter når du er logget ind. ");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      if (LOGGET_IND.test(await page.innerText("body"))) {
        log("\nBekræftet: du er logget ind. Profilen er gemt.");
        break;
      }

      log(
        "\nSiden viser dig stadig som IKKE logget ind.\n" +
          "Fortsatte vi nu, ville varerne ryge i en anonym kurv, du aldrig\n" +
          "kan se -- og pushet ville melde succes alligevel. Log ind i\n" +
          "browservinduet, og tryk så Enter igen.\n",
      );
    }
  } finally {
    rl.close();
    await context.close();
  }

  log(
    `\nProfilen ligger i ${PROFIL_MAPPE}/ og bliver liggende. ` +
      "Herefter kører push uden vindue.\n",
  );
  log("Kører dry-run...\n");
  execSync("npm run bilka:push", { stdio: "inherit" });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
