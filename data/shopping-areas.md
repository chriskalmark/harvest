# Nettos afdelinger og gå-rækkefølge

## En note om denne fil

Denne fil dokumenterer den gå-rækkefølge, appen bruger for et almindeligt Netto-indkøb. Indkøbslister udledes af rettens ingredienser og grupperes derefter i afdelingerne nedenfor, så man kan gå butikken igennem én gang uden at gå frem og tilbage.

Rækkefølgen er den bærende værdi i `STORE_CATEGORY_ORDER` i `lib/constants.ts` — denne fil skal altid stemme overens med den. Zonen på hver ingrediens sættes af den, der forfatter ugens madplan (se `data/meal-plan-skill.md`); denne fil er beskrivelsen af, hvad de 11 zoner dækker, ikke en klassifikator i sig selv.

---

## Afdelinger

| Zone | Hvad hører til her |
|---|---|
| **Frugt & grønt** | Frisk frugt, grøntsager, rodfrugter, salat, krydderurter, hvidløg, ingefær, citrusfrugt |
| **Brød** | Rugbrød, franskbrød, boller, tortillaer, pitabrød, knækbrød |
| **Køl** | Mejeriprodukter og æg: mælk, skyr, yoghurt, hytteost, fløde, smør, æg |
| **Ost & pålæg** | Ost i skiver og blok, pålæg, leverpostej, skinke, salami, hummus og lignende kølede pålægsvarer |
| **Kød & fjerkræ** | Fersk kød fra disk eller køledisk: kylling, oksekød, svinekød, hakket kød, pølser |
| **Fisk** | Fersk og røget fisk og skaldyr: torsk, laks, rejer, fiskefars |
| **Kolonial** | Tørvarer og holdbare varer: pasta, ris, mel, dåsevarer, krydderier, olie, eddike, sauce, nødder, bønner i dåse |
| **Frost** | Alt fra frostdisken: frosne grøntsager, frosne bær, frostpizza, is, frosne færdigretter |
| **Drikkevarer** | Sodavand, saft, juice, danskvand, øl og vin |
| **Slik & snacks** | Slik, chokolade, chips, kiks, snackpinde |
| **Non-food** | Rengøringsmidler, opvask, vaskemiddel, toiletpapir, køkkenrulle, personlig pleje |

---

## Gå-rækkefølge

```
1. Frugt & grønt
      ↓
2. Brød
      ↓
3. Køl
      ↓
4. Ost & pålæg
      ↓
5. Kød & fjerkræ
      ↓
6. Fisk
      ↓
7. Kolonial
      ↓
8. Frost
      ↓
9. Drikkevarer
      ↓
10. Slik & snacks
      ↓
11. Non-food
```

---

## Praktiske noter

- **Indkøbslister er udledte, ikke håndskrevne.** Appen grupperer hver ingrediens fra ugens retter i den fysiske afdeling ovenfor, ud fra den `zone`, madplanens forfatter har sat på ingrediensen.
- **Frost vinder over frisk-klingende navne.** Frosne grøntsager, frossen fisk og frosne bær hører til i Frost, selvom ingrediensen lyder som noget fra Frugt & grønt, Kød & fjerkræ eller Fisk.
- **Køl og Ost & pålæg er adskilt.** Mælk, skyr, yoghurt, æg, fløde og smør hører til Køl. Ost, pålæg og andre kølede spiseklare pålægsvarer hører til Ost & pålæg.
- **Kolonial er reservezonen** for ukendte eller tvetydige tørvarer — se `DEFAULT_STORE_ZONE` i `lib/constants.ts`.
- **Rækkefølgen er et kvalificeret gæt.** Den er godkendt på skrivebordet, men bør efterprøves ved første indkøbstur i den lokale Netto og rettes i `lib/constants.ts`, hvis butikken rent faktisk går anderledes.
