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

- Een gedeelde clip is maximaal 90 MB (Wistic maakt hem automatisch kleiner: maximaal 1080p).
- Per gebruiker: maximaal 20 gedeelde clips en 500 MB.
- Voor iedereen samen: maximaal 9 GB, zodat je onder de gratis 10 GB blijft.
- Elke weergave verlengt de clip met 30 dagen. Elke nacht (03:17 UTC) worden clips opgeruimd die 30 dagen niet bekeken zijn.
  Previews van Discord e.d. tellen niet mee als weergave.

## Eigen domein (later)

Cloudflare dashboard > Workers & Pages > wistic-share > Settings > Domains & Routes > Add > Custom domain.
Vergeet daarna niet het nieuwe adres in `share-config.js` te zetten.

## Veiligheid

- Alleen ingelogde Wistic-gebruikers kunnen uploaden. De server controleert het Firebase-token zelf (handtekening, project, verloopdatum).
- Iedereen met de link kan de clip bekijken. De link is niet te raden (8 willekeurige tekens), maar het is geen privékluis.
- Gebruikers kunnen alleen hun eigen clips verwijderen.
