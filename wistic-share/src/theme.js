// Gedeeld ontwerp voor homepage en /vergelijkingen: kleuren, menu, voet en vergelijkingstabel.
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const BASE_CSS = `
:root{color-scheme:dark;--bg:#0e1110;--pn:#151917;--pn2:#1b201d;--bd:#262c28;--tx:#eef2ea;--tx2:#c0c8ba;--mu:#879185;--ac:#8bb566;--ac2:#4f6b3a;--gr:#c9e8a0;--on:#0f150d}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;background:var(--bg);color:var(--tx);font:17px/1.65 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%;overflow-x:hidden;position:relative}
body:before{content:"";position:absolute;inset:0 0 auto;height:700px;background:radial-gradient(55% 70% at 20% 0,#7da35e33,transparent 70%);pointer-events:none;z-index:-1}
a{color:inherit}.wrap{max-width:1760px;margin:0 auto;padding:0 clamp(20px,5vw,96px)}
h1,h2,h3,summary,.d{font-family:"Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.03em;margin:0}
header{position:sticky;top:0;z-index:20;padding-top:env(safe-area-inset-top);background:#0e1110d0;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid #ffffff0d}
header .wrap{display:flex;justify-content:space-between;align-items:center;height:66px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font:800 1.25rem "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.03em}
.brand img{width:36px;height:36px;border-radius:22%;display:block}
.top{display:flex;align-items:center;gap:4px}.top a{padding:8px 13px;border-radius:99px;text-decoration:none;color:var(--tx2);font-weight:600;font-size:.95rem}
.top a:hover{background:var(--pn2);color:var(--tx)}.top a.nbtn{background:var(--ac);color:var(--on);margin-left:6px}.top a.nbtn:hover{background:#9bc176}
.btn{display:inline-block;text-decoration:none;font:600 1rem system-ui,sans-serif;padding:14px 26px;border-radius:99px;border:1px solid var(--bd);background:var(--pn);color:var(--tx)}
.btn:hover{border-color:var(--ac2);background:var(--pn2)}.btn.pri{background:var(--ac);border-color:var(--ac);color:var(--on)}.btn.pri:hover{background:#9bc176}.btn.off{opacity:.6;pointer-events:none}
.btn.s{padding:9px 16px;font-size:.9rem}.cta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
a:focus-visible,summary:focus-visible,.btn:focus-visible{outline:2px solid #b9d99a;outline-offset:3px;border-radius:10px}
section{padding:clamp(44px,7vw,84px) 0}
h2{font-weight:800;font-size:clamp(1.9rem,5vw,2.9rem);line-height:1.05;margin:0 0 32px;max-width:18ch}
.card{background:var(--pn);border:1px solid var(--bd);border-radius:22px;padding:26px}
kbd{font:600 .88em system-ui,sans-serif;background:var(--bg);border:1px solid #4a5246;border-bottom-width:3px;border-radius:7px;padding:1px 8px;color:var(--tx)}
.cmp{border:1px solid var(--bd);border-radius:24px;overflow:hidden;background:var(--pn)}
.cr{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,5fr) minmax(0,5fr);gap:clamp(14px,3vw,40px);padding:20px clamp(18px,3vw,32px);border-top:1px solid var(--bd)}.cr:first-child{border-top:0}
.cr.ch{background:var(--pn2);font:800 1.15rem "Bricolage Grotesque",system-ui,sans-serif;padding-block:16px}.cr.ch div:nth-child(2){color:var(--gr)}
.cr b{font-weight:600}.cr .mu{color:var(--mu)}.cr .w{background:#8bb56624;border-radius:14px;padding:10px 14px;margin:-10px 0}.ok{color:var(--gr);font-weight:800}
footer{padding:30px 0 max(34px,env(safe-area-inset-bottom));color:var(--mu);font-size:.9rem;border-top:1px solid var(--bd)}footer a{color:var(--mu)}footer a:hover{color:var(--tx)}.sep{margin:0 8px;opacity:.6}
@media(max-width:780px){.cr{grid-template-columns:1fr;gap:6px}.cr.ch{display:none}.cr div:before{content:attr(data-l);display:block;font-size:.78rem;font-weight:600;color:var(--mu);margin-top:6px}.top a.nbtn{display:none}}
@media(max-width:520px){.btn{text-align:center}.cta .btn{flex:1 1 100%}}
`;

export function dlInfo(env) {
  const dl = String(env.DOWNLOAD_URL || '').trim(), dc = String(env.DISCORD_INVITE || '').trim();
  const dlOk = /^https:\/\//i.test(dl), dcOk = /^https:\/\/(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/i.test(dc);
  return {
    dlOk, dcOk, dc, dl,
    dlBtn: dlOk ? `<a class="btn pri" href="${esc(dl)}">Download voor Windows</a>` : `<span class="btn pri off" aria-disabled="true">Download volgt binnenkort</span>`,
    dcBtn: dcOk ? `<a class="btn" href="${esc(dc)}" rel="noopener">Join onze Discord</a>` : ''
  };
}

export function shell(env, { title, desc, css = '', body }, assets = { favicon: '/favicon.png' }) {
  const i = dlInfo(env);
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><meta property="og:site_name" content="Wistic"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta name="theme-color" content="#0e1110">
<link rel="icon" type="image/png" href="${assets.favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;600&display=swap" rel="stylesheet"><style>${BASE_CSS}${css}</style></head>
<body>
<header><div class="wrap"><a class="brand" href="/"><img src="${assets.favicon}" width="36" height="36" alt="">Wistic</a><nav class="top" aria-label="Menu">${i.dcOk ? `<a href="${esc(i.dc)}" rel="noopener">Discord</a>` : ''}<a href="/compare">Vergelijk</a><a href="/support">Support</a>${i.dlOk ? `<a class="nbtn" href="${esc(i.dl)}">Download voor Windows</a>` : ''}</nav></div></header>
<main>${body}</main>
<footer><div class="wrap">Wistic. Geen overlay, alleen clips.<span class="sep">·</span><a href="/compare">Vergelijk</a><span class="sep">·</span><a href="/support">Support</a>${i.dcOk ? `<span class="sep">·</span><a href="${esc(i.dc)}" rel="noopener">Discord</a>` : ''}</div></footer>
</body></html>`;
}

// Een vergelijkingstabel: rows = [[onderwerp, wistic, andere]]
export function table(name, rows) {
  return `<div class="cmp"><div class="cr ch"><b></b><div>Wistic</div><div>${esc(name)}</div></div>` +
    rows.map(([a, w, o]) => `<div class="cr"><b>${a}</b><div class="w" data-l="Wistic"><span class="ok">✓</span> ${w}</div><div class="mu" data-l="${esc(name)}">${o}</div></div>`).join('') + `</div>`;
}
