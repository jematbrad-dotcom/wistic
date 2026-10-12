// Gedeeld ontwerp voor homepage en /vergelijkingen: kleuren, menu, voet en vergelijkingstabel.
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const BASE_CSS = `
:root{color-scheme:dark;--bg:#0b0c0b;--pn:#101210;--pn2:#151815;--bd:#1f231e;--tx:#eef1ea;--tx2:#b7beb1;--mu:#78806f;--ac:#7ea85c;--ac2:#42582f;--gr:#c9e8a0;--on:#0e130b}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:76px}
body{margin:0;background:var(--bg);color:var(--tx);font:17px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%;overflow-x:hidden}
a{color:inherit}.wrap{width:100%;max-width:2100px;margin:0 auto;padding:0 clamp(20px,4.5vw,64px)}
h1,h2,h3,summary,.d{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.02em;margin:0}
header{position:sticky;top:0;z-index:20;padding-top:env(safe-area-inset-top);background:#0b0c0bd0;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--bd)}
header .wrap{display:flex;justify-content:space-between;align-items:center;height:60px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font:800 1.15rem system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.02em}
.brand img{width:30px;height:30px;border-radius:8px;display:block}
.top{display:flex;align-items:center;gap:2px}.top a{padding:8px 13px;border-radius:8px;text-decoration:none;color:var(--tx2);font-weight:600;font-size:.92rem}
.top a:hover{background:var(--pn2);color:var(--tx)}.top a.nbtn{background:var(--ac);color:var(--on);margin-left:6px}.top a.nbtn:hover{background:#8fb96a}
.btn{display:inline-block;text-decoration:none;font:600 .95rem system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px 22px;border-radius:8px;border:1px solid var(--bd);background:var(--pn);color:var(--tx)}
.btn:hover{border-color:var(--ac2);background:var(--pn2)}.btn.pri{background:var(--ac);border-color:var(--ac);color:var(--on)}.btn.pri:hover{background:#8fb96a}.btn.off{opacity:.6;pointer-events:none}
.btn.s{padding:7px 14px;font-size:.85rem}.cta{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
a:focus-visible,summary:focus-visible,.btn:focus-visible{outline:2px solid #b9d99a;outline-offset:3px;border-radius:10px}
section{padding:clamp(44px,7vw,84px) 0}
h2{font-weight:800;font-size:clamp(1.75rem,4.5vw,2.6rem);line-height:1.08;margin:0 0 28px;max-width:20ch}
.card{background:var(--pn);border:1px solid var(--bd);border-radius:12px;padding:24px}
kbd{font:600 .88em system-ui,sans-serif;background:var(--bg);border:1px solid #3a4038;border-bottom-width:3px;border-radius:6px;padding:1px 8px;color:var(--tx)}
.cmp{border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:var(--pn);max-width:1680px}
.cr{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,5fr) minmax(0,5fr);gap:clamp(14px,3vw,40px);padding:18px clamp(18px,3vw,28px);border-top:1px solid var(--bd)}.cr:first-child{border-top:0}
.cr.ch{background:var(--pn2);font:800 1.05rem system-ui,sans-serif;padding-block:14px}.cr.ch div:nth-child(2){color:var(--gr)}
.cr b{font-weight:600}.cr .mu{color:var(--mu)}.cr .w{background:#7ea85c1f;border-radius:8px;padding:10px 14px;margin:-10px 0}.ok{color:var(--gr);font-weight:800}
footer{padding:26px 0 max(30px,env(safe-area-inset-bottom));color:var(--mu);font-size:.9rem;border-top:1px solid var(--bd)}footer a{color:var(--mu)}footer a:hover{color:var(--tx)}.sep{margin:0 8px;opacity:.6}
@media(max-width:780px){.cr{grid-template-columns:1fr;gap:6px}.cr.ch{display:none}.cr div:before{content:attr(data-l);display:block;font-size:.78rem;font-weight:600;color:var(--mu);margin-top:6px}.top a.nbtn{display:none}}
@media(max-width:520px){.btn{text-align:center}.cta .btn{flex:1 1 100%}}
`;

export function dlInfo(env) {
  const dl = String(env.DOWNLOAD_URL || '').trim(), dc = String(env.DISCORD_INVITE || '').trim(), repo = String(env.REPO_URL || '').trim();
  const dlOk = /^https:\/\//i.test(dl), dcOk = /^https:\/\/(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/i.test(dc), repoOk = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/i.test(repo);
  return {
    dlOk, dcOk, repoOk, dc, dl, repo,
    dlBtn: dlOk ? `<a class="btn pri" href="${esc(dl)}">Download voor Windows</a>` : `<span class="btn pri off" aria-disabled="true">Download volgt binnenkort</span>`,
    dcBtn: dcOk ? `<a class="btn" href="${esc(dc)}" rel="noopener">Join onze Discord</a>` : '',
    repoBtn: repoOk ? `<a class="btn" href="${esc(repo)}" rel="noopener">Source code</a>` : ''
  };
}

export function shell(env, { title, desc, css = '', body }, assets = { favicon: '/favicon.png' }) {
  const i = dlInfo(env);
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><meta property="og:site_name" content="Wistic"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta name="theme-color" content="#0b0c0b">
<link rel="icon" type="image/png" href="${assets.favicon}">
<style>${BASE_CSS}${css}</style></head>
<body>
<header><div class="wrap"><a class="brand" href="/"><img src="${assets.favicon}" width="36" height="36" alt="">Wistic</a><nav class="top" aria-label="Menu">${i.dcOk ? `<a href="${esc(i.dc)}" rel="noopener">Discord</a>` : ''}<a href="/compare">Vergelijk</a><a href="/support">Support</a>${i.dlOk ? `<a class="nbtn" href="${esc(i.dl)}">Download voor Windows</a>` : ''}</nav></div></header>
<main>${body}</main>
<footer><div class="wrap">Wistic. Geen overlay, alleen clips.<span class="sep">·</span><a href="/compare">Vergelijk</a><span class="sep">·</span><a href="/support">Support</a>${i.dcOk ? `<span class="sep">·</span><a href="${esc(i.dc)}" rel="noopener">Discord</a>` : ''}${i.repoOk ? `<span class="sep">·</span><a href="${esc(i.repo)}" rel="noopener">Source code</a>` : ''}</div></footer>
</body></html>`;
}

// Een vergelijkingstabel: rows = [[onderwerp, wistic, andere]]
export function table(name, rows) {
  return `<div class="cmp"><div class="cr ch"><b></b><div>Wistic</div><div>${esc(name)}</div></div>` +
    rows.map(([a, w, o]) => `<div class="cr"><b>${a}</b><div class="w" data-l="Wistic"><span class="ok">✓</span> ${w}</div><div class="mu" data-l="${esc(name)}">${o}</div></div>`).join('') + `</div>`;
}
