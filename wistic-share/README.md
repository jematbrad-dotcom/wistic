# Wistic Share (de website voor clip-links)

Wat dit doet: een clip uit Wistic krijgt een link (`https://.../c/abc12345`) die in een browser en in Discord afspeelt.
Draait gratis op Cloudflare (Workers + R2 + D1). Inloggen gaat met het Firebase-account dat Wistic al gebruikt.

## Opzetten (eenmalig, ongeveer 10 minuten)

Je hebt Node.js nodig (die heb je al voor Wistic).

1. Maak een gratis account op https://dash.cloudflare.com. Klik links op **Storage & databases > R2 object storage** en zet R2 aan.
   Cloudflare kan hier om een betaalmethode vragen. Je betaalt niets zolang je onder de gratis limiet blijft (10 GB).
2. Open een terminal in deze map en voer uit:
   ```
   npm install
   npx wrangler login
   npx wrangler r2 bucket create blips-clips
   npx wrangler d1 create blips
   ```
3. Het laatste commando toont een `database_id`. Plak die in `wrangler.toml` bij `database_id`.
4. Maak de tabel aan en zet de site online:
   ```
   npx wrangler d1 execute blips --remote --file=schema.sql
   npx wrangler deploy
   ```
5. Wrangler toont je adres, bijvoorbeeld `https://wistic.jouwnaam.workers.dev`.
6. Zet dat adres in `share-config.js` in de Wistic-app (bij `base`) en start Wistic opnieuw.

Klaar. In Wistic: klik op de drie puntjes bij een clip > **Link maken**.

## Homepage en downloadknop

Het hoofdadres van je website (`https://wistic.jouwnaam.workers.dev/`) toont nu een homepage met uitleg over Wistic.
De downloadknop zegt "Download volgt binnenkort" totdat je een link instelt:

1. Maak in de Wistic-app het installatiebestand: `npm install`, daarna `npm run dist`. Het resultaat staat in de map `dist` (een `.exe`).
2. Zet dat bestand ergens neer waar mensen het kunnen downloaden. Het makkelijkst is een gratis GitHub Release
   (github.com > je repository > Releases > Create a new release > sleep de .exe erin). Zet de repository niet openbaar met `firebase-config.js` erin.
3. Zet de downloadlink in `wrangler.toml` bij `DOWNLOAD_URL` (moet met `https://` beginnen) en voer `npx wrangler deploy` opnieuw uit.

Let op: Windows toont bij een nieuwe, niet-ondertekende app vaak een blauwe waarschuwing ("Windows heeft uw pc beschermd").
Mensen klikken dan op **Meer info > Toch uitvoeren**. Dat verdwijnt pas met een betaald code-ondertekeningscertificaat.

De teksten van de homepage staan in `src/home.js`.

## Regels (aan te passen bovenaan `src/index.js`)

- Een gedeelde clip is maximaal 90 MB. De app kiest de kwaliteit zelf: eerst 1080p, en pas als de clip groter
  wordt dan 40 MB gaat hij naar 720p en zo nodig 540p.
- Per gebruiker: maximaal 40 gedeelde clips en 1,5 GB.
- Voor iedereen samen: maximaal 13 GB (zie hieronder: 6 GB op R2 + 8,5 GB op Backblaze B2 = 20 GB gratis).
- Elke weergave verlengt de clip met 30 dagen. Elke nacht (03:17 UTC) worden clips opgeruimd die 30 dagen niet bekeken zijn.
  Komt de totale opslag boven 12,5 GB, dan worden ook de oudst-bekeken clips opgeruimd tot onder 11 GB:
  links verlopen dan iets eerder in plaats van dat "Link maken" mislukt.
  Previews van Discord e.d. tellen niet mee als weergave.

## Tweede opslaglaag: Backblaze B2 (10 GB gratis)

Cloudflare R2 geeft 10 GB gratis met gratis verkeer. Backblaze B2 levert daar 10 GB gratis bij, en omdat je
al door Cloudflare serveert is het verkeer daar ook gratis. Samen 20 GB in plaats van 10 GB.

De Worker zet verse clips op R2 (snel) en verplaatst 's nachts het oudste materiaal naar B2 zodra er op R2
meer dan `R2_KEEP` staat. Clips die op B2 staan worden via een korte download-link rechtstreeks vanaf B2
gestreamd, dus er gaat geen video door de Worker heen.

Aanzetten (eenmalig):

1. Maak een gratis account op backblaze.com en ga naar **Buckets > Add Bucket**. Noem hem bijvoorbeeld
   `wistic-clips` en kies **Private**. Noteer de regio uit het pad, zoals `eu-central-003`.
2. Bij **App Keys > Add a Key** maak je een sleutel met rechten `listBuckets`, `writeFiles`, `readFiles` en
   `deleteFiles` voor alleen die ene bucket. Noteer de **Key ID** en de **Application Key** (de secret, met `K`).
3. Zet ze als secrets, zodat ze in geen enkel bestand komen:

   ```
   npx wrangler secret put B2_BUCKET      # wistic-clips
   npx wrangler secret put B2_REGION      # eu-central-003
   npx wrangler secret put B2_KEY_ID      # je Key ID
   npx wrangler secret put B2_APP_KEY     # je Application Key
   ```

4. `npx wrangler deploy`.

Zonder die secrets doet alles gewoon alles op R2, dus stap 3 is vrijblijvend en kan later.
`b2-test.mjs` controleert de S3-handtekening tegen de officiële testvector van AWS (`node b2-test.mjs`).

## Eigen domein (later)

Cloudflare dashboard > Workers & Pages > wistic-share > Settings > Domains & Routes > Add > Custom domain.
Vergeet daarna niet het nieuwe adres in `share-config.js` te zetten.

## Veiligheid

- Alleen ingelogde Wistic-gebruikers kunnen uploaden. De server controleert het Firebase-token zelf (handtekening, project, verloopdatum).
- Iedereen met de link kan de clip bekijken. De link is niet te raden (8 willekeurige tekens), maar het is geen privékluis.
- Gebruikers kunnen alleen hun eigen clips verwijderen.
