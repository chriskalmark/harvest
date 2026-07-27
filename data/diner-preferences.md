# Husstandens madpræferencer — Harvest

> Refereret fra: `data/data_context.md`, `data/MEAL_PLAN_PRODUCTION_WORKFLOW.md`, `data/meal-plan-skill.md`

Præferencer for de to voksne, ugens retter laves til. Ledsagerens slik/snack-liste styres separat i `data/companion-preferences.md`.

---

## Ugeform

En uge er en **flad liste uden dage**: **1 morgenmad, 1 frokost, 4 aftensmader.** Ingen dage, ingen tidsslots — det er ét indkøb, ikke en kalender.

**Portioner:** hver ret laves som standard til **2 portioner**. Indkøbslisten skalerer automatisk efter portionstal, så hvis en ret ændres til 3 eller 4 portioner, ganges mængderne op — portionstallet er derfor det, der reelt styrer, hvor meget der skal købes.

---

## Kalorier

**Alle måltider: 450–550 kcal.**
Anvendes løst — smag og mæthed vejer tungere end at ramme tallet på gram.

---

## Tilberedning

- **Tidsramme: 20–30 minutter**, op til to gryder/pander ad gangen (morgenmad og aftensmader).
- Teknikker i spil: stege, sautere, koge, ovnbage (hvis det passer i tidsrammen), samle.
- **Frokost er undtagelsen:** kun samling — ingen tilberedning (se Frokoststil).
- Ingen "projektretter". Konsistent hverdagsindsats hele ugen.
- Frosne grøntsager og frossen fisk må bruges frit. Fuldt frosne færdigretter: **højst 1 om ugen.**

---

## Proteinrotation

Roter mellem disse proteiner. Sigt efter **mindst 3 forskellige proteintyper pr. uge** (mejeriprotein som skyr og hytteost tæller ikke med i de 3, men er fint som supplement).

| Protein | Noter |
|---|---|
| Kyllingelår, udbenet | Foretrækkes frem for bryst — mere smag og mere tilgivende i ovnen |
| Kyllingebryst | Fint, men brug lår, når begge dele ville fungere |
| Hakket oksekød eller kalkun | Godt til gryderetter, tacos, wok |
| Torsk / hvid fisk | Torsk, kulmule, rødspætte — roter fisketype |
| Laks | Fersk eller frossen filet |
| Rejer | Holdes i rotation som fast mulighed |
| Æg | Fast bestanddel til morgenmad og frokost |
| Kikærter, linser, sorte bønner | Førsteklasses protein, ikke en tilbehørskomponent |
| Tofu | Til vegetariske retter — marineres eller steges sprødt |
| Hytteost, skyr | Godt supplerende proteinløft, især til morgenmad og frokost |

**Hårdt nej:** ananas (i enhver ret, enhver sammenhæng).

---

## Vegetariske retter

Vegetariske retter er velkomne, når de passer ind i ugen. Når de bruges, skal de være mættende og proteinfyldte — kikærter, linser, bønner, tofu og æg tæller alle som fuldgyldigt protein.

---

## Smagsprofil

Direkte, hverdagsagtig dansk madlavning med afstikkere til det, husstanden allerede spiser ude: dansk husmandskost, italiensk, mexicansk/Tex-Mex, mellemøstlig/middelhavsmad, asiatisk wok. Undgå at gentage samme smagsprofil to gange i samme uge.

**Smagsmål:** umami, syrlighed fra citrus eller eddike, friske krydderurter. Undgå kedelige, uskrydrede proteiner.

---

## Morgenmadsstil

Varier stil fra uge til uge — undgå at to uger i træk begge er søde eller begge er havreprægede.

- **Salt:** æg, kornskåle, proteinfyldte opbygninger
- **Sødt, men mættende:** havregryn lavet spændende, skyr- eller yoghurt-opbygninger med reel protein og fibre

---

## Frokoststil

Frokost skal være **kun samling — ingen tilberedning.**

- Ingen komfur, ovn, sautering, kogning eller mikrobølge til frokostretten.
- OK: åbne, dryppe af, skylle, skære og samle spiseklare komponenter — inklusive forkogte æg og færdigmarinerede varer.
- Skal stadig ramme 450–550 kcal med ordentligt protein og fibre.

---

## Fibre

Fibre er et **førsteklasses næringsstof** — vises på hvert måltidskort. Foretrukne kilder: bælgfrugter, fuldkorn, grøntsager, bær og frugt.

---

## Makroer

```
kcal: 450–550
protein: sigt højt
fibre: vises på hvert kort, jo højere jo bedre
kulhydrat/fedt: ingen specifikke mål
```

---

## Sur mave / halsbrand — hensyn

Retterne planlægges med hensyn til følsomhed for sur mave.

**Regler:**
1. **Ingen ophobning af udløsere i samme ret.** Hvis en ret indeholder én udløser (fx tomatsauce), må den ikke også indeholde en anden (fx stegt/friturestegt element, kraftig krydring, citronbaseret dressing, chokolade).
2. **Højst én potentielt udløsende ret pr. uge.** Marker den tydeligt, når den forekommer.
3. Almindelige udløsere: tomatbaserede saucer, meget stærk krydring, friturestegt mad, citronbaserede dressinger/marinader, kraftige mængder hvidløg/løg, pebermynte, chokolade.

**Markeringsformat:** *"⚠️ Indeholder tomat — halsbrandsmarkering. Ingen andre udløsere i denne ret."*

---

## Måltidsstruktur (de fire søjler)

| Søjle | Beskrivelse |
|---|---|
| `pro` | Protein + tilberedningsnote |
| `base` | Korn, kartoffel eller brød |
| `veg` | Grøntsager |
| `engine` | Smagsanker — sauce, krydderiblanding eller lignende, der giver retten dens karakter |

**Ingen gentaget `base`- eller `engine`-tekst inden for samme uge.** Reglen gælder den viste `build`-tekst — ikke den underliggende ingrediensliste. De samme rå ingredienser (fx kartofler) må sagtens gå igen i flere retter i ugens indkøbsliste, så længe `build`-teksten beskriver forskellige tilberedninger (fx "Kartofler" som base i én ret og "Kartoffelmos" som base i en anden).

---

## Ugevalideringsregler

- [ ] 1 morgenmad, 1 frokost, 4 aftensmader
- [ ] Mindst 3 forskellige proteintyper på tværs af ugen
- [ ] Forskellig `engine`-tekst i hver ret
- [ ] Ingen gentaget `base`-tekst på tværs af ugen
- [ ] Alle retter 450–550 kcal
- [ ] Fibre vist på hvert måltidskort
- [ ] Ingen ophobning af udløsere i én ret
- [ ] Højst 1 flagget halsbrand-risikoret pr. uge
- [ ] Højst 1 fuldt frossen færdigret
- [ ] Frokost er kun samling
- [ ] Smagsprofil varierer i løbet af ugen
- [ ] Ingen ananas

---

## Undgå

- Kedelige salater og smagløse proteiner
- Gentagne uger (samme base, smagsprofil eller engine)
- Retter, der føles som en reklame for et bestemt produkt frem for et rigtigt måltid
- Ananas
- Ophobning af halsbrand-udløsere
