import type {
  AddToCartBody,
  AddToCartResponse,
  CartPoster,
} from "@/lib/bilkatogo/types";
import { loginBevis, type HarRequest } from "@/lib/bilkatogo/profil";
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

const BASE_URL =
  "https://api.bilkatogo.dk/api/shop/v6/ChangeLineCount?u=w&fullCart=0";

function urlFor(body: AddToCartBody): string {
  const url = new URL(BASE_URL);
  url.searchParams.set("productId", body.product_id);
  url.searchParams.set("count", String(body.count));
  return url.toString();
}

export async function createChromeCartPoster(): Promise<{
  post: CartPoster;
  close: () => Promise<void>;
}> {
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch {
    throw new Error(
      `Fik ikke fat i en browser på ${CDP_URL}.\n\n` +
        "Luk browseren HELT (⌘Q) og start den med fejlfindingsporten.\n" +
        "Brug den browser hvor du er logget ind på Bilka:\n\n" +
        '  open -a "Brave Browser"   --args --remote-debugging-port=9222\n' +
        '  open -a "Microsoft Edge"  --args --remote-debugging-port=9222\n' +
        '  open -a "Google Chrome"   --args --remote-debugging-port=9222\n\n' +
        "Log ind på bilkatogo.dk, og kør så kommandoen igen.",
    );
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    await browser.close();
    throw new Error("Chrome svarede, men havde ingen vinduer åbne.");
  }
  const context = contexts[0];

  // Samme kontrol som alle andre steder: uid, ikke et tegn paa en side.
  const bevis = await loginBevis(context as unknown as HarRequest);
  if (!bevis.loggetInd) {
    await browser.close();
    throw new Error(
      `Browseren er ikke logget ind på Bilka (uid=${bevis.uid}).\n` +
        "Åbn bilkatogo.dk i DEN browser, log ind, og kør så igen.",
    );
  }

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

  // Browseren lukkes IKKE -- det er hans egen Chrome. Kun forbindelsen.
  return { post, close: () => browser.close() };
}
