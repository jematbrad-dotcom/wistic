// Test welk game-logo Wistic per game zou tonen. Gebruik: node test-logos.js   (Node 18 of nieuwer, internet nodig)
// Voeg zelf games toe: [ 'spelnaam zoals Wistic hem noemt', 'exe-naam' ]. Zet de naam op null om de naam uit de exe te laten maken, zoals Wistic doet.
const GAMES = { 'FiveM.exe': 'FiveM', 'GTA5.exe': 'GTA V', 'RustClient.exe': 'Rust', 'javaw.exe': 'Minecraft' };
const TESTS = [
  'GTA5.exe', 'javaw.exe', 'RustClient.exe', 'fc27.exe', 'FortniteClient-Win64-Shipping.exe', 'VALORANT-Win64-Shipping.exe',
  'cs2.exe', 'r5apex.exe', 'RocketLeague.exe', 'League of Legends.exe', 'Overwatch.exe', 'RobloxPlayerBeta.exe',
  'eldenring.exe', 'Cyberpunk2077.exe', 'RainbowSix.exe', 'dota2.exe', 'helldivers2.exe', 'Marvel-Win64-Shipping.exe'
];
const cleanName = exe => exe.replace(/\.exe$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || 'Game';
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

(async () => {
  const byName = {}, byExe = {};
  const list = await (await fetch('https://discord.com/api/v10/applications/detectable')).json();
  for (const a of list) {
    const ic = a.icon || a.icon_hash; if (!ic) continue;
    const url = 'https://cdn.discordapp.com/app-icons/' + a.id + '/' + ic + '.png';
    byName[norm(a.name)] = url;
    for (const ex of a.executables || []) if (ex.os === 'win32') byExe[ex.name.replace(/^>/, '').split('/').pop().toLowerCase()] = url;
  }
  // Diagnose van Discords lijst
  const metIcoon = list.filter(a => a.icon || a.icon_hash).length, vb = list.find(a => /fortnite|grand theft auto/i.test(a.name));
  console.log('Discord-lijst: ' + list.length + ' games, ' + metIcoon + ' met logo. Voorbeeld:', vb ? JSON.stringify(vb).slice(0, 400) : '(niet gevonden)');
  console.log('');
  const ok = async u => { try { return (await fetch(u, { method: 'HEAD' })).ok; } catch (e) { return false; } };
  for (const exe of TESTS) {
    const name = GAMES[exe] || cleanName(exe), n = norm(name);
    let res = '';
    if (byExe[exe.toLowerCase()]) res = 'Discord (exe)';
    else if (byName[n]) res = 'Discord (naam)';
    else if (n.length >= 4 && Object.keys(byName).some(k => k.endsWith(n))) res = 'Discord (deel van naam)';
    else {
      try {
        const j = await (await fetch('https://store.steampowered.com/api/storesearch/?l=english&cc=us&term=' + encodeURIComponent(name))).json();
        const hit = (j.items || []).find(i => { const m = norm(i.name); return m === n || (n.length >= 4 && m.endsWith(n)) || (m.length >= 4 && n.endsWith(m)); });
        if (!hit) res = 'GEEN LOGO (Steam vindt "' + name + '" niet)';
        else {
          let port = '';
          try {
            const q = encodeURIComponent(JSON.stringify({ ids: [{ appid: hit.id }], context: { language: 'english', country_code: 'US' }, data_request: { include_assets: true } }));
            const gi = await (await fetch('https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=' + q)).json();
            const as = gi.response && gi.response.store_items && gi.response.store_items[0] && gi.response.store_items[0].assets;
            const f = as && (as.library_capsule || as.library_capsule_2x);
            if (as && f && as.asset_url_format) port = 'https://shared.akamai.steamstatic.com/store_item_assets/' + as.asset_url_format.replace('${FILENAME}', f);
          } catch (e) {}
          if (port && await ok(port)) res = 'Steam (staande cover) -> ' + hit.name;
          else if (hit.tiny_image && await ok(hit.tiny_image)) res = 'Steam (brede afbeelding) -> ' + hit.name;
          else res = 'GEEN LOGO (Steam-afbeelding niet bereikbaar)';
        }
      } catch (e) { res = 'FOUT: ' + e.message; }
    }
    console.log((exe + ' [' + name + ']').padEnd(62), res);
  }
})();
