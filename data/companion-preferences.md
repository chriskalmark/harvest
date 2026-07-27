# Ledsagerens slik/snack-liste — AI-planlægningsinstrukser

> Refereret fra: `data/data_context.md`, `data/MEAL_PLAN_PRODUCTION_WORKFLOW.md`

Præferencer for husstandens anden voksne, der handler ind sammen med den ugentlige madplan. Slik/snack-listen udgives sammen med hver uges madplan: øl/vin, chips, en ugentlig sødme, hurtige frostretter, en weekend-frossen godbid, kaffe, mælk/fløde til kaffen og danskvand — med variation frem for at købe det samme hver uge.

---

## Generel tilgang

- Prioriter det, der er nyt og interessant, frem for at gentage de samme faste varer.
- Fyld huller med standardvarer fra puljerne nedenfor, når intet særligt er på tilbud.
- Varier fra uge til uge. Undgå at gentage nøjagtig samme produkt to uger i træk, når det er praktisk muligt.

---

## Ting der undgås (på tværs af alle kategorier)

- ❌ Lakrids/anis/fennikel-smagsprofil
- ❌ Meget søde dessertvine (portvin, sildeportvin-stile)
- ❌ Kunstigt smagende diæt-/sukkerfrit slik og snacks
- ❌ Rosévin
- ❌ Alt for eksotisk/importeret slik, som ikke findes i en almindelig dansk Netto

---

## Kategorier & regler

Brug disse eksakte kategori-strenge, i denne rækkefølge — de matcher `JUNK_CATEGORY_ORDER` i `lib/constants.ts` og skal ikke oversættes, da de sammenlignes ordret af valideringsscriptet:

1. Coffee/Creamer
2. Beer/Wine
3. Chips
4. Sweets
5. Frozen Food
6. Frozen Treats
7. Beverages/Drinks

Indholdet under hver kategori skal derimod være almindelige danske Netto-varer.

---

### Coffee/Creamer

- **Kaffe:** almindelig formalet kaffe fra Netto-sortimentet (fx Gevalia, Merrild). Skal ikke skiftes hver uge — hver anden uge er fint.
- **Mælk/fløde til kaffen:** kaffefløde eller sødmælk, ugentligt. Danmark har ikke en tradition for smagssat "seasonal creamer" på samme måde som USA — hold det til almindelig kaffefløde, evt. en sæsonvariant op mod jul.

---

### Beer/Wine

**Øl:** ingen hvedeøl. Lean mod pilsner og IPA. Foretræk sæsonøl, ellers en almindelig sixpak pilsner eller en dansk IPA.

**Vin:** ingen rosé eller dessertvin. Vægt mod rødvin, med hvidvin og mousserende for variation. Altid 1 flaske.

---

### Chips

Roter frit (1 pose). Eksempelpulje:

- Kims Sourcream chips
- Ta'Ta's saltede
- Estrella Jalapeño chips
- Kims Party Mix
- Kartoffelchips med havsalt

Tilbudsvarer er velkomne som joker.

---

### Sweets

Vælg **1 vare pr. uge**. Bland chokolade og ikke-chokolade. Undgå lakrids/anis/fennikel og kunstigt diætslik. Tjek ugens tilbudsavis før du falder tilbage på standardpuljen (Anthon Berg marcipanbrød, Toms guldbarre, Ga-Jol uden lakrids, flødeboller, tørret mango).

---

### Frozen Food

Vælg **1–2** hurtige varme-og-spis frostretter — fx en indisk karryret eller en italiensk pastaret. Bland gerne uger med italiensk og indisk inspiration.

---

### Frozen Treats

Vælg 1 weekend-vare. Standard: is (Häagen-Dazs eller lignende); en salt/mættende frost-godbid (fx frosne tapasretter) er et fint alternativ engang imellem.

---

### Beverages/Drinks

Standard: smagssat, usødet danskvand på dåse eller flaske. Undgå kunstigt sødede light-sodavand. Roter smag fra uge til uge.

---

## Output-format

```json
{
  "junkList": [
    { "category": "Coffee/Creamer", "items": [...] },
    { "category": "Beer/Wine", "items": [...] },
    { "category": "Chips", "items": [...] },
    { "category": "Sweets", "items": [...] },
    { "category": "Frozen Food", "items": [...] },
    { "category": "Frozen Treats", "items": [...] },
    { "category": "Beverages/Drinks", "items": [...] }
  ]
}
```

Hver vare: `{ "n": "fuldt Netto-produktnavn", "q": "mængde" }`
