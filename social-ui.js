// Wistic Social (venster): tabs Vrienden, Chats en Rollen. Wordt na het hoofdscript in index.html geladen en gebruikt
// de bestaande hulpfuncties ($, api, esc, TR, IC, V, go, S, loginPage, dlab, hm). Alle server-aanroepen lopen via api('social').
(() => {
  'use strict';
  let BASE = '', ME = null, pendingChat = '';
  let chats = [], cur = '', lastId = 0, msgs = [], members = [], canMod = false, canDel = false, chatMeta = null, ticks = 0, busy = false;

  // ---------- Hulpjes ----------
  const RM = { owner: ['Eigenaar', '#f5b942'], verified: ['Geverifieerd', '#4da3ff'], admin: ['Admin', '#ff6b6b'], moderator: ['Moderator', '#5aa9ff'], vip: ['VIP', '#c58bff'] };
  const CROWN = '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M7.4 12.6l3 3 6.2-6.6" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const badge = r => r === 'owner' ? `<span class=rbi title="Eigenaar" style="--c:#f5b942">${CROWN}</span>`
    : r === 'verified' ? `<span class=rbi title="Geverifieerd" style="--c:#4da3ff">${CHECK}</span>`
    : (RM[r] ? `<span class=rb style="--c:${RM[r][1]}">${RM[r][0]}</span>` : '');
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const ava = (n, big, u, g) => {
    const l = esc((String(n || '?')[0] || '?').toUpperCase());
    const img = (u && u.av && u.uid && BASE) ? `<img src="${esc(BASE + '/a/' + encodeURIComponent(u.uid) + '?v=' + u.av)}" alt="" onerror="this.remove()">`
      : (g && g.av && g.id && BASE) ? `<img src="${esc(BASE + '/g/' + encodeURIComponent(g.id) + '?v=' + g.av)}" alt="" onerror="this.remove()">` : '';
    return `<span class="sav${big ? ' big' : ''}" style="--h:${hue(n)}">${l}${img}</span>`;
  };
  const sc = async (method, path, body) => { const r = await api('social', { method, path, body }); if (r && r.base) BASE = r.base; return r || { ok: false, error: 'Geen antwoord.' }; };
  const q = (r, s) => r.querySelector(s);
  // Foto kiezen en vierkant verkleinen (zelfde als bij je profielfoto). Geeft null terug als er niets gekozen is.
  async function pickPhoto() { const d = await api('profile:pick'); if (!d) return null; return await squareImg(d); }
  const photoBox = id => `<div style="display:flex;align-items:center;gap:12px;margin:10px 0"><span id=${id} style="display:inline-flex"></span><button class=gh id=${id}p>Foto kiezen</button><button class=gh id=${id}r style="display:none">Foto verwijderen</button></div>`;
  const drawPhoto = (box, id, data, name, gid, gav) => {
    const el = q(box, '#' + id); if (!el) return;
    el.innerHTML = data ? `<span class="sav big" style="--h:${hue(name)}"><img src="${data}" alt=""></span>` : ava(name || '?', true, null, gid ? { id: gid, av: gav } : null);
    const r = q(box, '#' + id + 'r'); if (r) r.style.display = (data || gav) ? '' : 'none';
  };

  const CSS = `
.fb{display:inline-flex;align-items:center;gap:3px;padding:5px 9px}.fb svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.fb .ub{margin-left:3px}
.rb{display:inline-block;font-size:.66rem;font-weight:800;letter-spacing:.3px;padding:1px 7px;border-radius:99px;color:var(--c);border:1px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);vertical-align:middle;margin-left:6px}
.sav{position:relative;overflow:hidden;width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:hsl(var(--h) 38% 34%);flex:none;font-size:.95rem}.sav.big{width:44px;height:44px;font-size:1.15rem}.sav img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sr{display:flex;gap:10px;align-items:center}.sr>input{flex:1;min-width:0}
.sl{display:flex;flex-direction:column}#mn .sl,.ov .sl{color:inherit;font-size:inherit;letter-spacing:normal;font-weight:inherit;padding:0;margin-top:0;border-top:0}
.btn.dgb{background:#e5384b;color:#fff}.btn.dgb:hover{filter:brightness(1.1)}.sl .it{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--bd)}.sl .it:last-child{border-bottom:0}
.sl .it .nm{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sl .it .ac{display:flex;gap:6px;flex:none}
.sg{margin-top:10px;display:flex;flex-direction:column}.sg .it{padding:7px 4px}
.rbi{display:inline-flex;vertical-align:middle;margin-left:6px;color:var(--c)}.rbi svg{width:16px;height:16px;fill:currentColor;display:block}
.cm2{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
.cp{background:var(--pn);border:1px solid var(--bd);border-radius:16px;padding:14px 16px;margin-bottom:12px}
.cph{display:flex;align-items:center;gap:11px}.cph .tx{flex:1;min-width:0}.cph .tx b{display:block}.cph .tx small{color:var(--mu)}
.cpb{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0 0}
.cp .scc{max-width:100%;margin-top:10px}.cp .scc img,.cp .scc .sci{width:160px;height:90px}
.cmr .pn{position:sticky;top:0}.cmr .sl{max-height:56vh;overflow:auto;margin-top:8px}
.sx{padding:6px 11px;border-radius:9px;font-size:.85rem}.sx.dg:hover{border-color:#e5384b;color:#ff8b95}
.sh3{display:flex;align-items:center;gap:8px;margin:22px 0 6px;font-size:.95rem}.sh3 i{font-style:normal;background:var(--pn2);border:1px solid var(--bd);border-radius:99px;padding:0 8px;font-size:.78rem;color:var(--mu)}
.ub{background:#e5384b;color:#fff;border-radius:99px;font-size:.7rem;font-weight:800;padding:1px 7px;min-width:20px;text-align:center;flex:none}
.sc{display:grid;grid-template-columns:290px 1fr;gap:14px;height:calc(100vh - 36px - 38px - 56px);min-height:360px}
.scl,.scm{background:var(--pn);border:1px solid var(--bd);border-radius:16px;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.sch{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--bd)}
.scs{overflow:auto;flex:1}
.ci{display:flex;gap:11px;align-items:center;padding:11px 14px;cursor:pointer;border-bottom:1px solid #ffffff08}.ci:hover{background:#ffffff0a}.ci.on{background:#ffffff12}
.ci .tx{flex:1;min-width:0}.ci b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ci small{display:block;color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.smh{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--bd)}.smh .tt{flex:1;min-width:0}.smh .tt b{font-size:1.05rem}.smh .tt small{display:block;color:var(--mu)}
.smb{flex:1;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.sd{align-self:center;color:var(--mu);font-size:.75rem;margin:12px 0 6px;background:var(--pn2);border-radius:99px;padding:2px 12px}
.sm{display:flex;gap:10px;padding:5px 6px;border-radius:10px;position:relative}.sm:hover{background:#ffffff08}
.sm .bd{min-width:0;flex:1}.sm .hd2{font-size:.85rem}.sm .hd2 b{font-weight:700}.sm .hd2 small{color:var(--mu);margin-left:8px}
.sm .tx2{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:1px}.sm.me .hd2 b{color:var(--ac)}
.sm .dl{position:absolute;right:8px;top:4px;opacity:0;background:var(--pn2);border:1px solid var(--bd);border-radius:8px;padding:1px 8px;color:var(--mu)}.sm:hover .dl{opacity:1}.sm .dl:hover{color:#ff8b95;border-color:#e5384b}
.scc{display:flex;gap:10px;align-items:center;margin-top:6px;max-width:360px;background:var(--pn2);border:1px solid var(--bd);border-radius:12px;padding:6px;cursor:pointer}.scc:hover{border-color:var(--ac2)}
.scc img,.scc .sci{width:96px;height:54px;border-radius:8px;object-fit:cover;background:#000;flex:none;display:flex;align-items:center;justify-content:center}.scc b{display:block}
.cmp{display:flex;gap:8px;padding:12px;border-top:1px solid var(--bd)}.cmp input{flex:1;min-width:0}.cer{color:#ff8b95;font-size:.82rem;padding:0 14px 8px;min-height:1.2em}
.sem{margin:auto;text-align:center;color:var(--mu);padding:30px}.sem b{display:block;color:var(--tx);font-size:1.1rem;margin-bottom:4px}
.pk{display:flex;flex-direction:column;max-height:46vh;overflow:auto;margin:10px 0}.pk label,.pk .it{display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid var(--bd);cursor:pointer}
`;
  const st = document.createElement('style'); st.id = 'socialcss'; st.textContent = CSS; document.head.appendChild(st);

  function modal(html, mount) {
    const o = document.createElement('div'); o.className = 'ov';
    o.innerHTML = `<div class=pn style="max-width:520px">${html}</div>`;
    o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });
    document.body.appendChild(o); mount && mount(o); return o;
  }
  // Eigen bevestigingsvenster (in plaats van het lelijke Windows-venster). Geeft true terug bij OK.
  function ask(msg, ok) {
    return new Promise(res => {
      const lines = String(msg).split('\n'), o = document.createElement('div'); o.className = 'ov'; o.style.zIndex = 90;
      o.innerHTML = `<div class=pn style="max-width:400px"><h3 style="margin:0 0 8px;font-size:1.15rem">${esc(lines[0])}</h3>${lines.length > 1 ? `<p class=mu style="margin:0;white-space:pre-wrap">${esc(lines.slice(1).join('\n').trim())}</p>` : ''}<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class=gh id=ano>Annuleren</button><button class="btn dgb" id=aok>${esc(ok || 'OK')}</button></div></div>`;
      document.body.appendChild(o);
      const done = v => { document.removeEventListener('keydown', key, true); o.remove(); res(v); };
      const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); } };
      document.addEventListener('keydown', key, true);
      o.addEventListener('mousedown', e => { if (e.target === o) done(false); });
      o.querySelector('#ano').onclick = () => done(false); o.querySelector('#aok').onclick = () => done(true);
      o.querySelector('#aok').focus();
    });
  }
  async function gate(title) {
    const m = await api('auth:me');
    if (m) return true;
    $('#mn').innerHTML = `<div class=hd><div><h1>${title}</h1></div></div><div class=pn style="max-width:520px"><h3 style="margin-top:0">Log in om verder te gaan</h3><p class=mu style="font-size:.9rem">Vrienden en chats werken met je Wistic-account. Opnemen en clips bewaren kan ook als gast.</p><button class=btn id=sgl>Inloggen</button></div>`;
    $('#sgl').onclick = () => loginPage();
    setUb(0, 0); return false;
  }

  // ---------- Badges in het menu ----------
  let unreadN = 0, reqN = 0, reqList = [], reqSeen = -1;
  function setUb(c, f) {          // c = ongelezen berichten, f = vriendschapsverzoeken; null = niet aanpassen
    if (c != null) unreadN = c;
    if (f != null) reqN = f;
    const put = (b, n) => {
      if (!b) return;
      let u = b.querySelector('.ub');
      if (!n) { if (u) u.remove(); return; }
      if (!u) { u = document.createElement('b'); u.className = 'ub'; b.appendChild(u); }
      u.textContent = n > 99 ? '99+' : n;
    };
    put(document.querySelector('[data-t=chats]'), unreadN + reqN);
    put(document.getElementById('fb'), reqN);
  }
  function showRoles(on) { const b = document.querySelector('[data-t=roles]'); if (b) b.style.display = on ? '' : 'none'; }
  async function me(force) {
    if (ME && !force) return ME;
    const r = await sc('GET', 'me'); ME = r.ok ? r.data : null; showRoles(!!(ME && ME.role === 'owner') || (!r.ok && r.status !== 401 && r.status !== 403)); return ME;   // server onbereikbaar of route mist: tab alvast laten zien
  }
  async function badges() {
    if (document.hidden) return;
    const a = await api('auth:me');
    if (!a) { ME = null; reqList = []; reqSeen = -1; showRoles(false); setUb(0, 0); return; }
    const [c, f] = await Promise.all([sc('GET', 'chats'), sc('GET', 'friends')]);
    if (!ME) me();
    if (!c.ok && !f.ok) return;
    if (c.ok) chats = c.data.chats;
    if (f.ok) {
      const before = reqList.map(x => x.uid).join();
      reqList = f.data.incoming;
      if (reqSeen >= 0 && reqList.length > reqSeen) {   // er is een nieuw verzoek: melding van Windows
        try { const n = new Notification(reqList[0].name, { body: 'wil je vriend worden op Wistic' }); n.onclick = () => { try { window.focus(); } catch (e) {} go('chats'); }; } catch (e) {}
      }
      reqSeen = reqList.length;
      if (tab === 'chats' && before !== reqList.map(x => x.uid).join()) drawList();
    }
    setUb(c.ok ? c.data.chats.reduce((x, y) => x + (y.unread || 0), 0) : null, f.ok ? f.data.incoming.length : null);
    if (!ME) me();
    syncAvatar();
  }
  // Eigen profielfoto naar de server, zodat vrienden hem zien. Alleen als hij veranderd is.
  async function syncAvatar() {
    try {
      const a = await api('auth:me'); if (!a) return;
      const s = await api('settings:get'), av = (s && s.avatar) || '';
      const key = 'avsync:' + a.uid, h = av ? av.length + ':' + av.slice(-40) : '';
      const old = localStorage.getItem(key);
      if (old === h || (old == null && !av)) return;
      const r = await sc('POST', 'avatar', { avatar: av });
      if (r.ok) { localStorage.setItem(key, h); ME = null; }
    } catch (e) {}
  }
  window.syncAvatar = syncAvatar;
  document.querySelector('[data-t=roles]') && showRoles(false);
  window.socialLoad = () => badges().catch(() => {}); setInterval(badges, 30000);   // het laadscherm roept socialLoad aan en wacht erop

  // ---------- Vrienden (klein venster in Chats, geen eigen tab) ----------
  V.friends = () => go('chats');
  function friendsModal() {
    const o = modal(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><h3 style="margin:0;flex:1">Vriend toevoegen</h3><button class=gh id=fx>Sluiten</button></div>
<div class=sr><input id=fq placeholder="Zoek op gebruikersnaam…" autocomplete=off><button class=btn id=fadd>Verzoek sturen</button></div><div id=fsg class=sg></div><div id=fmsg class=mu style="min-height:1.3em;margin-top:6px"></div><div id=fls style="max-height:44vh;overflow:auto"></div>`);
    const say = (m, good) => { const e = q(o, '#fmsg'); if (e) { e.style.color = good ? '#ffffff' : '#ff8b95'; e.textContent = m || ''; } };
    q(o, '#fx').onclick = () => o.remove();
    let t = null;
    q(o, '#fq').oninput = () => { clearTimeout(t); t = setTimeout(suggest, 250); };
    q(o, '#fq').onkeydown = e => { if (e.key === 'Enter') add(q(o, '#fq').value); };
    q(o, '#fadd').onclick = () => add(q(o, '#fq').value);
    q(o, '#fq').focus();
    async function suggest() {
      const v = q(o, '#fq').value.trim(), box = q(o, '#fsg'); if (!o.isConnected) return;
      if (v.length < 2) { box.innerHTML = ''; return; }
      const r = await sc('GET', 'users?q=' + encodeURIComponent(v)); if (!r.ok || !o.isConnected) return;
      box.innerHTML = r.data.users.map(u => `<div class="sl"><div class=it>${ava(u.name, 0, u)}<div class=nm>${esc(u.name)}${badge(u.role)}</div><div class=ac>${
        u.rel === 'friend' ? '<span class=mu>Vrienden</span>' : u.rel === 'outgoing' ? '<span class=mu>Verstuurd</span>'
        : u.rel === 'incoming' ? `<button class="btn sx" data-a=acc data-u="${esc(u.uid)}">Accepteren</button>` : `<button class="btn sx" data-a=req data-n="${esc(u.name)}">Toevoegen</button>`}</div></div></div>`).join('') || '<p class=mu style="margin:6px 4px">Niemand gevonden.</p>';
    }
    async function add(name) {
      name = String(name || '').trim(); if (!name) { say('Typ de gebruikersnaam van je vriend.'); return; }
      const r = await sc('POST', 'friends/request', { name });
      if (!r.ok) { say(r.error); return; }
      say(r.data.state === 'friend' ? `Je bent nu vrienden met ${r.data.name}!` : `Verzoek verstuurd naar ${r.data.name}.`, true);
      q(o, '#fq').value = ''; q(o, '#fsg').innerHTML = ''; draw();
    }
    async function draw() {
      const r = await sc('GET', 'friends'), box = q(o, '#fls'); if (!o.isConnected) return;
      if (!r.ok) { box.innerHTML = `<p class=mu style="margin-top:12px">${esc(r.error)}</p>`; return; }
      const d = r.data; reqList = d.incoming; reqSeen = reqList.length; setUb(null, d.incoming.length); if (tab === 'chats') drawList();
      const row = (u, btns) => `<div class=it>${ava(u.name, 0, u)}<div class=nm>${esc(u.name)}${badge(u.role)}</div><div class=ac>${btns}</div></div>`;
      const sec = (title, list, fn) => list.length ? `<div class=sh3>${title}<i>${list.length}</i></div><div class="sl">${list.map(fn).join('')}</div>` : '';
      box.innerHTML =
        sec('Verzoeken', d.incoming, u => row(u, `<button class="btn sx" data-a=acc data-u="${esc(u.uid)}">Accepteren</button><button class="gh sx" data-a=dec data-u="${esc(u.uid)}">Weigeren</button>`))
        + sec('Vrienden', d.friends, u => row(u, `<button class="btn sx" data-a=chat data-u="${esc(u.uid)}">Chat</button><button class="gh sx" data-a=rm data-u="${esc(u.uid)}" data-n="${esc(u.name)}">Verwijderen</button><button class="gh sx dg" data-a=blk data-u="${esc(u.uid)}" data-n="${esc(u.name)}">Blokkeren</button>`))
        + sec('Verstuurd', d.outgoing, u => row(u, `<button class="gh sx" data-a=cancel data-u="${esc(u.uid)}">Annuleren</button>`))
        + sec('Geblokkeerd', d.blocked, u => row(u, `<button class="gh sx" data-a=unb data-u="${esc(u.uid)}">Deblokkeren</button>`));
    }
    o.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a, u = b.dataset.u, n = b.dataset.n; b.disabled = true; let r;
      if (a === 'req') { await add(n); return; }
      if (a === 'acc') r = await sc('POST', 'friends/respond', { uid: u, accept: true });
      else if (a === 'dec') r = await sc('POST', 'friends/respond', { uid: u, accept: false });
      else if (a === 'cancel') r = await sc('DELETE', 'friends/' + encodeURIComponent(u));
      else if (a === 'rm') { if (!(await ask(TR('Verwijderen uit je vriendenlijst?') + ' ' + n, 'Verwijderen'))) { b.disabled = false; return; } r = await sc('DELETE', 'friends/' + encodeURIComponent(u)); }
      else if (a === 'blk') { if (!(await ask(TR('Blokkeren?') + ' ' + n + '\n' + TR('Jullie zijn dan geen vrienden meer en deze persoon kan je niet meer vinden.'), 'Blokkeren'))) { b.disabled = false; return; } r = await sc('POST', 'block', { uid: u }); }
      else if (a === 'unb') r = await sc('DELETE', 'block/' + encodeURIComponent(u));
      else if (a === 'chat') { r = await sc('POST', 'chats', { members: [u] }); if (r.ok) { o.remove(); await drawList(); open(r.data.id); return; } }
      if (r && !r.ok) say(r.error); else say('');
      draw(); suggest(); if (a === 'blk' || a === 'rm') drawList();
    };
    draw();
  }

  // ---------- Chats ----------
  const cname = c => c.name;
  const when = t => { if (!t) return ''; const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? hm(t) : d.toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'short' }); };

  V.chats = async function () {
    if (!(await gate('Chats'))) return;
    $('#mn').innerHTML = `<div class=sc id=sroot><div class=scl><div class=sch><b>Chats</b><span style="display:flex;gap:6px"><button class="gh fb" id=fb title="Vriend toevoegen">+ ${IC.users}</button><button class=gh id=ng>+ Nieuwe groep</button></span></div><div class=scs id=cl></div></div><div class=scm id=cm></div></div>`;
    $('#ng').onclick = newGroup; $('#fb').onclick = friendsModal; setUb(); badges();
    $('#cl').onclick = async e => {
      const b = e.target.closest('[data-a]');
      if (b) {
        b.disabled = true;
        const r = await sc('POST', 'friends/respond', { uid: b.dataset.u, accept: b.dataset.a === 'acc' });
        reqList = reqList.filter(x => x.uid !== b.dataset.u); reqSeen = reqList.length; setUb(null, reqList.length);
        if (!r.ok && $('#cl')) { b.disabled = false; return; }
        drawList(); return;
      }
      const i = e.target.closest('[data-c]'); if (i) open(i.dataset.c);
    };
    if (chats.length || reqList.length) paintList();   // meteen tonen wat we al weten, daarna verversen
    await drawList();
    if (pendingChat) { const id = pendingChat; pendingChat = ''; await open(id); }
    else if (cur && chats.some(c => c.id === cur)) await open(cur, true);
    else empty();
    ticks = 0; timer = setInterval(tick, 3000);
  };
  function empty() {
    cur = ''; const m = $('#cm'); if (!m) return;
    m.innerHTML = `<div class=sem><b>Kies een chat</b>${chats.length ? 'Klik links op een gesprek.' : 'Nog geen chats.'}</div>`;
  }
  const reqHtml = () => reqList.length ? `<div class=sh3 style="margin:10px 14px 4px">Verzoeken<i>${reqList.length}</i></div><div class=sl style="padding:0 10px 8px;border-bottom:1px solid var(--bd)">${reqList.map(u => `<div class=it>${ava(u.name, 0, u)}<div class=nm>${esc(u.name)}</div><div class=ac><button class="btn sx" data-a=acc data-u="${esc(u.uid)}">Accepteren</button><button class="gh sx" data-a=dec data-u="${esc(u.uid)}">Weigeren</button></div></div>`).join('')}</div>` : '';
  function paintList() {
    const box = $('#cl'); if (!box) return;
    box.innerHTML = reqHtml() + (chats.length ? chats.map(c => `<div class="ci${c.id === cur ? ' on' : ''}" data-c="${esc(c.id)}">${ava(cname(c), 0, c.peer, c.kind === 'group' ? c : null)}<div class=tx><b>${esc(cname(c))}${c.peer ? badge(c.peer.role) : ''}</b><small>${esc(c.last || (c.kind === 'group' ? c.n + ' leden' : ''))}</small></div><div style="text-align:right;flex:none"><small>${when(c.t)}</small>${c.unread && c.id !== cur ? `<div><b class=ub>${c.unread > 99 ? '99+' : c.unread}</b></div>` : ''}</div></div>`).join('')
      : '<p class=mu style="padding:14px;font-size:.9rem">Nog geen chats.</p>');
  }
  async function drawList() {
    const r = await sc('GET', 'chats'); const box = $('#cl'); if (!box) return;
    if (!r.ok) { box.innerHTML = `<p class=mu style="padding:14px">${esc(r.error)}</p>`; return; }
    chats = r.data.chats; setUb(chats.reduce((x, y) => x + (y.unread || 0), 0), null);
    paintList();
  }

  const dayKey = t => new Date(t).toDateString();
  function msgHtml(m, prev) {
    const mine = ME && m.uid === ME.uid, can = mine || canMod;
    const sep = !prev || dayKey(prev.t) !== dayKey(m.t) ? `<div class=sd>${esc(dlab(m.t))}</div>` : '';
    const clip = m.clip ? `<div class=scc ${clipAttrs(m.clip, m.name)}>${m.clip.thumb && !m.clip.gone ? `<img src="${esc(BASE + '/t/' + m.clip.id + '.jpg')}" onerror="this.style.display='none'">` : '<span class=sci>🎬</span>'}<div><b>${esc(m.clip.gone ? 'Clip niet meer online' : (m.clip.title || (m.clip.game ? m.clip.game + ' clip' : 'Wistic clip')))}</b><span class=mu>${esc(m.clip.game || 'Wistic')}</span></div></div>` : '';
    return `${sep}<div class="sm${mine ? ' me' : ''}" data-m="${m.id}">${ava(m.name, 0, m)}<div class=bd><div class=hd2><b>${esc(m.name)}</b>${badge(m.role)}<small>${hm(m.t)}</small></div>${m.body ? `<div class=tx2>${esc(m.body)}</div>` : ''}${clip}</div>${can ? '<button class=dl title="Verwijderen">✕</button>' : ''}</div>`;
  }
  const near = el => el.scrollHeight - el.scrollTop - el.clientHeight < 90;

  async function open(id, keepScroll) {
    cur = id; lastId = 0; msgs = []; members = [];
    document.querySelectorAll('#cl .ci').forEach(e => e.classList.toggle('on', e.dataset.c === id));
    const m = $('#cm'); if (!m) return;
    m.innerHTML = '<div class=sem>Laden…</div>';
    await me();
    const r = await sc('GET', 'chats/' + encodeURIComponent(id));
    if (!r.ok) { m.innerHTML = `<div class=sem><b>Chat niet beschikbaar</b>${esc(r.error)}</div>`; cur = ''; return; }
    apply(r.data, true); drawChat(); drawList();
  }
  function apply(d, full) {
    chatMeta = d.chat; canMod = d.canMod; canDel = d.canDelete;
    if (d.members) members = d.members;
    if (full) { msgs = d.messages.slice(); } else { for (const x of d.messages) if (x.id > (msgs.length ? msgs[msgs.length - 1].id : 0)) msgs.push(x); }
    lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
  }
  function title() {
    if (!chatMeta) return { name: '', sub: '', role: '' };
    if (chatMeta.kind === 'dm') { const p = members.find(x => ME && x.uid !== ME.uid); return { name: p ? p.name : 'Gesprek', sub: 'Gesprek', role: p ? p.role : '', u: p }; }
    return { name: chatMeta.name, sub: members.length + ' leden', role: '' };
  }
  function drawChat() {
    const m = $('#cm'); if (!m || !chatMeta) return; const t = title();
    m.innerHTML = `<div class=smh id=smh></div>
<div class=smb id=smb></div><div class=cer id=cer></div>
<div class=cmp><button class=gh id=cclip title="Clip delen">🎬</button><input id=cin maxlength=500 placeholder="Typ een bericht…" autocomplete=off><button class=btn id=csend>Verstuur</button></div>`;
    drawHead(); renderMsgs(true);
    const b = $('#smb');
    b.onclick = async e => {
      const c = e.target.closest('.scc'); if (c) { watchClip(c); return; }
      const d = e.target.closest('.dl'); if (!d) return;
      const mid = d.closest('.sm').dataset.m;
      const r = await sc('DELETE', `chats/${encodeURIComponent(cur)}/messages/${mid}`);
      if (!r.ok) { $('#cer').textContent = r.error; return; }
      msgs = msgs.filter(x => String(x.id) !== String(mid)); renderMsgs();
    };
    $('#csend').onclick = () => send(); $('#cin').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    $('#cclip').onclick = pickClip;
    $('#cin').focus();
  }
  function drawHead() {
    const h = $('#smh'); if (!h || !chatMeta) return; const t = title();
    h.innerHTML = `${ava(t.name, true, t.u, chatMeta.kind === 'group' ? { id: cur, av: chatMeta.av } : null)}<div class=tt><b>${esc(t.name)}</b>${badge(t.role)}<small>${esc(t.sub)}</small></div>${chatMeta.kind === 'group' ? '<button class=gh id=cmem>Leden</button>' : ''}`;
    const mm = $('#cmem'); if (mm) mm.onclick = memberModal;
  }
  function renderMsgs(bottom) {
    const b = $('#smb'); if (!b) return; const stick = bottom || near(b), top = b.scrollTop;
    b.innerHTML = msgs.length ? msgs.map((x, i) => msgHtml(x, msgs[i - 1])).join('') : '<div class=sem>Nog geen berichten. Zeg hallo!</div>';
    b.scrollTop = stick ? b.scrollHeight : top;
  }
  function addMsgs(list) {
    const b = $('#smb'); if (!b || !list.length) return;
    if (b.querySelector('.sem')) b.innerHTML = '';
    const stick = near(b); let prev = msgs[msgs.length - list.length - 1];
    b.insertAdjacentHTML('beforeend', list.map(x => { const h = msgHtml(x, prev); prev = x; return h; }).join(''));
    if (stick) b.scrollTop = b.scrollHeight;
  }
  async function send(clip) {
    const i = $('#cin'), er = $('#cer'); if (!i || busy) return;
    const body = i.value.trim(); if (!body && !clip) return;
    busy = true; $('#csend').disabled = true; er.textContent = '';
    const r = await sc('POST', `chats/${encodeURIComponent(cur)}/messages`, { body, clip: typeof clip === 'string' ? clip : undefined });
    busy = false; const s = $('#csend'); if (s) s.disabled = false;
    if (!r.ok) { if ($('#cer')) $('#cer').textContent = r.error; return; }
    i.value = ''; poll(); drawList();
  }
  async function poll(full) {
    if (!cur) return; const id = cur;
    const r = await sc('GET', `chats/${encodeURIComponent(id)}?after=${full ? 0 : lastId}${full || ticks % 20 === 0 ? '&m=1' : ''}`);
    if (id !== cur) return;
    if (!r.ok) { if (r.status === 404) { empty(); drawList(); } return; }
    const d = r.data; canMod = d.canMod; canDel = d.canDelete; chatMeta = d.chat; if (d.members) { members = d.members; drawHead(); }
    if (full) { const ids = d.messages.map(x => x.id).join(), old = msgs.map(x => x.id).join(); msgs = d.messages.slice(); lastId = msgs.length ? msgs[msgs.length - 1].id : 0; if (ids !== old) renderMsgs(); drawHead(); return; }
    const fresh = d.messages.filter(x => x.id > lastId);
    if (fresh.length) { msgs.push(...fresh); lastId = msgs[msgs.length - 1].id; addMsgs(fresh); drawList(); }
  }
  function tick() {
    if (document.hidden || tab !== 'chats') return;
    ticks++;
    if (!document.hasFocus() && ticks % 4) return;      // op de achtergrond minder vaak vragen (spaart de gratis limiet van Cloudflare)
    if (cur) poll(ticks % 10 === 0);                    // elke 10e keer alles opnieuw: dan verdwijnen ook verwijderde berichten
    if (ticks % 5 === 0) drawList();
  }

  // ---------- Online clip afspelen in de app zelf ----------
  const clipAttrs = (c, by) => `data-id="${esc(c.id)}" data-t="${esc(c.title || '')}" data-g="${esc(c.game || '')}" data-th="${c.thumb ? 1 : 0}" data-x="${c.gone ? 1 : 0}" data-by="${esc(by || '')}"`;
  function watchClip(el) {
    const d = el.dataset; if (d.x === '1' || !d.id) return;
    watch({ id: d.id, title: d.t, game: d.g, thumb: d.th === '1', by: d.by });
  }
  function watch(c) {
    const url = BASE + '/v/' + encodeURIComponent(c.id) + '.mp4', page = BASE + '/c/' + encodeURIComponent(c.id);
    const name = c.title || (c.game ? c.game + ' clip' : 'Wistic clip');
    try { document.activeElement && document.activeElement.blur(); } catch (e) {}
    const o = document.createElement('div'); o.className = 'ov vwo'; o.style.zIndex = 70;
    o.innerHTML = `<div class=vw><div class=vl><div class=vbox id=vbox><video id=v src="${esc(url)}"${c.thumb ? ` poster="${esc(BASE + '/t/' + c.id + '.jpg')}"` : ''} autoplay preload=auto playsinline></video>`
      + `<div class=vc id=vc><div class=vsk id=vsk><div class=vfill id=vfill></div><div class=vknob id=vknob></div><div class=vtip id=vtip></div></div>`
      + `<div class=vrow><button class=vi id=vpl title="Afspelen / pauzeren (spatie)">${VI.pause}</button><span id=vtm>0:00 / 0:00</span><span class=sp></span><button class=vi id=vmu title="Geluid (m)">${VI.vol}</button><input type=range id=vvol min=0 max=1 step=.05 value=1><button class=vi id=vfs title="Volledig scherm (f)">${VI.fs}</button></div></div></div></div>`
      + `<div class=vr><button class=vx id=vx title="Sluiten">✕</button><div class=vf><b style="font-size:1.1rem">${esc(name)}</b></div>`
      + `<div class=vmeta>${typeof gi === 'function' && c.game ? gi(c.game) : ''}<b>${esc(c.game || 'Wistic')}</b></div>`
      + (c.by ? `<div class=mu>Gedeeld door ${esc(c.by)}</div>` : '')
      + `<p class=mu style="margin:0;font-size:.78rem">Spatie = pauze · M = geluid · F = volledig scherm · Esc = sluiten</p>`
      + `<div class=vbtns><button class=gh id=vcp>🔗 Link kopiëren</button><button class=gh id=vbr>🌐 Open in browser</button></div><div class=mu id=vmsg style="min-height:1.3em;margin-top:8px"></div></div></div>`;
    document.body.appendChild(o);
    const g = s => o.querySelector(s), v = g('#v'), box = g('#vbox'), say = t => { g('#vmsg').textContent = t || ''; };
    let dur = 0, sk = false, idleT = 0, dead = false, lastTm = '';
    const tick = () => {
      if (dead) return;
      const t = v.currentTime || 0, p = (dur ? Math.max(0, Math.min(100, t / dur * 100)) : 0) + '%';
      g('#vfill').style.width = p; g('#vknob').style.left = p;
      const tm = mmss(t) + ' / ' + mmss(dur); if (tm !== lastTm) { lastTm = tm; g('#vtm').textContent = tm; }
      requestAnimationFrame(tick);
    };
    v.onloadedmetadata = () => { dur = isFinite(v.duration) ? v.duration : 0; };
    v.onerror = () => say('Deze clip kan niet worden afgespeeld. Misschien is hij verlopen of verwijderd.');
    tick();
    const tp = () => { if (v.paused) { const r = v.play(); r && r.catch && r.catch(() => {}); } else v.pause(); };
    const wake = () => { box.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!v.paused && !sk) box.classList.add('idle'); }, 2500); };
    box.onmousemove = wake; box.onmouseleave = () => { if (!v.paused && !sk) box.classList.add('idle'); };
    v.onplay = () => { g('#vpl').innerHTML = VI.pause; wake(); }; v.onpause = () => { g('#vpl').innerHTML = VI.play; box.classList.remove('idle'); };
    v.onclick = tp; v.ondblclick = () => g('#vfs').click(); g('#vpl').onclick = tp;
    const vic = () => { g('#vmu').innerHTML = (v.muted || v.volume === 0) ? VI.mute : VI.vol; };
    try { const sv = localStorage.getItem('blipsVol'); if (sv !== null && isFinite(+sv)) { v.volume = Math.max(0, Math.min(1, +sv)); g('#vvol').value = sv; } } catch (e) {}
    g('#vvol').oninput = e => { v.muted = false; v.volume = +e.target.value; try { localStorage.setItem('blipsVol', e.target.value); } catch (x) {} vic(); };
    g('#vmu').onclick = () => { v.muted = !v.muted; vic(); }; vic();
    g('#vfs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else box.requestFullscreen && box.requestFullscreen(); };
    const vs = g('#vsk');
    const sx = e => { const r = vs.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))) * dur; };
    vs.onpointerdown = e => { if (!dur) return; sk = true; vs.classList.add('dr'); vs.setPointerCapture(e.pointerId); v.currentTime = sx(e); };
    vs.onpointermove = e => { if (!dur) return; const t = sx(e), tip = g('#vtip'); tip.style.display = 'block'; tip.style.left = (t / dur * 100) + '%'; tip.textContent = mmss(t); if (sk) v.currentTime = t; };
    vs.onpointerup = vs.onpointercancel = () => { sk = false; vs.classList.remove('dr'); };
    vs.onpointerleave = () => { g('#vtip').style.display = 'none'; };
    const key = e => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range') return;
      if (e.key === ' ') { e.preventDefault(); tp(); }
      else if (e.key === 'm' || e.key === 'M') g('#vmu').click();
      else if (e.key === 'f' || e.key === 'F') g('#vfs').click();
      else if (e.key === 'Escape' && !document.fullscreenElement) close();
    };
    const close = () => { dead = true; document.removeEventListener('keydown', key, true); try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} o.remove(); };
    document.addEventListener('keydown', key, true);
    g('#vx').onclick = close; o.addEventListener('mousedown', e => { if (e.target === o) close(); });
    g('#vcp').onclick = async () => { try { await navigator.clipboard.writeText(page); say('Link gekopieerd.'); } catch (e) { say(page); } };
    g('#vbr').onclick = () => api('open:url', { url: page });
  }

  async function pickClip() {
    const r = await sc('GET', 'myclips');
    const list = r.ok ? (r.data.clips || []) : [];
    modal(`<h3 style="margin-top:0">Clip delen</h3>${r.ok ? (list.length ? `<p class=mu style="font-size:.9rem">Kies een clip die al online staat.</p><div class=pk>${list.map(c => `<div class=it data-c="${esc(c.id)}"><span style="font-size:1.4rem">🎬</span><div class=nm style="flex:1;min-width:0"><b>${esc(c.title || (c.game ? c.game + ' clip' : 'Wistic clip'))}</b><div class=mu style="font-size:.8rem">${esc(c.game || '')} · ${(c.size / 1e6).toFixed(0)} MB</div></div></div>`).join('')}</div>`
      : '<p class=mu>Je hebt nog geen clips online. Klik bij een clip op Link maken, daarna kun je hem hier delen.</p>') : `<p class=mu>${esc(r.error)}</p>`}<div style="text-align:right"><button class=gh id=px>Sluiten</button></div>`, o => {
      q(o, '#px').onclick = () => o.remove();
      q(o, '.pk') && (q(o, '.pk').onclick = e => { const it = e.target.closest('[data-c]'); if (it) { o.remove(); send(it.dataset.c); } });
    });
  }

  async function newGroup() {
    const r = await sc('GET', 'friends'); const fr = r.ok ? r.data.friends : [];
    modal(`<h3 style="margin-top:0">Nieuwe groepschat</h3>${fr.length ? `<input id=gn placeholder="Naam van de groep" maxlength=30 style="width:100%">${photoBox('gph')}<p class=mu style="font-size:.9rem;margin:12px 0 0">Kies de vrienden die erbij komen:</p><div class=pk>${fr.map(u => `<label>${ava(u.name, 0, u)}<span style="flex:1">${esc(u.name)}${badge(u.role)}</span><input type=checkbox value="${esc(u.uid)}"></label>`).join('')}</div><div id=gm class=mu style="min-height:1.3em;color:#ff8b95"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class=gh id=gx>Annuleren</button><button class=btn id=gok>Maak groep</button></div>`
      : '<p class=mu>Nog geen vrienden</p><div style="text-align:right"><button class=gh id=gx>Sluiten</button></div>'}`, o => {
      q(o, '#gx').onclick = () => o.remove();
      const ok = q(o, '#gok'); if (!ok) return; q(o, '#gn').focus();
      let gphoto = '';
      const gdraw = () => drawPhoto(o, 'gph', gphoto, q(o, '#gn').value);
      gdraw(); q(o, '#gn').oninput = gdraw;
      q(o, '#gphp').onclick = async () => { try { const p = await pickPhoto(); if (p) { gphoto = p; gdraw(); } } catch (e) { q(o, '#gm').textContent = TR('Dit bestand is geen geldige afbeelding.'); } };
      q(o, '#gphr').onclick = () => { gphoto = ''; gdraw(); };
      ok.onclick = async () => {
        const ids = [...o.querySelectorAll('.pk input:checked')].map(x => x.value), name = q(o, '#gn').value.trim();
        if (name.length < 2) { q(o, '#gm').textContent = TR('Geef de groep een naam (minstens 2 tekens).'); return; }
        if (!ids.length) { q(o, '#gm').textContent = TR('Kies minstens één vriend.'); return; }
        ok.disabled = true; const r2 = await sc('POST', 'chats', { name, members: ids });
        if (!r2.ok) { ok.disabled = false; q(o, '#gm').textContent = r2.error; return; }
        if (gphoto) await sc('POST', `chats/${encodeURIComponent(r2.data.id)}/avatar`, { avatar: gphoto });
        o.remove(); await drawList(); open(r2.data.id);
      };
    });
  }

  async function memberModal() {
    if (!chatMeta) return;
    const owner = ME && chatMeta.owner === ME.uid, fr = owner ? ((await sc('GET', 'friends')).data || { friends: [] }).friends.filter(f => !members.some(m => m.uid === f.uid)) : [];
    const o = modal('', null), box = o.firstElementChild;
    const render = () => {
      box.innerHTML = `<h3 style="margin-top:0">${esc(chatMeta.name)}</h3>
<div class="sl" style="max-height:34vh;overflow:auto">${members.map(m => `<div class=it>${ava(m.name, 0, m)}<div class=nm>${esc(m.name)}${badge(m.role)}${m.uid === chatMeta.owner ? '<span class=rb style="--c:#f5b942">Groepseigenaar</span>' : ''}</div><div class=ac>${owner && m.uid !== ME.uid ? `<button class="gh sx dg" data-k="${esc(m.uid)}">Verwijderen</button>` : ''}</div></div>`).join('')}</div>
${owner && fr.length ? `<h4>Vriend toevoegen</h4><div class="sl" style="max-height:22vh;overflow:auto">${fr.map(u => `<div class=it>${ava(u.name, 0, u)}<div class=nm>${esc(u.name)}</div><div class=ac><button class="btn sx" data-p="${esc(u.uid)}">Toevoegen</button></div></div>`).join('')}</div>` : ''}
${owner ? `<h4>Groepsfoto</h4>${photoBox('mph')}` : ''}
${owner ? `<h4>Naam wijzigen</h4><div class=sr><input id=rn value="${esc(chatMeta.name)}" maxlength=30><button class=gh id=rnb>Opslaan</button></div>` : ''}
<div id=mm class=mu style="min-height:1.3em;color:#ff8b95;margin-top:8px"></div>
<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px"><span style="display:flex;gap:8px"><button class="gh dg" id=lv>Groep verlaten</button>${canDel ? '<button class="gh dg" id=dg>Groep verwijderen</button>' : ''}</span><button class=gh id=cx2>Sluiten</button></div>`;
      q(box, '#cx2').onclick = () => o.remove();
      if (owner) {
        drawPhoto(box, 'mph', '', chatMeta.name, cur, chatMeta.av);
        const setPhoto = async data => {
          const r = await sc('POST', `chats/${encodeURIComponent(cur)}/avatar`, { avatar: data });
          if (!r.ok) { q(box, '#mm').textContent = r.error; return; }
          chatMeta.av = (r.data && r.data.av) || 0; drawPhoto(box, 'mph', '', chatMeta.name, cur, chatMeta.av); drawHead(); drawList();
        };
        q(box, '#mphp').onclick = async () => { try { const p = await pickPhoto(); if (p) await setPhoto(p); } catch (e) { q(box, '#mm').textContent = TR('Dit bestand is geen geldige afbeelding.'); } };
        q(box, '#mphr').onclick = () => setPhoto('');
      }
      const say = m => { q(box, '#mm').textContent = m || ''; };
      box.onclick = async e => {
        const k = e.target.closest('[data-k]'), p = e.target.closest('[data-p]');
        if (k) { const r = await sc('DELETE', `chats/${encodeURIComponent(cur)}/members/${encodeURIComponent(k.dataset.k)}`); if (!r.ok) return say(r.error); members = members.filter(m => m.uid !== k.dataset.k); render(); drawHead(); }
        if (p) { const r = await sc('POST', `chats/${encodeURIComponent(cur)}/members`, { uid: p.dataset.p }); if (!r.ok) return say(r.error); const u = fr.find(f => f.uid === p.dataset.p); members.push(u); fr.splice(fr.indexOf(u), 1); render(); drawHead(); }
      };
      const rb = q(box, '#rnb'); if (rb) rb.onclick = async () => { const r = await sc('POST', `chats/${encodeURIComponent(cur)}/rename`, { name: q(box, '#rn').value }); if (!r.ok) return say(r.error); chatMeta.name = r.data.name; render(); drawHead(); drawList(); };
      q(box, '#lv').onclick = async () => { if (!(await ask(TR('Groep verlaten?'), 'Verlaten'))) return; const r = await sc('DELETE', `chats/${encodeURIComponent(cur)}/members/${encodeURIComponent(ME.uid)}`); if (!r.ok) return say(r.error); o.remove(); cur = ''; await drawList(); empty(); };
      const dg = q(box, '#dg'); if (dg) dg.onclick = async () => { if (!(await ask(TR('Groep voor iedereen verwijderen? Dit kan niet ongedaan worden gemaakt.'), 'Verwijderen'))) return; const r = await sc('DELETE', 'chats/' + encodeURIComponent(cur)); if (!r.ok) return say(r.error); o.remove(); cur = ''; await drawList(); empty(); };
    };
    render();
  }

  // ---------- Community: clips posten + alle gebruikers ----------
  V.community = async function () {
    if (!(await gate('Community'))) return;
    const m = await me(true);
    const mod = !!(m && ['owner', 'admin', 'moderator'].includes(m.role));
    $('#mn').innerHTML = `<div class=hd><div><h1>Community</h1><p>Deel je beste clips en zie wie er allemaal Wistic gebruikt.</p></div><div style="display:flex;gap:8px"><button class=gh id=crf>Vernieuwen</button><button class=btn id=cpost>Clip posten</button></div></div>
<div class=cm2 id=sroot><div><div id=cfeed><p class=mu>Laden…</p></div><div style="text-align:center"><button class=gh id=cmore style="display:none">Meer laden</button></div></div>
<div class=cmr><div class=pn><div class=sh3 style="margin:0">Leden<i id=cmn>0</i></div><input id=cmq placeholder="Zoek een gebruiker…" autocomplete=off style="width:100%;margin-top:10px"><div class=sl id=cml></div><div style="text-align:center;margin-top:8px"><button class=gh id=cmm style="display:none">Meer leden</button></div></div></div></div>`;
    const clipHtml = (c, by) => c ? `<div class=scc ${clipAttrs(c, by)}>${c.thumb && !c.gone ? `<img src="${esc(BASE + '/t/' + c.id + '.jpg')}" onerror="this.style.display='none'">` : '<span class=sci>🎬</span>'}<div><b>${esc(c.gone ? 'Clip niet meer online' : (c.title || (c.game ? c.game + ' clip' : 'Wistic clip')))}</b><span class=mu>${esc(c.game || 'Wistic')}</span></div></div>` : '';
    const postHtml = p => { const del = p.canDelete != null ? p.canDelete : (mod || (m && p.uid === m.uid));
      return `<div class=cp data-id="${esc(p.id)}"><div class=cph>${ava(p.name, 0, p)}<div class=tx><b>${esc(p.name)}${badge(p.role)}</b><small>${when(p.t)}</small></div>${del ? `<button class="gh sx dg" data-del="${esc(p.id)}">Verwijderen</button>` : ''}</div>${p.body ? `<div class=cpb>${esc(p.body)}</div>` : ''}${clipHtml(p.clip, p.name)}</div>`; };
    let posts = [], more = false;
    const drawFeed = () => {
      const f = $('#cfeed'); if (!f) return;
      f.innerHTML = posts.length ? posts.map(postHtml).join('') : '<div class=sem><b>Nog geen posts</b>Wees de eerste en post een clip!</div>';
      const b = $('#cmore'); if (b) b.style.display = more ? '' : 'none';
    };
    async function loadFeed(append) {
      const before = append && posts.length ? '?before=' + encodeURIComponent(posts[posts.length - 1].id) : '';
      const r = await sc('GET', 'community/posts' + before);
      if (!$('#cfeed')) return;
      if (!r.ok) { if (!append) $('#cfeed').innerHTML = `<p class=mu>${esc(r.error)}</p>`; return; }
      posts = append ? posts.concat(r.data.posts) : r.data.posts; more = !!r.data.more; drawFeed();
    }
    $('#cfeed').onclick = async e => {
      const c = e.target.closest('.scc'); if (c) { watchClip(c); return; }
      const d = e.target.closest('[data-del]');
      if (d) { if (!(await ask(TR('Post verwijderen?'), 'Verwijderen'))) return; const r = await sc('DELETE', 'community/posts/' + encodeURIComponent(d.dataset.del)); if (r.ok) { posts = posts.filter(p => String(p.id) !== d.dataset.del); drawFeed(); } else alert(r.error); }
    };
    $('#cmore').onclick = () => loadFeed(true);
    $('#crf').onclick = () => { loadFeed(false); loadMembers(false); };
    $('#cpost').onclick = async () => {
      const r = await sc('GET', 'myclips'); const list = r.ok ? (r.data.clips || []) : []; let pick = '';
      modal(`<h3 style="margin-top:0">Clip posten</h3>${r.ok ? (list.length ? `<textarea id=ptx maxlength=300 rows=3 placeholder="Schrijf iets bij je clip (mag leeg)…" style="width:100%;resize:none"></textarea><p class=mu style="font-size:.9rem;margin:10px 0 0">Kies een clip die al online staat:</p><div class=pk>${list.map(c => `<div class=it data-c="${esc(c.id)}"><span style="font-size:1.4rem">🎬</span><div class=nm style="flex:1;min-width:0"><b>${esc(c.title || (c.game ? c.game + ' clip' : 'Wistic clip'))}</b><div class=mu style="font-size:.8rem">${esc(c.game || '')} · ${(c.size / 1e6).toFixed(0)} MB</div></div></div>`).join('')}</div>` : '<p class=mu>Je hebt nog geen clips online. Klik bij een clip op Link maken, daarna kun je hem hier posten.</p>') : `<p class=mu>${esc(r.error)}</p>`}<div id=pme class=mu style="min-height:1.3em;color:#ff8b95"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class=gh id=px>Annuleren</button>${list.length ? '<button class=btn id=pok>Posten</button>' : ''}</div>`, o => {
        q(o, '#px').onclick = () => o.remove();
        const pk = q(o, '.pk'); if (pk) pk.onclick = e => { const it = e.target.closest('[data-c]'); if (!it) return; pick = it.dataset.c; pk.querySelectorAll('.it').forEach(x => x.style.background = x === it ? '#ffffff14' : ''); };
        const ok = q(o, '#pok'); if (ok) ok.onclick = async () => {
          const body = q(o, '#ptx').value.trim(); if (!pick) { q(o, '#pme').textContent = TR('Kies een clip.'); return; }
          ok.disabled = true; const r2 = await sc('POST', 'community/posts', { body, clip: pick });
          if (!r2.ok) { ok.disabled = false; q(o, '#pme').textContent = r2.error; return; }
          o.remove(); loadFeed(false);
        };
      });
    };
    // Leden: iedereen die Wistic gebruikt
    let mem = [], mtot = 0, mmore = false, mt = null;
    async function loadMembers(append) {
      const qv = ($('#cmq') && $('#cmq').value.trim()) || '';
      const r = await sc('GET', 'community/members?q=' + encodeURIComponent(qv) + '&offset=' + (append ? mem.length : 0));
      if (!$('#cml') || !r.ok) return;
      mem = append ? mem.concat(r.data.members) : r.data.members; mtot = r.data.total || mem.length; mmore = mem.length < mtot;
      $('#cmn').textContent = mtot;
      $('#cml').innerHTML = mem.length ? mem.map(u => `<div class=it>${ava(u.name, 0, u)}<div class=nm>${esc(u.name)}${badge(u.role)}</div></div>`).join('') : '<p class=mu style="padding:8px">Niemand gevonden.</p>';
      $('#cmm').style.display = mmore ? '' : 'none';
    }
    $('#cmq').oninput = () => { clearTimeout(mt); mt = setTimeout(() => loadMembers(false), 300); };
    $('#cmm').onclick = () => loadMembers(true);
    loadFeed(false); loadMembers(false);
  };

  // ---------- Rollen (alleen de eigenaar) ----------
  V.roles = async function () {
    if (!(await gate('Rollen'))) return;
    const m = await me(true);
    if (!m || m.role !== 'owner') { $('#mn').innerHTML = `<div class=hd><div><h1>Rollen</h1></div></div><div class=pn style="max-width:560px"><p>Alleen de eigenaar van Wistic kan rollen uitdelen.</p></div>`; return; }
    const opt = (v, cur) => [['', 'Geen rol'], ['verified', 'Geverifieerd'], ['vip', 'VIP'], ['moderator', 'Moderator'], ['admin', 'Admin']].map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l}</option>`).join('');
    $('#mn').innerHTML = `<div class=hd><div><h1>Rollen</h1><p>Jij bent de eigenaar. Geef anderen een rol; die staat als label bij hun naam.</p></div></div>
<div id=sroot><div class=pn style="max-width:640px"><h4 style="margin-top:0">Rol geven</h4><div class=sr><input id=rq placeholder="Gebruikersnaam" autocomplete=off><select id=rs>${opt('', 'admin')}</select><button class=btn id=rb>Opslaan</button></div><div id=rsg class=sg></div><div id=rm class=mu style="min-height:1.3em;margin-top:8px"></div></div>
<div class="pn" style="max-width:640px;margin-top:14px"><h4 style="margin-top:0">Wat mag welke rol?</h4>
<div class=sl><div class=it><span><span class=rb style="--c:#f5b942;margin:0">Eigenaar</span></span><div class=nm style="white-space:normal;font-weight:400">Alles, en alleen jij kunt rollen uitdelen.</div></div>
<div class=it><span><span class=rbi style="--c:#f5b942;margin:0">${CROWN}</span></span><div class=nm style="white-space:normal;font-weight:400">Kroontje naast je naam.</div></div>
<div class=it><span><span class=rbi style="--c:#4da3ff;margin:0">${CHECK}</span></span><div class=nm style="white-space:normal;font-weight:400">Geverifieerd: een vinkje naast de naam. Voor bekende of vertrouwde mensen.</div></div>
<div class=it><span><span class=rb style="--c:#ff6b6b;margin:0">Admin</span></span><div class=nm style="white-space:normal;font-weight:400">Berichten van anderen verwijderen in elke chat en groepen verwijderen.</div></div>
<div class=it><span><span class=rb style="--c:#5aa9ff;margin:0">Moderator</span></span><div class=nm style="white-space:normal;font-weight:400">Berichten van anderen verwijderen in elke chat.</div></div>
<div class=it><span><span class=rb style="--c:#c58bff;margin:0">VIP</span></span><div class=nm style="white-space:normal;font-weight:400">Alleen een label bij de naam.</div></div></div></div>
<div id=rls></div></div>`;
    const say = (t, good) => { const e = $('#rm'); if (e) { e.style.color = good ? '#ffffff' : '#ff8b95'; e.textContent = t || ''; } };
    let t = null;
    $('#rq').oninput = () => { clearTimeout(t); t = setTimeout(async () => { const v = $('#rq').value.trim(), box = $('#rsg'); if (!box) return; if (v.length < 2) { box.innerHTML = ''; return; } const r = await sc('GET', 'users?q=' + encodeURIComponent(v)); if (!r.ok || !$('#rsg')) return; box.innerHTML = `<div class=sl>${r.data.users.map(u => `<div class=it style="cursor:pointer" data-n="${esc(u.name)}">${ava(u.name, 0, u)}<div class=nm>${esc(u.name)}${badge(u.role)}</div></div>`).join('')}</div>`; }, 250); };
    $('#rsg').onclick = e => { const i = e.target.closest('[data-n]'); if (i) { $('#rq').value = i.dataset.n; $('#rsg').innerHTML = ''; } };
    $('#rb').onclick = async () => {
      const name = $('#rq').value.trim(); if (!name) { say('Typ een gebruikersnaam.'); return; }
      const r = await sc('POST', 'roles', { name, role: $('#rs').value });
      if (!r.ok) { say(r.error); return; }
      say(r.data.role ? `${r.data.name} is nu ${RM[r.data.role][0]}.` : `${r.data.name} heeft geen rol meer.`, true); $('#rq').value = ''; draw();
    };
    async function draw() {
      const r = await sc('GET', 'roles'), box = $('#rls'); if (!box) return;
      if (!r.ok) { box.innerHTML = `<p class=mu>${esc(r.error)}</p>`; return; }
      const l = r.data.roles;
      box.innerHTML = `<div class=sh3>Mensen met een rol<i>${l.length}</i></div>` + (l.length ? `<div class="pn sl" style="max-width:640px">${l.map(u => `<div class=it>${ava(u.name, 0, u)}<div class=nm>${esc(u.name)}${badge(u.role)}</div><div class=ac><select data-u="${esc(u.uid)}">${opt('', u.role)}</select></div></div>`).join('')}</div>` : '<p class=mu>Nog niemand. Geef hierboven iemand een rol.</p>');
      box.onchange = async e => { const s = e.target.closest('select[data-u]'); if (!s) return; const r2 = await sc('POST', 'roles', { uid: s.dataset.u, role: s.value }); if (!r2.ok) say(r2.error); draw(); };
    }
    draw();
  };
})();
