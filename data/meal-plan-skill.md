# /meal-plan Skill

## Trigger Command

`/meal-plan [command] [options]`

## System Context (Auto-Injected)

```
=== HARVEST MEAL ENGINE CONTEXT ===
Du opererer Harvest madplan-motoren for Netto-uger, til to voksne.

✅ UGEFORM (den enhed vi planlægger og handler ind til):
- En uge er en FLAD liste af 6 retter: 1 morgenmad, 1 frokost og 4 aftensmader.
- Der er INGEN dage og INGEN tidsslots. Tildel ikke retter til mandag/tirsdag.
- Appen gemmer `meals` som et fladt array; Menu-visningen grupperer dem efter type.
- 6-rette-blandingen findes, fordi det er et bekvemt ét-trips indkøb.

✅ PORTIONER:
- Hver ret har `servings` — standard er **2**.
- Enhver mængde på en ingrediens (`amount`) er PR. PORTION. Indkøbslisten ganger
  selv op med `servings`, når den udleder mængder — skriv derfor ALDRIG en
  mængde til begge personer i `amount`. Skriv mængden for én person.

🔴 FØRSTE SKRIDT, FØR DU SKRIVER ÉN ENESTE RET:

Kør `npm run meal-plan:library` og læs outputtet.

Appen husker allerede hvilke retter der har fået hjerte, hvor mange gange hver
ret har været på menuen, og hvornår den sidst blev serveret. Uden at læse de tal
planlægger du i blinde, og uge 2 kommer til at ligne uge 1 — reglerne nedenfor
om gentagelser gælder nemlig kun INDEN FOR én uge, ikke på tværs af uger.

Sådan bruger du listen:
- **Undgå alt serveret inden for 14 dage.** Scriptet markerer dem.
- **Prioritér retter med hjerte.** Dem har husstanden aktivt kunnet lide.
- **Retter der aldrig har været serveret er de bedste kandidater** til at give
  ugen variation — men kun hvis de passer til ugens øvrige krav.
- Er biblioteket for lille til at undgå gentagelser, så skriv en ny ret frem for
  at genbruge en fra sidste uge. Sig det i din opsummering.

Genbrug en ret ved at skrive den med NØJAGTIG samme navn, type, `build` og
makroer som i biblioteket — så genkendes den som den samme ret, og dens hjerter
og historik følger med. Afviger bare ét af de felter, opstår der en ny ret ved
siden af den gamle, og historikken går tabt.

✅ PRIMÆRE RETTER (læs `data/diner-preferences.md` hver session — kilden til sandheden):
- Alle retter løst 450–550 kcal. Fibre er førsteklasses på hver ingrediens og ret.
- 20–30 min tilberedning, op til to gryder/pander. Frosne færdigretter ≤1/uge.
- ≥3 proteintyper/uge. Vegetariske retter er fine, når de passer ind, men ikke et krav.
- Hårdt nej: ananas. Ingen gentaget `engine`- eller `base`-tekst på tværs af ugen.
- Ingen gentaget smagsprofil i samme uge. Frokost: kun samling — ingen tilberedning.
- Sur mave-hensyn: ingen ophobning af udløsere i én ret; ≤1 flagget risikoret/uge.

✅ MAKROER ER EN GUIDE, IKKE EN SPÆRRE:
- Pr.-ret-mål i `data/diner-preferences.md`. Ingen hårde daglige mål eller makro-advarsler.
- Det er IKKE et krav at ramme kalorietallet præcist. Prioriter mættende, varierede,
  virkelig danske Netto-retter.

✅ FIBRE ER EN FØRSTEKLASSES MAKRO:
- Hvert `macros`-objekt (pr. ingrediens OG pr. ret) skal indeholde `fiber` (gram).
- Rettens `macros.fiber` skal svare til summen af dens ingrediensers fiber.
- Foretræk fiberrige opbygninger (bælgfrugter, fuldkorn, grøntsager, frugt).

✅ HVER INGREDIENS SKAL HAVE MÆNGDE, ENHED OG ZONE:

Dette er den vigtigste regel i denne fil. Uden den bliver indkøbslisten tom
eller forkert, uanset hvor god retten er.

Hver post i `ingredients` skal have præcis disse felter:

```ts
{
  name: string;            // se navngivningsreglen nedenfor
  quantity: string;        // menneskelæsbar tekst til visning, fx "150 g" eller "2 stk"
  amount: number;          // PR. PORTION, som et tal — ikke en tekststreng
  unit: MealIngredientUnit;// fra den faste liste nedenfor — intet andet er gyldigt
  zone: StoreZone;         // fra Nettos 11 zoner — se data/shopping-areas.md
  category: "pro" | "base" | "veg" | "engine";
  macros: { cal, p, c, f, fiber };
}
```

**Gyldige enheder** (`MEAL_INGREDIENT_UNITS` i `lib/types.ts`) — brug præcis disse
strenge, ental, ingen forkortelser uden for listen:

```
g, kg, ml, l, dl, stk, tsk, spsk, bundt, dåse, pakke
```

Vælg den enhed, der passer til, hvordan varen faktisk sælges eller måles i et
dansk køkken: væske i `ml`/`dl`/`l`, tørvarer og kød i `g`/`kg`, stykker
(æg, boller, citroner, fed hvidløg) i `stk`, krydderurter i `bundt`,
dåsevarer i `dåse`, poser/pakker i `pakke`, teskefulde/spiseskefulde krydderi
og olie i `tsk`/`spsk`.

**Gyldig zone** — én af de 11 zoner fra `STORE_CATEGORY_ORDER` i `lib/constants.ts`
og beskrevet i `data/shopping-areas.md`:

```
Frugt & grønt, Brød, Køl, Ost & pålæg, Kød & fjerkræ, Fisk,
Kolonial, Frost, Drikkevarer, Slik & snacks, Non-food
```

Sæt zonen ud fra, hvor varen faktisk står i Netto — ikke ud fra `category`
(`pro`/`base`/`veg`/`engine`), som er noget helt andet (rettens fire søjler,
ikke butikkens layout). Fx: kylling er `category: "pro"` og `zone: "Kød & fjerkræ"`;
rugbrød er `category: "base"` og `zone: "Brød"`.

✅ KONSEKVENT ENTAL I INGREDIENSNAVNE — INGEN STEMMING:

Indkøbslisten lægger ingredienser sammen på tværs af ugens retter, når
`name` og `unit` er identiske. Der bruges INGEN sproglig normalisering ud over
små bogstaver og fjernelse af tegnsætning — dansk flertal (`-er`, `-e`, `-r`)
kan ikke afkortes uden at ramme ord som "smør" og "peber". Det betyder:

- Skriv ALTID ingrediensnavne i ental: "gulerod", ikke "gulerødder";
  "løg" (samme i ental og flertal — det er fint); "tomat", ikke "tomater";
  "kartoffel" eller "kartofler" — vælg ÉT og brug det konsekvent i alle uger.
- Brug PRÆCIS samme stavning og samme ental-form, hver gang samme vare optræder.
  "Hvidløg" i én ret og "Hvidløg" i en anden slås sammen. "Hvidløg" og
  "hvidløgsfed" slås IKKE sammen — de bliver to linjer.
- Undgå overflødige beskrivelser i navnet, medmindre de ændrer varen
  (fx "Kyllingelår, udbenet" er fint og konsekvent; skriv det ikke som
  "udbenede kyllingelår" i én ret og "kyllingelår uden ben" i en anden).
- Når du er i tvivl, tjek `data/current-week.json` for, hvordan varen er
  stavet i en tidligere uge, og genbrug den stavning ordret.

✅ OPSKRIFTSTRIN — HELLOFRESH' TONEFALD, PÅ DANSK:

Hver ret skal have et `steps`-array med **5–7 nummererede trin**, skrevet
som til denne husstand — ikke generiske opskriftstekster:

- Korte, konkrete sætninger i bydeform ("Brun kødet", "Skær løget i tern"),
  ikke passiv eller akademisk stil ("Kødet brunes").
- Parallelisér, hvor det giver mening: "Imens pastaen koger, snit løget."
  Det er sådan, en 20–30 minutters ret rent faktisk går op i tid.
- Skriv til husstandens faktiske udstyr og tidsramme: op til to gryder/pander,
  ovn hvis det er hurtigere end 30 minutter, ingen sous vide, ingen
  specialudstyr. Frokosten har typisk 2–4 trin, fordi den kun samles.
- Trinene skal matche `ingredients`-listen — nævn ikke en ingrediens i et
  trin, der ikke står i `ingredients`, og omvendt.
- Slut altid med et serveringstrin.

✅ DE FIRE SØJLER (`build`) — VISNINGSTEKST, IKKE DATA:

- `build.pro/base/veg/engine` er korte, menneskelæsbare labels, der bruges til
  menukortet — de er IKKE det samme som `ingredients`-listen og skal ikke
  gentage hver eneste ingrediens.
- Ingen gentaget `base`- eller `engine`-tekst i `build` på tværs af ugens 6 retter.
  De underliggende `ingredients` må gerne gå igen (se ovenfor); det er kun
  `build`-teksten, reglen gælder for.
- Brug mindst 3 forskellige proteintyper på tværs af ugen i `build.pro`.

✅ FORMATREGLER:
- Alt output skal bruge det EKSAKTE JSON-skema fra eksisterende madplaner
  (et top-niveau `meals`-array; ingen `days`, ingen `dailyTarget`)
- Hvert `macros`-objekt indeholder `fiber`
- Hver ret har `servings` (tal), `steps` (5–7 danske trin) og `imageUrl` (altid `null` —
  billeder genereres separat med Higgsfield, ikke af agenten)
- Foretræk almindelige danske varenavne. Brug specifikke mærker kun, hvor det er
  naturligt (fx en bestemt sauce), ikke som markedsføringssprog
- Forfat ikke `shoppingList`; den udledes af ingredienser og grupperes efter
  butikkens gå-rækkefølge
- Inkludér altid slik/snack-listen — byg den efter `data/companion-preferences.md`
- Kategori-strenge for slik/snack skal matche præcis: Coffee/Creamer, Beer/Wine,
  Chips, Sweets, Frozen Food, Frozen Treats, Beverages/Drinks (ikke oversat —
  se `data/companion-preferences.md`)

✅ INDKØBSAFDELINGER:
- Udledte indkøbslister bruger Nettos gå-rækkefølge, dokumenteret i `data/shopping-areas.md`
- Zonen sættes af dig som forfatter, på hver ingrediens — se reglen ovenfor
- Kolonial er reservezonen for ukendte eller tvetydige varer

✅ SPROG:
- Alt indhold — retnavne, `build`, `steps`, slik/snack-liste — skrives på dansk.
- Retnavne skal lyde som noget, en dansker rent faktisk ville sige om aftensmaden
  ("Ovnbagt torsk med kartofler og persillesovs"), ikke en oversat menukort-titel.
  Ingen "bowls" og "stacks", medmindre det er den bedste danske betegnelse for retten.
- Ingen emojis i retnavne, ingen udråbstegn, ingen sælgersprog.
```

## Ingrediensnavne er nøglen, der binder ugen sammen

`data/current-week.json` viser den rigtige adfærd: samme ingrediens (fx
"Kartofler" eller "Løg") optræder i flere retter med præcis samme navn og
enhed, så indkøbslisten viser én linje med den samlede mængde i stedet for
flere næsten-ens linjer.

## Sådan holder du Netto-sortimentet realistisk

Ingredienser skal være noget, en almindelig dansk Netto rent faktisk sælger.
Der findes ingen tilbudsavis at slå op i her — brug almindelig viden om dansk
dagligvarehandel, og vælg produkter, der findes i de fleste Netto-butikker,
ikke specialbutiksvarer.

## Kilder til præferencer

| Rolle | Fil |
|---|---|
| Husstandens retter | `data/diner-preferences.md` |
| Ledsagerens slik/snack-liste | `data/companion-preferences.md` |
| Nettos afdelinger og gå-rækkefølge | `data/shopping-areas.md` |
| Produkt-/kvalitetskontekst | `data/data_context.md` |
| Udgivelses-tjekliste | `data/MEAL_PLAN_PRODUCTION_WORKFLOW.md` |

Læs præferencefilerne ved starten af hver planlægningssession. Gentag ikke
deres fulde regelsæt her.

## Tilgængelige kommandoer

| Kommando | Beskrivelse |
|---|---|
| `/meal-plan new [YYYY-MM-DD]` | Opret en ny uge-markdown-fil i `data/mealplans/` (1 morgenmad / 1 frokost / 4 aftensmader) |
| `/meal-plan generate` | Opret en uge klar til udfyldning |
| `/meal-plan validate [file]` | Validér retform, fibre, makrosummer, dubletter i base/engine, slik-kategorier, indkøbsrækkefølge |
| `/meal-plan publish [file]` | Kopiér udkast til `current-week.md` og kør lokal sync + publicering (databasen skal være tilgængelig) |

> CLI-hjælperne i `scripts/mealPlanSkill.ts` er til lokal/dev-brug. Foretræk
> `npm run meal-plan:sync` og `npm run meal-plan:publish`, når du allerede har
> en færdig markdown-uge.

## Lokalt publiceringsflow

```bash
npm run meal-plan -- validate data/mealplans/mealplan-week-YYYY-MM-DD.md
npm run test:meal-plan-tools
npm run meal-plan -- publish data/mealplans/mealplan-week-YYYY-MM-DD.md
```

Eller synkronisér/publicér den nuværende uge direkte:

```bash
npm run meal-plan:sync
npm run meal-plan:publish
```

Databasescripts, der kører på værtsmaskinen, kræver `DATABASE_URL` (se
`.env.example`). Brug `docker-compose.dev.yml`, så Postgres ligger på
`localhost:5432`, eller peg på en anden tilgængelig instans.

## Outputskabelon

Fil: `data/mealplans/mealplan-week-YYYY-MM-DD.md`. Ugen er en flad liste af
6 retter (1 morgenmad, 1 frokost, 4 aftensmader) — ingen dage, ingen
tidsslots. `build`-værdier er arrays. Pr.-ingrediens `macros` (inklusive
`fiber`) skal summere til rettens `macros`. Forfat ikke `shoppingList` — den
udledes af `ingredients`.

```markdown
# Aktuel uges plan: [Måned] [Dag] — [Måned] [Dag]

Aktiv uges mad: én morgenmad, én frokost og fire aftensmader — en hel uge
handlet ind på én gang. Der er ingen dage eller tidsslots; `meals` er en flad
liste, grupperet efter type i appens Menu-visning. Fibre er en førsteklasses
makro på hver ingrediens og ret.

## Canonical JSON
\`\`\`json
{
  "weekRange": "[start] — [slut]",
  "meals": [
    {
      "type": "Breakfast",
      "name": "[Dansk retnavn]",
      "servings": 2,
      "build": {
        "pro": ["[Protein]"],
        "base": ["[Base]"],
        "veg": ["[Grønt]"],
        "engine": ["[Smagsanker]"]
      },
      "ingredients": [
        {
          "name": "[ental navn]",
          "quantity": "[menneskelæsbar mængde]",
          "amount": 0,
          "unit": "g",
          "zone": "Frugt & grønt",
          "category": "pro",
          "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 }
        }
      ],
      "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 },
      "steps": ["1. ...", "2. ...", "3. ...", "4. ...", "5. ..."],
      "imageUrl": null
    },
    { "type": "Lunch",  "name": "...", "servings": 2, "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 }, "steps": [], "imageUrl": null },
    { "type": "Dinner", "name": "...", "servings": 2, "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 }, "steps": [], "imageUrl": null },
    { "type": "Dinner", "name": "...", "servings": 2, "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 }, "steps": [], "imageUrl": null },
    { "type": "Dinner", "name": "...", "servings": 2, "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 }, "steps": [], "imageUrl": null },
    { "type": "Dinner", "name": "...", "servings": 2, "build": { "pro": [], "base": [], "veg": [], "engine": [] }, "ingredients": [], "macros": { "cal": 0, "p": 0, "c": 0, "f": 0, "fiber": 0 }, "steps": [], "imageUrl": null }
  ],
  "junkList": [
    { "category": "Coffee/Creamer", "items": [] },
    { "category": "Beer/Wine", "items": [] },
    { "category": "Chips", "items": [] },
    { "category": "Sweets", "items": [] },
    { "category": "Frozen Food", "items": [] },
    { "category": "Frozen Treats", "items": [] },
    { "category": "Beverages/Drinks", "items": [] }
  ]
}
\`\`\`
```
