# Indkøbslisten ind i Apples Påmindelser

## Det virker ikke sådan her

Påmindelser deler **ikke** en indsat tekst op i linjer. Indsætter man 26
varer, bliver de til én påmindelse med 26 linjer i titlen. Det blev prøvet
af på en rigtig iPhone, ikke gættet.

Der findes ingen URL-adresse, ingen filtype og ingen delemodtager i iOS der
laver flere påmindelser ud af én tekst. Det skal en Genvej gøre.

## Genvejen — laves én gang, tager to minutter

Åbn **Genveje** → `+` → giv den navnet **Varer til Påmindelser**.

**1. Slå deling til**

Tryk på ⓘ nederst (eller pilen ved navnet) → **Vis i delemenu**.
Under *Modtag* skal der stå **Tekst**. Slå alt andet fra, så genvejen ikke
dukker op når man deler et billede.

**2. Byg de tre trin**

| # | Handling | Indstilling |
|---|---|---|
| 1 | **Del tekst** | Tekst: `Genvejsinput` · Del efter: **Nye linjer** |
| 2 | **Gentag med hvert emne** | Emner: resultatet fra trin 1 |
| 3 | **Tilføj ny påmindelse** *(inde i gentagelsen)* | Titel: `Gentag emne` · Liste: **Indkøb** |

Lav listen **Indkøb** i Påmindelser først, hvis den ikke findes.

**3. Sådan bruges den**

Harvest → **Indkøb** → **Eksportér** → **Send til Påmindelser** → vælg
**Varer til Påmindelser** i delemenuen.

Hver vare bliver til sin egen påmindelse, med mængden i titlen:
`agurk – 200 g`.

## Hvorfor Harvest deler den nøgne liste

Delingen sender **kun** varelinjer — ingen zoneoverskrifter, ingen ugetitel,
ingen tomme linjer, og kun det der ikke er krydset af. Genvejen laver én
påmindelse per linje, så alt andet ville blive til en påmindelse man skulle
krydse af sammen med agurken.

Der sendes heller ingen `title` med i delingen. Nogle modtagere lægger den
ind som en ekstra linje, og så ville der stå en påmindelse der hed
"Indkøb · Uge 34".

## Hvorfor ikke bare hente listen direkte i Genveje

Genveje kan hente en URL, og det ville være færre trin. Men Harvest ligger
bag Cloudflare Access, og en Genvej kan ikke gennemføre Access' login —
den ville få login-siden tilbage i stedet for listen. Skal den vej åbnes,
kræver det en **Service Token** i Access og et token i genvejen.

Delemenuen går uden om hele det problem: teksten kommer fra browseren, hvor
man allerede er lukket ind.
