// Firebase-beheer vanuit de Worker: gebruikers opvragen, uitzetten en een wachtwoord-resetmail sturen.
// Nodig: het geheim FIREBASE_SERVICE_ACCOUNT (de volledige JSON van een Firebase service account-key).
// Optioneel maar aangeraden: FIREBASE_API_KEY in wrangler.toml (de publieke web-API-key uit firebase-config.js), voor de resetmail.

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function account(env) {
  try {
    const j = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '');
    return j && j.client_email && j.private_key ? j : null;
  } catch (e) { return null; }
}
export const fbReady = env => !!account(env);

let tok = null, tokExp = 0;
async function token(env) {
  if (tok && Date.now() < tokExp - 60e3) return tok;
  const k = account(env); if (!k) throw new Error('Geen service account ingesteld');
  const now = Math.floor(Date.now() / 1000);
  const head = b64(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64(enc.encode(JSON.stringify({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const der = Uint8Array.from(atob(k.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + b64(sig)
  });
  const d = await r.json().catch(() => ({}));
  if (!d.access_token) throw new Error('Inloggen bij Google mislukt (' + (d.error || r.status) + ')');
  tok = d.access_token; tokExp = Date.now() + (d.expires_in || 3600) * 1000;
  return tok;
}

async function call(env, method, path, body) {
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID + path, {
    method, headers: { authorization: 'Bearer ' + await token(env), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || 'Firebase fout ' + r.status);
  return d;
}

const shape = u => {
  const ids = (u.providerUserInfo || []).map(p => p.providerId);
  return {
    uid: u.localId, email: u.email || '', name: u.displayName || '', providers: ids,
    google: ids.includes('google.com'), password: ids.includes('password'),
    created: +u.createdAt || 0, last: +u.lastLoginAt || 0, disabled: !!u.disabled
  };
};

// Alle accounts, nieuwste eerst (maximaal 5000)
export async function listUsers(env) {
  const out = []; let next = '';
  for (let i = 0; i < 5; i++) {
    const d = await call(env, 'GET', '/accounts:batchGet?maxResults=1000' + (next ? '&nextPageToken=' + encodeURIComponent(next) : ''));
    out.push(...(d.users || []).map(shape));
    next = d.nextPageToken || ''; if (!next) break;
  }
  return out.sort((a, b) => b.created - a.created);
}

export async function getUser(env, uid) {
  const d = await call(env, 'POST', '/accounts:lookup', { localId: [uid] });
  return d.users && d.users[0] ? shape(d.users[0]) : null;
}

export async function setDisabled(env, uid, disabled) {
  await call(env, 'POST', '/accounts:update', { localId: uid, disableUser: !!disabled });
}

// Stuurt de gebruiker een mail om zelf een nieuw wachtwoord te kiezen. Jij ziet of zet nooit een wachtwoord.
export async function sendReset(env, email) {
  if (env.FIREBASE_API_KEY) {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=' + encodeURIComponent(env.FIREBASE_API_KEY), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d.error && d.error.message) || 'Resetmail mislukt'); }
    return;
  }
  await call(env, 'POST', '/accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email });
}
