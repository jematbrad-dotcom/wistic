# Een update uitbrengen

Eenmalig: installeer Wistic met het installatiebestand (.exe). Automatisch updaten werkt alleen in de geinstalleerde app, niet bij `npm start`.

Elke nieuwe versie:
1. Verhoog `version` in `package.json` (bijv. 0.1.0 -> 0.1.1). Zonder hoger nummer ziet de app geen update.
2. In `wistic-app`: `npm install` (alleen de eerste keer) en `npm run dist`.
3. In `wistic-share`: `powershell -ExecutionPolicy Bypass -File upload-update.ps1`

Mensen krijgen dan binnen een paar uur (of bij de volgende start) de melding "Nieuwe versie staat klaar" met de knop **Nu updaten**.

Downloadknop op de homepage: zet in `wistic-share/wrangler.toml`
DOWNLOAD_URL = "https://wistic.net/updates/Wistic-Setup.exe"
en voer `npx wrangler deploy` uit.
