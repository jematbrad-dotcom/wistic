import { LOGO_W, LOGO_H } from './logo.js';
import { fbReady, listUsers, getUser, setDisabled, sendReset } from './firebase-admin.js';

// Wistic Support: tickets met bijlagen.
// - /support              formulier om een ticket te openen (voor iedereen)
// - /support/t/<token>    privepagina van een ticket (alleen met de geheime link), met antwoorden
// - /admin                alleen voor jou (wachtwoord uit het geheim ADMIN_PASSWORD)
// Tickets staan in D1, bijlagen in R2 (map s/). Nieuwe tickets kunnen een melding in Discord sturen (DISCORD_WEBHOOK).

const DAY = 86400000;
const MAX_FILES = 5;                       // bestanden per bericht
const MAX_FILE = 10 * 1024 * 1024;         // per bestand
const MAX_MSG_FILES = 25 * 1024 * 1024;    // alle bestanden samen per bericht
const MAX_BODY = 30 * 1024 * 1024;         // hele verzoek
const MAX_SUPPORT_TOTAL = 500 * 1024 * 1024; // alle bijlagen van alle tickets samen
const MAX_MSG = 4000, MAX_SUBJ = 100;
const CLOSED_KEEP_DAYS = 90;               // gesloten tickets worden na zoveel dagen automatisch gewist

const CATS = { bug: 'Bug of probleem', vraag: 'Vraag', idee: 'Idee of wens', anders: 'Anders' };
const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  txt: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8',
  json: 'application/json', zip: 'application/zip', pdf: 'application/pdf',
};
const INLINE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'txt', 'log']);
const IMG = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const ACCEPT = Object.keys(TYPES).map(e => '.' + e).join(',');

const enc = new TextEncoder();
const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => ALPHA[x % ALPHA.length]).join(''); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const line = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const text = (s, n) => String(s || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const extOf = n => (String(n).split('.').pop() || '').toLowerCase();
const fmt = t => { try { return new Date(t).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }); } catch (e) { return ''; } };
const mb = n => (n / 1048576 >= 0.1 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const linkify = s => esc(s).replace(/https?:\/\/(?:[^\s<>"'&]|&amp;)+/g, m => {
  const t = m.match(/[.,;:!?)\]]+$/), url = t ? m.slice(0, -t[0].length) : m;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>${t ? t[0] : ''}`;
});

// ---------- antwoorden ----------
const CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const page = (body, status = 200, extra = {}) => new Response(body, { status, headers: {
  'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP, 'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...extra } });
const jres = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...extra } });

const CSS = `
:root{color-scheme:dark;--bg:#0b0c0b;--pn:#101210;--pn2:#151815;--bd:#1f231e;--tx:#eef1ea;--mu:#78806f;--ac:#7ea85c;--ac2:#42582f;--gr:#c9e8a0;--er:#e8806f}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--tx);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh;overflow-x:hidden;-webkit-text-size-adjust:100%}
.w{max-width:760px;margin:0 auto;padding:0 20px}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:max(24px,calc(env(safe-area-inset-top) + 12px)) 0 8px}
.brand img{display:block;height:34px;width:auto}
.brand img.mark{height:64px;width:64px}
.brand{display:inline-flex;align-items:center;gap:9px;text-decoration:none}
nav a{color:var(--mu);text-decoration:none;margin-left:18px;font-weight:600}nav a:hover{color:var(--tx)}
main{padding:20px 0 36px}
footer{padding:20px 0 max(28px,env(safe-area-inset-bottom));border-top:1px solid var(--bd);color:var(--mu);font-size:.9rem}
footer a{color:var(--mu)}
h1{font:800 clamp(1.7rem,5vw,2.5rem)/1.1 system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 12px;overflow-wrap:anywhere}
h2{font:700 1.15rem system-ui,sans-serif;margin:26px 0 10px}
p{margin:0 0 14px;color:#c6ccbf}.mu{color:var(--mu)}.sm{font-size:.9rem}
a{color:var(--gr)}
label{display:block;font-weight:600;margin:16px 0 6px}
input,select,textarea{width:100%;background:var(--pn);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:11px 13px;font:inherit}
textarea{min-height:150px;resize:vertical}
input:focus,select:focus,textarea:focus{outline:2px solid #b9d99a55;border-color:var(--ac2)}
input[type=file]{padding:9px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.btn{appearance:none;border:1px solid var(--bd);background:var(--pn);color:var(--tx);font:700 .95rem system-ui,sans-serif;padding:11px 20px;border-radius:8px;cursor:pointer;text-decoration:none;display:inline-block}
.btn:hover{border-color:var(--ac2);background:var(--pn2)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:#0e130b}.btn.pri:hover{background:#8fb96a}
.btn.dng{border-color:#6b3a33;color:var(--er)}
.btn.sm{padding:7px 14px;font-size:.88rem}
.btn:disabled{opacity:.6;cursor:wait}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px}
.err{background:#1d1412;border:1px solid #6b3a33;color:#f0b3a8;border-radius:8px;padding:10px 14px;margin:14px 0}
.ok{background:#151d12;border:1px solid var(--ac2);color:var(--gr);border-radius:8px;padding:10px 14px;margin:14px 0}
.msg{border:1px solid var(--bd);background:var(--pn);border-radius:10px;padding:14px 16px;margin:12px 0}
.msg.adm{border-color:var(--ac2);background:#141a11}
.msg .who{display:flex;justify-content:space-between;gap:10px;color:var(--mu);font-size:.85rem;margin-bottom:6px}
.msg .who b{color:var(--tx)}
.msg .bd{white-space:pre-wrap;overflow-wrap:anywhere}
.att{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.att a{display:block;border:1px solid var(--bd);border-radius:8px;overflow:hidden;background:#0a0b0a;text-decoration:none;color:var(--tx);font-size:.88rem}
.att img{display:block;max-width:240px;max-height:170px}
.att .f{padding:9px 12px}
.badge{display:inline-block;font-size:.78rem;font-weight:700;padding:2px 9px;border-radius:999px;border:1px solid var(--bd);color:var(--mu);vertical-align:middle}
.badge.open{color:var(--gr);border-color:var(--ac2)}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
.tabs a{padding:7px 14px;border:1px solid var(--bd);border-radius:999px;text-decoration:none;color:var(--mu);font-weight:600}
.tabs a.on{color:var(--tx);border-color:var(--ac2);background:var(--pn)}
.tk{display:block;padding:14px 6px;border-bottom:1px solid var(--bd);text-decoration:none;color:var(--tx)}
.tk:hover{background:var(--pn)}
.tk b{display:block;overflow-wrap:anywhere}.tk .dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ac);margin-right:8px}
.kv{display:flex;flex-wrap:wrap;gap:4px 18px;color:var(--mu);font-size:.92rem;margin:0 0 6px}
.us{padding:16px 6px;border-bottom:1px solid var(--bd)}.us .ut{overflow-wrap:anywhere;font-size:1.05rem}.us .uid{font-size:.78rem;color:var(--mu);overflow-wrap:anywhere}.us .row{margin-top:10px}
.srch{display:flex;gap:10px;margin:14px 0}.srch input{flex:1}.badge.off{color:var(--er);border-color:#6b3a33}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0 6px}
.stat{display:block;background:var(--pn);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;text-decoration:none;color:var(--tx)}
a.stat:hover{border-color:var(--ac2);background:var(--pn2)}
.stat b{display:block;font:800 1.8rem/1.1 system-ui,sans-serif}.stat span{color:var(--mu);font-size:.88rem}
.stat.hot{border-color:var(--ac2)}.stat.hot b{color:var(--gr)}
.w.wide{max-width:none;padding:0 clamp(20px,3vw,64px)}
.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(20px,4vw,56px)}
@media (max-width:900px){.cols{grid-template-columns:1fr}}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:12px;margin-top:6px}
.grid .tk,.grid .us{background:var(--pn);border:1px solid var(--bd);border-radius:10px;padding:16px 18px}
.grid .tk:hover{border-color:var(--ac2);background:var(--pn2)}
.cols2{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:clamp(24px,4vw,64px)}
@media (max-width:900px){.cols2{grid-template-columns:1fr}}
.sec{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.sec a{font-size:.92rem;font-weight:600}
@media (max-width:640px){.btn{width:100%;text-align:center}.row{flex-direction:column;align-items:stretch}nav a{margin-left:12px}}
`;

const layout = (title, body, { admin = false, index = false, wide = false } = {}) => `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${index ? '' : '<meta name="robots" content="noindex">'}<link rel="icon" type="image/png" href="/favicon.png"><style>${CSS}</style></head><body><div class="${wide ? 'w wide' : 'w'}"><header><a class="brand" href="/"><img class="mark" src="/favicon.png" width="76" height="76" alt="Wistic"></a><nav>${admin ? '<a href="/admin">Overzicht</a><a href="/admin/tickets">Tickets</a><a href="/admin/users">Gebruikers</a><a href="/admin/logout">Uitloggen</a>' : '<a href="/">Home</a><a href="/support">Support</a>'}</nav></header><main>${body}</main><footer>Wistic${admin ? '' : ' · <a href="/support">Support</a>'}</footer></div></body></html>`;

// ---------- beveiliging ----------
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const adminOn = env => typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= 10;
async function passOk(env, given) { return same(await hmac('pw', String(given || '')), await hmac('pw', env.ADMIN_PASSWORD)); }
async function isAdmin(req, env) {
  if (!adminOn(env)) return false;
  const c = (req.headers.get('cookie') || '').match(/(?:^|;\s*)wa=(\d+)\.([0-9a-f]{64})/);
  if (!c || +c[1] < Date.now()) return false;
  return same(c[2], await hmac(env.ADMIN_PASSWORD, 'adm.' + c[1]));
}
async function ipKey(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || 'x';
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(ip + '|' + (env.ADMIN_PASSWORD || 'wistic')))).slice(0, 16);
}
async function limited(env, key, max, windowMs) {
  const now = Date.now();
  const r = await env.DB.prepare('SELECT COUNT(*) n FROM rl WHERE k=? AND t>?').bind(key, now - windowMs).first();
  if (r && r.n >= max) return true;
  await env.DB.prepare('INSERT INTO rl (k,t) VALUES (?,?)').bind(key, now).run();
  return false;
}
const sameOrigin = (req, u) => {
  const sf = req.headers.get('sec-fetch-site');
  if (sf) return sf === 'same-origin' || sf === 'none';
  const o = req.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === u.host; } catch (e) { return false; }
};
const wantsJson = req => /application\/json/.test(req.headers.get('accept') || '');

async function notify(env, msg) {
  if (!/^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\//.test(env.DISCORD_WEBHOOK || '')) return;
  try { await fetch(env.DISCORD_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: msg.slice(0, 1800), allowed_mentions: { parse: [] } }) }); } catch (e) {}
}

// ---------- bestanden en berichten ----------
async function readForm(req) {
  const len = +req.headers.get('content-length') || 0;
  if (len > MAX_BODY) return { err: 'Dit is te groot. Stuur minder of kleinere bestanden (samen maximaal 25 MB).', status: 413 };
  try { return { form: await req.formData() }; } catch (e) { return { err: 'Het formulier kon niet worden gelezen. Probeer het opnieuw.', status: 400 }; }
}
function pickFiles(form) {
  const list = form.getAll('files').filter(f => f && typeof f === 'object' && typeof f.size === 'number' && f.size > 0);
  if (list.length > MAX_FILES) return { err: 'Kies maximaal ' + MAX_FILES + ' bestanden.' };
  let total = 0;
  for (const f of list) {
    const ext = extOf(f.name);
    if (!TYPES[ext]) return { err: '"' + line(f.name, 60) + '" kan niet worden verstuurd. Toegestaan: ' + Object.keys(TYPES).join(', ') + '.' };
    if (f.size > MAX_FILE) return { err: '"' + line(f.name, 60) + '" is groter dan 10 MB. Maak van een grote video liever een Wistic-link en plak die in je bericht.' };
    total += f.size;
  }
  if (total > MAX_MSG_FILES) return { err: 'De bestanden zijn samen te groot (maximaal 25 MB).' };
  return { list, total };
}
async function storageFull(env, adding) {
  if (!adding) return false;
  const r = await env.DB.prepare('SELECT COALESCE(SUM(size),0) s FROM files').first();
  return (r ? r.s : 0) + adding > MAX_SUPPORT_TOTAL;
}
async function addMessage(env, ticketId, author, body, files) {
  const now = Date.now();
  const r = await env.DB.prepare('INSERT INTO messages (ticket_id,author,body,created) VALUES (?,?,?,?)').bind(ticketId, author, body, now).run();
  const mid = r.meta.last_row_id;
  for (const f of files) {
    const ext = extOf(f.name), fid = rnd(10) + '.' + ext;
    await env.BUCKET.put('s/' + ticketId + '/' + fid, f, { httpMetadata: { contentType: TYPES[ext] } });
    await env.DB.prepare('INSERT INTO files (id,ticket_id,message_id,name,type,size,created) VALUES (?,?,?,?,?,?,?)')
      .bind(fid, ticketId, mid, line(f.name, 80) || ('bestand.' + ext), TYPES[ext], f.size, now).run();
  }
  return mid;
}
async function wipe(env, id) {
  const { results } = await env.DB.prepare('SELECT id FROM files WHERE ticket_id=?').bind(id).all();
  for (let i = 0; i < results.length; i += 500) await env.BUCKET.delete(results.slice(i, i + 500).map(f => 's/' + id + '/' + f.id));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM files WHERE ticket_id=?').bind(id),
    env.DB.prepare('DELETE FROM messages WHERE ticket_id=?').bind(id),
    env.DB.prepare('DELETE FROM tickets WHERE id=?').bind(id),
  ]);
}
async function serveFile(env, f) {
  const ext = extOf(f.id), type = TYPES[ext];
  if (!type) return new Response('Niet gevonden', { status: 404 });
  const o = await env.BUCKET.get('s/' + f.ticket_id + '/' + f.id);
  if (!o) return new Response('Niet gevonden', { status: 404 });
  const safe = String(f.name || 'bestand').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  return new Response(o.body, { headers: {
    'content-type': type, 'content-length': String(o.size),
    'content-disposition': (INLINE.has(ext) ? 'inline' : 'attachment') + '; filename="' + safe + '"',
    'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox",
    'referrer-policy': 'no-referrer', 'cache-control': 'private, no-store' } });
}

// ---------- weergave ----------
const attHtml = (files, urlOf) => !files.length ? '' : `<div class="att">${files.map(f => {
  const u = esc(urlOf(f));
  return IMG.has(extOf(f.id))
    ? `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="${esc(f.name)}" loading="lazy"></a>`
    : `<a href="${u}" target="_blank" rel="noopener"><div class="f">📎 ${esc(f.name)} <span class="mu">(${mb(f.size)})</span></div></a>`;
}).join('')}</div>`;

const msgHtml = (m, files, urlOf, who) => `<div class="msg${m.author === 'admin' ? ' adm' : ''}"><div class="who"><b>${esc(who(m))}</b><span>${esc(fmt(m.created))}</span></div><div class="bd">${linkify(m.body)}</div>${attHtml(files.filter(f => f.message_id === m.id), urlOf)}</div>`;

const formScript = `
(function(){var f=document.getElementById('f'),b=document.getElementById('b'),e=document.getElementById('e'),l=b.textContent,MAX=${MAX_FILE};
function show(m){e.innerHTML='';var d=document.createElement('div');d.className='err';d.textContent=m;e.appendChild(d)}
function reset(){b.disabled=false;b.textContent=l}
f.addEventListener('submit',function(ev){ev.preventDefault();e.innerHTML='';
var fs=document.getElementById('fl').files;
if(fs.length>${MAX_FILES}){show('Kies maximaal ${MAX_FILES} bestanden.');return}
for(var i=0;i<fs.length;i++){if(fs[i].size>MAX){show('"'+fs[i].name+'" is groter dan 10 MB.');return}}
b.disabled=true;b.textContent='Versturen…';
fetch(f.action,{method:'POST',body:new FormData(f),headers:{accept:'application/json'}})
.then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})
.then(function(x){if(x.ok&&x.j.url){location.href=x.j.url}else if(x.ok){location.reload()}else{show((x.j&&x.j.error)||'Versturen mislukt. Probeer het opnieuw.');reset()}})
.catch(function(){show('Versturen mislukt. Controleer je internet en probeer het opnieuw.');reset()})});})();`;

function fileField() {
  return `<label for="fl">Screenshots of bestanden (optioneel)</label><input id="fl" type="file" name="files" multiple accept="${ACCEPT}"><p class="mu sm" style="margin-top:8px">Maximaal ${MAX_FILES} bestanden van elk 10 MB (${Object.keys(TYPES).join(', ')}). Een grote video? Maak een Wistic-link en plak die in je bericht.</p>`;
}

function supportForm(env) {
  const dc = /^https:\/\/(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/i.test(env.DISCORD_INVITE || '') ? env.DISCORD_INVITE : '';
  return layout('Support - Wistic', `<h1>Support</h1>
<p>Een bug gevonden, een vraag of een idee? Open hier een ticket. Alleen de maker van Wistic kan het lezen. Je kunt screenshots en andere bestanden meesturen.</p>
${dc ? `<p class="mu sm">Liever even chatten? <a href="${esc(dc)}" rel="noopener">Kom naar de Discord-server</a>.</p>` : ''}
<form id="f" method="post" action="/api/support/ticket" enctype="multipart/form-data">
<div class="cols2"><div>
<label for="cat">Waar gaat het over?</label><select id="cat" name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
<label for="sub">Onderwerp</label><input id="sub" name="subject" maxlength="${MAX_SUBJ}" required placeholder="Kort, bijvoorbeeld: opnemen start niet">
<label for="msg">Wat is er aan de hand?</label><textarea id="msg" name="message" maxlength="${MAX_MSG}" required placeholder="Wat deed je, wat verwachtte je en wat gebeurde er? Noem ook je Wistic-versie en Windows-versie."></textarea>
</div><div>
${fileField()}
<label for="nm">Naam (optioneel)</label><input id="nm" name="name" maxlength="40" autocomplete="name">
<label for="em">E-mail (optioneel)</label><input id="em" name="email" type="email" maxlength="120" autocomplete="email">
<p class="mu sm" style="margin-top:8px">Je e-mailadres gebruik ik alleen om je zo nodig te bereiken over dit ticket. Mijn antwoord staat op de ticketpagina die je na het versturen krijgt.</p>
</div></div>
<div class="hp" aria-hidden="true"><label for="hp">Website</label><input id="hp" name="website" tabindex="-1" autocomplete="off"></div>
<div id="e"></div>
<div class="row"><button class="btn pri" id="b" type="submit">Ticket versturen</button></div>
</form>
<p class="mu sm" style="margin-top:22px">Privacy: je bericht en bijlagen worden alleen gebruikt om je te helpen. Gesloten tickets worden na ${CLOSED_KEEP_DAYS} dagen automatisch gewist.</p>
<script>${formScript}</script>`, { index: true, wide: true });
}

function ticketPage(t, msgs, files, fresh) {
  const urlOf = f => '/support/f/' + f.id + '?t=' + t.token;
  return layout(t.subject + ' - Wistic Support', `<h1>${esc(t.subject)}</h1>
<p class="kv"><span class="badge ${t.status === 'open' ? 'open' : ''}">${t.status === 'open' ? 'Open' : 'Gesloten'}</span><span>${esc(CATS[t.category] || t.category)}</span><span>${esc(fmt(t.created))}</span></p>
${fresh ? '<div class="ok"><b>Je ticket is verstuurd.</b> Bewaar deze pagina (bladwijzer of kopieer de link): mijn antwoord verschijnt hier. Iedereen met deze link kan het ticket lezen, deel hem dus niet.</div>' : '<p class="mu sm">Bewaar deze pagina. Mijn antwoord verschijnt hier.</p>'}
<div class="row" style="margin-top:6px"><button class="btn sm" id="cp" type="button">Link kopiëren</button></div>
${msgs.map(m => msgHtml(m, files, urlOf, x => x.author === 'admin' ? 'Wistic' : (t.name || 'Jij'))).join('')}
<h2>Reageren</h2>
<form id="f" method="post" action="/api/support/t/${t.token}/reply" enctype="multipart/form-data">
<textarea id="msg" name="message" maxlength="${MAX_MSG}" required placeholder="Typ hier je reactie…" aria-label="Je reactie"></textarea>
${fileField()}
<div id="e"></div>
<div class="row"><button class="btn pri" id="b" type="submit">Versturen</button></div>
</form>
<script>${formScript}
(function(){var c=document.getElementById('cp');c.onclick=function(){var d=function(){c.textContent='Gekopieerd';setTimeout(function(){c.textContent='Link kopiëren'},2000)};try{navigator.clipboard.writeText(location.origin+location.pathname).then(d,d)}catch(e){d()}}})();</script>`);
}

// ---------- beheer ----------
const loginPage = (env, error) => layout('Beheer - Wistic', `<h1>Beheer</h1>${!adminOn(env)
  ? '<div class="err">Beheer staat uit. Stel eerst het geheim ADMIN_PASSWORD in (minimaal 10 tekens) met <code>npx wrangler secret put ADMIN_PASSWORD</code>.</div>'
  : `${error ? `<div class="err">${esc(error)}</div>` : ''}<form method="post" action="/admin/login"><label for="pw">Wachtwoord</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus><div class="row"><button class="btn pri" type="submit">Inloggen</button></div></form>`}`);

async function adminList(env, status) {
  const st = ['open', 'closed', 'all'].includes(status) ? status : 'open';
  const { results } = await env.DB.prepare(`SELECT t.id,t.subject,t.category,t.name,t.status,t.updated,t.last_from,t.unread,(SELECT COUNT(*) FROM messages m WHERE m.ticket_id=t.id) n FROM tickets t WHERE (?='all' OR t.status=?) ORDER BY t.unread DESC, t.updated DESC LIMIT 200`).bind(st, st).all();
  const unread = (await env.DB.prepare('SELECT COUNT(*) n FROM tickets WHERE unread=1').first()).n;
  const tab = (k, l) => `<a href="/admin/tickets?status=${k}" class="${st === k ? 'on' : ''}">${l}</a>`;
  return page(layout('Tickets - Beheer', `<h1>Tickets</h1><p class="mu">${unread ? `${unread} ongelezen` : 'Alles gelezen'}</p>
<div class="tabs">${tab('open', 'Open')}${tab('closed', 'Gesloten')}${tab('all', 'Alles')}</div>
<div class="grid">${results.length ? results.map(r => `<a class="tk" href="/admin/t/${r.id}"><b>${r.unread ? '<span class="dot"></span>' : ''}${esc(r.subject)}</b><span class="mu sm">${esc(CATS[r.category] || r.category)} · ${esc(r.name || 'Anoniem')} · ${r.n} ${r.n === 1 ? 'bericht' : 'berichten'} · ${esc(fmt(r.updated))}${r.status === 'closed' ? ' · gesloten' : r.last_from === 'admin' ? ' · jij antwoordde laatst' : ''}</span></a>`).join('') : '<p class="mu">Geen tickets.</p>'}</div>`, { admin: true, wide: true }));
}

async function adminTicket(env, id, note) {
  const t = await env.DB.prepare('SELECT * FROM tickets WHERE id=?').bind(id).first();
  if (!t) return page(layout('Niet gevonden', '<h1>Ticket niet gevonden</h1><p><a href="/admin/tickets">Terug naar de lijst</a></p>', { admin: true }), 404);
  if (t.unread) await env.DB.prepare('UPDATE tickets SET unread=0 WHERE id=?').bind(id).run();
  const msgs = (await env.DB.prepare('SELECT * FROM messages WHERE ticket_id=? ORDER BY id').bind(id).all()).results;
  const files = (await env.DB.prepare('SELECT * FROM files WHERE ticket_id=?').bind(id).all()).results;
  const urlOf = f => '/admin/f/' + f.id;
  return page(layout(t.subject + ' - Beheer', `<p><a href="/admin/tickets">&larr; Alle tickets</a></p><h1>${esc(t.subject)}</h1>
<p class="kv"><span class="badge ${t.status === 'open' ? 'open' : ''}">${t.status === 'open' ? 'Open' : 'Gesloten'}</span><span>${esc(CATS[t.category] || t.category)}</span><span>${esc(fmt(t.created))}</span><span>${esc(t.name || 'Anoniem')}</span>${t.email ? `<span>${esc(t.email)}</span>` : ''}</p>
${note ? `<div class="ok">${esc(note)}</div>` : ''}
${msgs.map(m => msgHtml(m, files, urlOf, x => x.author === 'admin' ? 'Jij (Wistic)' : (t.name || 'Gebruiker'))).join('')}
<h2>Antwoorden</h2>
<form method="post" action="/admin/t/${t.id}/reply" enctype="multipart/form-data"><textarea name="message" maxlength="${MAX_MSG}" required placeholder="Je antwoord…" aria-label="Je antwoord"></textarea>
<label for="fl">Bijlagen (optioneel)</label><input id="fl" type="file" name="files" multiple accept="${ACCEPT}">
<div class="row"><button class="btn pri" type="submit">Antwoord sturen</button></div></form>
<div class="row" style="margin-top:28px">
<form method="post" action="/admin/t/${t.id}/status"><input type="hidden" name="status" value="${t.status === 'open' ? 'closed' : 'open'}"><button class="btn" type="submit">${t.status === 'open' ? 'Ticket sluiten' : 'Ticket heropenen'}</button></form>
<form method="post" action="/admin/t/${t.id}/delete" onsubmit="return confirm('Dit ticket en alle bijlagen definitief verwijderen?')"><button class="btn dng" type="submit">Verwijderen</button></form></div>`, { admin: true }));
}

// ---------- gebruikers (Firebase-accounts) ----------
const U_OK = { reset: 'Reset-mail verstuurd.', off: 'Account uitgezet.', on: 'Account weer aangezet.' };
const U_ERR = { limit: 'Er is net al een paar keer een mail naar dit account gestuurd. Probeer het over een uur opnieuw.', nopw: 'Dit account heeft geen wachtwoord (Google-login). Er is niets om te resetten.', fb: 'Firebase gaf een fout. Controleer de instellingen en probeer het opnieuw.', owner: 'Je eigen account kun je niet uitzetten.' };
const ownerOf = (env, x) => !!(env.OWNER_EMAIL && x.email && x.email.toLowerCase() === String(env.OWNER_EMAIL).trim().toLowerCase());

async function adminUsers(env, q, ok, er) {
  const T = 'Gebruikers - Beheer';
  if (!fbReady(env)) return page(layout(T, '<h1>Gebruikers</h1><div class="err">De koppeling met Firebase staat nog niet aan. Zet het geheim FIREBASE_SERVICE_ACCOUNT met <code>npx wrangler secret put FIREBASE_SERVICE_ACCOUNT</code> en deploy opnieuw.</div>', { admin: true }), 503);
  let all;
  try { all = await listUsers(env); } catch (e) { return page(layout(T, `<h1>Gebruikers</h1><div class="err">Firebase gaf een fout: ${esc(String(e.message).slice(0, 200))}</div>`, { admin: true }), 502); }
  let names = new Map(), clips = new Map();
  try {
    names = new Map((await env.DB.prepare('SELECT uid,name FROM usernames').all()).results.map(r => [r.uid, r.name]));
    clips = new Map((await env.DB.prepare('SELECT uid,COUNT(*) n FROM clips GROUP BY uid').all()).results.map(r => [r.uid, r.n]));
  } catch (e) {}
  const needle = q.toLowerCase();
  const list = needle ? all.filter(x => x.email.toLowerCase().includes(needle) || x.uid.toLowerCase().includes(needle) || (names.get(x.uid) || '').toLowerCase().includes(needle) || x.name.toLowerCase().includes(needle)) : all;
  const act = (path, x, extra, label, cls, ask) => `<form method="post" action="/admin/users/${path}" onsubmit="return confirm('${ask}')"><input type="hidden" name="uid" value="${esc(x.uid)}">${extra}<button class="btn sm ${cls}" type="submit">${label}</button></form>`;
  const row = x => {
    const own = ownerOf(env, x), nm = names.get(x.uid);
    const how = [x.google ? 'Google' : '', x.password ? 'E-mail + wachtwoord' : ''].filter(Boolean).join(' + ') || 'Onbekend';
    return `<div class="us"><div class="ut"><b>${esc(x.email || '(geen e-mail)')}</b> <span class="mu">· ${nm ? esc(nm) : 'nog geen gebruikersnaam'}</span></div>
<p class="kv"><span class="badge">${esc(how)}</span>${x.disabled ? '<span class="badge off">Uitgezet</span>' : ''}${own ? '<span class="badge open">Eigenaar</span>' : ''}<span>Aangemaakt ${esc(fmt(x.created))}</span><span>Laatste login ${x.last ? esc(fmt(x.last)) : '-'}</span><span>${clips.get(x.uid) || 0} gedeelde clips</span></p>
<div class="uid">${esc(x.uid)}</div>
<div class="row">${x.password ? act('reset', x, '', 'Reset-mail sturen', '', 'Een mail sturen zodat deze gebruiker een nieuw wachtwoord kan kiezen?') : '<span class="mu sm">Google-login: er is geen wachtwoord om te resetten.</span>'}${own ? '' : act('disable', x, `<input type="hidden" name="to" value="${x.disabled ? '0' : '1'}">`, x.disabled ? 'Weer aanzetten' : 'Account uitzetten', x.disabled ? '' : 'dng', x.disabled ? 'Dit account weer aanzetten?' : 'Dit account uitzetten? De gebruiker kan dan niet meer inloggen.')}</div></div>`;
  };
  return page(layout(T, `<h1>Gebruikers</h1><p class="mu">${all.length} ${all.length === 1 ? 'account' : 'accounts'}${needle ? `, ${list.length} gevonden` : ''}</p>
${U_OK[ok] ? `<div class="ok">${U_OK[ok]}</div>` : ''}${U_ERR[er] ? `<div class="err">${U_ERR[er]}</div>` : ''}
<form class="srch" method="get" action="/admin/users"><input name="q" value="${esc(q)}" placeholder="Zoek op e-mail, gebruikersnaam of ID" aria-label="Zoeken"><button class="btn" type="submit">Zoeken</button></form>
<div class="grid">${list.length ? list.map(row).join('') : '<p class="mu">Geen accounts gevonden.</p>'}</div>`, { admin: true, wide: true }));
}

// ---------- overzicht (hoofdpagina van /admin) ----------
async function adminHome(env) {
  const now = Date.now();
  const one = async sql => { try { return (await env.DB.prepare(sql).first()) || {}; } catch (e) { return {}; } };
  const tk = await one("SELECT COUNT(*) total, SUM(status='open') open, SUM(unread=1) unread, SUM(status='open' AND last_from='user') waiting FROM tickets");
  const cl = await one('SELECT COUNT(*) n, COALESCE(SUM(size),0) bytes FROM clips WHERE ready=1');
  let recentT = [];
  try { recentT = (await env.DB.prepare("SELECT id,subject,category,name,updated,last_from,unread FROM tickets WHERE status='open' ORDER BY unread DESC, updated DESC LIMIT 5").all()).results; } catch (e) {}

  let users = null, userNote = '';
  if (!fbReady(env)) userNote = 'De koppeling met Firebase staat nog niet aan (geheim FIREBASE_SERVICE_ACCOUNT).';
  else { try { users = await listUsers(env); } catch (e) { userNote = 'Firebase gaf een fout: ' + String(e.message).slice(0, 120); } }

  let names = new Map();
  try { names = new Map((await env.DB.prepare('SELECT uid,name FROM usernames').all()).results.map(r => [r.uid, r.name])); } catch (e) {}

  const stat = (href, n, label, hot) => `<a class="stat${hot ? ' hot' : ''}" href="${href}"><b>${n}</b><span>${label}</span></a>`;
  const week = now - 7 * DAY;
  const cards = [
    stat('/admin/tickets?status=open', tk.unread || 0, 'ongelezen tickets', (tk.unread || 0) > 0),
    stat('/admin/tickets?status=open', tk.waiting || 0, 'wachten op jouw antwoord', (tk.waiting || 0) > 0),
    stat('/admin/tickets?status=open', tk.open || 0, 'open tickets'),
    stat('/admin/tickets?status=all', tk.total || 0, 'tickets totaal')
  ];
  if (users) cards.push(
    stat('/admin/users', users.length, 'gebruikers'),
    stat('/admin/users', users.filter(x => x.created >= week).length, 'nieuw (7 dagen)'),
    stat('/admin/users', users.filter(x => x.last >= week).length, 'actief (7 dagen)'),
    stat('/admin/users', users.filter(x => x.disabled).length, 'uitgezet')
  );
  cards.push(`<div class="stat"><b>${cl.n || 0}</b><span>gedeelde clips · ${mb(cl.bytes || 0)}</span></div>`);

  const ticketRows = recentT.length ? recentT.map(r => `<a class="tk" href="/admin/t/${r.id}"><b>${r.unread ? '<span class="dot"></span>' : ''}${esc(r.subject)}</b><span class="mu sm">${esc(CATS[r.category] || r.category)} · ${esc(r.name || 'Anoniem')} · ${esc(fmt(r.updated))}${r.last_from === 'admin' ? ' · jij antwoordde laatst' : ''}</span></a>`).join('') : '<p class="mu">Geen open tickets. 🎉</p>';

  let userRows;
  if (!users) userRows = `<div class="err">${esc(userNote)}</div>`;
  else if (!users.length) userRows = '<p class="mu">Nog geen gebruikers.</p>';
  else userRows = users.slice(0, 5).map(x => `<a class="tk" href="/admin/users?q=${encodeURIComponent(x.email || x.uid)}"><b>${esc(x.email || '(geen e-mail)')}${x.disabled ? ' <span class="badge off">Uitgezet</span>' : ''}</b><span class="mu sm">${names.get(x.uid) ? esc(names.get(x.uid)) : 'nog geen gebruikersnaam'} · aangemaakt ${esc(fmt(x.created))}</span></a>`).join('');

  return page(layout('Overzicht - Beheer', `<h1>Overzicht</h1><p class="mu">Wat er speelt in Wistic.</p>
<div class="stats">${cards.join('')}</div>
<div class="cols"><div><div class="sec"><h2>Open tickets</h2><a href="/admin/tickets">Alle tickets &rarr;</a></div>
${ticketRows}</div>
<div><div class="sec"><h2>Nieuwste gebruikers</h2><a href="/admin/users">Alle gebruikers &rarr;</a></div>
${userRows}</div></div>`, { admin: true, wide: true }));
}

// ---------- routes ----------
const TOKEN = '([A-Za-z0-9]{24})', TID = '([A-Za-z0-9]{8})', FID = '([A-Za-z0-9]{10}\\.[a-z0-9]{2,4})';

export async function handleSupport(req, env, ctx, u) {
  const p = u.pathname.replace(/\/+$/, '') || '/', M = req.method;
  if (!(p === '/support' || p.startsWith('/support/') || p.startsWith('/api/support/') || p === '/admin' || p.startsWith('/admin/'))) return null;
  const GET = M === 'GET' || M === 'HEAD';
  let m;

  // --- publiek ---
  if (p === '/support' && GET) return page(supportForm(env));

  if (p === '/api/support/ticket' && M === 'POST') {
    const json = wantsJson(req), fail = (msg, s = 400) => json ? jres({ error: msg }, s) : page(layout('Support - Wistic', `<h1>Dat lukte niet</h1><div class="err">${esc(msg)}</div><p><a href="/support">Terug naar het formulier</a></p>`), s);
    if (!sameOrigin(req, u)) return fail('Verzoek geweigerd.', 403);
    const ik = await ipKey(req, env);
    if (await limited(env, 'tk:' + ik, 5, 3600e3)) return fail('Je hebt net al meerdere tickets gestuurd. Probeer het over een uur opnieuw.', 429);
    const r = await readForm(req); if (r.err) return fail(r.err, r.status);
    const f = r.form;
    if (line(f.get('website'), 50)) return json ? jres({ ok: true, url: '/support' }) : redirect('/support');   // spam-val
    const subject = line(f.get('subject'), MAX_SUBJ), body = text(f.get('message'), MAX_MSG);
    if (!subject) return fail('Vul een onderwerp in.');
    if (!body) return fail('Schrijf kort wat er aan de hand is.');
    const cat = CATS[f.get('category')] ? f.get('category') : 'anders';
    const pf = pickFiles(f); if (pf.err) return fail(pf.err);
    if (await storageFull(env, pf.total)) return fail('Bijlagen kunnen nu niet worden opgeslagen. Stuur je ticket zonder bijlagen of probeer het later opnieuw.', 507);
    const id = rnd(8), token = rnd(24), now = Date.now();
    const name = line(f.get('name'), 40), email = line(f.get('email'), 120);
    await env.DB.prepare('INSERT INTO tickets (id,token,name,email,category,subject,status,created,updated,last_from,unread) VALUES (?,?,?,?,?,?,?,?,?,?,1)')
      .bind(id, token, name, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '', cat, subject, 'open', now, now, 'user').run();
    await addMessage(env, id, 'user', body, pf.list);
    ctx.waitUntil(notify(env, `🎫 **Nieuw ticket** (${CATS[cat]}): ${subject}${pf.list.length ? ` · ${pf.list.length} bijlage(n)` : ''}\n${u.origin}/admin/t/${id}`));
    const url = '/support/t/' + token + '?new=1';
    return json ? jres({ ok: true, url }) : redirect(url);
  }

  if ((m = p.match(new RegExp('^/support/t/' + TOKEN + '$'))) && GET) {
    const t = await env.DB.prepare('SELECT * FROM tickets WHERE token=?').bind(m[1]).first();
    if (!t) return page(layout('Ticket niet gevonden', '<h1>Ticket niet gevonden</h1><p>De link klopt niet, of het ticket is verwijderd. <a href="/support">Open een nieuw ticket</a>.</p>'), 404);
    const msgs = (await env.DB.prepare('SELECT * FROM messages WHERE ticket_id=? ORDER BY id').bind(t.id).all()).results;
    const files = (await env.DB.prepare('SELECT * FROM files WHERE ticket_id=?').bind(t.id).all()).results;
    return page(ticketPage(t, msgs, files, u.searchParams.get('new') === '1'));
  }

  if ((m = p.match(new RegExp('^/api/support/t/' + TOKEN + '/reply$'))) && M === 'POST') {
    const json = wantsJson(req), fail = (msg, s = 400) => json ? jres({ error: msg }, s) : page(layout('Support - Wistic', `<h1>Dat lukte niet</h1><div class="err">${esc(msg)}</div><p><a href="/support/t/${m[1]}">Terug naar het ticket</a></p>`), s);
    if (!sameOrigin(req, u)) return fail('Verzoek geweigerd.', 403);
    const t = await env.DB.prepare('SELECT id,token,subject FROM tickets WHERE token=?').bind(m[1]).first();
    if (!t) return fail('Ticket niet gevonden.', 404);
    if (await limited(env, 'rp:' + await ipKey(req, env), 20, 3600e3)) return fail('Je hebt veel berichten gestuurd. Probeer het later opnieuw.', 429);
    const r = await readForm(req); if (r.err) return fail(r.err, r.status);
    const body = text(r.form.get('message'), MAX_MSG); if (!body) return fail('Schrijf eerst een bericht.');
    const pf = pickFiles(r.form); if (pf.err) return fail(pf.err);
    if (await storageFull(env, pf.total)) return fail('Bijlagen kunnen nu niet worden opgeslagen. Probeer het zonder bijlagen.', 507);
    await addMessage(env, t.id, 'user', body, pf.list);
    await env.DB.prepare("UPDATE tickets SET updated=?, last_from='user', unread=1, status='open' WHERE id=?").bind(Date.now(), t.id).run();
    ctx.waitUntil(notify(env, `💬 **Nieuw bericht** in "${t.subject}"\n${u.origin}/admin/t/${t.id}`));
    return json ? jres({ ok: true }) : redirect('/support/t/' + t.token);
  }

  if ((m = p.match(new RegExp('^/support/f/' + FID + '$'))) && GET) {
    const t = u.searchParams.get('t') || '';
    const f = await env.DB.prepare('SELECT f.* FROM files f JOIN tickets k ON k.id=f.ticket_id WHERE f.id=? AND k.token=?').bind(m[1], t).first();
    return f ? serveFile(env, f) : new Response('Niet gevonden', { status: 404 });
  }

  // --- beheer (alleen jij) ---
  if (p === '/admin' && GET) return (await isAdmin(req, env)) ? adminHome(env) : page(loginPage(env), adminOn(env) ? 200 : 503);

  if (p === '/admin/login' && M === 'POST') {
    if (!adminOn(env)) return page(loginPage(env), 503);
    if (!sameOrigin(req, u)) return page(loginPage(env, 'Verzoek geweigerd.'), 403);
    if (await limited(env, 'lg:' + await ipKey(req, env), 8, 900e3)) return page(loginPage(env, 'Te veel pogingen. Wacht even en probeer het opnieuw.'), 429);
    let pw = ''; try { pw = (await req.formData()).get('password'); } catch (e) {}
    if (!(await passOk(env, pw))) return page(loginPage(env, 'Dat wachtwoord klopt niet.'), 401);
    const exp = Date.now() + 7 * DAY, sig = await hmac(env.ADMIN_PASSWORD, 'adm.' + exp);
    return redirect('/admin', { 'set-cookie': `wa=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 86400}` });
  }
  if (p === '/admin/logout') return redirect('/admin', { 'set-cookie': 'wa=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });

  if (p.startsWith('/admin/')) {
    if (!(await isAdmin(req, env))) return redirect('/admin');
    if (M === 'POST' && !sameOrigin(req, u)) return new Response('Verzoek geweigerd', { status: 403 });

    if (p === '/admin/users' && GET) return adminUsers(env, line(u.searchParams.get('q'), 100), u.searchParams.get('ok'), u.searchParams.get('e'));
    if (p === '/admin/users/reset' && M === 'POST') {
      let uid = ''; try { uid = String((await req.formData()).get('uid') || ''); } catch (e) {}
      if (!/^[A-Za-z0-9]{6,128}$/.test(uid) || !fbReady(env)) return redirect('/admin/users?e=fb');
      if (await limited(env, 'rs:' + uid, 3, 3600e3)) return redirect('/admin/users?e=limit');
      try {
        const x = await getUser(env, uid);
        if (!x || !x.password || !x.email) return redirect('/admin/users?e=nopw');
        await sendReset(env, x.email);
        return redirect('/admin/users?ok=reset');
      } catch (e) { return redirect('/admin/users?e=fb'); }
    }
    if (p === '/admin/users/disable' && M === 'POST') {
      let uid = '', to = ''; try { const f = await req.formData(); uid = String(f.get('uid') || ''); to = String(f.get('to') || ''); } catch (e) {}
      if (!/^[A-Za-z0-9]{6,128}$/.test(uid) || !(to === '0' || to === '1') || !fbReady(env)) return redirect('/admin/users?e=fb');
      try {
        const x = await getUser(env, uid);
        if (!x) return redirect('/admin/users?e=fb');
        if (to === '1' && ownerOf(env, x)) return redirect('/admin/users?e=owner');
        await setDisabled(env, uid, to === '1');
        return redirect('/admin/users?ok=' + (to === '1' ? 'off' : 'on'));
      } catch (e) { return redirect('/admin/users?e=fb'); }
    }
    if (p === '/admin/tickets' && GET) return adminList(env, u.searchParams.get('status'));
    if ((m = p.match(new RegExp('^/admin/t/' + TID + '$'))) && GET) return adminTicket(env, m[1], u.searchParams.get('sent') ? 'Antwoord verstuurd.' : '');
    if ((m = p.match(new RegExp('^/admin/f/' + FID + '$'))) && GET) {
      const f = await env.DB.prepare('SELECT * FROM files WHERE id=?').bind(m[1]).first();
      return f ? serveFile(env, f) : new Response('Niet gevonden', { status: 404 });
    }
    if ((m = p.match(new RegExp('^/admin/t/' + TID + '/reply$'))) && M === 'POST') {
      const t = await env.DB.prepare('SELECT id FROM tickets WHERE id=?').bind(m[1]).first(); if (!t) return redirect('/admin/tickets');
      const r = await readForm(req); if (r.err) return page(layout('Fout', `<h1>Dat lukte niet</h1><div class="err">${esc(r.err)}</div><p><a href="/admin/t/${m[1]}">Terug</a></p>`, { admin: true }), r.status);
      const body = text(r.form.get('message'), MAX_MSG), pf = pickFiles(r.form);
      if (pf.err || !body) return page(layout('Fout', `<h1>Dat lukte niet</h1><div class="err">${esc(pf.err || 'Schrijf eerst een antwoord.')}</div><p><a href="/admin/t/${m[1]}">Terug</a></p>`, { admin: true }), 400);
      await addMessage(env, t.id, 'admin', body, pf.list);
      await env.DB.prepare("UPDATE tickets SET updated=?, last_from='admin', unread=0 WHERE id=?").bind(Date.now(), t.id).run();
      return redirect('/admin/t/' + t.id + '?sent=1');
    }
    if ((m = p.match(new RegExp('^/admin/t/' + TID + '/status$'))) && M === 'POST') {
      let s = ''; try { s = (await req.formData()).get('status'); } catch (e) {}
      if (s === 'open' || s === 'closed') await env.DB.prepare('UPDATE tickets SET status=?, updated=? WHERE id=?').bind(s, Date.now(), m[1]).run();
      return redirect('/admin/t/' + m[1]);
    }
    if ((m = p.match(new RegExp('^/admin/t/' + TID + '/delete$'))) && M === 'POST') { await wipe(env, m[1]); return redirect('/admin/tickets'); }
  }
  return null;
}

// Nachtelijk: oude gesloten tickets en oude limiet-regels opruimen
export async function cleanupSupport(env) {
  const now = Date.now();
  const { results } = await env.DB.prepare("SELECT id FROM tickets WHERE status='closed' AND updated<? LIMIT 100").bind(now - CLOSED_KEEP_DAYS * DAY).all();
  for (const r of results) await wipe(env, r.id);
  await env.DB.prepare('DELETE FROM rl WHERE t<?').bind(now - DAY).run();
}
