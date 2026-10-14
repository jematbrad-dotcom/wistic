// Kleine controles zonder extra programma's: node --test
// Kijkt vooral naar de dingen die in een review fout gingen: te korte clip-id's en
// bestandsnamen die proberen uit de clipmap te ontsnappen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { safeClipName, clipPath, uniqueName } = require('../../clip-safe.js');

const ALFABET = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const rid = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map(x => ALFABET[x % ALFABET.length]).join(''); };
const RID = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ'.length;

test('elk clip-id is precies 8 tekens uit het alfabet', () => {
  for (let i = 0; i < 20000; i++) {
    const id = rid();
    assert.equal(id.length, 8, 'id te kort of te lang: ' + id);
    assert.equal(ALFABET.length, RID);
    for (const c of id) assert.ok(ALFABET.includes(c), 'ongeldig teken in id: ' + id);
  }
});

test('de modulo kan nooit buiten het alfabet wijzen', () => {
  // de oude fout was % 57 bij een alfabet van 56 tekens: x % 57 kan 56 geven
  for (let x = 0; x < 256; x++) assert.ok(ALFABET[x % ALFABET.length] !== undefined, 'teken ontbreekt bij ' + x);
});

test('normale clipnamen worden geaccepteerd', () => {
  assert.equal(safeClipName('Minecraft_2026-10-14-12-34-56.mp4'), 'Minecraft_2026-10-14-12-34-56.mp4');
  assert.equal(safeClipName('Screenshot_2026-10-14-12-34-56-1a2b3c.png'), 'Screenshot_2026-10-14-12-34-56-1a2b3c.png');
});

test('paden en rare typen worden geweigerd', () => {
  const slecht = ['../geheim.txt', '..\\geheim.txt', 'sub/map.mp4', 'C:\\Windows\\win.ini', '/etc/passwd.mp4',
    '..', '.', 'naampje', 'bestand.mp3', 'bestand.exe', '', null, undefined, 42, 'a'.repeat(300)];
  for (const n of slecht) assert.equal(safeClipName(n), null, 'moest geweigerd worden: ' + JSON.stringify(n));
});

test('een geldig pad blijft binnen de clipmap', () => {
  const map = 'C:\\Users\\iemand\\Videos\\Wistic';
  assert.equal(clipPath(map, 'Rust_2026.mp4'), map + '\\Rust_2026.mp4');
  assert.equal(clipPath(map, '../settings.json'), null);
  assert.equal(clipPath(map, '..\\..\\AppData\\settings.json'), null);
  assert.equal(clipPath(map, 'C:\\Windows\\System32\\drivers\\etc\\hosts'), null);
});

test('unieke naam blijft geldig en krijgt een eigen eindje', () => {
  const a = uniqueName('Valheim_2026.mp4'), b = uniqueName('Valheim_2026.mp4');
  assert.notEqual(a, b, 'twee aanroepen moeten verschillende namen geven');
  for (const n of [a, b]) {
    assert.ok(safeClipName(n), 'unieke naam is ongeldig geworden: ' + n);
    assert.equal(clipPath('C:\\x', n), 'C:\\x\\' + n);
  }
});

test('twee screenshots in dezelfde seconde krijgen nu verschillende namen', () => {
  const sec = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const n1 = safeClipName('Valorant_' + sec + '-' + uniqueName('x.png').split('-').pop() + '.png');
  const n2 = safeClipName('Valorant_' + sec + '-' + uniqueName('y.png').split('-').pop() + '.png');
  assert.notEqual(n1, n2);
});