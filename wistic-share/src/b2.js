// Backblaze B2 als tweede opslaglaag: 10 GB gratis naast de 10 GB van R2.
// B2 praat het S3-protocol, dus we tekenen onze verzoeken zelf (AWS SigV4 met WebCrypto).
// Zonder secrets werkt alles gewoon op R2; met secrets verhuist de oude opslag 's nachts naar B2.
//
// Secrets (via `wrangler secret put`, nooit in een bestand):
//   B2_BUCKET   naam van de bucket, bijv. wistic-clips
//   B2_REGION   regio uit het bucket-pad, bijv. eu-central-003
//   B2_KEY_ID   application key id
//   B2_APP_KEY  application key (alleen lezen/schrijven in die ene bucket geven)

const ENC = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', ENC.encode(s)));
const stampOf = d => d.toISOString().replace(/[:-]|\.\d{3}/g, '');
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ENC.encode(msg)));
}

export const b2On = env => !!(env && env.B2_BUCKET && env.B2_REGION && env.B2_KEY_ID && env.B2_APP_KEY);
// Standaard gaan we met pad-stijl (s3.<regio>.backblazeb2.com/<bucket>/<naam>), wat B2 ook ondersteunt.
const host = env => {
  const h = env.B2_HOST || ('s3.' + env.B2_REGION + '.backblazeb2.com');
  return env.B2_VHOST ? env.B2_BUCKET + '.' + h : h;
};
const path = env => env.B2_VHOST ? '/' : '/' + enc(env.B2_BUCKET) + '/';
const url = (env, key) => 'https://' + host(env) + path(env) + enc(key);
const scope = (env, day) => day + '/' + env.B2_REGION + '/s3/aws4_request';

async function chain(env, day) {
  const k = await hmac(ENC.encode('AWS4' + env.B2_APP_KEY), day);
  const k2 = await hmac(k, env.B2_REGION);
  const k3 = await hmac(k2, 's3');
  return hmac(k3, 'aws4_request');
}

// De string-to-sign: algoritme, tijdstip, bereik en de hash van het canonieke verzoek.
const toSign = async (env, ts, day, canonical) => 'AWS4-HMAC-SHA256\n' + ts + '\n' + scope(env, day) + '\n' + await sha256(canonical);

// ---------- GET: korte download-link (de video streamt dan rechtstreeks vanaf B2) ----------
export async function b2GetUrl(env, key, seconds = 3600, disposition, when) {
  if (!b2On(env)) return '';
  const ts = stampOf(when || new Date()), day = ts.slice(0, 8), k = await chain(env, day);
  const q = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': env.B2_KEY_ID + '/' + scope(env, day),
    'X-Amz-Date': ts,
    'X-Amz-Expires': String(seconds),
    'X-Amz-SignedHeaders': 'host'
  };
  if (disposition) q['response-content-disposition'] = disposition;
  const qs = Object.keys(q).sort().map(n => enc(n) + '=' + enc(q[n])).join('&');
  const canonical = ['GET', path(env) + enc(key), qs, 'host:' + host(env), '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const sig = hex(await hmac(k, await toSign(env, ts, day, canonical)));
  return url(env, key) + '?' + qs + '&X-Amz-Signature=' + sig;
}

// ---------- PUT / DELETE / HEAD: verzoek met handtekening in de headers ----------
async function send(env, method, key, body, extra) {
  if (!b2On(env)) return null;
  const ts = stampOf(new Date()), day = ts.slice(0, 8), k = await chain(env, day);
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const canonHdrs = ['host:' + host(env), 'x-amz-content-sha256:UNSIGNED-PAYLOAD', 'x-amz-date:' + ts].join('\n');
  const canonical = [method, path(env) + enc(key), '', canonHdrs, '', signed, 'UNSIGNED-PAYLOAD'].join('\n');
  const sig = hex(await hmac(k, await toSign(env, ts, day, canonical)));
  const headers = Object.assign({
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': ts,
    authorization: 'AWS4-HMAC-SHA256 Credential=' + env.B2_KEY_ID + '/' + scope(env, day) + ', SignedHeaders=' + signed + ', Signature=' + sig
  }, extra || {});
  const r = await fetch(url(env, key), { method, headers, body });
  return r;
}

export const b2Put = (env, key, body, contentType) => send(env, 'PUT', key, body, { 'content-type': contentType || 'application/octet-stream' });
export const b2Delete = async (env, key) => { const r = await send(env, 'DELETE', key); return !!r && (r.ok || r.status === 404); };
export async function b2Head(env, key) {
  const r = await send(env, 'HEAD', key);
  if (!r || !r.ok) return null;
  return { size: +(r.headers.get('content-length') || 0), etag: r.headers.get('etag') };
}