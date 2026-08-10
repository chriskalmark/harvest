# Flere husstande i Harvest

Planen for at gå fra én fælles madplan til én per husstand. Skrevet før
noget bygges, så rækkefølgen kan læses igennem — det er en ændring på
levende data.

## Modellen

**Personer hører til en husstand. Planen hører til husstanden.**

Chris og Malene bliver husstand 1 og mærker ingenting. En anden familie får
sin egen. Læste vi det som "én plan per person", ville de to miste den
fælles uge, og det er ikke det der efterspørges.

**Kataloget forbliver fælles.** De 137 Skagenfood-opskrifter er de samme for
alle — én kopi, ikke én per husstand. Det samme gælder ugeimporten om
søndagen: den kører én gang for alle.

## Identiteten kommer fra Cloudflare Access

Access sætter to headere på hver forespørgsel den slipper igennem:

```
Cf-Access-Authenticated-User-Email:  k@lmar.io
Cf-Access-Jwt-Assertion:             <signeret JWT>
```

**E-mailen alene er ikke nok.** Enhver der rammer origin udenom Cloudflare —
på LAN'et via port 3005 — kan sætte den header selv og udgive sig for hvem
som helst. Derfor skal **JWT'ens signatur verificeres** mod Cloudflares
nøgler:

```
https://stormosegaard.cloudflareaccess.com/cdn-cgi/access/certs
```

Nøglerne hentes én gang og gemmes i processen. `aud` skal matche
applikationens Audience Tag fra Access, ellers kan et token fra en HELT
anden Access-applikation bruges her.

`/api/hvem` er bygget for at måle om headerne overhovedet når frem, før
resten hviler på det.

## Skemaet

```sql
CREATE TABLE husstande (
  id BIGSERIAL PRIMARY KEY,
  navn TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE husstandsmedlemmer (
  id BIGSERIAL PRIMARY KEY,
  husstand_id BIGINT NOT NULL REFERENCES husstande(id) ON DELETE CASCADE,
  -- Små bogstaver ved indsættelse. Access sender som brugeren skrev den,
  -- og "K@lmar.io" må ikke blive til en anden person end "k@lmar.io".
  email TEXT NOT NULL UNIQUE,
  rolle TEXT NOT NULL DEFAULT 'medlem',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`email UNIQUE` på tværs af hele tabellen, ikke per husstand: en person hører
til én husstand. Skal det laves om senere, er det en ny beslutning.

## Migrationens rækkefølge — den farlige del

`week_plans.monday_date` er **UNIQUE** i dag. Bliver den stående, kan kun
én husstand i verden have uge 34. Constrainten skal skiftes, og det skal ske
i denne rækkefølge:

1. `CREATE TABLE husstande` + `husstandsmedlemmer`
2. Indsæt husstand 1 og de to nuværende e-mails
3. `ALTER TABLE week_plans ADD COLUMN husstand_id BIGINT REFERENCES husstande(id)`
4. `UPDATE week_plans SET husstand_id = 1` — alle eksisterende rækker
5. `ALTER TABLE week_plans ALTER COLUMN husstand_id SET NOT NULL`
6. `ALTER TABLE week_plans DROP CONSTRAINT week_plans_monday_date_key`
7. `ALTER TABLE week_plans ADD CONSTRAINT ... UNIQUE (husstand_id, monday_date)`

Trin 4 skal køre FØR trin 5, ellers afvises den eksisterende uge. Trin 6 før
trin 7, ellers findes to constraints på samme tid og den gamle vinder.

`week_plan_days` og `week_plan_shopping_checks` peger på `week_plans.id` og
følger med af sig selv. Ingen ændring dér.

Den gamle model (`meals`, `meal_plans`, `meal_plan_meals`) røres ikke.

## Kaldsvejene

Otte servicefunktioner tager i dag kun en uge og skal tage husstand + uge:

`getWeekPlan` · `setRecipeOnDay` · `setManualDishOnDay` · `clearDay` ·
`setPortions` · `getShoppingList` · `setChecked` · `clearChecks`

Det er den kedelige halvdel af arbejdet, og det er præcis dér en fejl ville
betyde, at man så en anden husstands plan. Husstanden må derfor **aldrig**
komme fra forespørgslens krop eller adresse — kun fra den verificerede
identitet. Ellers kan man skrive `husstand_id: 2` og se med.

## Første gang en ny e-mail logger ind

Access lukker dem ind, men appen kender dem ikke. To veje:

- **Opret ny husstand** — de får deres egen, tom
- **Har du en invitationskode?** — de kommer med i en eksisterende, så en
  ægtefælle kan komme til uden at få sin egen plan

Uden det andet valg ville Malene få sin egen tomme uge i stedet for at dele
med Chris.

## Det Access ikke kan

**Access har ingen selv-tilmelding.** Hver ny e-mail skal tilføjes manuelt
i policyen i Cloudflare. Til nogle få inviterede familier er det fint. Skal
fremmede kunne melde sig til, holder Access ikke, og login skal tilbage i
appen — med rigtige konti i databasen denne gang, ikke i en miljøvariabel.
