// Backblaze B2 als tweede opslaglaag: 10 GB gratis naast de 10 GB van R2.
// We praten het S3-protocol van B2 met een eigen SigV4-handtekening (WebCrypto, geen extra
// dependency). Twee dingen die B2 striek eist: de echte hash van de inhoud (nooit UNSIGNED-PAYLOAD
// bij schrijven), en de S3-API moet aanstaan bij de bucket én de sleutel.
//
// Secrets (via `wrangler secret put`, nooit in een bestand):
//   B2_BUCKET   naam van de bucket, bijv. wistic-clips
//   B2_REGION   regio uit het bucket-pad, bv. us-east-005
//   B2_KEY_ID   application key id (master keys mogen niet op S3)
//   B2_APP_KEY  application key, met de S3-rechten aan (lezen, schrijven, lijstjes)
//
// De handtekening is getest tegen de officiële testvector van AWS: `node b2-test.mjs`.

const ENC = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', ENC.encode(s)));
const sha256b = async b => hex(await crypto.subtle.digest('SHA-256', b));
const LEEG = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';   // sha256 van niks
const stampOf = d => d.toISOString().replace(/[:-]|\.\d{3}/g, '');
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ENC.encode(msg)));
}

export const b2On = env => !!(env && env.B2_BUCKET && env.B2_REGION && env.B2_KEY_ID && env.B2_APP_KEY);
// Standaard pad-stijl: s3.<regio>.backblazeb2.com/<bucket>/<naam>. Met B2_VHOST gaat de bucket in de host.
const fullHost = env => (env.B2_VHOST ? env.B2_BUCKET + '.' : '') + (env.B2_HOST || ('s3.' + env.B2_REGION + '.backblazeb2.com'));
const pad = (env, key) => (env.B2_VHOST ? '' : '/' + enc(env.B2_BUCKET)) + '/' + enc(key);
const url = (env, key) => 'https://' + fullHost(env) + pad(env, key);
const scope = (env, day) => day + '/' + env.B2_REGION + '/s3/aws4_request';

async function chain(env, day) {
  const k = await hmac(ENC.encode('AWS4' + env.B2_APP_KEY), day);
  const k2 = await hmac(k, env.B2_REGION);
  return hmac(await hmac(k2, 's3'), 'aws4_request');
}
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
  const canonical = ['GET', pad(env, key), qs, 'host:' + fullHost(env), '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const sig = hex(await hmac(k, await toSign(env, ts, day, canonical)));
  return url(env, key) + '?' + qs + '&X-Amz-Signature=' + sig;
}

// ---------- PUT / DELETE / HEAD: verzoek met handtekening in de headers ----------
async function send(env, method, key, body, extra) {
  if (!b2On(env)) return null;
  const hash = body ? await sha256b(body) : LEEG;
  const ts = stampOf(new Date()), day = ts.slice(0, 8), k = await chain(env, day);
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const canonHdrs = ['host:' + fullHost(env), 'x-amz-content-sha256:' + hash, 'x-amz-date:' + ts].join('\n');
  const canonical = [method, pad(env, key), '', canonHdrs, '', signed, hash].join('\n');
  const sig = hex(await hmac(k, await toSign(env, ts, day, canonical)));
  const headers = Object.assign({
    'x-amz-content-sha256': hash,
    'x-amz-date': ts,
    authorization: 'AWS4-HMAC-SHA256 Credential=' + env.B2_KEY_ID + '/' + scope(env, day) + ', SignedHeaders=' + signed + ', Signature=' + sig
  }, extra || {});
  return fetch(url(env, key), { method, headers, body });
}

// Bij schrijven moet het blokje bytes zijn (geen stream): de hash ervan gaat in de handtekening.
export const b2Put = (env, key, body, contentType) => send(env, 'PUT', key, body, { 'content-type': contentType || 'application/octet-stream' });
export const b2Delete = async (env, key) => { const r = await send(env, 'DELETE', key); return !!r && (r.ok || r.status === 404); };
export async function b2Head(env, key) {
  const r = await send(env, 'HEAD', key);
  if (!r || !r.ok) return null;
  return { size: +(r.headers.get('content-length') || 0), etag: r.headers.get('etag') };
}