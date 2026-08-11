import fs from "node:fs";
import path from "node:path";

/**
 * Hvorfor siger Bilka ja, når kurven bliver tom?
 *
 * pushToBilka meldte "19/19 lagt i, 0 fejlede", og kurven på sitet var tom.
 * Grunden er, at succes blev målt på HTTP-status alene: response.ok() er sand
 * for alt i 200-serien, og et API kan sagtens svare 200 med "nej" i kroppen.
 *
 * Det her script gætter ikke. Det laver ÉT kald og skriver alt frem:
 * status, svar-headers og hele kroppen. Så kan vi se hvad Bilka rent faktisk
 * siger, i stedet for at læse to felter og håbe.
 *
 * Kør:  npx tsx scripts/bilkaDiagnose.ts [produktId]
 */

const STORAGE = ".bilka-session.json";
const PRODUKT = process.argv[2] ?? "20824"; // solsikkerugbrød

const PLAYWRIGHT = "playwright";

interface PwResponse {
  status(): number;
  statusText(): string;
  headers(): Record<string, string>;
  text(): Promise<string>;
}
interface PwRequestCtx {
  fetch(
    url: string,
    opts: { method?: string; headers?: Record<string, string> },
  ): Promise<PwResponse>;
}
interface PwCtx {
  request: PwRequestCtx;
  newPage(): Promise<{ goto(u: string): Promise<unknown> }>;
  cookies(): Promise<{ name: string; domain: string }[]>;
}
interface PwBrowser {
  newContext(o?: { storageState?: string }): Promise<PwCtx>;
  close(): Promise<void>;
}

function url(produktId: string, count: number): string {
  const u = new URL("https://api.bilkatogo.dk/api/shop/v6/ChangeLineCount");
  u.searchParams.set("u", "w");
  u.searchParams.set("productId", produktId);
  u.searchParams.set("count", String(count));
  u.searchParams.set("fullCart", "0");
  return u.toString();
}

async function main(): Promise<void> {
  if (!fs.existsSync(path.join(process.cwd(), STORAGE))) {
    throw new Error(`Fandt ikke ${STORAGE}. Kør npm run bilka:setup først.`);
  }

  const { chromium } = (await import(PLAYWRIGHT)) as {
    chromium: {
      launch(o?: { headless?: boolean }): Promise<PwBrowser>;
    };
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STORAGE });

  try {
    const cookies = await context.cookies();
    const bilka = cookies.filter((c) => c.domain.includes("bilkatogo"));
    console.log(
      `Session: ${bilka.length} bilkatogo-cookies (${bilka.map((c) => c.name).join(", ")})\n`,
    );

    /*
     * Besøg forsiden først.
     *
     * Mistanken: kurven hænger på en kurv-id, som sitet udsteder når man
     * lander på det, og som IKKE ligger i de gemte cookies. Et rent
     * API-kald uden det besøg ville så skrive til en kurv, ingen kan se.
     * Vi prøver begge veje og sammenligner.
     */
    for (const medBesøg of [false, true]) {
      if (medBesøg) {
        console.log("--- efter et besøg på forsiden ---");
        const page = await context.newPage();
        await page.goto("https://www.bilkatogo.dk/");
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.log("--- rent API-kald, uden at have besøgt sitet ---");
      }

      for (const metode of ["POST", "GET"]) {
        const svar = await context.request.fetch(url(PRODUKT, 1), {
          method: metode,
        });
        const krop = await svar.text();
        console.log(
          `  ${metode.padEnd(4)} ${svar.status()} ${svar.statusText()}  ` +
            `krop(${krop.length}): ${krop.slice(0, 400)}`,
        );
      }
      console.log();
    }
  } finally {
    await browser.close();
  }
}

main().catch((f: unknown) => {
  console.error(f instanceof Error ? f.message : String(f));
  process.exitCode = 1;
});
