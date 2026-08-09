# Adgang til Harvest

Harvest indeholder ingen adgangskode. Låsen ligger **foran** appen, i
Cloudflare Access.

## Hvorfor ikke i appen

Der stod kortvarigt en husstandskode i selve appen (august 2026). Den
virkede teknisk — 31 prøver holdt, og alt var målt inde i containeren — men
den krævede, at et 174-tegns scrypt-aftryk blev båret i hånden fra en
terminal, gennem udklipsholderen, ind i et Portainer-felt. Det gik galt tre
gange i træk, og "Forkert kode" siger ikke hvilket af de tre led der
svigtede.

Access flytter låsen hen hvor der ikke skal bæres noget.

## Sådan er den sat op

Cloudflare Zero Trust → Access → Applications → **Self-hosted**

| Felt | Værdi |
|---|---|
| Application name | Harvest |
| Session duration | 1 måned |
| Application domain | `mad.lmar.io` |
| Policy | Allow · Include → Emails → husstandens to adresser |
| Login method | One-time PIN (e-mail) |

## Det vigtigste at forstå

**Access beskytter kun det, der går gennem Cloudflare.**

Appen selv er åben. Rammer nogen origin uden om Cloudflare, er der intet der
stopper dem — hverken læsning eller skrivning. To veje findes:

1. **LAN'et.** Stacken publicerer port 3005 direkte på Portainer-værten.
   Alle på nettet derhjemme kan nå appen udenom Access. Skal den vej lukkes,
   bindes porten til `127.0.0.1:3005` i stack-filen.
2. **Værtens offentlige adresse**, hvis den kan nås udefra.

Derfor: **DNS'en for `mad.lmar.io` skal blive ved med at være proxied**
(orange sky). Slås proxyen fra, forsvinder hele forsvaret på én gang, og
intet i appen siger til.

## Home Assistant

`/api/widget` har sit eget token (`WIDGET_TOKEN`) og kaldes serverside af
Home Assistant, som ikke kan gennemføre et Access-login. Skal den bruges,
har den brug for enten en **Service Token** i Access eller en bypass-policy
for netop den sti. `WIDGET_TOKEN` står tom i dag, så ruten er lukket, og
spørgsmålet er ikke aktuelt endnu.

## Log alle ud

Cloudflare Zero Trust → Access → **Sessions** → revoke. Eller sæt session
duration ned. Der er ingen sessioner i appen at rydde op i.
