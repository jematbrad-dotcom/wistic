// Favorieten in de eigen Google Drive van de gebruiker (scope drive.file: alleen bestanden die Wistic zelf maakt).
const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const AUTH = require('./auth');

const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
const CHUNK = 8 * 1024 * 1024;   // veelvoud van 256 KiB, zoals Drive eist
let folderId = '';

async function g(url, opt = {}) {
  const t = await AUTH.googleToken(); if (!t) throw new Error('Google Drive is niet verbonden.');
  const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + t }, opt.headers || {}) }));
  if (!r.ok) {
    let m = ''; try { const j = await r.clone().json(); m = (j.error && ((j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || j.error.message)) || ''; } catch (e) {}
    if (/accessNotConfigured|has not been used|SERVICE_DISABLED/i.test(m)) throw new Error('Zet de Google Drive API aan in Google Cloud (APIs & Services > Library).');
    if (r.status === 401) throw new Error('Google Drive: log opnieuw in met Google.');
    if (r.status === 403 && /storageQuotaExceeded|quota/i.test(m)) throw new Error('Je Google Drive zit vol.');
    throw new Error('Google Drive-fout (' + (m || r.status) + ').');
  }
  return r;
}

async function folder() {
  if (folderId) return folderId;
  const q = encodeURIComponent("name='Blips' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const j = await (await g(API + '/files?q=' + q + '&fields=files(id)&pageSize=1')).json();
  if (j.files && j.files[0]) return (folderId = j.files[0].id);
  const c = await (await g(API + '/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Blips', mimeType: 'application/vnd.google-apps.folder' }) })).json();
  return (folderId = c.id);
}

// Groot bestand in stukken uploaden (hervatbaar), met voortgang.
async function upload(file, name, props, mime, onPct) {
  const fid = await folder(), size = fs.statSync(file).size;
  const init = await g(UP + '/files?uploadType=resumable&fields=id', { method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify({ name, parents: [fid], appProperties: props }) });
  const loc = init.headers.get('location'); if (!loc) throw new Error('Google Drive: upload kon niet starten.');
  const fd = fs.openSync(file, 'r'); let pos = 0, id = '';
  try {
    while (pos < size) {
      const n = Math.min(CHUNK, size - pos), buf = Buffer.alloc(n); fs.readSync(fd, buf, 0, n, pos);
      let r, tries = 0;
      for (;;) {
        try { r = await fetch(loc, { method: 'PUT', headers: { 'Content-Range': `bytes ${pos}-${pos + n - 1}/${size}` }, body: buf }); break; }
        catch (e) { if (++tries > 4) throw new Error('Geen internetverbinding.'); await new Promise(res => setTimeout(res, 1500 * tries)); }
      }
      if (r.status === 308) { pos += n; onPct && onPct(pos / size); continue; }
      if (r.ok) { const j = await r.json().catch(() => ({})); id = j.id || ''; pos = size; onPct && onPct(1); break; }
      throw new Error('Google Drive-upload mislukt (' + r.status + ').');
    }
  } finally { fs.closeSync(fd); }
  return id;
}

// Klein bestand (thumbnail) in één keer.
async function uploadSmall(file, name, props, mime) {
  const fid = await folder(), b = 'blips' + Date.now();
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [fid], appProperties: props })}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`),
    fs.readFileSync(file), Buffer.from(`\r\n--${b}--`)]);
  const r = await g(UP + '/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
  return (await r.json()).id;
}

async function list() {
  const fid = await folder(); let out = [], tok = '';
  do {
    const q = encodeURIComponent(`'${fid}' in parents and trashed=false`);
    const j = await (await g(API + '/files?q=' + q + '&pageSize=200&fields=nextPageToken,files(id,name,size,createdTime,appProperties)' + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''))).json();
    out = out.concat(j.files || []); tok = j.nextPageToken || '';
  } while (tok);
  return out;
}

async function download(id, dest, onPct, size) {
  const r = await g(API + '/files/' + id + '?alt=media');
  const total = +r.headers.get('content-length') || size || 0, part = dest + '.part';
  let got = 0; const rs = Readable.fromWeb(r.body);
  rs.on('data', d => { got += d.length; total && onPct && onPct(Math.min(1, got / total)); });
  try { await pipeline(rs, fs.createWriteStream(part)); fs.renameSync(part, dest); }
  catch (e) { try { fs.rmSync(part, { force: true }); } catch (x) {} throw e; }
}

async function setProps(id, props) { await g(API + '/files/' + id + '?fields=id', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appProperties: props }) }); }
async function remove(id) { await g(API + '/files/' + id, { method: 'DELETE' }); }
const reset = () => { folderId = ''; };

module.exports = { upload, uploadSmall, list, download, remove, setProps, reset };
