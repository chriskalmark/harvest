# Bilka ToGo: indkøbslisten i kurven

## Sådan bruges den

**Én gang:** luk din browser helt (⌘Q), og start den med en fejlfindingsport.
Brug den browser hvor du er logget ind på Bilka:

```
open -a "Brave Browser"  --args --remote-debugging-port=9222
open -a "Microsoft Edge" --args --remote-debugging-port=9222
open -a "Google Chrome"  --args --remote-debugging-port=9222
```

Chrome, Brave og Edge er alle Chromium og taler samme protokol. Log ind på
bilkatogo.dk som du plejer. Så:

```
npm run bilka:push -- --week 2026-08-10          # se hvad der ville ske
npm run bilka:push -- --week 2026-08-10 --push   # læg i kurven
```

Dry-run er standard. `--file min-liste.json` virker også.

## Hvorfor din egen browser, og ikke en automatiseret

Det blev prøvet, og det virker ikke. En Playwright-browser kunne ikke få en
Bilka-session: der blev logget ud og ind flere gange, vinduet så logget ind
ud, og API'et svarede `uid: -1` hver eneste gang. Gigya afviser efter alt at
dømme den automatiserede browser — login *ser* ud til at lykkes, men serveren
udsteder ingen session.

Din egen browser er allerede godkendt. Der er intet at logge ind på og intet
der kan afvises, fordi det ER den browser Bilka kender.

## Hvordan man ved om det virkede

**Ikke på scriptets tal.** Det meldte engang "19/19 lagt i, 0 fejlede" til en
kurv der stod tom. Bilka svarer 200 OK med rigtige tal — antal, sum,
enhedspris — også når man er anonym; varen ryger bare et sted hen, ingen kan
se.

Det eneste pålidelige felt er `uid` i svaret: **-1 betyder anonym**. Både
posteren og `addLine` tjekker det nu, så en anonym session giver en fejl på
linjen i stedet for et grønt tal.

Og til sidst: kig i kurven på sitet. Det er den rigtige prøve.

## Ting der kostede tid, så de ikke gentages

| Antagelsen | Virkeligheden |
|---|---|
| `product_id` i en POST-krop | `productId` i **adressen** |
| Kaldet går til en host med `bilkatogo` i | Kunne være hvad som helst; filteret skjulte det |
| "Log ud" på siden = logget ind | Bilka skriver "Mit BilkaToGo" — og det står der altid |
| 200 OK = varen er i kurven | 200 OK siger intet om hvis kurv |

Fire gange samme fejl: et kendetegn blev gættet i stedet for målt. Derfor
spørger koden nu API'et om `uid` i stedet for at læse tekst.

## Faste varer

`data/bilkatogo-overrides.json` kobler et varenavn til et Bilka-produkt-id.
Varer der står der, slås ikke op.

Søgningen foretrækker **økologiske** varianter. Det er ikke tilfældigt, det
er systematisk — vil man have de almindelige, lægges de ind her. Kør en
dry-run, kopiér id'et fra `alt:`-linjen, og skriv det ind.
