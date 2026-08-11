import { loginBevis, profilSti, type HarRequest } from "../lib/bilkatogo/profil";

/**
 * Log ind i automatiseringsbrowseren, og se det ske.
 *
 * Baggrund: Chris siger han er logget ind, profilen siger uid -1, og vi har
 * skiftedes til at have ret i fire runder. Diskussionen skyldes, at vi kigger
 * på hver sin ting -- han på et vindue, scriptet på et API-svar.
 *
 * Her opdateres tilstanden hvert andet sekund, mens vinduet står åbent. Så
 * kan man SE om den skifter, når man logger ind, i stedet for at trykke
 * Enter og få et ja eller nej bagefter.
 *
 * Kør: npx tsx scripts/bilkaLogin.ts
 */

const PLAYWRIGHT = "playwright";
const START = "https://www.bilkatogo.dk/";

interface Ctx extends HarRequest {
  newPage(): Promise<{
    goto(u: string, o?: { waitUntil?: string }): Promise<unknown>;
    innerText(s: string): Promise<string>;
  }>;
  close(): Promise<void>;
}

async function main(): Promise<void> {
  const { chromium } = (await import(PLAYWRIGHT)) as {
    chromium: {
      launchPersistentContext(
        d: string,
        o?: { headless?: boolean },
      ): Promise<Ctx>;
    };
  };

  const ctx = await chromium.launchPersistentContext(profilSti(), {
    headless: false,
  });

  console.log(
    "\nBrowservinduet er åbent. Log ind DÉR.\n" +
      "Status opdateres hvert 2. sekund. Luk vinduet når der står LOGGET IND.\n",
  );

  const page = await ctx.newPage();
  await page.goto(START, { waitUntil: "domcontentloaded" });

  let sidste = "";
  for (let i = 0; i < 300; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));

    let logInd = "?";
    try {
      logInd = /log ind/i.test(await page.innerText("body")) ? "ja" : "nej";
    } catch {
      // Vinduet kan vaere lukket eller midt i en navigation.
      break;
    }

    const bevis = await loginBevis(ctx);
    const linje = `uid=${bevis.uid}  'Log ind' på siden=${logInd}  ->  ${
      bevis.loggetInd ? "LOGGET IND" : "anonym"
    }`;

    if (linje !== sidste) {
      console.log(`  ${new Date().toLocaleTimeString("da-DK")}  ${linje}`);
      sidste = linje;
    }

    if (bevis.loggetInd) {
      console.log(
        "\nLogget ind. Profilen er gemt i " +
          `${profilSti()}\nDu kan lukke vinduet og køre: npm run bilka:push -- --push\n`,
      );
      break;
    }
  }

  await ctx.close();
}

main().catch((f: unknown) => {
  console.error(f instanceof Error ? f.message : String(f));
  process.exitCode = 1;
});
