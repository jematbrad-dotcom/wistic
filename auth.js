// Firebase Authentication via de officiële REST API (Identity Toolkit). Geen extra npm-pakket nodig.
const { app, safeStorage, shell, net } = require('electron');
const http = require('http'), crypto = require('crypto');
const path = require('path'), fs = require('fs');
const cfg = require('./firebase-config');
const { T: tr } = require('./i18n');

const IDT = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const STS = 'https://securetoken.googleapis.com/v1/token';

// Netwerk via Chromium (net.fetch): volgt de Windows-proxy, DNS en certificaten. Node's eigen fetch doet dat niet en faalt daardoor
// op sommige pc's (VPN, school/werk-wifi, antivirus, proxy). Valt terug op gewone fetch als de app nog niet klaar is.
const nfetch = (u, o) => (app.isReady() && net && net.fetch ? net.fetch(u, o) : fetch(u, o));
// Laat de echte oorzaak zien (bv. ERR_NAME_NOT_RESOLVED) in plaats van altijd "Geen internetverbinding".
const netErr = e => {
  const m = String((e && (e.code || (e.cause && e.cause.code))) || (e && e.message) || '');
  if (/INTERNET_DISCONNECTED|NETWORK_CHANGED/.test(m)) return new Error('Geen internetverbinding.');
  return new Error('Er ging iets mis (' + (m.replace(/^net::/, '') || 'netwerk') + ').');
};
const file = () => path.join(app.getPath('userData'), 'auth.json');

const MSG = {
  EMAIL_EXISTS: 'Er bestaat al een account met dit e-mailadres.',
  INVALID_EMAIL: 'Dit e-mailadres is ongeldig.',
  MISSING_PASSWORD: 'Vul een wachtwoord in.',
  WEAK_PASSWORD: 'Wachtwoord te zwak: minimaal 6 tekens.',
  EMAIL_NOT_FOUND: 'Verkeerd e-mailadres of wachtwoord.',
  INVALID_PASSWORD: 'Verkeerd e-mailadres of wachtwoord.',
  INVALID_LOGIN_CREDENTIALS: 'Verkeerd e-mailadres of wachtwoord.',
  USER_DISABLED: 'Dit account is uitgeschakeld.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Te veel pogingen. Probeer het later opnieuw.',
  OPERATION_NOT_ALLOWED: 'Deze inlogmethode staat uit in je Firebase-project (Authentication > Sign-in method).',
  INVALID_IDP_RESPONSE: 'Google-login mislukt. Probeer het opnieuw.',
  API_KEY_INVALID: 'Firebase API-key klopt niet (zie firebase-config.js).'
};

async function call(url, body) {
  if (!cfg.apiKey || cfg.apiKey.startsWith('PLAK_')) throw new Error('Firebase is nog niet ingesteld (zie firebase-config.js).');
  let r;
  try {
    r = await nfetch(url + (url.includes('?') ? '&' : '?') + 'key=' + cfg.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { throw netErr(e); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = String((j.error && j.error.message) || '').split(' ')[0];
    throw new Error(MSG[code] || 'Er ging iets mis (' + (code || r.status) + ').');
  }
  return j;
}

function save(s) {
  const o = { email: s.email, uid: s.uid, name: s.name };
  const rt = Buffer.from(s.refreshToken);
  if (safeStorage.isEncryptionAvailable()) { o.rt = safeStorage.encryptString(s.refreshToken).toString('base64'); o.enc = true; }
  else o.rt = rt.toString('base64');
  if (s.g) o.g = (o.enc ? safeStorage.encryptString(s.g) : Buffer.from(s.g)).toString('base64');
  fs.writeFileSync(file(), JSON.stringify(o));
}
function load() {
  try {
    const o = JSON.parse(fs.readFileSync(file(), 'utf8'));
    const buf = Buffer.from(o.rt, 'base64');
    const dec = b64 => { const b = Buffer.from(b64, 'base64'); return o.enc ? safeStorage.decryptString(b) : b.toString(); };
    return { email: o.email, uid: o.uid, name: o.name, refreshToken: dec(o.rt), g: o.g ? dec(o.g) : '' };
  } catch (e) { return null; }
}

const pub = s => ({ email: s.email, uid: s.uid, name: s.name, verified: !!s.verified, drive: false });

async function signup(email, password, name) {
  const j = await call(IDT + 'signUp', { email, password, returnSecureToken: true });
  let display = name || email.split('@')[0];
  await call(IDT + 'update', { idToken: j.idToken, displayName: display, returnSecureToken: false });
  try { await call(IDT + 'sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: j.idToken }); } catch (e) {}
  const s = { email: j.email, uid: j.localId, name: display, refreshToken: j.refreshToken };
  save(s); return pub(s);
}
async function login(email, password) {
  const j = await call(IDT + 'signInWithPassword', { email, password, returnSecureToken: true });
  const s = { email: j.email, uid: j.localId, name: j.displayName || j.email.split('@')[0], refreshToken: j.refreshToken };
  save(s); return pub(s);
}

// ---- Inloggen met Google (OAuth 2.0 voor desktop-apps: browser + loopback + PKCE) ----
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function googleCode() {
  return new Promise((resolve, reject) => {
    const verifier = b64u(crypto.randomBytes(32)), state = b64u(crypto.randomBytes(16));
    const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
    let done = false, port = 0;
    const page = (t, m) => `<!doctype html><meta charset=utf-8><title>Wistic</title><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0e09;color:#e0e7d8;font:16px system-ui,sans-serif"><div style="text-align:center"><h2 style="margin:0 0 8px">${tr(t)}</h2><p style="color:#87937c">${tr(m)}</p></div>`;
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404); return res.end(); }
      const code = u.searchParams.get('code'), err = u.searchParams.get('error');
      const ok = code && u.searchParams.get('state') === state;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(ok ? page('Ingelogd bij Wistic', 'Je kunt dit tabblad sluiten en terug naar de app gaan.') : page('Inloggen mislukt', 'Ga terug naar Wistic en probeer het opnieuw.'));
      if (done) return; done = true; clearTimeout(tm); srv.close();
      if (ok) resolve({ code, verifier, redirect: 'http://127.0.0.1:' + port });
      else reject(new Error(err === 'access_denied' ? 'Inloggen met Google geannuleerd.' : 'Google-login mislukt. Probeer het opnieuw.'));
    });
    const tm = setTimeout(() => { if (done) return; done = true; srv.close(); reject(new Error('Google-login duurde te lang. Probeer het opnieuw.')); }, 3 * 60 * 1000);
    srv.on('error', () => { if (done) return; done = true; clearTimeout(tm); reject(new Error('Kon lokale login-server niet starten.')); });
    srv.listen(0, '127.0.0.1', () => {
      port = srv.address().port;
      const redirect = 'http://127.0.0.1:' + port;
      const q = new URLSearchParams({ client_id: cfg.googleClientId, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', access_type: 'offline',
        code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'consent select_account' });
      shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + q);
    });
  });
}
async function google() {
  if (!cfg.googleClientId || cfg.googleClientId.startsWith('PLAK_')) throw new Error('Google-login is nog niet ingesteld (zie firebase-config.js).');
  const { code, verifier, redirect } = await googleCode();
  const body = new URLSearchParams({ code, client_id: cfg.googleClientId, client_secret: cfg.googleClientSecret || '', redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier });
  let r;
  try { r = await nfetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); }
  catch (e) { throw netErr(e); }
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.id_token) throw new Error('Google-login mislukt (' + (t.error_description || t.error || r.status) + ').');
  const j = await call(IDT + 'signInWithIdp', { postBody: 'id_token=' + t.id_token + '&providerId=google.com', requestUri: 'http://localhost', returnIdpCredential: true, returnSecureToken: true });
  let name = j.displayName, photo = j.photoUrl;
  try { const l = await call(IDT + 'lookup', { idToken: j.idToken }); const u = l.users && l.users[0]; if (u) { if (u.displayName) name = u.displayName; photo = u.photoUrl || photo; } } catch (e) {}
  const s = { email: j.email, uid: j.localId, name: name || (j.email || 'Gebruiker').split('@')[0], refreshToken: j.refreshToken,
    g: '' };
  gtok = { v: '', exp: 0 };
  save(s); return Object.assign(pub(s), { isNew: !!j.isNewUser, photo: photo || '', drive: false });
}

// Verse idToken ophalen met de opgeslagen refresh-token en gekozen gebruikersnaam naar Firebase schrijven.
async function setName(name) {
  const s = load(); if (!s) throw new Error('Niet ingelogd.');
  const r = await nfetch(STS + '?key=' + cfg.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refreshToken) });
  if (!r.ok) throw new Error('Sessie verlopen.');
  const j = await r.json();
  await call(IDT + 'update', { idToken: j.id_token, displayName: name, returnSecureToken: false });
  s.refreshToken = j.refresh_token || s.refreshToken; s.name = name; save(s); return true;
}

// ---- Google Drive: access-token ophalen met de opgeslagen Google refresh-token ----
const driveOn = () => false;   // Google Drive staat uit in Wistic
async function googleToken() {
  if (gtok.v && Date.now() < gtok.exp - 60000) return gtok.v;
  const s = load(); if (!s || !s.g) return null;
  const body = new URLSearchParams({ client_id: cfg.googleClientId, client_secret: cfg.googleClientSecret || '', refresh_token: s.g, grant_type: 'refresh_token' });
  let r; try { r = await nfetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); }
  catch (e) { throw netErr(e); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error === 'invalid_grant') { s.g = ''; save(s); }   // toestemming ingetrokken of verlopen
    throw new Error('Google Drive: log opnieuw in met Google.');
  }
  gtok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return gtok.v;
}
async function reset(email) { await call(IDT + 'sendOobCode', { requestType: 'PASSWORD_RESET', email }); return true; }
let gtok = { v: '', exp: 0 };
function logout() { gtok = { v: '', exp: 0 }; try { fs.rmSync(file(), { force: true }); } catch (e) {} return true; }

// Controleert bij het opstarten of de opgeslagen sessie nog geldig is (bijv. account verwijderd/uitgeschakeld).
async function restore() {
  const s = load(); if (!s) return null;
  try {
    const r = await nfetch(STS + '?key=' + cfg.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refreshToken) });
    if (r.status >= 400 && r.status < 500) { logout(); return null; }   // sessie ongeldig
    if (!r.ok) return pub(s);
    const j = await r.json(); s.refreshToken = j.refresh_token || s.refreshToken; save(s);
    return pub(s);
  } catch (e) { return pub(s); }   // offline: gewoon doorgaan met opgeslagen sessie
}
const current = () => { const s = load(); return s ? pub(s) : null; };

// Verse Firebase ID-token (1 uur geldig); de Share-server gebruikt die om te zien wie er uploadt.
async function idToken() {
  const s = load(); if (!s) throw new Error('Log eerst in bij Wistic om clips te delen.');
  let r;
  try { r = await nfetch(STS + '?key=' + cfg.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refreshToken) }); }
  catch (e) { throw netErr(e); }
  if (!r.ok) throw new Error('Sessie verlopen. Log opnieuw in bij Wistic.');
  const j = await r.json();
  if (j.refresh_token && j.refresh_token !== s.refreshToken) { s.refreshToken = j.refresh_token; save(s); }
  return j.id_token;
}

module.exports = { nfetch, netErr, signup, login, google, setName, driveOn, googleToken, reset, logout, restore, current, idToken };
