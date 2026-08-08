# Husstandens lås

Harvest ligger på det åbne internet. Indtil 8. august 2026 kunne hvem som
helst både læse og skrive madplanen — 14 skriveruter uden en eneste kontrol.
Det her dokument beskriver låsen der lukkede den.

## Sådan er den skruet sammen

**Én husstand, én kode.** Der er ingen brugere, ingen konti og ingen
sessionstabel. Der er en kode og en signeret cookie.

| Fil | Rolle |
|---|---|
| `middleware.ts` | Porten. Hvidliste — alt kræver session undtagen `/login`, `/api/login`, `/api/logout`, ikoner og `/api/widget` (som har sit eget token). |
| `lib/auth/session.ts` | HMAC-SHA256 over udløbstidspunktet. Web Crypto, så den samme kode kører i middleware (Edge) og i API-ruter (Node). |
| `lib/auth/kodeord.ts` | scrypt med salt. `node:crypto`, kun i `/api/login`. |
| `app/login/page.tsx` | Ét felt. `autoComplete="current-password"` så telefonens nøglering tilbyder at gemme koden. |

**Cookien** hedder `harvest_husstand`, er `HttpOnly`, `Secure`,
`SameSite=Lax` og holder 90 dage. Den indeholder `<udløb>.<signatur>` —
intet om hvem du er, for det ved appen ikke.

## To miljøvariabler, begge påkrævede

```
HOUSEHOLD_PASSWORD_HASH=scrypt$16384$<salt>$<aftryk>
SESSION_SECRET=<64 hex-tegn>
```

Lav dem med:

```
npm run lav-kode "din kode her"
```

Selve koden gemmes **aldrig** — hverken i repoet, i databasen eller i
Portainer. Kun aftrykket, og et scrypt-aftryk kan ikke regnes tilbage.

## Den vigtigste egenskab: den fejler LUKKET

Mangler `SESSION_SECRET`, eller er den under 32 tegn, kommer **ingen** ind
— heller ikke med den rigtige kode. Det er med vilje. Det modsatte ville
betyde, at en glemt miljøvariabel tavst slog adgangskoden fra, og at man
ikke opdagede det, fordi alt så ud til at virke.

Det samme gælder aftrykket: et ulæseligt, tomt eller manglende
`HOUSEHOLD_PASSWORD_HASH` giver `false`, aldrig `true`.

`scripts/testHusstandslaas.ts` holder 30 prøver på netop de tilfælde.

## Log alle telefoner ud

Skift `SESSION_SECRET` i Portainer og redeploy. Hver eneste signatur bliver
ugyldig med det samme — der er ikke noget at rydde op i.

`/api/logout` sletter kun cookien på den ene telefon. En cookie der allerede
er kopieret, gælder til den udløber; det er derfor hemmeligheden er den
rigtige knap, hvis en telefon bliver væk.

## Det låsen IKKE dækker

**LAN'et.** Stacken publicerer port 3005 direkte på Portainer-værten.
Middleware kører også dér, så koden kræves stadig — men trafikken går uden
om Cloudflare og er ukrypteret på dit eget net. Skal den vej lukkes, bindes
porten til `127.0.0.1:3005`.

**`/api/widget`** er undtaget og beskyttes af `WIDGET_TOKEN`. Den kaldes
serverside af Home Assistant, som aldrig har en browsercookie. Er
`WIDGET_TOKEN` tom, svarer ruten fejl — altså lukket.
