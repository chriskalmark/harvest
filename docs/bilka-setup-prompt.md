# Prompt til Claude Code: Bilka ToGo-integration i Harvest

Kopiér alt herunder ind i Claude Code i harvest-roden.

---

Byg en funktion i denne app der tager en indkøbsliste og lægger varerne i kurven på bilkatogo.dk. Følg specen nedenfor. Nogle af filerne findes måske allerede fra en tidligere session. Denne spec er kilden: opret det der mangler, og bring eksisterende filer i overensstemmelse med den frem for at lave dubletter.

## Konventioner

Følg mønsteret i `lib/skagenfood/`: et tyndt netværkslag med retries og timeout, wire-typer adskilt fra domænetyper, og tests der måler mod virkeligheden. Scripts ligger i `scripts/` og køres med tsx. Brug `@/`-aliaset til imports i `lib/`. Alt skal type-tjekke i strict mode.

Prosa i kommentarer, commits og docs: dansk, ingen em-dashes, ingen AI-fyld ("spiller en central rolle", "det er værd at bemærke"), ingen rule of three. Commits i imperativ og specifik. Selve koden er som altid engelsk.

## Fakta om Bilka ToGo

Søgning og kurv er to forskellige systemer.

Søgning er en offentlig Algolia-instans, virker uden login. App-id `F9VBJLR1BK`, søge-only nøgle `1deaf41c87e729779f7695c00f190cc9`, index `prod_BILKATOGO_PRODUCTS`, endpoint `https://F9VBJLR1BK-dsn.algolia.net/1/indexes/prod_BILKATOGO_PRODUCTS/query`. Send `{query, hitsPerPage, filters: "nonsearchable:false"}`. Nøglen skjuler de fleste felter: et hit har kun `objectID` og `_highlightResult`. Produktnavnet står i `_highlightResult.name.value` med `<em>`-markering der skal fjernes. `objectID` er produkt-id'et kurven skal bruge.

Kurven er Bilkas eget API bag et Gigya-login (accounts.eu1.gigya.com). Kurven er server-side, keyed på cookies. Et add-to-cart-kald lægger én vare ad gangen: POST til `https://api.bilkatogo.dk/api/shop/vX/...` med kroppen `{product_id, count, fullCart: 0, cartVersion: 6}`. Den fulde sti (v-nummeret) skal fanges fra ét rigtigt kald, fordi den kan skifte.

Login må ikke automatiseres, og der må aldrig indtastes kodeord. Brugeren logger selv ind i en rigtig browser, og sessionen genbruges via en gemt storageState.

## Filer

`lib/bilkatogo/types.ts`
Wire-typer for Algolia-svaret (`WireProductHit` med `objectID` og `_highlightResult`, `WireSearchResponse`). Domænetyper: `ProductMatch` (productId, name, rank), `ShoppingMatch` (query, count, source: "override" | "search" | "none", match, alternatives), `CartLine`, `AddLineResult`, `CartPoster` (funktion der sender ét kald), `AddToCartBody` (`product_id`, `count`, `fullCart`, `cartVersion`), `AddToCartResponse` (`offerLimitMessage?`, `message?`).

`lib/bilkatogo/algolia.ts`
`searchProducts(query, options?)`: POST til Algolia-endpointet med app-id og nøgle i headers og `nonsearchable:false` som filter. Retry op til 3 gange med backoff, timeout. Fjern `<em>` fra navnet. Spring hits uden `objectID` over. Returnér `ProductMatch[]`, bedste hit først (rank 0). Tom liste når intet findes. Egen fejltype `BilkatogoSearchError`.

`lib/bilkatogo/matching.ts`
`parseCount(q)`: kun et ledende heltal er stykantal ("2", "2 stk", "3 pakker" giver tallet). Vægt og volumen ("500 g", "1,5 l", "1 kg") er ikke stykantal og giver 1. Manglende eller fritekst giver 1. `normalizeKey(name)`: trimmet og små bogstaver, samme form for mapping og opslag. `OverrideMap = Record<string, string>` fra normaliseret varenavn til produkt-id. `matchLine(line, overrides)`: override vinder og springer søgning over; ellers søg, bedste hit bliver valget og resten alternativer; intet hit giver source "none" og match null. `matchList` kører sekventielt. `matchedProductIds(matches)` giver kun de matches der kan lægges i kurven.

`lib/bilkatogo/cart.ts`
Transport-agnostisk. Kender ikke cookies eller login, får en `CartPoster` udefra. `addToCartBody(line)` bygger kroppen med `cartVersion: 6`. `addLine(post, line)` kaster aldrig; returnerer et resultat med ok, Bilkas besked (`offerLimitMessage` eller `message`) og evt. fejl. `addLines(post, lines, options?)` kører sekventielt med en lille pause mellem kald, fordi kurven er delt server-side tilstand.

`lib/bilkatogo/report.ts`
`formatMatchReport(matches)`: læsbar terminal-opsummering der gør tvivl synlig. Faste varer kort, søgetræf med alternativer og deres id'er klar til at kopiere til override-filen, varer uden hit for sig. `formatPushReport(results)`: hvor mange kom i kurven, beskeder og fejl.

`lib/bilkatogo/session.example.ts`
Dokumentation af hvordan man leverer en `createCartPoster()`. Beskriv to veje: Playwright med gemt session (anbefalet) og rå fetch med cookie i miljøet. Forklar at add-to-cart-stien fanges fra ét rigtigt kald. Denne fil er kun skabelon; den rigtige `session.ts` genereres af setup-scriptet og er git-ignoreret.

`scripts/testBilkatogoSearch.ts`
Test kørt med tsx. Rene funktioner uden netværk: `parseCount`, `normalizeKey`, `addToCartBody`, override-vej. Ægte søgning mod Algolia: kendte danske varer (letmælk, rugbrød, æg, smør) skal give hits med produkt-id, en meningsløs streng skal give nul hits. En lille liste ende til ende hvor en vare uden hit bliver "none" og ikke får et gættet id.

`scripts/pushToBilka.ts`
Orkestrator. Dry-run som standard: match hele listen og vis rapporten uden at røre kurven. `--push` lægger de matchede varer i kurven via `session.ts`. `--file <sti>` for en liste (JSON: `[{ "n": "letmælk", "q": "2" }]`), ellers en indbygget sample-liste. `--overrides <sti>`, ellers `data/bilkatogo-overrides.json` hvis den findes. `loadOverrides` springer nøgler der starter med `_` og tomme værdier over. Hent `createCartPoster` fra `session.ts` med et dynamisk import hvor modulnavnet er en `string`-typet variabel, så en manglende (git-ignoreret) `session.ts` ikke er en type-fejl; tjek filens eksistens først og giv en klar besked hvis den mangler.

`scripts/bilkaSetup.ts`
Én kommando der gør alt det mekaniske. I rækkefølge: opret `data/bilkatogo-overrides.json` fra eksemplet hvis den mangler. Sørg for Playwright (dynamisk import med `string`-typet navn så filen type-tjekker uden pakken; installér `playwright` og `npx playwright install chromium` hvis importet fejler). Åbn et headed browservindue mod bilkatogo.dk, indlæs eksisterende `.bilka-session.json` hvis den findes. Bed brugeren logge ind og trykke Enter. Sæt derefter en request-listener, bed brugeren lægge én vare i kurven, og fang det første POST-kald til `api.bilkatogo.dk` under `/shop/` hvor kroppen indeholder `product_id`. Gem storageState i `.bilka-session.json`. Generér `lib/bilkatogo/session.ts` med den fundne URL og eventuelle `x-`-headers fra kaldet, som en fungerende Playwright-baseret `createCartPoster()`. Kør til sidst `npm run bilka:push` som dry-run. Brug node:readline/promises til prompterne. Rør aldrig login eller kodeord.

`.claude/commands/bilka-setup.md`
En Claude Code-kommando `/bilka-setup` der kører `npm run bilka:setup`, videregiver de to interaktive trin (login, læg én vare i kurven) til brugeren uden at automatisere dem, og til sidst minder om at fylde faste varer i override-filen og køre `npm run bilka:push -- --push`.

`data/bilkatogo-overrides.example.json`
Eksempel på faste varer: normaliseret varenavn til produkt-id, med en `_comment`-nøgle der forklarer formatet.

## package.json og .gitignore

Tilføj scripts: `"test:bilka": "tsx scripts/testBilkatogoSearch.ts"`, `"bilka:setup": "tsx scripts/bilkaSetup.ts"`, `"bilka:push": "tsx scripts/pushToBilka.ts"`.

Tilføj til .gitignore: `lib/bilkatogo/session.ts`, `.bilka-session.json`, `data/bilkatogo-overrides.json`.

## Til sidst

Type-tjek alt (uden at Playwright er installeret og uden at `session.ts` findes endnu skal det være rent). Kør `npm run test:bilka` mod det ægte API. Kør derefter `npm run bilka:setup` og følg dens to interaktive trin. Bekræft at `lib/bilkatogo/session.ts` og `.bilka-session.json` blev oprettet, og at dry-runnen fandt produkt-id'er.
