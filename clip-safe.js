// Bewaken dat een clipnaam nooit naar een pad buiten de clipmap kan wijzen.
// Wordt gebruikt door het verwijderen, openen en de meta-data van clips.
const path = require('path');
const crypto = require('crypto');

// Alleen een gewone bestandsnaam met een clip- of screenshot-extensie. Geen slashes, geen ..
function safeClipName(n) {
  const s = typeof n === 'string' ? n : '';
  if (!s || s.length > 200) return null;
  if (/[\\/]/.test(s)) return null;                       // geen mappen
  if (s === '.' || s === '..' || s.includes('\0')) return null;
  if (!/^[^<>:"/\\|?*\x00-\x1f]+$/i.test(s)) return null;  // geen Windows-verboden tekens
  if (!/\.(mp4|png)$/i.test(s)) return null;              // alleen clips en screenshots
  return s;
}

// Het volledige pad, gecontroleerd: moet binnen de clipmap blijven.
function clipPath(folder, n) {
  const s = safeClipName(n);
  if (!s) return null;
  const base = path.resolve(folder);
  const vol = path.resolve(base, s);
  if (path.dirname(vol).toLowerCase() !== base.toLowerCase()) return null;
  return vol;
}

// Zelfde naam, maar met een willekeurig einde: gebruikt bij het maken van bestanden.
function uniqueName(n) {
  const s = safeClipName(n);
  if (!s) return null;
  const i = s.lastIndexOf('.');
  return s.slice(0, i) + '-' + crypto.randomBytes(3).toString('hex') + s.slice(i);
}

module.exports = { safeClipName, clipPath, uniqueName };