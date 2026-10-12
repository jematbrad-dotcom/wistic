import { homePage } from './home.js';
import { vergelijkingenPage } from './vergelijkingen.js';
import { LOGO_B64, LOGO_W, LOGO_H, FAVICON_B64 } from './logo.js';
import { handleSupport, cleanupSupport } from './support.js';
import { localize } from './localize.js';
import { handleSocial, cleanupSocial } from './social.js';

// Wistic Share: clips delen via een link.
// Cloudflare Worker + R2 (video's) + D1 (gegevens). Inloggen gaat met het Firebase-account uit de Wistic-app.

const MAX_CLIP = 90 * 1024 * 1024;        // gratis Workers accepteren ongeveer 100 MB per upload
const MAX_USER_BYTES = 500 * 1024 * 1024; // per gebruiker
const MAX_USER_CLIPS = 20;                // per gebruiker
const MAX_TOTAL = 9 * 1024 ** 3;          // voor iedereen samen, blijft onder de gratis 10 GB
const TTL_DAYS = 30, DAY = 86400000;
const BOT = /bot|crawler|spider|discord|slack|telegram|whatsapp|facebookexternalhit|preview|embed/i;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const err = (m, s = 400) => json({ error: m }, s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map(x => 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[x % 57]).join(''); };
const ID = '([A-Za-z0-9]{8})';

// ---------- Inloggen: Firebase ID-token controleren ----------
let jwks = null, jwksAt = 0;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function keys(env) {
  if (jwks && Date.now() - jwksAt < 3600e3) return jwks;
  const r = await fetch(env.JWKS_URL || JWKS_URL);
  jwks = (await r.json()).keys || []; jwksAt = Date.now();
  return jwks;
}
async function user(req, env) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer /, ''), p = t.split('.');
  if (p.length !== 3) return null;
  try {
    const dec = new TextDecoder();
    const h = JSON.parse(dec.decode(b64u(p[0]))), c = JSON.parse(dec.decode(b64u(p[1])));
    if (h.alg !== 'RS256') return null;
    const jwk = (await keys(env)).find(k => k.kid === h.kid); if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(p[2]), new TextEncoder().encode(p[0] + '.' + p[1]));
    const pid = env.FIREBASE_PROJECT_ID;
    if (!ok || c.aud !== pid || c.iss !== 'https://securetoken.google.com/' + pid || !(c.exp > Date.now() / 1000) || !c.sub) return null;
    return { uid: c.sub, name: clean(c.name, 24), email: clean(c.email, 200), verified: c.email_verified === true };   // social.js gebruikt email + verified om de eigenaar te herkennen
  } catch (e) { return null; }
}

// ---------- Gebruikersnamen: uniek, en maar 1 keer per 7 dagen te wijzigen ----------
const NAME_COOLDOWN = 7 * DAY;
const RESERVED = ['wistic', 'admin', 'administrator', 'support', 'moderator', 'staff', 'system', 'owner'];
let unReady = false;
async function unTable(env) {
  if (unReady) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS usernames (uid TEXT PRIMARY KEY, name TEXT NOT NULL, nk TEXT NOT NULL UNIQUE, changed INTEGER NOT NULL DEFAULT 0)').run();
  unReady = true;
}
// Alleen dezelfde naam is bezet. Hoofdletters tellen niet mee: "JanWillem" en "janwillem" zijn dezelfde naam, "Jan Willem" niet.
const nameKey = n => n.toLowerCase();
function checkName(raw) {
  const name = String(raw || '').normalize('NFC').replace(/[\u0000-\u001f]/g, ' ').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 24) return { error: 'Gebruikersnaam: 3 tot 24 tekens.' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(name)) return { error: 'Gebruik alleen letters, cijfers, spaties en . _ -' };
  const nk = nameKey(name);
  if (nk.length < 3 || RESERVED.includes(nk)) return { error: 'Deze gebruikersnaam is niet beschikbaar.' };
  return { name, nk };
}
async function nameGet(req, env) {
  const me = await user(req, env); if (!me) return err('Niet ingelogd. Log opnieuw in bij Wistic.', 401);
  await unTable(env);
  const r = await env.DB.prepare('SELECT name, changed FROM usernames WHERE uid=?').bind(me.uid).first();
  return json({ name: r ? r.name : '', next: r && r.changed ? r.changed + NAME_COOLDOWN : 0 });
}
async function nameSet(req, env) {
  const me = await user(req, env); if (!me) return err('Niet ingelogd. Log opnieuw in bij Wistic.', 401);
  const b = await req.json().catch(() => ({})), v = checkName(b.name);
  if (v.error) return err(v.error);
  await unTable(env);
  const now = Date.now();
  const cur = await env.DB.prepare('SELECT name, changed FROM usernames WHERE uid=?').bind(me.uid).first();
  if (cur && cur.name === v.name) return json({ name: cur.name, next: cur.changed ? cur.changed + NAME_COOLDOWN : 0 });
  if (cur && cur.changed && now < cur.changed + NAME_COOLDOWN)
    return json({ error: 'Je kunt je gebruikersnaam maar 1 keer per 7 dagen wijzigen.', next: cur.changed + NAME_COOLDOWN }, 429);
  const taken = await env.DB.prepare('SELECT uid FROM usernames WHERE nk=? AND uid<>?').bind(v.nk, me.uid).first();
  if (taken) return err('Deze gebruikersnaam is al in gebruik.', 409);
  try {
    if (cur) await env.DB.prepare('UPDATE usernames SET name=?, nk=?, changed=? WHERE uid=?').bind(v.name, v.nk, now, me.uid).run();
    else await env.DB.prepare('INSERT INTO usernames (uid,name,nk,changed) VALUES (?,?,?,0)').bind(me.uid, v.name, v.nk).run();
  } catch (e) { return err('Deze gebruikersnaam is al in gebruik.', 409); }
  await env.DB.prepare('UPDATE clips SET author=? WHERE uid=?').bind(v.name, me.uid).run();
  return json({ name: v.name, next: cur ? now + NAME_COOLDOWN : 0 });
}
// Zonder inloggen: is een naam nog vrij? (voor het aanmaken van een account)
async function nameCheck(env, u) {
  const v = checkName(u.searchParams.get('name'));
  if (v.error) return json({ available: false, error: v.error });
  await unTable(env);
  const t = await env.DB.prepare('SELECT uid FROM usernames WHERE nk=?').bind(v.nk).first();
  return json(t ? { available: false, error: 'Deze gebruikersnaam is al in gebruik.' } : { available: true });
}

// ---------- API voor de Wistic-app ----------
async function init(req, env) {
  const me = await user(req, env); if (!me) return err('Niet ingelogd. Log opnieuw in bij Wistic.', 401);
  const b = await req.json().catch(() => ({})), size = Math.floor(+b.size || 0);
  if (!(size > 0)) return err('Ongeldige clip.');
  if (size > MAX_CLIP) return err('Deze clip is te groot om te delen (max 90 MB). Snij hem bij.', 413);
  const mine = await env.DB.prepare('SELECT COUNT(*) n, COALESCE(SUM(size),0) s FROM clips WHERE uid=?').bind(me.uid).first();
  if (mine.n >= MAX_USER_CLIPS) return err('Je hebt al ' + MAX_USER_CLIPS + ' gedeelde clips. Verwijder er eerst een.', 403);
  if (mine.s + size > MAX_USER_BYTES) return err('Je deellimiet (500 MB) is vol. Verwijder eerst een gedeelde clip.', 403);
  const all = await env.DB.prepare('SELECT COALESCE(SUM(size),0) s FROM clips').first();
  if (all.s + size > MAX_TOTAL) return err('Er is op dit moment geen ruimte meer om te delen. Probeer het later opnieuw.', 507);
  await unTable(env);
  const un = await env.DB.prepare('SELECT name FROM usernames WHERE uid=?').bind(me.uid).first();
  const id = rid(), now = Date.now();
  await env.DB.prepare('INSERT INTO clips (id,uid,author,title,game,size,created,last_viewed) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, me.uid, (un && un.name) || me.name || 'Wistic', clean(b.title, 60), clean(b.game, 40), size, now, now).run();
  return json({ id });
}

async function upload(req, env, id, kind) {
  const me = await user(req, env); if (!me) return err('Niet ingelogd.', 401);
  const row = await env.DB.prepare('SELECT size FROM clips WHERE id=? AND uid=?').bind(id, me.uid).first();
  if (!row) return err('Clip niet gevonden.', 404);
  const len = +req.headers.get('content-length') || 0;
  if (!len) return err('Lengte van het bestand ontbreekt.', 411);
  if (kind === 'thumb') {
    if (len > 2e6) return err('Voorbeeldplaatje is te groot.', 413);
    await env.BUCKET.put('t/' + id + '.jpg', req.body, { httpMetadata: { contentType: 'image/jpeg' } });
    await env.DB.prepare('UPDATE clips SET thumb=1 WHERE id=?').bind(id).run();
    return json({ ok: true });
  }
  if (len > MAX_CLIP || len > row.size + 1024) return err('Het bestand is groter dan opgegeven.', 413);
  await env.BUCKET.put('v/' + id + '.mp4', req.body, { httpMetadata: { contentType: 'video/mp4' } });
  await env.DB.prepare('UPDATE clips SET ready=1, size=?, last_viewed=? WHERE id=?').bind(len, Date.now(), id).run();
  return json({ ok: true });
}

async function mine(req, env) {
  const me = await user(req, env); if (!me) return err('Niet ingelogd.', 401);
  const { results } = await env.DB.prepare('SELECT id,title,game,size,views,last_viewed FROM clips WHERE uid=? AND ready=1 ORDER BY created DESC').bind(me.uid).all();
  return json({ clips: results.map(r => ({ ...r, expires: r.last_viewed + TTL_DAYS * DAY })) });
}

async function del(req, env, id) {
  const me = await user(req, env); if (!me) return err('Niet ingelogd.', 401);
  const row = await env.DB.prepare('SELECT id FROM clips WHERE id=? AND uid=?').bind(id, me.uid).first();
  if (!row) return err('Clip niet gevonden.', 404);
  await env.BUCKET.delete(['v/' + id + '.mp4', 't/' + id + '.jpg']);
  await env.DB.prepare('DELETE FROM clips WHERE id=?').bind(id).run();
  return json({ ok: true });
}

// ---------- Publieke pagina's ----------
// Een weergave verlengt de clip met 30 dagen. Bots (Discord-preview e.d.) tellen niet mee.
async function touch(env, id, view) {
  const now = Date.now();
  if (view) await env.DB.prepare('UPDATE clips SET last_viewed=?, views=views+1 WHERE id=?').bind(now, id).run();
  else await env.DB.prepare('UPDATE clips SET last_viewed=? WHERE id=? AND last_viewed<?').bind(now, id, now - 3600e3).run();
}

const HEAD = (title, extra = '') => `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${extra}<link rel="icon" type="image/png" href="/favicon.png"><style>${CSS}</style></head>`;

const CSS = `
:root{color-scheme:dark;--bg:#0b0c0b;--pn:#101210;--bd:#1f231e;--tx:#eef1ea;--mu:#78806f;--ac:#7ea85c;--ac2:#42582f;--gr:#c9e8a0}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh;overflow-x:hidden}
main{max-width:1440px;margin:0 auto;padding:max(20px,env(safe-area-inset-top)) 20px 32px}
.brand{display:inline-flex;align-items:center;gap:9px;color:var(--tx);text-decoration:none;font:800 1.1rem system-ui,sans-serif;margin:6px 0 18px}
.brand img{height:36px;width:auto;display:block}
.brand img.mark{height:72px;width:72px}
.stage{background:#000;border:1px solid var(--bd);border-radius:12px;overflow:hidden;aspect-ratio:16/9;max-height:78vh;width:100%}
video{width:100%;height:100%;display:block;background:#000}
.info{display:flex;gap:20px;justify-content:space-between;align-items:flex-start;margin-top:20px;flex-wrap:wrap}
h1{font:800 clamp(1.5rem,4vw,2.3rem)/1.1 system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 10px;overflow-wrap:anywhere}
.meta{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--mu);font-size:.92rem}
.meta b{color:var(--tx);font-weight:600}
.act{display:flex;gap:10px;flex-wrap:wrap}
.btn{appearance:none;border:1px solid var(--bd);background:var(--pn);color:var(--tx);font:600 .95rem system-ui,sans-serif;padding:11px 18px;border-radius:8px;cursor:pointer;text-decoration:none;display:inline-block}
.btn:hover{border-color:var(--ac2);background:var(--pn2)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:#0e130b}.btn.pri:hover{background:#8fb96a}
.btn.ok{background:var(--gr);border-color:var(--gr);color:#04140c}
.btn:focus-visible,a:focus-visible,video:focus-visible{outline:2px solid #b9d99a;outline-offset:3px}
footer{margin-top:30px;color:var(--mu);font-size:.85rem;max-width:62ch}
.gone{max-width:520px;margin:18vh auto 0;text-align:left}
.gone h1{font-size:clamp(1.7rem,5vw,2.4rem)}.gone p{color:var(--mu);margin:0 0 22px}
@media (max-width:640px){main{padding-left:14px;padding-right:14px}.stage{border-radius:10px}.act{width:100%}.act .btn{flex:1;text-align:center}}
`;

const BRAND = `<a class="brand" href="/"><img class="mark" src="/favicon.png" width="84" height="84" alt="Wistic"></a>`;
const html = (b, s = 200) => new Response(b, { status: s, headers: { 'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } });

function fmtDate(t) { try { return new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }); } catch (e) { return ''; } }

function watch(r, base) {
  const title = r.title || (r.game ? r.game + ' clip' : 'Wistic clip'), page = base + '/c/' + r.id, vid = base + '/v/' + r.id + '.mp4', img = r.thumb ? base + '/t/' + r.id + '.jpg' : '';
  const og = `<meta name="robots" content="noindex"><meta property="og:site_name" content="Wistic"><meta property="og:type" content="video.other"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc([r.game, r.author].filter(Boolean).join(' - ') || 'Bekijk deze clip op Wistic')}"><meta property="og:url" content="${esc(page)}">`
    + `<meta property="og:video" content="${esc(vid)}"><meta property="og:video:secure_url" content="${esc(vid)}"><meta property="og:video:type" content="video/mp4"><meta property="og:video:width" content="1280"><meta property="og:video:height" content="720">`
    + (img ? `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">` : '<meta name="twitter:card" content="summary">')
    + `<meta name="theme-color" content="#0b0c0b">`;
  const meta = [r.game && `<span><b>${esc(r.game)}</b></span>`, r.author && `<span>door <b>${esc(r.author)}</b></span>`, `<span>${esc(fmtDate(r.created))}</span>`, `<span>${r.views} ${r.views === 1 ? 'weergave' : 'weergaven'}</span>`].filter(Boolean).join('');
  return HEAD(title + ' - Wistic', og) + `<body><main>${BRAND}
<div class="stage"><video src="${esc(vid)}"${img ? ` poster="${esc(img)}"` : ''} controls playsinline preload="metadata"></video></div>
<div class="info"><div><h1>${esc(title)}</h1><div class="meta">${meta}</div></div>
<div class="act"><button class="btn pri" id="cp" type="button">Link kopiëren</button><a class="btn" href="${esc(vid)}?dl=1" download>Downloaden</a></div></div>
<footer>Deze clip verdwijnt 30 dagen nadat hij voor het laatst is bekeken.</footer></main>
<script>var b=document.getElementById('cp');b.onclick=function(){var d=function(){b.textContent='Gekopieerd';b.classList.add('ok');setTimeout(function(){b.textContent='Link kopiëren';b.classList.remove('ok')},2000)};try{navigator.clipboard.writeText(location.href).then(d,d)}catch(e){var t=document.createElement('textarea');t.value=location.href;document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(x){}t.remove();d()}}</script></body></html>`;
}

const gone = () => HEAD('Clip niet gevonden - Wistic', '<meta name="robots" content="noindex">') + `<body><main>${BRAND}<div class="gone"><h1>Deze clip is er niet meer</h1><p>De link klopt niet, of de clip is verwijderd. Clips verdwijnen 30 dagen nadat ze voor het laatst zijn bekeken.</p></div></main></body></html>`;


async function page(req, env, ctx, id, base) {
  const r = await env.DB.prepare('SELECT * FROM clips WHERE id=? AND ready=1').bind(id).first();
  if (!r) return html(gone(), 404);
  if (!BOT.test(req.headers.get('user-agent') || '')) ctx.waitUntil(touch(env, id, req.method === 'GET'));
  return html(watch(r, base));
}

async function video(req, env, ctx, id, dl) {
  const r = await env.DB.prepare('SELECT ready FROM clips WHERE id=?').bind(id).first();
  if (!r || !r.ready) return new Response('Niet gevonden', { status: 404 });
  const range = req.headers.get('range');
  const o = await env.BUCKET.get('v/' + id + '.mp4', range ? { range: req.headers } : undefined);
  if (!o) return new Response('Niet gevonden', { status: 404 });
  const h = new Headers({ 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=3600', etag: o.httpEtag, 'access-control-allow-origin': '*' });
  if (dl) h.set('content-disposition', 'attachment; filename="wistic-' + id + '.mp4"');
  let status = 200;
  if (range && o.range) {
    let s = o.range.offset || 0, e = o.size - 1;
    if (o.range.suffix !== undefined) s = Math.max(0, o.size - o.range.suffix);
    else if (o.range.length !== undefined) e = s + o.range.length - 1;
    h.set('content-range', 'bytes ' + s + '-' + e + '/' + o.size); h.set('content-length', String(e - s + 1)); status = 206;
  } else h.set('content-length', String(o.size));
  if (!BOT.test(req.headers.get('user-agent') || '') && (!range || /^bytes=0-/.test(range))) ctx.waitUntil(touch(env, id, false));
  return new Response(req.method === 'HEAD' ? null : o.body, { status, headers: h });
}

const bin = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
const PNG = { '/logo.png': bin(LOGO_B64), '/favicon.png': bin(FAVICON_B64) };

async function thumb(env, id) {
  const o = await env.BUCKET.get('t/' + id + '.jpg');
  if (!o) return new Response('Niet gevonden', { status: 404 });
  return new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' } });
}

// ---------- App-updates (installer + latest.yml voor automatisch updaten) ----------
async function updateFile(req, env, name) {
  const o = await env.BUCKET.get('updates/' + name, req.headers.get('range') ? { range: req.headers } : undefined);
  if (!o) return new Response('Niet gevonden', { status: 404 });
  const isYml = /\.ya?ml$/.test(name);
  const h = new Headers({ 'content-type': isYml ? 'text/yaml; charset=utf-8' : 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': isYml ? 'no-cache' : 'public, max-age=3600', etag: o.httpEtag });
  if (!isYml) h.set('content-disposition', 'attachment; filename="' + name + '"');
  let status = 200;
  const range = req.headers.get('range');
  if (range && o.range) {
    let s = o.range.offset || 0, e = o.size - 1;
    if (o.range.suffix !== undefined) s = Math.max(0, o.size - o.range.suffix);
    else if (o.range.length !== undefined) e = s + o.range.length - 1;
    h.set('content-range', 'bytes ' + s + '-' + e + '/' + o.size); h.set('content-length', String(e - s + 1)); status = 206;
  } else h.set('content-length', String(o.size));
  return new Response(req.method === 'HEAD' ? null : o.body, { status, headers: h });
}

// ---------- Nachtelijke opruiming ----------
async function cleanup(env) {
  const now = Date.now();
  const { results } = await env.DB.prepare('SELECT id FROM clips WHERE (ready=1 AND last_viewed<?) OR (ready=0 AND created<?) LIMIT 500').bind(now - TTL_DAYS * DAY, now - DAY).all();
  if (!results.length) return;
  await env.BUCKET.delete(results.flatMap(r => ['v/' + r.id + '.mp4', 't/' + r.id + '.jpg']));
  await env.DB.batch(results.map(r => env.DB.prepare('DELETE FROM clips WHERE id=?').bind(r.id)));
}

const worker = {
  async fetch(req, env, ctx) {
    const u = new URL(req.url), p = u.pathname, M = req.method;
    try {
      let m;
      if (PNG[p] && (M === 'GET' || M === 'HEAD')) return new Response(M === 'HEAD' ? null : PNG[p], { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
      if (p === '/' && (M === 'GET' || M === 'HEAD')) return html(homePage(env));
      if (p === '/compare' && (M === 'GET' || M === 'HEAD')) return html(vergelijkingenPage(env));
      if (p === '/vergelijkingen') return new Response(null, { status: 301, headers: { location: '/compare' + u.search } });
      if (p === '/api/username' && M === 'GET') return await nameGet(req, env);
      if (p === '/api/username' && M === 'POST') return await nameSet(req, env);
      if (p === '/api/username/check' && M === 'GET') return await nameCheck(env, u);
      if (p === '/api/clips' && M === 'POST') return await init(req, env);
      if (p === '/api/clips' && M === 'GET') return await mine(req, env);
      if ((m = p.match(new RegExp('^/api/clips/' + ID + '/(video|thumb)$'))) && M === 'PUT') return await upload(req, env, m[1], m[2]);
      if ((m = p.match(new RegExp('^/api/clips/' + ID + '$'))) && M === 'DELETE') return await del(req, env, m[1]);
      if ((m = p.match(new RegExp('^/c/' + ID + '$'))) && (M === 'GET' || M === 'HEAD')) return await page(req, env, ctx, m[1], u.origin);
      if ((m = p.match(new RegExp('^/v/' + ID + '\\.mp4$'))) && (M === 'GET' || M === 'HEAD')) return await video(req, env, ctx, m[1], u.searchParams.has('dl'));
      if ((m = p.match(new RegExp('^/t/' + ID + '\\.jpg$'))) && (M === 'GET' || M === 'HEAD')) return await thumb(env, m[1]);
      if ((m = p.match(/^\/updates\/([A-Za-z0-9._-]{1,120})$/)) && (M === 'GET' || M === 'HEAD')) return await updateFile(req, env, m[1]);
      const so = await handleSocial(req, env, u, user); if (so) return so;   // chats, vrienden, community, rollen en profielfoto's (/api/social/*, /a/*, /g/*)
      const sp = await handleSupport(req, env, ctx, u); if (sp) return sp;
      return html(gone(), 404);
    } catch (e) { return err('Er ging iets mis op de server.', 500); }
  },
  async scheduled(ev, env, ctx) { ctx.waitUntil(Promise.all([cleanup(env), cleanupSupport(env), cleanupSocial(env)])); }
};

// Taalkeuze: ?lang=nl of ?lang=en onthoudt de keuze in een cookie. Anders bepaalt de taal van de browser (zie i18n.js).
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url), ql = u.searchParams.get('lang');
    if ((req.method === 'GET' || req.method === 'HEAD') && (ql === 'nl' || ql === 'en')) {
      u.searchParams.delete('lang');
      return new Response(null, { status: 302, headers: { location: u.pathname + u.search, 'set-cookie': 'lang=' + ql + '; Path=/; Max-Age=31536000; SameSite=Lax; Secure' } });
    }
    return localize(req, await worker.fetch(req, env, ctx));
  },
  scheduled(ev, env, ctx) { return worker.scheduled(ev, env, ctx); }
};
