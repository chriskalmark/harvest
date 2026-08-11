import type {
  AddToCartBody,
  AddToCartResponse,
  CartPoster,
} from "@/lib/bilkatogo/types";
import {
  IKKE_LOGGET_IND_BESKED,
  LOGGET_IND,
  profilFindes,
  profilSti,
} from "@/lib/bilkatogo/profil";
import { chromium } from "playwright";

/**
 * EKSEMPEL. Den rigtige session.ts genereres af npm run bilka:setup.
 *
 * Posteren mod Bilkas kurv.
 *
 * Bruger den VEDVARENDE browserprofil, ikke en gemt storageState. Gigya
 * holder sin login-tilstand paa sit eget domaene i en iframe, og den blev
 * tabt af storageState -- sessionen saa gyldig ud, svarede 200 OK, og skrev
 * til en anonym kurv man aldrig kunne se.
 *
 * Endepunktet tager productId og count som QUERY-PARAMETRE, ikke i kroppen.
 * cart.ts bygger en krop; den oversaettes her, fordi traadformen hoerer til
 * sessionen og ikke til kurv-logikken.
 */

const BASE_URL = "https://api.bilkatogo.dk/api/shop/v6/ChangeLineCount?u=w&fullCart=0";

function urlFor(body: AddToCartBody): string {
  const url = new URL(BASE_URL);
  url.searchParams.set("productId", body.product_id);
  url.searchParams.set("count", String(body.count));
  return url.toString();
}

export async function createCartPoster(): Promise<{
  post: CartPoster;
  close: () => Promise<void>;
}> {
  if (!profilFindes()) throw new Error(IKKE_LOGGET_IND_BESKED);

  const context = await chromium.launchPersistentContext(profilSti(), {
    headless: true,
  });

  /*
   * Sitet aabnes én gang foer der pushes.
   *
   * To grunde: appens egen opstart fornyer sessionen, og vi kan se om vi
   * overhovedet er logget ind. Bilka svarer nemlig 200 OK paa kurv-kald,
   * selv naar man ikke er -- varen ryger bare et sted hen, ingen kan se.
   * Det kostede en runde hvor "19/19 lagt i" stod over en tom kurv.
   */
  const page = await context.newPage();
  await page.goto("https://www.bilkatogo.dk/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  const tekst = await page.innerText("body");
  if (!LOGGET_IND.test(tekst)) {
    await context.close();
    throw new Error(IKKE_LOGGET_IND_BESKED);
  }
  await page.close();

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

  return { post, close: () => context.close() };
}
