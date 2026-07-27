# Harvest — dansk HelloFresh-udgave

**Dato:** 2026-07-27
**Repo:** `chriskalmark/harvest` (fork af `SGShuman/tjs-meal-planner`)
**Status:** designet godkendt, klar til implementeringsplan

---

## Formål

Den oprindelige app er bygget til ét ugentligt indkøb i Trader Joe's for to voksne, med ingredienslister og bevidst *ingen* opskrifter. Vi beholder grundidéen — én uge, én indkøbstur, ingen dags-tvang — og udskifter tre ting: butikken bliver Netto, retterne bliver HelloFresh-agtige med trin-for-trin opskrifter, og udseendet bliver et andet.

Målgruppen er to voksne i én husstand. Appen er privat, har ingen konti og skal aldrig sælge noget.

## Beslutninger

| Emne | Valg |
|---|---|
| Repo | Fork på `chriskalmark/harvest`, klonet til `~/Documents/code/harvest` |
| Ugeform | Flad liste uden dage: 1 morgenmad, 1 frokost, **4 aftensmader** |
| Portioner | Pr. ret, standard **2**. Indkøbslisten skalerer efter portionstal |
| Opskrifter | AI-genereret i HelloFresh' tonefald af det ugentlige agent-workflow. Ikke skrabet fra HelloFresh |
| Butik | Netto |
| Sprog | Dansk, i UI såvel som indhold. Intet i18n-bibliotek |
| Billeder | Genereret med nanobanana ved forfatter-tid, ikke af appen |
| Udseende | Grøn flade + hvid plade + runde madfotos. Se `.impeccable.md` |

### Fravalg med begrundelse

- **Dags-baseret uge (man-fre)** blev valgt fra. Portionstal løser det samme problem uden at genindføre det dags-begreb, forfatteren bevidst fjernede, og uden at røre tre skærme.
- **Skrabning af HelloFresh' opskrifter** er fravalgt: ophavsretligt beskyttet materiale, i strid med deres brugsvilkår, og teknisk skrøbeligt. HelloFresh er stilreference, ikke kilde.
- **i18n-lag** er fravalgt. Privat app til to mennesker på ét sprog; et oversættelseslag ville være rent overhead.
- **E-handelsgreb** fra den visuelle reference (priser, "læg i kurv", stjerneratings) er fravalgt. Der købes ingenting i appen.

---

## Arkitektur

### Datamodel — migration `003`

Den bærende ændring. `meals.ingredients` er i dag en JSONB-liste af rene produktnavne uden mængder, og det er derfor, portionsskalering ikke kan lade sig gøre i dag.

Hver ingrediens bliver et objekt:

```json
{ "navn": "kyllingelår", "maengde": 150, "enhed": "g", "zone": "Kød & fjerkræ" }
```

`maengde` er **pr. portion**. `enhed` er en fast liste: `g`, `kg`, `ml`, `l`, `stk`, `dl`, `tsk`, `spsk`, `bundt`, `dåse`, `pakke`.

Nye kolonner på `meals`:

| Kolonne | Type | Formål |
|---|---|---|
| `servings` | `INTEGER NOT NULL DEFAULT 2` | Portionstal for retten |
| `steps` | `JSONB NOT NULL DEFAULT '[]'` | Nummereret opskrift, 5-7 trin |
| `image_url` | `TEXT` | Relativ sti, f.eks. `/meals/cremet-kylling.webp`. Må være `NULL` |

Det seedede Trader Joe's-demodata smides væk i samme migration. Det har ingen værdi for denne husstand, og det gamle ingrediensformat kan ikke konverteres, fordi mængderne aldrig har eksisteret.

### Indkøbsliste

`lib/domain/shoppingListDerivation.ts` og `shoppingUsage.ts` skal regne, ikke bare gruppere:

1. For hver ret: gang hver ingrediens' `maengde` med rettens `servings`
2. Læg ens ingredienser sammen på tværs af ugens retter, når `navn` **og** `enhed` matcher
3. Gruppér efter `zone` og sortér zonerne efter `STORE_CATEGORY_ORDER`

Ingredienser med forskellig enhed for samme navn lægges *ikke* sammen — de bliver til to linjer. Det er med vilje: 2 fed hvidløg og 10 g hvidløg skal ikke slås sammen til et gæt.

### Nettos gå-rækkefølge

`STORE_CATEGORY_ORDER` i `lib/constants.ts` og beskrivelserne i `data/shopping-areas.md` udskiftes med:

```
Frugt & grønt → Brød → Køl (mejeri, æg) → Ost & pålæg → Kød & fjerkræ →
Fisk → Kolonial → Frost → Drikkevarer → Slik & snacks → Non-food
```

### Ugeform

`EXPECTED_MEAL_COUNTS` bliver `{ Breakfast: 1, Lunch: 1, Dinner: 4 }`. Den er allerede "single source of truth" i koden, så tallet kan ændres ét sted.

**Måltidstyperne beholder deres engelske værdier i databasen** (`Breakfast`, `Lunch`, `Dinner`) og oversættes kun ved visning. At omdøbe dem ville kræve en datamigrering af `meals.meal_type` for at spare en oversættelse tre steder i UI'et — dårlig handel.

Ingrediensens `zone` skal derimod være en værdi fra `STORE_CATEGORY_ORDER` på dansk, da den er ren indholdsdata og aldrig sammenlignes med noget engelsk.

---

## Indhold

`data/diner-preferences.md` skrives om til denne husstand: 2 personer, 450-550 kcal pr. måltid, proteinrotation og tidsrammer efter brugerens smag. Det er reelt her, husstandens præferencer bor — filen er agentens input.

`data/meal-plan-skill.md` — kontrakten det ugentlige agent-workflow arbejder efter — udvides til at kræve:

- Mængde og enhed på **hver** ingrediens, pr. portion
- Zone på hver ingrediens, fra Netto-listen
- 5-7 nummererede trin på dansk i HelloFresh' tonefald: korte sætninger, parallelisering indbygget ("Imens pastaen koger, snit løget"), bydeform
- Trinene skrevet til husstandens udstyr og tidsramme, ikke generiske

`data/shopping-areas.md` og `data/companion-preferences.md` oversættes og tilpasses Netto.

---

## Udseende

Fuld designkontekst ligger i `.impeccable.md` i projektroden. Kort fortalt:

- **Grøn som dominerende flade**, ikke som accentfarve. Hvid plade lagt ovenpå, runde madfotos der bryder kanten mellem de to
- **Typografi:** Gabarito til retternes navne og tal, Schibsted Grotesk til brødtekst og UI. Fraunces og Plus Jakarta Sans fjernes
- **Farve i OKLCH**, neutrale flader tonet mod den grønne hue. Varm apricot forbeholdt hjerter
- **Rytme frem for gitter:** ugens første aftensmad fylder mest, resten er tættere rækker
- **To læseafstande:** butik på armslængde, komfur på en meter. Opskrifttrin sættes stort med luft

Tokens i `app/globals.css` udskiftes; komponenterne læser allerede fra dem, så farveskiftet rammer ét sted.

**Indkøbsskærmen er ikke designet endnu.** Den er den sværeste af de tre — den skal kunne betjenes med én tommelfinger, mens man går, og afkrydsning skal overleve, at telefonen låser. Den får sin egen designrunde under implementeringen.

### Billeder

nanobanana og Higgsfield er MCP-værktøjer på forfatter-siden, ikke API'er appen kan kalde. Appen genererer altså aldrig selv et billede.

Billederne lægges i et named volume monteret på `/app/public/meals`, så nye retter kan få billeder uden at containeren bygges om. Retter uden billede skal have en reserve-tilstand, der ser bevidst ud — ikke et brækket `<img>`.

Higgsfield er kun relevant, hvis der senere skal video på. Til stillbilleder er nanobanana det rigtige værktøj.

---

## Drift

Stacken `harvest` (Portainer, id 78, environment 3) peger i dag på `SGShuman/tjs-meal-planner`. Build-context skiftes til `chriskalmark/harvest`, og der tilføjes et volume for `/app/public/meals`.

Uændret fra den nuværende opsætning: port `3005` (3000 er optaget af `kan-web`), Postgres uden host-port, named volume `harvest-postgres-data`. `mad.lmar.io` peges på host-IP:3005 i Nginx Proxy Manager.

Migrationer i `db/init/` køres **ikke** automatisk, fordi Postgres-volumet allerede er initialiseret. `003` skal køres manuelt ind, ligesom `001` og `002` blev det.

## Test

`npm run test:meal-plan-tools` findes allerede og dækker markdown-/JSON-værktøjerne. Den skal udvides til det nye ingrediensformat.

Ny dækning er nødvendig for skaleringslogikken: den er ren funktion ind/ud og dermed billig at teste, og den er samtidig det sted, en fejl gør mest skade — en forkert mængde opdages først i butikken.

## Rækkefølge

Arbejdet falder i fire led, der bygger på hinanden: **datamodel og skalering** → **indhold på dansk (Netto, præferencer, agent-kontrakt)** → **udseende** → **billeder**. Første led er det eneste, resten ikke kan undvære, og det er også det, der bærer risikoen. Billeder er sidste led og er allerede blokeret, så de må ikke ligge på den kritiske vej.

## Kendte blokeringer

1. **nanobanana afviser med `RESOURCE_EXHAUSTED`** — månedligt spend-loft er nået. Billeder kan ikke genereres, før loftet hæves i AI Studio. Alt andet kan bygges imens; billeder er sidste led.
2. **Nettos gå-rækkefølge er et kvalificeret gæt.** Rækkefølgen er godkendt på skrivebordet, men bør efterprøves ved første indkøbstur og rettes i `lib/constants.ts`.
