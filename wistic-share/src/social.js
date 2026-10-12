// Wistic Social: vrienden, chats en rollen (Cloudflare Worker + D1).
// Inloggen gaat met hetzelfde Firebase-token als Wistic Share; de functie `user` komt uit index.js.
// Tabellen worden bij het eerste gebruik zelf aangemaakt (CREATE TABLE IF NOT EXISTS), net als bij de gebruikersnamen.

const DAY = 86400000;
const RANK = { owner: 4, admin: 3, moderator: 2, vip: 1, verified: 0.5, '': 0 };
const ASSIGN = ['admin', 'moderator', 'vip', 'verified'];       // rollen die de eigenaar kan uitdelen
const MOD = 2;                                      // moderator en hoger mogen berichten van anderen verwijderen
const MAX_POST = 300, POST_GAP = 15000, POSTS_PER_HOUR = 6, POST_PAGE = 20, MEMBER_PAGE = 30, POST_DAYS = 180;
const MAX_FRIENDS = 100, MAX_CHATS = 30, MAX_MEMBERS = 20, MAX_MSG = 500, MSG_DAYS = 60;
const ID = /^[A-Za-z0-9]{8}$/, UID = /^[A-Za-z0-9_-]{1,128}$/;

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const err = (m, s = 400) => json({ error: m }, s);
const text = (s, n) => String(s || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const name1 = s => String(s || '').normalize('NFC').replace(/[\u0000-\u001f]/g, ' ').trim().replace(/\s+/g, ' ');
const RID = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // 56 tekens (eerder stond er % 57: dan kwam er soms een id van 7 tekens uit en gaf delen een 404)
const rid = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map(x => RID[x % RID.length]).join(''); };
const qs = n => Array(n).fill('?').join(',');
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

// ---------- Tabellen ----------
let ready = false;
async function tables(env) {
  if (ready) return;
  const q = [
    'CREATE TABLE IF NOT EXISTS usernames (uid TEXT PRIMARY KEY, name TEXT NOT NULL, nk TEXT NOT NULL UNIQUE, changed INTEGER NOT NULL DEFAULT 0)',
    'CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, req_by TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (a, b))',
    'CREATE INDEX IF NOT EXISTS friends_b ON friends (b)',
    'CREATE TABLE IF NOT EXISTS blocks (uid TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY (uid, target))',
    'CREATE TABLE IF NOT EXISTS roles (uid TEXT PRIMARY KEY, role TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL, kind TEXT NOT NULL, dm TEXT UNIQUE, created INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS chat_members (chat TEXT NOT NULL, uid TEXT NOT NULL, joined INTEGER NOT NULL, last_read INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (chat, uid))',
    'CREATE INDEX IF NOT EXISTS chat_members_uid ON chat_members (uid)',
    'CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat TEXT NOT NULL, uid TEXT NOT NULL, body TEXT NOT NULL, clip TEXT, created INTEGER NOT NULL)',
    'CREATE INDEX IF NOT EXISTS chat_messages_chat ON chat_messages (chat, id)',
    'CREATE TABLE IF NOT EXISTS avatars (uid TEXT PRIMARY KEY, v INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS chat_avatars (chat TEXT PRIMARY KEY, v INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, body TEXT NOT NULL, clip TEXT NOT NULL, created INTEGER NOT NULL)',
    'CREATE INDEX IF NOT EXISTS posts_uid ON posts (uid, id)'
  ];
  for (const s of q) await env.DB.prepare(s).run();
  ready = true;
}

// ---------- Wie ben je (en welke rol heb je) ----------
// De eigenaar is het account met het e-mailadres uit OWNER_EMAIL (wrangler.toml) en een geverifieerd e-mailadres (Google-login is dat altijd).
let ownerSeen = '';
async function who(req, env, user) {
  const me = await user(req, env);
  if (!me) return { bad: err('Niet ingelogd. Log opnieuw in bij Wistic.', 401) };
  await tables(env);
  const un = await env.DB.prepare('SELECT name FROM usernames WHERE uid=?').bind(me.uid).first();
  if (!un) return { bad: err('Kies eerst een gebruikersnaam (Instellingen > Profiel bewerken).', 403) };
  const owner = !!(env.OWNER_EMAIL && me.email && me.verified && me.email.toLowerCase() === String(env.OWNER_EMAIL).trim().toLowerCase());
  let role = '';
  if (owner) {
    role = 'owner';
    if (ownerSeen !== me.uid) {
      await env.DB.prepare('INSERT INTO roles (uid, role) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET role=excluded.role').bind(me.uid, 'owner').run();
      ownerSeen = me.uid;
    }
  } else {
    const r = await env.DB.prepare('SELECT role FROM roles WHERE uid=?').bind(me.uid).first();
    if (r && r.role === 'owner') await env.DB.prepare('DELETE FROM roles WHERE uid=?').bind(me.uid).run();   // oude eigenaar-rij opruimen
    else if (r && ASSIGN.includes(r.role)) role = r.role;
  }
  return { me: { uid: me.uid, name: un.name, role, rank: RANK[role] || 0 } };
}

// Namen en rollen van een groep gebruikers ophalen.
async function info(env, uids) {
  uids = [...new Set(uids)].filter(Boolean);
  const m = new Map();
  for (let i = 0; i < uids.length; i += 50) {
    const part = uids.slice(i, i + 50);
    const { results } = await env.DB.prepare('SELECT u.uid, u.name, r.role, a.v AS av FROM usernames u LEFT JOIN roles r ON r.uid=u.uid LEFT JOIN avatars a ON a.uid=u.uid WHERE u.uid IN (' + qs(part.length) + ')').bind(...part).all();
    for (const r of results) m.set(r.uid, { uid: r.uid, name: r.name, role: r.role || '', av: r.av || 0 });
  }
  return m;
}
const card = (m, uid) => m.get(uid) || { uid, name: 'Onbekend', role: '', av: 0 };

const isBlocked = async (env, a, b) => !!(await env.DB.prepare('SELECT 1 x FROM blocks WHERE (uid=? AND target=?) OR (uid=? AND target=?)').bind(a, b, b, a).first());
async function friendRow(env, a, b) { const [x, y] = pair(a, b); return env.DB.prepare('SELECT status, req_by FROM friends WHERE a=? AND b=?').bind(x, y).first(); }
const isFriend = async (env, a, b) => { const r = await friendRow(env, a, b); return !!(r && r.status === 'accepted'); };
const member = (env, chat, uid) => env.DB.prepare('SELECT last_read FROM chat_members WHERE chat=? AND uid=?').bind(chat, uid).first();

// ---------- Router ----------
export async function handleSocial(req, env, u, user) {
  const p = u.pathname;
  // Profielfoto's zijn openbaar (net als op elk chatplatform): /a/<uid>?v=<versie>
  const am = p.match(/^\/a\/([A-Za-z0-9_-]{1,128})$/);
  if (am && (req.method === 'GET' || req.method === 'HEAD')) {
    const o = await env.BUCKET.get('avatars/' + am[1]);
    if (!o) return new Response('', { status: 404 });
    return new Response(req.method === 'HEAD' ? null : o.body, { headers: { 'content-type': (o.httpMetadata && o.httpMetadata.contentType) || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
  }
  // Groepsfoto's zijn ook openbaar: /g/<chat-id>?v=<versie> (het id is niet te raden)
  const gm = p.match(/^\/g\/([A-Za-z0-9]{8})$/);
  if (gm && (req.method === 'GET' || req.method === 'HEAD')) {
    const o = await env.BUCKET.get('chatavatars/' + gm[1]);
    if (!o) return new Response('', { status: 404 });
    return new Response(req.method === 'HEAD' ? null : o.body, { headers: { 'content-type': (o.httpMetadata && o.httpMetadata.contentType) || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
  }
  if (!p.startsWith('/api/social/')) return null;
  const M = req.method, s = p.slice('/api/social/'.length).split('/').filter(Boolean);
  const w = await who(req, env, user); if (w.bad) return w.bad;
  const me = w.me;
  const b = (M === 'POST' || M === 'PUT') ? await req.json().catch(() => ({})) : {};

  if (s[0] === 'avatar' && M === 'POST') return avatarSet(env, me, b);
  if (s[0] === 'me' && M === 'GET') return json({ uid: me.uid, name: me.name, role: me.role });
  if (s[0] === 'users' && M === 'GET') return userSearch(env, me, u);

  if (s[0] === 'friends') {
    if (!s[1] && M === 'GET') return friendList(env, me);
    if (s[1] === 'request' && M === 'POST') return friendRequest(env, me, b);
    if (s[1] === 'respond' && M === 'POST') return friendRespond(env, me, b);
    if (s[1] && UID.test(s[1]) && M === 'DELETE') return friendRemove(env, me, s[1]);
  }
  if (s[0] === 'block') {
    if (!s[1] && M === 'POST') return blockAdd(env, me, b);
    if (s[1] && UID.test(s[1]) && M === 'DELETE') { await env.DB.prepare('DELETE FROM blocks WHERE uid=? AND target=?').bind(me.uid, s[1]).run(); return json({ ok: true }); }
  }
  if (s[0] === 'chats') {
    if (!s[1] && M === 'GET') return chatList(env, me);
    if (!s[1] && M === 'POST') return chatCreate(env, me, b);
    if (s[1] && ID.test(s[1])) {
      const id = s[1];
      if (!s[2] && M === 'GET') return chatGet(env, me, id, u);
      if (!s[2] && M === 'DELETE') return chatDelete(env, me, id);
      if (s[2] === 'messages' && !s[3] && M === 'POST') return msgSend(env, me, id, b);
      if (s[2] === 'messages' && /^\d{1,12}$/.test(s[3] || '') && M === 'DELETE') return msgDelete(env, me, id, +s[3]);
      if (s[2] === 'members' && !s[3] && M === 'POST') return memberAdd(env, me, id, b);
      if (s[2] === 'members' && UID.test(s[3] || '') && M === 'DELETE') return memberRemove(env, me, id, s[3]);
      if (s[2] === 'rename' && M === 'POST') return chatRename(env, me, id, b);
      if (s[2] === 'avatar' && !s[3] && M === 'POST') return chatAvatar(env, me, id, b);
    }
  }
  if (s[0] === 'community') {
    if (s[1] === 'posts' && !s[2] && M === 'GET') return postList(env, me, u);
    if (s[1] === 'posts' && !s[2] && M === 'POST') return postCreate(env, me, b);
    if (s[1] === 'posts' && /^\d{1,12}$/.test(s[2] || '') && M === 'DELETE') return postDelete(env, me, +s[2]);
    if (s[1] === 'members' && !s[2] && M === 'GET') return memberList(env, me, u);
  }
  if (s[0] === 'roles') {
    if (me.role !== 'owner') return err('Alleen de eigenaar mag rollen beheren.', 403);
    if (M === 'GET') return roleList(env);
    if (M === 'POST') return roleSet(env, me, b);
  }
  return err('Niet gevonden.', 404);
}

// Leest een plaatje uit een data-URL (jpeg, png of webp, max ongeveer 220 KB). Geeft null terug als het niet klopt.
function readImage(a) {
  const m = String(a).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m || a.length > 300000) return null;
  let bin;
  try { bin = atob(m[2]); } catch (e) { return null; }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1], bytes };
}

// ---------- Profielfoto ----------
// De app stuurt een vierkant jpeg-plaatje van 256x256 (data-URL). Leeg = foto verwijderen.
async function avatarSet(env, me, b) {
  const a = String(b.avatar || '');
  if (!a) {
    await env.BUCKET.delete('avatars/' + me.uid);
    await env.DB.prepare('DELETE FROM avatars WHERE uid=?').bind(me.uid).run();
    return json({ ok: true, av: 0 });
  }
  const img = readImage(a);
  if (!img) return err('Deze profielfoto is ongeldig of te groot.');
  const v = Date.now();
  await env.BUCKET.put('avatars/' + me.uid, img.bytes, { httpMetadata: { contentType: img.type } });
  await env.DB.prepare('INSERT INTO avatars (uid, v) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET v=excluded.v').bind(me.uid, v).run();
  return json({ ok: true, av: v });
}

// ---------- Gebruikers zoeken ----------
async function userSearch(env, me, u) {
  const q = name1(u.searchParams.get('q')).toLowerCase();
  if (q.length < 2) return json({ users: [] });
  const like = q.replace(/[\\%_]/g, c => '\\' + c) + '%';
  const { results } = await env.DB.prepare("SELECT uid, name FROM usernames WHERE nk LIKE ? ESCAPE '\\' AND uid<>? AND uid NOT IN (SELECT uid FROM blocks WHERE target=?) ORDER BY nk LIMIT 10").bind(like, me.uid, me.uid).all();
  const rows = await env.DB.prepare('SELECT a, b, status, req_by FROM friends WHERE a=? OR b=?').bind(me.uid, me.uid).all();
  const rel = new Map();
  for (const r of rows.results) rel.set(r.a === me.uid ? r.b : r.a, r.status === 'accepted' ? 'friend' : r.req_by === me.uid ? 'outgoing' : 'incoming');
  const roles = await info(env, results.map(r => r.uid));
  return json({ users: results.map(r => ({ uid: r.uid, name: r.name, role: card(roles, r.uid).role, av: card(roles, r.uid).av, rel: rel.get(r.uid) || '' })) });
}

// ---------- Vrienden ----------
async function friendList(env, me) {
  const { results } = await env.DB.prepare('SELECT a, b, status, req_by FROM friends WHERE a=? OR b=?').bind(me.uid, me.uid).all();
  const bl = await env.DB.prepare('SELECT target FROM blocks WHERE uid=?').bind(me.uid).all();
  const other = r => (r.a === me.uid ? r.b : r.a);
  const m = await info(env, [...results.map(other), ...bl.results.map(r => r.target)]);
  const by = n => (x, y) => x.name.localeCompare(y.name);
  const out = { friends: [], incoming: [], outgoing: [], blocked: bl.results.map(r => card(m, r.target)) };
  for (const r of results) {
    const c = card(m, other(r));
    if (r.status === 'accepted') out.friends.push(c); else if (r.req_by === me.uid) out.outgoing.push(c); else out.incoming.push(c);
  }
  for (const k of Object.keys(out)) out[k].sort(by());
  return json(out);
}
async function friendRequest(env, me, b) {
  const nk = name1(b.name).toLowerCase();
  if (nk.length < 3) return err('Typ de gebruikersnaam van je vriend.');
  const t = await env.DB.prepare('SELECT uid, name FROM usernames WHERE nk=?').bind(nk).first();
  if (!t) return err('Geen gebruiker met die naam gevonden.', 404);
  if (t.uid === me.uid) return err('Je kunt jezelf niet toevoegen.');
  if (await isBlocked(env, me.uid, t.uid)) return err('Je kunt deze gebruiker niet toevoegen.', 403);
  const cur = await friendRow(env, me.uid, t.uid), [x, y] = pair(me.uid, t.uid);
  if (cur && cur.status === 'accepted') return err('Jullie zijn al vrienden.', 409);
  if (cur && cur.req_by === me.uid) return err('Je hebt al een verzoek gestuurd.', 409);
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM friends WHERE (a=? OR b=?) AND status='accepted'").bind(me.uid, me.uid).first();
  if (n.n >= MAX_FRIENDS) return err('Je vriendenlijst is vol (' + MAX_FRIENDS + ').', 403);
  if (cur) {   // die ander had jou al een verzoek gestuurd: dan zijn jullie meteen vrienden
    await env.DB.prepare("UPDATE friends SET status='accepted' WHERE a=? AND b=?").bind(x, y).run();
    return json({ ok: true, state: 'friend', name: t.name });
  }
  await env.DB.prepare("INSERT INTO friends (a, b, status, req_by, created) VALUES (?, ?, 'pending', ?, ?)").bind(x, y, me.uid, Date.now()).run();
  return json({ ok: true, state: 'sent', name: t.name });
}
async function friendRespond(env, me, b) {
  if (!UID.test(String(b.uid || ''))) return err('Ongeldige gebruiker.');
  const cur = await friendRow(env, me.uid, b.uid), [x, y] = pair(me.uid, b.uid);
  if (!cur || cur.status !== 'pending' || cur.req_by === me.uid) return err('Dit verzoek bestaat niet meer.', 404);
  if (b.accept) await env.DB.prepare("UPDATE friends SET status='accepted' WHERE a=? AND b=?").bind(x, y).run();
  else await env.DB.prepare('DELETE FROM friends WHERE a=? AND b=?').bind(x, y).run();
  return json({ ok: true });
}
async function friendRemove(env, me, uid) {
  const [x, y] = pair(me.uid, uid);
  await env.DB.prepare('DELETE FROM friends WHERE a=? AND b=?').bind(x, y).run();
  return json({ ok: true });
}
async function blockAdd(env, me, b) {
  if (!UID.test(String(b.uid || '')) || b.uid === me.uid) return err('Ongeldige gebruiker.');
  const [x, y] = pair(me.uid, b.uid);
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO blocks (uid, target) VALUES (?, ?)').bind(me.uid, b.uid),
    env.DB.prepare('DELETE FROM friends WHERE a=? AND b=?').bind(x, y)
  ]);
  return json({ ok: true });
}

// ---------- Chats ----------
async function chatList(env, me) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.kind, c.owner, c.dm, m.last_read, ca.v AS av,
       (SELECT COUNT(*) FROM chat_members x WHERE x.chat=c.id) AS n,
       (SELECT COUNT(*) FROM chat_messages g WHERE g.chat=c.id AND g.id>m.last_read AND g.uid<>?) AS unread,
       (SELECT body FROM chat_messages WHERE chat=c.id ORDER BY id DESC LIMIT 1) AS last_body,
       (SELECT clip FROM chat_messages WHERE chat=c.id ORDER BY id DESC LIMIT 1) AS last_clip,
       (SELECT created FROM chat_messages WHERE chat=c.id ORDER BY id DESC LIMIT 1) AS last_t
     FROM chat_members m JOIN chats c ON c.id=m.chat LEFT JOIN chat_avatars ca ON ca.chat=c.id WHERE m.uid=? ORDER BY COALESCE(last_t, c.created) DESC`
  ).bind(me.uid, me.uid).all();
  const peers = results.filter(r => r.kind === 'dm').map(r => r.dm.split(':').find(x => x !== me.uid));
  const m = await info(env, peers);
  return json({ chats: results.map(r => {
    const peer = r.kind === 'dm' ? card(m, r.dm.split(':').find(x => x !== me.uid)) : null;
    return { id: r.id, kind: r.kind, name: peer ? peer.name : r.name, peer, owner: r.owner, n: r.n, unread: r.unread, av: r.kind === 'group' ? (r.av || 0) : 0,
      last: r.last_body ? r.last_body.slice(0, 80) : (r.last_clip ? '🎬 Clip' : ''), t: r.last_t || 0 };
  }) });
}
async function chatCreate(env, me, b) {
  const ids = [...new Set((Array.isArray(b.members) ? b.members : []).map(String))].filter(x => UID.test(x) && x !== me.uid);
  if (!ids.length) return err('Kies minstens één vriend.');
  if (ids.length + 1 > MAX_MEMBERS) return err('Een groep kan maximaal ' + MAX_MEMBERS + ' leden hebben.');
  for (const id of ids) {
    if (!(await isFriend(env, me.uid, id)) || await isBlocked(env, me.uid, id)) return err('Je kunt alleen vrienden toevoegen.', 403);
  }
  const now = Date.now();
  if (ids.length === 1 && !String(b.name || '').trim()) {   // 1-op-1 gesprek: bestaat het al, dan geef je dat terug
    const key = pair(me.uid, ids[0]).join(':');
    const ex = await env.DB.prepare('SELECT id FROM chats WHERE dm=?').bind(key).first();
    if (ex) { await env.DB.prepare('INSERT OR IGNORE INTO chat_members (chat, uid, joined, last_read) VALUES (?, ?, ?, 0)').bind(ex.id, me.uid, now).run(); return json({ id: ex.id }); }
    const id = rid();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO chats (id, name, owner, kind, dm, created) VALUES (?, '', ?, 'dm', ?, ?)").bind(id, me.uid, key, now),
      env.DB.prepare('INSERT INTO chat_members (chat, uid, joined) VALUES (?, ?, ?)').bind(id, me.uid, now),
      env.DB.prepare('INSERT INTO chat_members (chat, uid, joined) VALUES (?, ?, ?)').bind(id, ids[0], now)
    ]);
    return json({ id });
  }
  const name = text(b.name, 30).replace(/\n/g, ' ');
  if (name.length < 2) return err('Geef de groep een naam (minstens 2 tekens).');
  const mine = await env.DB.prepare('SELECT COUNT(*) n FROM chat_members WHERE uid=?').bind(me.uid).first();
  if (mine.n >= MAX_CHATS) return err('Je zit al in ' + MAX_CHATS + ' chats. Verlaat er eerst één.', 403);
  const id = rid();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO chats (id, name, owner, kind, created) VALUES (?, ?, ?, 'group', ?)").bind(id, name, me.uid, now),
    env.DB.prepare('INSERT INTO chat_members (chat, uid, joined) VALUES (?, ?, ?)').bind(id, me.uid, now),
    ...ids.map(x => env.DB.prepare('INSERT INTO chat_members (chat, uid, joined) VALUES (?, ?, ?)').bind(id, x, now))
  ]);
  return json({ id });
}
async function chatGet(env, me, id, u) {
  const mem = await member(env, id, me.uid); if (!mem) return err('Chat niet gevonden.', 404);
  const chat = await env.DB.prepare('SELECT id, name, kind, owner, dm FROM chats WHERE id=?').bind(id).first();
  if (!chat) return err('Chat niet gevonden.', 404);
  const after = Math.max(0, Math.floor(+u.searchParams.get('after')) || 0), full = after === 0 || u.searchParams.get('m') === '1';
  const SEL = 'SELECT g.id, g.uid, g.body, g.clip, g.created, u.name, r.role, av.v AS av, c.title, c.game, c.thumb FROM chat_messages g LEFT JOIN usernames u ON u.uid=g.uid LEFT JOIN roles r ON r.uid=g.uid LEFT JOIN avatars av ON av.uid=g.uid LEFT JOIN clips c ON c.id=g.clip AND c.ready=1';
  let rows;
  if (after > 0) rows = (await env.DB.prepare(SEL + ' WHERE g.chat=? AND g.id>? ORDER BY g.id LIMIT 100').bind(id, after).all()).results;
  else rows = (await env.DB.prepare(SEL + ' WHERE g.chat=? ORDER BY g.id DESC LIMIT 60').bind(id).all()).results.reverse();
  if (rows.length) {
    const last = rows[rows.length - 1].id;
    if (last > mem.last_read) await env.DB.prepare('UPDATE chat_members SET last_read=? WHERE chat=? AND uid=? AND last_read<?').bind(last, id, me.uid, last).run();
  }
  const cav = chat.kind === 'group' ? await env.DB.prepare('SELECT v FROM chat_avatars WHERE chat=?').bind(id).first() : null;
  let members = null;
  if (full) {
    const ms = (await env.DB.prepare('SELECT uid FROM chat_members WHERE chat=? ORDER BY joined').bind(id).all()).results;
    const m = await info(env, ms.map(x => x.uid));
    members = ms.map(x => card(m, x.uid));
  }
  return json({
    chat: { id: chat.id, name: chat.name, kind: chat.kind, owner: chat.owner, av: cav ? cav.v : 0 },
    members, canMod: me.rank >= MOD || chat.owner === me.uid, canDelete: chat.kind === 'group' && (chat.owner === me.uid || me.rank >= 3),
    messages: rows.map(r => ({ id: r.id, uid: r.uid, name: r.name || 'Onbekend', role: r.role || '', av: r.av || 0, body: r.body, t: r.created,
      clip: r.clip ? { id: r.clip, title: r.title || '', game: r.game || '', thumb: !!r.thumb, gone: r.title == null && r.game == null } : null }))
  });
}
async function msgSend(env, me, id, b) {
  if (!(await member(env, id, me.uid))) return err('Chat niet gevonden.', 404);
  const chat = await env.DB.prepare('SELECT kind, dm FROM chats WHERE id=?').bind(id).first();
  if (chat && chat.kind === 'dm') {
    const peer = chat.dm.split(':').find(x => x !== me.uid);
    if (await isBlocked(env, me.uid, peer)) return err('Je kunt in dit gesprek geen berichten sturen.', 403);
  }
  const body = text(b.body, MAX_MSG), clip = ID.test(String(b.clip || '')) ? String(b.clip) : '';
  if (!body && !clip) return err('Typ eerst een bericht.');
  if (clip) {
    const c = await env.DB.prepare('SELECT id FROM clips WHERE id=? AND uid=? AND ready=1').bind(clip, me.uid).first();
    if (!c) return err('Die clip staat niet online. Maak eerst een link bij de clip.', 404);
  }
  const now = Date.now();
  const last = await env.DB.prepare('SELECT created FROM chat_messages WHERE chat=? AND uid=? ORDER BY id DESC LIMIT 1').bind(id, me.uid).first();
  if (last && now - last.created < 600) return err('Rustig aan, je verstuurt te snel.', 429);
  const r = await env.DB.prepare('INSERT INTO chat_messages (chat, uid, body, clip, created) VALUES (?, ?, ?, ?, ?)').bind(id, me.uid, body, clip || null, now).run();
  const mid = r.meta && r.meta.last_row_id;
  if (mid) await env.DB.prepare('UPDATE chat_members SET last_read=? WHERE chat=? AND uid=? AND last_read<?').bind(mid, id, me.uid, mid).run();
  return json({ id: mid || 0 });
}
async function msgDelete(env, me, id, mid) {
  if (!(await member(env, id, me.uid))) return err('Chat niet gevonden.', 404);
  const msg = await env.DB.prepare('SELECT uid FROM chat_messages WHERE id=? AND chat=?').bind(mid, id).first();
  if (!msg) return err('Bericht niet gevonden.', 404);
  const chat = await env.DB.prepare('SELECT owner FROM chats WHERE id=?').bind(id).first();
  if (!(msg.uid === me.uid || me.rank >= MOD || (chat && chat.owner === me.uid))) return err('Je mag dit bericht niet verwijderen.', 403);
  await env.DB.prepare('DELETE FROM chat_messages WHERE id=?').bind(mid).run();
  return json({ ok: true });
}
async function memberAdd(env, me, id, b) {
  const chat = await env.DB.prepare('SELECT kind, owner FROM chats WHERE id=?').bind(id).first();
  if (!chat || !(await member(env, id, me.uid))) return err('Chat niet gevonden.', 404);
  if (chat.kind !== 'group') return err('Aan een gesprek van twee mensen kun je niemand toevoegen. Maak een groep.');
  if (chat.owner !== me.uid) return err('Alleen de eigenaar van de groep kan leden toevoegen.', 403);
  const uid = String(b.uid || '');
  if (!UID.test(uid)) return err('Ongeldige gebruiker.');
  if (!(await isFriend(env, me.uid, uid)) || await isBlocked(env, me.uid, uid)) return err('Je kunt alleen vrienden toevoegen.', 403);
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM chat_members WHERE chat=?').bind(id).first();
  if (n.n >= MAX_MEMBERS) return err('Een groep kan maximaal ' + MAX_MEMBERS + ' leden hebben.', 403);
  if (await member(env, id, uid)) return err('Deze vriend zit al in de groep.', 409);
  await env.DB.prepare('INSERT INTO chat_members (chat, uid, joined, last_read) VALUES (?, ?, ?, (SELECT COALESCE(MAX(id),0) FROM chat_messages WHERE chat=?))').bind(id, uid, Date.now(), id).run();
  return json({ ok: true });
}
async function memberRemove(env, me, id, uid) {
  const chat = await env.DB.prepare('SELECT kind, owner FROM chats WHERE id=?').bind(id).first();
  if (!chat || !(await member(env, id, me.uid))) return err('Chat niet gevonden.', 404);
  if (chat.kind !== 'group') return err('Je kunt een gesprek van twee mensen niet verlaten.');
  if (uid !== me.uid && chat.owner !== me.uid) return err('Alleen de eigenaar van de groep kan leden verwijderen.', 403);
  await env.DB.prepare('DELETE FROM chat_members WHERE chat=? AND uid=?').bind(id, uid).run();
  if (uid === chat.owner) {   // de eigenaar vertrekt: de oudste overgebleven lid wordt eigenaar, of de groep verdwijnt
    const next = await env.DB.prepare('SELECT uid FROM chat_members WHERE chat=? ORDER BY joined LIMIT 1').bind(id).first();
    if (next) await env.DB.prepare('UPDATE chats SET owner=? WHERE id=?').bind(next.uid, id).run();
    else await wipe(env, id);
  }
  return json({ ok: true });
}
async function chatRename(env, me, id, b) {
  const chat = await env.DB.prepare('SELECT kind, owner FROM chats WHERE id=?').bind(id).first();
  if (!chat || !(await member(env, id, me.uid))) return err('Chat niet gevonden.', 404);
  if (chat.kind !== 'group' || chat.owner !== me.uid) return err('Alleen de eigenaar van de groep kan de naam wijzigen.', 403);
  const name = text(b.name, 30).replace(/\n/g, ' ');
  if (name.length < 2) return err('Geef de groep een naam (minstens 2 tekens).');
  await env.DB.prepare('UPDATE chats SET name=? WHERE id=?').bind(name, id).run();
  return json({ ok: true, name });
}
async function chatDelete(env, me, id) {
  const chat = await env.DB.prepare('SELECT kind, owner FROM chats WHERE id=?').bind(id).first();
  if (!chat || !(await member(env, id, me.uid))) return err('Chat niet gevonden.', 404);
  if (chat.kind !== 'group' || !(chat.owner === me.uid || me.rank >= 3)) return err('Alleen de eigenaar van de groep kan hem verwijderen.', 403);
  await wipe(env, id);
  return json({ ok: true });
}
async function wipe(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM chat_messages WHERE chat=?').bind(id),
    env.DB.prepare('DELETE FROM chat_members WHERE chat=?').bind(id),
    env.DB.prepare('DELETE FROM chat_avatars WHERE chat=?').bind(id),
    env.DB.prepare('DELETE FROM chats WHERE id=?').bind(id)
  ]);
  try { await env.BUCKET.delete('chatavatars/' + id); } catch (e) {}
}

// Groepsfoto: alleen de eigenaar van de groep. Leeg = foto verwijderen.
async function chatAvatar(env, me, id, b) {
  const chat = await env.DB.prepare('SELECT kind, owner FROM chats WHERE id=?').bind(id).first();
  if (!chat || !(await member(env, id, me.uid))) return err('Chat niet gevonden.', 404);
  if (chat.kind !== 'group' || chat.owner !== me.uid) return err('Alleen de eigenaar van de groep kan de groepsfoto wijzigen.', 403);
  const a = String(b.avatar || '');
  if (!a) {
    await env.BUCKET.delete('chatavatars/' + id);
    await env.DB.prepare('DELETE FROM chat_avatars WHERE chat=?').bind(id).run();
    return json({ ok: true, av: 0 });
  }
  const img = readImage(a);
  if (!img) return err('Deze groepsfoto is ongeldig of te groot.');
  const v = Date.now();
  await env.BUCKET.put('chatavatars/' + id, img.bytes, { httpMetadata: { contentType: img.type } });
  await env.DB.prepare('INSERT INTO chat_avatars (chat, v) VALUES (?, ?) ON CONFLICT(chat) DO UPDATE SET v=excluded.v').bind(id, v).run();
  return json({ ok: true, av: v });
}

// ---------- Community: clips posten en alle leden ----------
async function postList(env, me, u) {
  const before = Math.max(0, Math.floor(+u.searchParams.get('before')) || 0);
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.uid, p.body, p.clip, p.created, un.name, r.role, av.v AS av, c.id AS cid, c.title, c.game, c.thumb
     FROM posts p JOIN usernames un ON un.uid=p.uid LEFT JOIN roles r ON r.uid=p.uid LEFT JOIN avatars av ON av.uid=p.uid
       LEFT JOIN clips c ON c.id=p.clip AND c.ready=1
     WHERE (?=0 OR p.id<?) AND p.uid NOT IN (SELECT target FROM blocks WHERE uid=?) AND p.uid NOT IN (SELECT uid FROM blocks WHERE target=?)
     ORDER BY p.id DESC LIMIT ?`
  ).bind(before, before, me.uid, me.uid, POST_PAGE + 1).all();
  const more = results.length > POST_PAGE;
  return json({ more, posts: results.slice(0, POST_PAGE).map(r => ({
    id: r.id, uid: r.uid, name: r.name, role: r.role || '', av: r.av || 0, t: r.created, body: r.body,
    clip: { id: r.clip, title: r.title || '', game: r.game || '', thumb: !!r.thumb, gone: !r.cid },
    canDelete: r.uid === me.uid || me.rank >= MOD
  })) });
}
async function postCreate(env, me, b) {
  const body = text(b.body, MAX_POST), clip = ID.test(String(b.clip || '')) ? String(b.clip) : '';
  if (!clip) return err('Kies een clip om te posten.');
  const c = await env.DB.prepare('SELECT id FROM clips WHERE id=? AND uid=? AND ready=1').bind(clip, me.uid).first();
  if (!c) return err('Die clip staat niet online. Maak eerst een link bij de clip.', 404);
  const now = Date.now();
  const last = await env.DB.prepare('SELECT created FROM posts WHERE uid=? ORDER BY id DESC LIMIT 1').bind(me.uid).first();
  if (last && now - last.created < POST_GAP) return err('Rustig aan, je post te snel.', 429);
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM posts WHERE uid=? AND created>?').bind(me.uid, now - 3600000).first();
  if (n.n >= POSTS_PER_HOUR) return err('Je hebt het laatste uur veel gepost. Probeer het later opnieuw.', 429);
  if (await env.DB.prepare('SELECT 1 x FROM posts WHERE uid=? AND clip=?').bind(me.uid, clip).first()) return err('Deze clip heb je al gepost.', 409);
  const r = await env.DB.prepare('INSERT INTO posts (uid, body, clip, created) VALUES (?, ?, ?, ?)').bind(me.uid, body, clip, now).run();
  return json({ id: (r.meta && r.meta.last_row_id) || 0 });
}
async function postDelete(env, me, id) {
  const p = await env.DB.prepare('SELECT uid FROM posts WHERE id=?').bind(id).first();
  if (!p) return err('Post niet gevonden.', 404);
  if (!(p.uid === me.uid || me.rank >= MOD)) return err('Je mag deze post niet verwijderen.', 403);
  await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id).run();
  return json({ ok: true });
}
// Alle mensen met een gebruikersnaam (= iedereen die Wistic gebruikt). Eigenaar eerst, dan admins, moderators, geverifieerd, vip, de rest.
async function memberList(env, me, u) {
  const q = name1(u.searchParams.get('q')).toLowerCase();
  const off = Math.max(0, Math.min(5000, Math.floor(+u.searchParams.get('offset')) || 0));
  const where = " WHERE u.uid NOT IN (SELECT uid FROM blocks WHERE target=?) AND u.uid NOT IN (SELECT target FROM blocks WHERE uid=?)" + (q ? " AND u.nk LIKE ? ESCAPE '\\'" : '');
  const bind = [me.uid, me.uid]; if (q) bind.push('%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%');
  const tot = await env.DB.prepare('SELECT COUNT(*) n FROM usernames u' + where).bind(...bind).first();
  const { results } = await env.DB.prepare(
    "SELECT u.uid, u.name, r.role, a.v AS av FROM usernames u LEFT JOIN roles r ON r.uid=u.uid LEFT JOIN avatars a ON a.uid=u.uid" + where +
    " ORDER BY CASE r.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 WHEN 'verified' THEN 3 WHEN 'vip' THEN 4 ELSE 5 END, u.nk LIMIT ? OFFSET ?"
  ).bind(...bind, MEMBER_PAGE, off).all();
  return json({ total: tot.n, members: results.map(r => ({ uid: r.uid, name: r.name, role: r.role || '', av: r.av || 0 })) });
}

// ---------- Rollen (alleen de eigenaar) ----------
async function roleList(env) {
  const { results } = await env.DB.prepare("SELECT uid, role FROM roles WHERE role<>'owner'").all();
  const m = await info(env, results.map(r => r.uid));
  return json({ roles: results.map(r => ({ uid: r.uid, name: card(m, r.uid).name, av: card(m, r.uid).av, role: r.role })).sort((a, b) => (RANK[b.role] - RANK[a.role]) || a.name.localeCompare(b.name)) });
}
async function roleSet(env, me, b) {
  const role = String(b.role || '');
  if (role && !ASSIGN.includes(role)) return err('Onbekende rol.');
  const nk = name1(b.name).toLowerCase();
  const t = b.uid && UID.test(String(b.uid))
    ? await env.DB.prepare('SELECT uid, name FROM usernames WHERE uid=?').bind(String(b.uid)).first()
    : await env.DB.prepare('SELECT uid, name FROM usernames WHERE nk=?').bind(nk).first();
  if (!t) return err('Geen gebruiker met die naam gevonden.', 404);
  if (t.uid === me.uid) return err('Je bent zelf de eigenaar; die rol kun je niet wijzigen.', 403);
  if (!role) await env.DB.prepare('DELETE FROM roles WHERE uid=?').bind(t.uid).run();
  else await env.DB.prepare('INSERT INTO roles (uid, role) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET role=excluded.role').bind(t.uid, role).run();
  return json({ ok: true, uid: t.uid, name: t.name, role });
}

// ---------- Nachtelijke opruiming ----------
export async function cleanupSocial(env) {
  try {
    await tables(env);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM friends WHERE status='pending' AND created<?").bind(now - 90 * DAY),
      env.DB.prepare('DELETE FROM posts WHERE created<?').bind(now - POST_DAYS * DAY)
    ]);
  } catch (e) { /* opruimen mag nooit de rest blokkeren */ }
}
