/**
 * De to regnestykker enhver søgning i Harvest deler.
 *
 * Rene funktioner: ind kommer tekst, ud kommer tekst. Ingen database, intet
 * netværk, ingen React -- saa de kan efterprøves uden at starte noget.
 *
 * Selve filtreringen ligger dér hvor den hører til: retvælgerens egen
 * lib/catalog/picker.ts, som ogsaa kender hovedingredienser og tider. Her
 * staar kun det de har til fælles.
 */

/**
 * Smaa bogstaver, og æ/ø/å skrevet begge veje.
 *
 * Man skal kunne finde "spidskål" ved at taste "spidskaal" -- og omvendt, saa
 * "blomkaal" i søgefeltet ogsaa rammer en ret der hedder "blomkål". Derfor
 * foldes BEGGE sider af sammenligningen gennem den her.
 */
export function foldDanish(value: string): string {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa");
}

/** Trimmer og folder mellemrum. Tom streng betyder "vis alt". */
export function normalizeCatalogQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
