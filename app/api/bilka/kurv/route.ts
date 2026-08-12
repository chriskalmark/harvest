import { NextRequest } from "next/server";
import { createRouteHandler } from "@/lib/apiUtils";
import { matchList } from "@/lib/bilkatogo/matching";
import { loadOverrides } from "@/lib/bilkatogo/overrides";
import { getShoppingList } from "@/lib/services/weekPlanShoppingService";
import {
  husstandFraRequest,
  weekFromQuery,
  withWeekPlanErrors,
} from "@/lib/weekPlan/apiSupport";

/**
 * GET /api/bilka/kurv?uge=2026-08-10
 *
 * Ugens indkøbsliste oversat til Bilka-produkter, klar til at blive lagt i
 * kurven af browseren selv.
 *
 * HVORFOR SVARET ER ADRESSER OG IKKE EN HANDLING:
 *
 * Serveren kan ikke lægge noget i kurven. Kurven hænger på Chris' egen
 * Bilka-session, som kun findes i hans browser -- en server har ingen
 * adgang til den, og et forsøg ville ryge i en anonym kurv.
 *
 * Browseren kan derimod godt. Navigerer den til kurv-adressen, er den
 * førstepart hos Bilka, cookien sendes, og varen lander i den rigtige
 * kurv. Målt: kurven gik fra 708,35 til 719,35 ved en ren navigation fra
 * et fremmed domæne. Et baggrundskald fra samme side blev derimod
 * blokeret -- derfor NAVIGATION, ikke fetch.
 *
 * Serveren gør det browseren ikke kan: slår 19 varenavne op i Bilkas
 * søgning og regner antal pakker ud. Det er et opslag pr. vare, og det
 * skal ikke ligge i en telefon.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KURV_URL = "https://api.bilkatogo.dk/api/shop/v6/ChangeLineCount";

function kurvAdresse(productId: string, antal: number): string {
  const url = new URL(KURV_URL);
  url.searchParams.set("u", "w");
  url.searchParams.set("productId", productId);
  url.searchParams.set("count", String(antal));
  url.searchParams.set("fullCart", "0");
  return url.toString();
}

export const GET = createRouteHandler(async (request: NextRequest) => {
  const husstand = await withWeekPlanErrors(() => husstandFraRequest(request));

  const indkøb = await withWeekPlanErrors(() =>
    getShoppingList({ husstand, week: weekFromQuery(request) }),
  );

  /*
   * Kun det der IKKE er krydset af.
   *
   * Har man allerede taget agurken fra køleskabet, skal den ikke i kurven.
   * Det er den samme regel som eksporten til Påmindelser bruger.
   */
  const linjer = indkøb.liste.afsnit
    .flatMap((afsnit) => afsnit.varer)
    .filter((vare) => !vare.checked)
    .map((vare) => ({ n: vare.navn, q: vare.mængde ?? undefined }));

  if (linjer.length === 0) {
    return {
      bilka: {
        weekStart: indkøb.weekStart,
        weekLabel: indkøb.weekLabel,
        varer: [],
        uden: [],
      },
    };
  }

  const matches = await matchList(linjer, loadOverrides());

  const varer = matches
    .filter((m) => m.match)
    .map((m) => ({
      navn: m.query,
      produktId: m.match!.productId,
      produktNavn: m.match!.name,
      antal: m.count,
      hvorfor: m.countBegrundelse ?? null,
      url: kurvAdresse(m.match!.productId, m.count),
    }));

  const uden = matches.filter((m) => !m.match).map((m) => m.query);

  return {
    bilka: {
      weekStart: indkøb.weekStart,
      weekLabel: indkøb.weekLabel,
      varer,
      uden,
      kurvUrl: "https://www.bilkatogo.dk/kurv/",
      loginUrl: "https://www.bilkatogo.dk/",
    },
  };
});
