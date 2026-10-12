# Zet de nieuwste Wistic-versie online zodat de app zichzelf kan updaten.
# Gebruik (in de map wistic-share):  powershell -ExecutionPolicy Bypass -File upload-update.ps1
$ErrorActionPreference = 'Stop'
$app  = Join-Path $PSScriptRoot '..'
$dist = Join-Path $app 'dist'
$v    = (Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json).version
$exe  = "Wistic-Setup-$v.exe"
if (-not (Test-Path (Join-Path $dist $exe))) { throw "Niet gevonden: $dist\$exe  (voer eerst 'npm run dist' uit in wistic-app)" }
Write-Host "Uploaden van versie $v ..."
npx wrangler r2 object put "blips-clips/updates/$exe" --file (Join-Path $dist $exe) --remote
if (Test-Path (Join-Path $dist "$exe.blockmap")) { npx wrangler r2 object put "blips-clips/updates/$exe.blockmap" --file (Join-Path $dist "$exe.blockmap") --remote }
npx wrangler r2 object put "blips-clips/updates/Wistic-Setup.exe" --file (Join-Path $dist $exe) --remote
# latest.yml als laatste: pas daarna zien de apps de nieuwe versie
npx wrangler r2 object put "blips-clips/updates/latest.yml" --file (Join-Path $dist 'latest.yml') --remote
Write-Host "Klaar. Versie $v staat online."
