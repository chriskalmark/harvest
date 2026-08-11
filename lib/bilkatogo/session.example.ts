import type {
  AddToCartBody,
  AddToCartResponse,
  CartPoster,
} from "@/lib/bilkatogo/types";

/**
 * Session mod et logget-ind Bilka ToGo.
 *
 * Kopiér denne fil til session.ts (den er git-ignoreret) og udfyld den. Den
 * leverer én ting: en CartPoster, altså en funktion der sender ét add-to-cart-
 * kald fra en session der allerede er logget ind. pushToBilka.ts importerer
 * createCartPoster herfra når du kører med --push.
 *
 * Login klarer du selv. Bilka bruger et Gigya-login, og det skal ikke
 * automatiseres væk. Log ind i en rigtig browser, og lad sessionen bære
 * cookies videre. Intet kodeord hører hjemme i denne fil.
 *
 * Der er to veje. Vælg én.
 */

// ---------------------------------------------------------------------------
// Det sidste, du selv skal fange: add-to-cart-stien
// ---------------------------------------------------------------------------
//
// Kroppen kender vi (product_id, count, fullCart, cartVersion) fra deres
// frontend. Den fulde URL under https://api.bilkatogo.dk/api/shop/vX/... skal
// du læse af ét rigtigt kald, fordi versionen kan skifte:
//
//   1. Log ind på bilkatogo.dk i Chrome.
//   2. Åbn DevTools -> Network, filtrér på "shop".
//   3. Læg én vare i kurven.
//   4. Find kaldet med product_id i kroppen. Kopiér dets fulde URL herind.
//
// Så matcher vores kald browserens eget præcist.
const ADD_TO_CART_URL = "https://api.bilkatogo.dk/api/shop/v7/UDFYLD_STIEN_HER";

// ===========================================================================
// Vej A: Playwright med gemt session (anbefalet)
// ===========================================================================
//
// Kræver playwright som dev-afhængighed:  npm i -D playwright
//
// Engangs-login der gemmer sessionen (kør den selv):
//
//   npx playwright open --save-storage=.bilka-session.json https://www.bilkatogo.dk
//   # log ind i vinduet, luk det. Sessionen ligger nu i .bilka-session.json
//   # .bilka-session.json er allerede i .gitignore
//
// Fordelen: cookies bæres automatisk med, og context.request sender kaldet fra
// selve browser-konteksten, så det ligner et ganske almindeligt klik.

/*
import { chromium } from "playwright";

export async function createCartPoster(): Promise<{
  post: CartPoster;
  close: () => Promise<void>;
}> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: ".bilka-session.json",
  });

  const post: CartPoster = async (
    body: AddToCartBody,
  ): Promise<AddToCartResponse> => {
    const response = await context.request.post(ADD_TO_CART_URL, {
      data: body,
    });
    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()} ${response.statusText()}`);
    }
    return (await response.json()) as AddToCartResponse;
  };

  return { post, close: () => browser.close() };
}
*/

// ===========================================================================
// Vej B: Rå fetch med cookies + basketGUID
// ===========================================================================
//
// Ingen ekstra afhængighed, men du skal selv holde cookie-strengen frisk.
// Kopiér den fra et logget-ind kald i DevTools (Request Headers -> cookie).
// Læg den i .env, aldrig i git.
//
//   BILKA_COOKIE="..."          # hele cookie-strengen fra et request
//
// Skrøbeligere end vej A, fordi cookies udløber. God til en hurtig test.

/*
export async function createCartPoster(): Promise<{
  post: CartPoster;
  close: () => Promise<void>;
}> {
  const cookie = process.env.BILKA_COOKIE;
  if (!cookie) throw new Error("BILKA_COOKIE mangler i miljøet");

  const post: CartPoster = async (
    body: AddToCartBody,
  ): Promise<AddToCartResponse> => {
    const response = await fetch(ADD_TO_CART_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as AddToCartResponse;
  };

  return { post, close: async () => {} };
}
*/

// Fjern denne når du har valgt en vej ovenfor.
export async function createCartPoster(): Promise<{
  post: CartPoster;
  close: () => Promise<void>;
}> {
  void ADD_TO_CART_URL;
  const _unused: [AddToCartBody, AddToCartResponse] | null = null;
  void _unused;
  throw new Error(
    "session.ts er ikke sat op endnu. Kopiér session.example.ts til session.ts, " +
      "vælg vej A eller B, og udfyld add-to-cart-stien.",
  );
}
