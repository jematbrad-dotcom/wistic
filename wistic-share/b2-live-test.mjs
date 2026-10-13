// Echte proef op Backblaze B2: een klein bestand wegschrijven, inlezen, downloaden en opruimen.
// Uitvoeren met de vier secrets in de omgeving, dus er komt geen sleutel in een bestand:
//   $env:B2_BUCKET=...; $env:B2_REGION=...; $env:B2_KEY_ID=...; $env:B2_APP_KEY=...; node b2-live-test.mjs
import { b2On, b2Put, b2Head, b2GetUrl, b2Delete } from './src/b2.js';

const env = {
  B2_BUCKET: process.env.B2_BUCKET,
  B2_KEY_ID: process.env.B2_KEY_ID, B2_APP_KEY: process.env.B2_APP_KEY
};
if (!b2On(env)) { console.log('FOUT: niet alle vier de secrets gevuld.'); process.exit(1); }

const key = 't/test-' + Date.now() + '.txt';
const inhoud = new TextEncoder().encode('Wistic test ' + new Date().toISOString());
let ok = true;

const up = await b2Put(env, key, inhoud, 'text/plain');
const upStatus = up ? up.status : 'geen antwoord';
console.log('1. schrijven      :', upStatus);
if (!up || !up.ok) { console.log('   fout:', up ? (await up.text()).slice(0, 300) : 'geen verbinding'); ok = false; }

if (ok) {
  const h = await b2Head(env, key);
  console.log('2. inlezen        :', h ? h.size + ' bytes' : 'NIET GEVONDEN');
  if (!h || h.size !== inhoud.byteLength) ok = false;
}

if (ok) {
  const url = await b2GetUrl(env, key, 300);
  const r = await fetch(url);
  const terug = new Uint8Array(await r.arrayBuffer());
  console.log('3. downloaden     :', r.status, '|', new TextDecoder().decode(terug).slice(0, 60));
  if (r.status !== 200 || new TextDecoder().decode(terug) !== new TextDecoder().decode(inhoud)) ok = false;
}

await b2Delete(env, key);
const weg = await b2Head(env, key);
console.log('4. verwijderen    :', weg ? 'NOG ER' : 'weg, opgeruimd');
if (weg) ok = false;

console.log(ok ? '\nGOED: B2 werkt helemaal.' : '\nFOUT: zie hierboven welke stap misgaat.');
process.exit(ok ? 0 : 1);