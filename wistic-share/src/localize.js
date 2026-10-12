// Vertaalt eerst de nieuwe teksten (i18n-vergelijk.js) en laat daarna de gewone i18n.js de rest doen.
// Zo hoef je i18n.js zelf niet aan te passen.
import { localize as base, pickLang } from './i18n.js';
import { EXTRA } from './i18n-vergelijk.js';

const LIST = [...EXTRA].sort((a, b) => b[0].length - a[0].length);

export async function localize(req, res) {
  const path = new URL(req.url).pathname;
  const ct = res.headers.get('content-type') || '';
  if (!path.startsWith('/admin') && /text\/html/i.test(ct) && pickLang(req) === 'en') {
    let t = await res.text();
    for (const [nl, en] of LIST) if (t.includes(nl)) t = t.split(nl).join(en);
    const h = new Headers(res.headers);
    h.delete('content-length');
    res = new Response(t, { status: res.status, headers: h });
  }
  return base(req, res);
}
