import type {
  AddLineResult,
  AddToCartBody,
  CartLine,
  CartPoster,
} from "@/lib/bilkatogo/types";

/**
 * Kurv-laget mod Bilka ToGo.
 *
 * Bilka lægger i kurv én vare ad gangen. Deres eget "bulkAddToCart" er bare en
 * kø der sender ét kald pr. vare. Vi gør det samme: ét kald pr. linje, med den
 * krop deres frontend selv sender.
 *
 * Klienten kender med vilje hverken login, cookies eller basketGUID. Den får en
 * poster udefra der ved hvordan man taler med et logget-ind Bilka. I praksis er
 * det en Playwright-kontekst der allerede har en session (se
 * scripts/pushToBilka.ts). Fordelen: alt herinde kan ræsonneres om og testes
 * uden en session, og hele auth-delen ligger ét sted.
 *
 * Om request-formen: felterne er læst ud af deres frontend. Add-kaldet sender
 * {productId, count, fullCart:0}, og søster-kaldet SetOption afslører at
 * serveren bruger snake_case med cartVersion:6. Det er derfor kroppen ser ud
 * som den gør. Selve stien (/api/shop/vX/...) og en evt. header sætter posteren,
 * fordi den hører sammen med sessionen -- den fanges én gang fra et rigtigt
 * kald (se --discover i scriptet), så det matcher browserens eget kald præcist.
 */

const CART_VERSION = 6;

/** Byg den krop sitet sender for at lægge én vare i kurven. */
export function addToCartBody(line: CartLine): AddToCartBody {
  return {
    product_id: line.productId,
    count: line.count,
    fullCart: 0,
    cartVersion: CART_VERSION,
  };
}

/**
 * Læg én linje i kurven.
 *
 * Fejler aldrig ved at kaste: et fejlet kald skal ikke vælte resten af listen.
 * Resultatet siger om det gik, og bærer Bilkas besked med når der er en (fx en
 * tilbudsgrænse), så den kan vises frem for at forsvinde.
 */
export async function addLine(
  post: CartPoster,
  line: CartLine,
): Promise<AddLineResult> {
  try {
    const response = await post(addToCartBody(line));

    /*
     * Der tjekkes IKKE paa uid.
     *
     * Der stod engang "uid === -1 betyder anonym" her, og det kostede fire
     * runder. Maalt i Chris' egen indloggede browser: uid er -1 OGSAA naar
     * varen lander i den rigtige kurv. Feltet betyder ingenting.
     *
     * Den eneste rigtige proeve er kurven selv -- se laesKurv() i chrome.ts,
     * som koeres efter et push.
     */
    const message = response.offerLimitMessage || response.message || null;
    return { line, ok: true, message, error: null };
  } catch (error) {
    return {
      line,
      ok: false,
      message: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Læg en hel liste i kurven, én ad gangen.
 *
 * Sekventielt med vilje: kurven er en delt server-side tilstand hos Bilka, og
 * parallelle kald ville kappes om den. En lille pause mellem kald holder os på
 * afstand af enhver rate-grænse. Rækkefølgen i svaret følger inputtet.
 */
export async function addLines(
  post: CartPoster,
  lines: CartLine[],
  options: { delayMs?: number } = {},
): Promise<AddLineResult[]> {
  const delayMs = options.delayMs ?? 250;
  const results: AddLineResult[] = [];
  for (const line of lines) {
    results.push(await addLine(post, line));
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}
