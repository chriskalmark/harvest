import type { ShoppingLineInput } from "@/lib/bilkatogo/matching";

/**
 * Ugens indkøbsliste hentet fra Harvest, klar til Bilka-matchning.
 *
 * Hvorfor /api/ugeplan/indkoeb og ikke /api/mealplan/shopping:
 *
 *   Den gamle rute har ingen GET -- kun POST, PUT, DELETE og PATCH. Den
 *   ÆNDRER den gamle indkøbsliste, den udleverer den ikke. Og den serverer
 *   den gamle madplan (meal_plans), som ugeplanlæggeren aldrig skriver til.
 *   Den liste man rent faktisk skal handle efter -- med halvfabrikata foldet
 *   ud og varerne i Nettos rækkefølge -- ligger på ugeplanens rute.
 *
 * Hvorfor et service-token:
 *
 *   Harvest ligger bag Cloudflare Access. Et script har ingen browser og kan
 *   ikke gennemføre et Access-login; uden token får man login-siden tilbage i
 *   stedet for listen. Access' egen løsning på netop det er et service-token,
 *   som sendes med som to headere.
 *
 * Tokenet er IKKE det samme som Bilka-sessionen. Access afgør om man må se
 * madplanen; Bilka-sessionen afgør om man må lægge noget i deres kurv. De
 * har intet med hinanden at gøre og må ikke blandes sammen.
 */

export interface UgelisteValg {
  /** Mandagens dato, ÅÅÅÅ-MM-DD. */
  uge: string;
  /** Fx https://mad.lmar.io */
  base: string;
  /** Tag også "tjek skabet" med. Standard: nej -- det er ikke indkøb. */
  medSkabet?: boolean;
  /** Tag også det man allerede har krydset af. Standard: nej. */
  medKlarede?: boolean;
}

interface ApiVare {
  navn?: unknown;
  mængde?: unknown;
  checked?: unknown;
}

interface ApiSvar {
  data?: {
    indkøb?: {
      weekLabel?: unknown;
      liste?: {
        afsnit?: { zone?: unknown; varer?: ApiVare[] }[];
        skabet?: ApiVare[];
      };
    };
  };
  error?: unknown;
}

function accessHeadere(): Record<string, string> {
  const id = process.env.CF_ACCESS_CLIENT_ID?.trim();
  const secret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();
  if (!id || !secret) return {};
  return { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret };
}

export function harAccessToken(): boolean {
  return Object.keys(accessHeadere()).length === 2;
}

function tilLinje(vare: ApiVare): ShoppingLineInput | null {
  const navn = typeof vare.navn === "string" ? vare.navn.trim() : "";
  if (!navn) return null;
  const mængde = typeof vare.mængde === "string" ? vare.mængde.trim() : "";
  return mængde ? { n: navn, q: mængde } : { n: navn };
}

export interface Ugeliste {
  ugeTitel: string;
  linjer: ShoppingLineInput[];
}

/**
 * Henter ugen. Rækkefølgen fra API'et beholdes -- den er Nettos gå-rækkefølge,
 * og selvom Bilka ToGo ikke bruger den til noget, gør den dry-run-rapporten
 * læsbar i den rækkefølge man kender listen.
 */
export async function hentUgeliste(valg: UgelisteValg): Promise<Ugeliste> {
  const url = new URL("/api/ugeplan/indkoeb", valg.base);
  url.searchParams.set("uge", valg.uge);

  const svar = await fetch(url, {
    headers: { Accept: "application/json", ...accessHeadere() },
    redirect: "manual",
  });

  // Access svarer 302 til sit login, ikke 401. Uden det her fik man en
  // JSON-parsefejl på en HTML-side og skulle selv gætte hvorfor.
  if (svar.status >= 300 && svar.status < 400) {
    throw new Error(
      harAccessToken()
        ? "Cloudflare Access afviste service-tokenet. Har politikken en Service Auth-regel for det token?"
        : "Cloudflare Access spærrer. Lav et service-token i Zero Trust og sæt CF_ACCESS_CLIENT_ID og CF_ACCESS_CLIENT_SECRET.",
    );
  }

  if (!svar.ok) {
    throw new Error(`Harvest svarede ${svar.status} ${svar.statusText}.`);
  }

  const krop = (await svar.json()) as ApiSvar;
  const indkøb = krop.data?.indkøb;
  if (!indkøb?.liste) {
    throw new Error(
      typeof krop.error === "string"
        ? krop.error
        : "Harvest svarede uden en indkøbsliste.",
    );
  }

  const varer: ApiVare[] = [];
  for (const afsnit of indkøb.liste.afsnit ?? []) {
    varer.push(...(afsnit.varer ?? []));
  }
  if (valg.medSkabet) varer.push(...(indkøb.liste.skabet ?? []));

  const linjer = varer
    .filter((vare) => (valg.medKlarede ? true : vare.checked !== true))
    .map(tilLinje)
    .filter((linje): linje is ShoppingLineInput => linje !== null);

  return {
    ugeTitel:
      typeof indkøb.weekLabel === "string" ? indkøb.weekLabel : valg.uge,
    linjer,
  };
}
