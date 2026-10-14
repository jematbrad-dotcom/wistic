const { screen, app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, dialog, nativeImage, clipboard, Notification } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), { pathToFileURL } = require('url');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const CS_SRC = require('./audiocap');
const MIX_SRC = require('./audiomix');
const AUTH = require('./auth');
const DR = require('./drive');
const I18N = require('./i18n'), tr = s => I18N.T(s);
const FF = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
// De map met je instellingen, login en clip-gegevens blijft 'Blips' heten, zodat er na de naamswijziging niets kwijtraakt.
app.setPath('userData', path.join(app.getPath('appData'), 'Blips'));
// Minder RAM: geen GPU-versnelling voor het (kleine) venster en de melding; opnemen gaat via ffmpeg en blijft hier los van.
app.disableHardwareAcceleration();
if (!app.requestSingleInstanceLock()) app.quit();

const UD = () => app.getPath('userData'), BUF = path.join(os.tmpdir(), 'blips-buf'), SEG = 4;
const DEF = { seconds: 60, fps: 30, bitrate: 12, folder: path.join(os.homedir(), 'Videos', 'Wistic'), maxGB: 50, lang: 'auto', keys: { save: 'F8', shot: 'F7', rec: 'Alt+F8' },
  sound: 'ping', volume: 60, micGain: 100, gameGain: 100, mixer: false, appGains: {}, user: '', avatar: '', driveSync: true, customWav: '', audio: '', systemAudio: '', mode: 'game', startup: false, discordRpc: true, display: 'primary', detectAny: true,
  games: { FiveM: { on: true, seconds: 60 }, Rust: { on: true, seconds: 90 }, Minecraft: { on: true, seconds: 60 }, 'GTA V': { on: true, seconds: 60 } } };
const gameExe = {};   // spelnaam -> exe (voor het zoeken van het game-logo)
const GAMES = { 'FiveM.exe': 'FiveM', 'FiveM_GTAProcess.exe': 'FiveM', 'GTA5.exe': 'GTA V', 'RustClient.exe': 'Rust', 'javaw.exe': 'Minecraft', 'FC27.exe': 'EA SPORTS FC 27' };
// Processes that are almost never games (used when detectAny is on)
const BLACKLIST = new Set([
  // Windows system
  'explorer.exe','searchhost.exe','searchapp.exe','startmenuexperiencehost.exe','shellexperiencehost.exe',
  'applicationframehost.exe','systemsettings.exe','taskmgr.exe','dwm.exe','csrss.exe','winlogon.exe',
  'lsass.exe','services.exe','svchost.exe','runtimebroker.exe','sihost.exe','ctfmon.exe','conhost.exe',
  'textinputhost.exe','lockapp.exe','securityhealthsystray.exe','securityhealthservice.exe',
  'widgets.exe','widgetservice.exe','phoneexperiencehost.exe','yourphone.exe','gamebar.exe',
  'gamebarftserver.exe','gamingservices.exe','gamingservicesnet.exe','xboxapp.exe','xboxgameoverlay.exe',
  'xboxgamingoverlay.exe','xboxwidget.exe','crossdevicevalidatedappservice.exe','backgroundtaskhost.exe',
  'dllhost.exe','taskhostw.exe','fontdrvhost.exe','userinit.exe','logonui.exe','consent.exe',
  // Browsers & office
  'chrome.exe','msedge.exe','firefox.exe','opera.exe','brave.exe','iexplore.exe','vivaldi.exe','waterfox.exe',
  'discord.exe','spotify.exe','slack.exe','teams.exe','zoom.exe','code.exe','devenv.exe','cursor.exe',
  'notepad.exe','notepad++.exe','winword.exe','excel.exe','powerpnt.exe','outlook.exe','onenote.exe',
  'acrobat.exe','acrord32.exe','photoshop.exe','illustrator.exe','obs64.exe','obs32.exe','streamlabs obs.exe',
  // Launchers & stores
  'steam.exe','steamwebhelper.exe','steamservice.exe','steamerrorreporter.exe','steamclient.exe',
  'epicgameslauncher.exe','epicwebhelper.exe','origin.exe','originwebhelper.exe','eadesktop.exe','eadesktop',
  'battle.net.exe','agent.exe','upc.exe','ubisoftconnect.exe','ubisoftgameslauncher.exe',
  'gog galaxy.exe','galaxyclient.exe','riotclientservices.exe','riotclientux.exe','leagueclient.exe',
  'battleye.exe','easyanticheat.exe','vgtray.exe','vgc.exe','faceitclient.exe','faceit.exe',
  // GPU / overlays / desktop tools
  'nvidia share.exe','nvidia web helper.exe','nvcontainer.exe','nvidia geforce experience.exe',
  'amdow.exe','radeonsoftware.exe','radeonsoftware','msiafterburner.exe','rtss.exe','rtsshooksloader64.exe',
  'rainmeter.exe','wallpaperengine.exe','wallpaper32.exe','wallpaper64.exe','lively.exe','desktopok.exe',
  'displayfusion.exe','actual window manager.exe','powertoys.exe','powertoys.awake.exe','everything.exe',
  'sharex.exe','greenshot.exe','lightshot.exe','snippingtool.exe','screenpresso.exe',
  // Our app + terminals
  'blips.exe','wistic.exe','electron.exe','node.exe','powershell.exe','cmd.exe','windowsterminal.exe','powershell_ise.exe',
  'windowsterminal.exe','openconsole.exe','bash.exe','wsl.exe','ubuntu.exe'
]);
// Extra patterns that almost never are the game itself
// Programma's die clips opnemen of de game-pc beheren zijn zelf geen game (bv. Medal): nooit als game tonen
const NOT_GAMES = /^(modrinth|prismlauncher|prism launcher|multimc|curseforge|atlauncher|medal|overwolf|outplayed|obs\d*|streamlabs|xsplit|bandicam|geforce|nvidia|radeon|amd|lghub|icue|steelseries|razer)/i;
const SKIP_PATTERNS = /webhelper|errorreporter|crashhandler|updater|launcher|service|helper|overlay|tray|widget|host|agent|setup|installer|unins|crash|report|cefsharp|qtwebengine|notification|systray|background|runtime|broker|input|desktop|rainmeter|wallpaper|afterburner|rtss|sharex|greenshot/i;
let volP = null, capProc = null, forceNoAudio = false, lastStart = 0, helperP = null, mixP = null, mixerBroken = false, capMix = false;
let running = new Set(), S = DEF, proc = null, game = null, enc = null, win = null, tray = null, pruner = null;
const jr = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(UD(), f))); } catch (e) { return d; } };
const jw = (f, v) => fs.writeFileSync(path.join(UD(), f), JSON.stringify(v));
const SAFE = require('./clip-safe');
// Tweede resolutie zou twee opnames in dezelfde seconde dezelfde naam geven: daarom een willekeurig einde.
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) + '-' + require('crypto').randomBytes(3).toString('hex');
const run = (a, t = 30000) => new Promise(r => execFile(FF, a, { timeout: t }, e => r(!e)));
const secs = () => (game && S.games[game] && S.games[game].seconds) || S.seconds;

// ---- Extra "clean" geluiden: zacht, helder en kort. Worden live gemaakt (geen bestanden nodig). ----
const CLEAN = ['ping', 'chime', 'pop', 'sparkle'];
function cleanSamples(kind) {
  // L = hoorbaar deel, daarna zachte uitloop (cosinus-fade) en een stukje stilte zodat de geluidskaart het geluid niet afknipt.
  const sr = 44100, TP = 2 * Math.PI, L = { ping: 1.0, chime: 1.3, pop: 0.35, sparkle: 1.2 }[kind], PAD = 0.35;
  const n = Math.floor(sr * (L + PAD)), nl = Math.floor(sr * L), a = new Float64Array(n);
  const note = (f, t0, dec, par) => { const i0 = Math.floor(sr * t0); for (let i = i0; i < nl; i++) { const t = (i - i0) / sr; let v = 0; for (const [k, g] of par) v += g * Math.sin(TP * f * k * t);
    a[i] += v * Math.min(1, t / 0.006) * Math.exp(-dec * t); } };
  const harm = [[1, 1], [2, 0.18], [3, 0.05]];
  if (kind === 'ping') note(1175, 0, 5, [[1, 1], [2.76, 0.12], [5.4, 0.03]]);
  else if (kind === 'chime') { note(784, 0, 5, harm); note(1175, 0.12, 4.5, harm); }
  else if (kind === 'sparkle') { note(1047, 0, 7, harm); note(1319, 0.08, 7, harm); note(1568, 0.16, 5.5, harm); }
  else if (kind === 'pop') { let ph = 0; for (let i = 0; i < nl; i++) { const t = i / sr; ph += TP * (350 + 900 * (1 - Math.exp(-45 * t))) / sr; a[i] = Math.sin(ph) * Math.min(1, t / 0.003) * Math.exp(-14 * t); } }
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(a[i]));
  const fl = Math.floor(nl * 0.5);   // laatste helft van het geluid loopt zacht uit naar 0
  for (let i = 0; i < n; i++) { let g = 0.8 / (mx || 1); if (i >= nl) g = 0; else if (i >= nl - fl) g *= 0.5 * (1 + Math.cos(Math.PI * (i - (nl - fl)) / fl)); a[i] *= g; }
  return { sr, a };
}
function cleanWav(kind, raw) {
  const { sr, a } = cleanSamples(kind), n = a.length, b = Buffer.alloc(44 + n * 2), amp = raw ? 32767 : Math.max(0, Math.min(1, (+S.volume || 0) / 100)) * 32767;
  b.write('RIFF'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, a[i] * amp)), 44 + i * 2);
  if (raw) return b;
  const p = path.join(os.tmpdir(), 'blips-snd.wav'); fs.writeFileSync(p, b); return p;
}
function wavFile(kind) {
  if (CLEAN.includes(kind)) return cleanWav(kind);
  const sr = 22050, d = kind === 'camera' ? 0.25 : 0.07, n = Math.floor(sr * d), b = Buffer.alloc(44 + n * 2), amp = Math.max(0, Math.min(1, (+S.volume || 0) / 100)) * 0.98 * 32767;
  b.write('RIFF'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  const f = { click: 1000, soft: 600, minimal: 800, digital: 1500, camera: 1200 }[kind] || 1000;
  for (let i = 0; i < n; i++) { const t = i / sr; let v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (kind === 'camera' ? 25 : 70));
    if (kind === 'camera' && t > 0.12) v += Math.sin(2 * Math.PI * 800 * (t - .12)) * Math.exp(-(t - .12) * 40);
    b.writeInt16LE(Math.max(-32767, Math.min(32767, v * amp)), 44 + i * 2); }
  const p = path.join(os.tmpdir(), 'blips-snd.wav'); fs.writeFileSync(p, b); return p;
}
const AUDIO_EXT = /\.(wav|mp3|m4a|wma|aac|flac)$/i;
// Een eigen geluid is een verwijzing naar een bestand op de pc (we kopieren niets).
// Is dat bestand verwijderd of verplaatst, dan gaat het geluid ook weg en valt Wistic terug op het standaardgeluid.
function customSoundOk() {
  let ok = false;
  if (S.customWav) { try { ok = fs.statSync(S.customWav).isFile(); } catch (e) {} }
  if (!ok && (S.customWav || S.sound === 'custom')) {
    S.customWav = ''; if (S.sound === 'custom') S.sound = 'ping';
    try { jw('settings.json', S); } catch (e) {}
  }
  return ok;
}
// Van de ingebouwde geluiden kennen we de exacte tonen. Die halen we met smalle filters weg, zodat je microfoon en game-geluid blijven.
// Onbekende geluiden (eigen bestand, pop) kunnen we niet zo wegfilteren: daar zetten we het stukje helemaal stil.
const NOTCH = { ping: [1175, 3243, 6345], chime: [784, 1175, 1568, 2351, 3525], sparkle: [1047, 1319, 1568, 2094, 2638, 3139, 3957, 4704] };
function beepCut(kind, a, e) {
  const en = `enable='between(t,${a.toFixed(2)},${e.toFixed(2)})'`, n = NOTCH[kind];
  if (!n) return `volume=${en}:volume=0`;
  return n.flatMap((f, i) => (i === 0 ? [f, f] : [f])).map(f => `bandreject=f=${f}:width_type=q:w=25:${en}`).join(',');
}
const beeps = [];   // wanneer er een piep klonk: die zit dan in het geluid van de buffer en knippen we uit latere clips
function beep(kind = S.sound) {
  if (kind === 'custom' && !customSoundOk()) kind = S.sound;
  if (kind === 'none') return;
  const vol = Math.max(0, Math.min(1, (+S.volume || 0) / 100));
  if (vol > 0) { const ready = soundOk && customKey() === soundKey && toast && !toast.isDestroyed(); beeps.push({ t: Date.now(), ms: beepMs(kind) + (ready ? 0 : 1500), kind }); if (beeps.length > 30) beeps.shift(); }
  if (kind === 'custom') {
    // Snel: het geluid staat al klaar in het meldingsvenster. Langzaam (PowerShell) alleen als noodoplossing.
    const slow = () => {
      const f = S.customWav.replace(/'/g, "''");
      const ps = `Add-Type -AssemblyName presentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'${f}'); $p.Volume = ${vol.toFixed(2)}; $t = 0; while (-not $p.NaturalDuration.HasTimeSpan -and $t -lt 40) { Start-Sleep -Milliseconds 50; $t++ }; $p.Play(); $d = 1500; if ($p.NaturalDuration.HasTimeSpan) { $d = [Math]::Min(8000, [int]$p.NaturalDuration.TimeSpan.TotalMilliseconds + 200) }; Start-Sleep -Milliseconds $d; $p.Close()`;
      execFile('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], () => {});
    };
    const key = customKey();
    if (soundOk && key && key === soundKey && toast && !toast.isDestroyed())
      toast.webContents.executeJavaScript('playSound(' + vol.toFixed(2) + ')').then(ok => { if (!ok) slow(); }).catch(slow);
    else { slow(); syncSound(); }
    return;
  }
  // Ingebouwde geluiden (ping, chime, pop, sparkle): ook direct afspelen via het meldingsvenster i.p.v. PowerShell starten (dat gaf ~0,5-1s vertraging).
  const slowBuiltin = () => { const f = wavFile(kind); if (!f) return; execFile('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `(New-Object Media.SoundPlayer '${f.replace(/'/g, "''")}').PlaySync()`], () => {}); };
  if (CLEAN.includes(kind) && kind === S.sound) {
    const key = customKey();
    if (soundOk && key && key === soundKey && toast && !toast.isDestroyed())
      toast.webContents.executeJavaScript('playSound(' + vol.toFixed(2) + ')').then(ok => { if (!ok) slowBuiltin(); }).catch(slowBuiltin);
    else { slowBuiltin(); syncSound(); }
    return;
  }
  const f = wavFile(kind); if (!f) return;
  execFile('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `(New-Object Media.SoundPlayer '${f.replace(/'/g, "''")}').PlaySync()`], () => {});
}

// ---- Headset / uitvoer-opname (WASAPI loopback via klein C#-hulpprogramma) ----
async function buildHelper(src0, base, key) {
  const cached = key === 'mix' ? mixP : helperP;
  if (cached && fs.existsSync(cached)) return cached;
  let out = null;
  try {
    fs.mkdirSync(UD(), { recursive: true });
    const ver = crypto.createHash('md5').update(src0).digest('hex').slice(0, 8);
    const exe = path.join(UD(), `${base}-${ver}.exe`);
    if (fs.existsSync(exe)) out = exe;
    else {
      const src = path.join(UD(), base + '.cs'); fs.writeFileSync(src, src0);
      const win = process.env.WINDIR || 'C:\\Windows';
      for (const fw of ['Framework64', 'Framework']) {
        const csc = path.join(win, 'Microsoft.NET', fw, 'v4.0.30319', 'csc.exe');
        if (!fs.existsSync(csc)) continue;
        const ok = await new Promise(r => execFile(csc, ['/nologo', '/optimize+', '/target:exe', '/out:' + exe, src], { timeout: 60000 }, (e, so, se) => {
          if (e) try { fs.writeFileSync(path.join(UD(), key === 'mix' ? 'mix-helper-log.txt' : 'audio-helper-log.txt'), String(so) + String(se)); } catch (x) {}
          r(!e);
        }));
        if (ok && fs.existsSync(exe)) { out = exe; break; }
      }
    }
  } catch (e) {}
  if (key === 'mix') mixP = out; else helperP = out;
  return out;
}
const pendB = {};   // dezelfde helper maar 1x tegelijk compileren
const buildOnce = (src0, base, key) => pendB[key] || (pendB[key] = buildHelper(src0, base, key).finally(() => { pendB[key] = null; }));
const helperPath = () => buildOnce(CS_SRC, 'blips-audio', 'main');
const mixPath = () => buildOnce(MIX_SRC, 'wistic-mix', 'mix');
// "Geluid per app": stuurt de ingestelde volumes (per app, in %) naar het lopende mixer-hulpprogramma. Geen herstart nodig.
function pushGains(only) {
  const c = capProc, okC = c && capMix && c.stdin && !c.stdin.destroyed, okV = volP && volP.stdin && !volP.stdin.destroyed;
  if (!okC && !okV) return;
  try {
    const g = S.appGains || {};
    for (const k of (only ? [only] : Object.keys(g))) {
      const v = +g[k], pct = Number.isFinite(v) ? Math.max(0, Math.min(200, v)) : 100, key = String(k).replace(/[\t\r\n]/g, ' ');
      if (okC) c.stdin.write('g\t' + key + '\t' + pct + '\n');                                      // volume in de clip (per-app opname)
      if (S.mixerLive === true) {                                                                  // echte app-volume (wat je zelf hoort)
        const line = 'v\t' + key + '\t' + Math.min(100, pct) + '\n';
        if (okC) c.stdin.write(line);
        if (okV) volP.stdin.write(line);
      }
    }
  } catch (e) {}
}
const helperRun = (hp, args) => new Promise(r => execFile(hp, args, { timeout: 8000, encoding: 'utf8', windowsHide: true }, (e, so) => r(e ? null : String(so || ''))));
function sysDevName(id) {
  id = (id || '').trim();
  if (!id || id.startsWith('dshow:')) return null;
  if (id.startsWith('out:')) return id.slice(4);
  if (id.startsWith('wasapi:')) return id.slice(7);
  return id;
}
async function encoder() {
  if (enc) return enc;
  for (const e of ['h264_nvenc', 'h264_amf', 'h264_qsv'])
    if (await run(['-f', 'lavfi', '-i', 'color=s=256x256:d=0.1', '-frames:v', '1', '-c:v', e, '-f', 'null', '-'], 8000)) return (enc = e);
  return (enc = 'libx264');
}
let starting = false;
async function startBuffer() {
  if (proc || starting) return;
  starting = true;
  try { await startBuffer2(); } catch (e) { try { fs.appendFileSync(path.join(UD(), 'ffmpeg-log.txt'), '\nstartBuffer: ' + (e && e.message) + '\n'); } catch (x) {} } finally { starting = false; }
}
async function startBuffer2() {
  if (proc) return;
  const e = await encoder();
  const fpsNum = Math.max(15, Math.min(Number(S.fps) || 30, 60));
  const fps = String(fpsNum);
  let startNum = 0;   // tijdens een lange opname de bestaande segmenten bewaren en gewoon doortellen
  if (lrec) { try { const nn = fs.readdirSync(BUF).map(x => /^s_(\d+)\.ts$/.exec(x)).filter(Boolean).map(m => +m[1]); startNum = nn.length ? Math.max(...nn) + 1 : 0; } catch (e) {} }
  else {
    // Een bestand kan even vergrendeld zijn (bijv. door een clip die nog wordt gemaakt of door antivirus). Dat mag de start niet stoppen.
    try { fs.rmSync(BUF, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }); }
    catch (e) { try { for (const x of fs.readdirSync(BUF)) if (/\.ts$/.test(x)) { try { fs.rmSync(path.join(BUF, x), { force: true }); } catch (y) {} } } catch (y) {} }
    // Bleven er toch oude segmenten staan? Dan gewoon daarboven doortellen, zodat nieuwe bestanden ze niet overschrijven of ermee door elkaar lopen.
    try { const nn = fs.readdirSync(BUF).map(x => /^s_(\d+)\.ts$/.exec(x)).filter(Boolean).map(m => +m[1]); if (nn.length) startNum = Math.max(...nn) + 1; } catch (e) {}
  }
  fs.mkdirSync(BUF, { recursive: true });

  const q = {
    h264_nvenc: ['-preset', 'p4', '-tune', 'll', '-rc', 'cbr', '-bf', '0'],
    h264_amf: ['-quality', 'balanced', '-rc', 'cbr'],
    h264_qsv: ['-preset', 'fast', '-bf', '0'],
    libx264: ['-preset', 'veryfast', '-tune', 'zerolatency', '-bf', '0']
  }[e];

  // Always use gdigrab for reliability
  const a = [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'gdigrab',
    '-framerate', fps,
    '-draw_mouse', '1',
    '-thread_queue_size', '512',
    ...region(),
    '-i', 'desktop'
  ];

  // Audio: microfoon (dshow) + game/headset-geluid (loopback van gekozen uitvoerapparaat)
  const mic = forceNoAudio ? '' : (S.audio || '').trim();
  const sys = forceNoAudio ? '' : (S.systemAudio || '').trim();
  let audioInputs = 0, capArgs = null, micOn = false;
  const mg = Math.max(0.1, (Number(S.micGain) || 100) / 100), gg = Math.max(0.1, (Number(S.gameGain) || 100) / 100);

  const mixExe = (S.mixer && !mixerBroken && sys && !sys.startsWith('dshow:')) ? await mixPath() : null;
  // Per-app opname lukt niet (mixerBroken)? Dan zetten we alleen het echte Windows-volume per app. De gewone headset-opname neemt dat dan vanzelf zo op.
  const volExe = (S.mixer && mixerBroken && S.mixerLive === true && sys && !sys.startsWith('dshow:')) ? await mixPath() : null;
  if (mic && !mic.startsWith('wasapi:') && !mic.startsWith('dshow:')) {
    a.push('-f', 'dshow', '-thread_queue_size', '1024', '-audio_buffer_size', '80', '-i', 'audio=' + mic);
    audioInputs++; micOn = true;
  }
  if (sys.startsWith('dshow:')) {
    a.push('-f', 'dshow', '-thread_queue_size', '1024', '-audio_buffer_size', '80', '-i', 'audio=' + sys.slice(6));
    audioInputs++;
  } else if (sys && mixExe) {
    // Geluid per app: elke app wordt apart opgenomen en met zijn eigen volume gemengd (44100 Hz stereo)
    const dn0 = sysDevName(sys);
    a.push('-f', 'f32le', '-ar', '44100', '-ac', '2', '-use_wallclock_as_timestamps', '1', '-thread_queue_size', '1024', '-i', 'pipe:0');
    capArgs = { hp: mixExe, devName: dn0 === 'default' || dn0 === null ? '' : dn0, mix: true };
    audioInputs++;
  } else if (sys) {
    const hp = await helperPath();
    const devName = sysDevName(sys);
    const rate = hp && parseInt(await helperRun(hp, ['info', devName === 'default' ? '' : devName]), 10);
    if (rate > 0) {
      a.push('-f', 'f32le', '-ar', String(rate), '-ac', '2', '-use_wallclock_as_timestamps', '1', '-thread_queue_size', '1024', '-i', 'pipe:0');
      capArgs = { hp, devName: devName === 'default' ? '' : devName };
      audioInputs++;
    } else {
      try { const { Notification } = require('electron'); new Notification({ title: 'Wistic', body: tr('Headset-audio kon niet gestart worden. Opname gaat verder zonder game-geluid.') }).show(); } catch (x) {}
    }
  }

  a.push(
    '-c:v', e, ...q,
    '-b:v', (S.bitrate || 12) + 'M',
    '-maxrate', (S.bitrate || 12) + 'M',
    '-bufsize', ((S.bitrate || 12) * 2) + 'M',
    '-pix_fmt', 'yuv420p',
    '-r', fps,
    '-vsync', 'cfr',
    '-g', String(fpsNum * SEG),
    '-force_key_frames', `expr:gte(t,n_forced*${SEG})`
  );

  const lim = ',alimiter=limit=0.95';
  if (audioInputs === 2) {
    a.push(
      '-filter_complex', `[1:a]aresample=44100:async=1:first_pts=0,volume=${mg},aformat=sample_fmts=fltp:channel_layouts=stereo[a1];[2:a]aresample=44100:async=1:first_pts=0,volume=${gg},aformat=sample_fmts=fltp:channel_layouts=stereo[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=0:normalize=0${lim}[aout]`,
      '-map', '0:v', '-map', '[aout]',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2'
    );
  } else if (audioInputs === 1) {
    a.push('-af', `aresample=44100:async=1:first_pts=0,volume=${micOn ? mg : gg}${lim}`, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2');
  }

  a.push(
    '-f', 'segment',
    '-segment_time', String(SEG),
    '-segment_format', 'mpegts',
    '-reset_timestamps', '1',
    '-segment_start_number', String(startNum),
    path.join(BUF, 's_%06d.ts')
  );

  const logPath = path.join(UD(), 'ffmpeg-log.txt');
  const logFd = fs.openSync(logPath, 'w');
  lastStart = Date.now();
  const p = proc = spawn(FF, a, { stdio: [capArgs ? 'pipe' : 'ignore', logFd, logFd], windowsHide: true });
  capMix = false;
  if (capArgs) {
    p.stdin.on('error', () => {});
    capMix = !!capArgs.mix;
    // De mixer krijgt een eigen logbestand (mix-log.txt): bij een terugval wordt ffmpeg-log.txt opnieuw gemaakt en zou de foutreden anders verdwijnen.
    let hFd = logFd; if (capArgs.mix) { try { hFd = fs.openSync(path.join(UD(), 'mix-log.txt'), 'w'); } catch (x) { hFd = logFd; } }
    const hStart = Date.now();
    const c = capProc = spawn(capArgs.hp, [capArgs.mix ? 'mixer' : 'capture', capArgs.devName], { stdio: [capArgs.mix ? 'pipe' : 'ignore', 'pipe', hFd], windowsHide: true });
    if (capArgs.mix) { c.stdin.on('error', () => {}); pushGains(); }
    c.stdout.pipe(p.stdin);
    c.on('exit', (code) => {
      if (capArgs.mix) { try { fs.writeSync(hFd, '[mix] helper gestopt met code ' + code + ' na ' + (Date.now() - hStart) + ' ms\n'); } catch (x) {} if (hFd !== logFd) try { fs.closeSync(hFd); } catch (x) {} }
      if (capProc === c) capProc = null;
      // Mixer stopt kort na de start (niet ondersteund, of een fout)? Dan terug naar de gewone headset-opname. De microfoon blijft gewoon werken.
      if (capArgs.mix && proc === p && (code === 10 || Date.now() - lastStart < 15000)) {
        mixerBroken = true; p.mixKilled = true; forceNoAudio = false;
        // De echte reden erbij zetten, zodat je die kunt zien zonder logbestanden te zoeken.
        let why = ''; try { const t = fs.readFileSync(path.join(UD(), 'mix-log.txt'), 'utf8').split(/\r?\n/).filter(Boolean); why = '\n[code ' + code + ' | Windows ' + os.release() + (t.length ? ' | ' + t.slice(-3).join(' | ') : '') + ']'; why = why.slice(0, 330); } catch (x) { why = '\n[code ' + code + ' | Windows ' + os.release() + ']'; }
        try { new Notification({ title: 'Wistic', body: tr('Geluid per app wordt niet ondersteund op deze pc. Wistic neemt het totale headset-geluid op.') + why }).show(); } catch (x) {}
        setTimeout(startBuffer, 1500);
      }
      if (proc === p) try { p.kill(); } catch (x) {}
    }); // apparaat weg -> buffer herstart vanzelf
  }
  if (volP) { try { volP.kill(); } catch (x) {} volP = null; }
  if (volExe) {
    try {
      const dnv = sysDevName(sys), vfd = fs.openSync(path.join(UD(), 'mix-log.txt'), 'a');
      const v = volP = spawn(volExe, ['vol', (dnv === 'default' || dnv === null) ? '' : dnv], { stdio: ['pipe', 'ignore', vfd], windowsHide: true });
      v.stdin.on('error', () => {});
      v.on('exit', () => { try { fs.closeSync(vfd); } catch (x) {} if (volP === v) volP = null; });
      pushGains();
    } catch (x) {}
  }
  p.on('exit', (code) => {
    try { fs.closeSync(logFd); } catch (e) {}
    if (capProc) { try { capProc.kill(); } catch (e) {} capProc = null; }
    if (proc === p) { proc = null; clearInterval(pruner); }
    // Start mislukt direct na opstarten met audio? Probeer 1x zonder audio zodat video wel werkt.
    if (code !== 0 && code !== null && audioInputs > 0 && Date.now() - lastStart < 10000 && !forceNoAudio && !p.mixKilled) {
      forceNoAudio = true;
      setTimeout(startBuffer, 1000);
    }
  });

  pruner = setInterval(() => {
    if (lrec || prHold || saving) return;   // lange opname of clip-opslaan bezig: alles bewaren
    try {
      const f = fs.readdirSync(BUF).filter(x => x.endsWith('.ts')).sort();
      f.slice(0, Math.max(0, f.length - (Math.ceil(secs() / SEG) + 3))).forEach(x => fs.rmSync(path.join(BUF, x), { force: true }));
    } catch (e) {}
  }, 5000);

  tray && tray.setToolTip('Wistic — buffer actief' + (game ? ' (' + game + ')' : ''));
}

function stopBuffer() {
  if (volP) { try { volP.kill(); } catch (e) {} volP = null; }
  if (capProc) { try { capProc.kill(); } catch (e) {} capProc = null; }
  if (proc) {
    try { proc.kill(); } catch (e) {}
  }
  proc = null;
  tray && tray.setToolTip('Wistic — gepauzeerd');
}


// ---- Meldingsvenster (zoals Medal): thumbnail + voortgangsbalk ----
let toast = null, toastReady = false, toastQ = [], toastState = {}, toastTimer = null, saving = false;
// Het eigen clip-geluid wordt 1x in het (verborgen) meldingsvenster geladen en daar direct afgespeeld.
let soundKey = '', soundOk = false;
function customKey() {
  try { if (S.sound === 'custom' && S.customWav) { const st = fs.statSync(S.customWav); if (st.isFile() && st.size <= 10e6) return S.customWav + '|' + st.mtimeMs; } } catch (e) {}
  if (CLEAN.includes(S.sound)) return 'builtin|' + S.sound;
  return '';
}
function syncSound() {
  if (!toast || toast.isDestroyed() || !toastReady) return;
  const key = customKey(); if (key === soundKey) return;
  soundKey = key; soundOk = false;
  if (!key) { toast.webContents.executeJavaScript('clearSound()').catch(() => {}); return; }
  let b64; try { b64 = key.startsWith('builtin|') ? cleanWav(S.sound, true).toString('base64') : fs.readFileSync(S.customWav).toString('base64'); } catch (e) { soundKey = ''; return; }
  toast.webContents.executeJavaScript('loadSound("' + b64 + '")').then(ok => { if (soundKey === key) soundOk = !!ok; }).catch(() => { soundKey = ''; });
}
function toastGo() {
  if (!toast || toast.isDestroyed() || !toastReady || !Object.keys(toastState).length) return;
  toast.webContents.executeJavaScript('set(' + JSON.stringify(toastState) + ')').catch(() => {});
  if (!toast.isVisible()) toast.showInactive();
}
function makeToast() {
  const wa = screen.getPrimaryDisplay().workArea, W = 380, H = 108;
  toastReady = false;
  toast = new BrowserWindow({ width: W, height: H, x: wa.x + wa.width - W - 12, y: wa.y + wa.height - H - 12, frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, focusable: false, resizable: false, show: false, hasShadow: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false, autoplayPolicy: 'no-user-gesture-required' } });
  toast.setAlwaysOnTop(true, 'screen-saver'); toast.setIgnoreMouseEvents(true);
  vastzetten(toast);
  toast.loadFile('toast.html');
  toast.webContents.once('did-finish-load', () => { toastReady = true; soundKey = ''; soundOk = false; syncSound(); toastGo(); });
}
function toastShow(d, hideAfter) {
  d = Object.assign({}, d); if (d.title) d.title = tr(d.title); if (d.sub) d.sub = tr(d.sub);
  toastState = Object.assign(toastState, d);
  clearTimeout(toastTimer);
  if (!toast || toast.isDestroyed()) makeToast(); else toastGo();
  if (hideAfter) toastTimer = setTimeout(() => {
    if (toast && !toast.isDestroyed()) { toast.webContents.executeJavaScript('hide()').catch(() => {}); setTimeout(() => { try { toast.hide(); } catch (e) {} }, 400); }
    toastState = {};
  }, hideAfter);
}
const dataUrl = (f, mime) => { try { return 'data:' + mime + ';base64,' + fs.readFileSync(f).toString('base64'); } catch (e) { return ''; } };
const CLC = { k: '', v: null, t: 0 };   // cache voor clips:list (tab-wissels worden daardoor direct)
const fmt = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
const changed = () => { CLC.v = null; try { win && win.webContents.send('clips:changed'); } catch (e) {} };
// ---- Voorbeeldplaatje = eerste beeld van de clip (als dat toevallig zwart is: het eerste beeld dat dat niet is) ----
const lum = (src, ss) => new Promise(r => execFile(FF, ['-v', 'error', '-ss', String(ss), '-i', src, '-frames:v', '1', '-vf', 'scale=1:1:flags=area,format=gray', '-f', 'rawvideo', '-'],
  { timeout: 15000, encoding: 'buffer' }, (e, out) => r(!e && out && out.length ? out[0] : -1)));
async function makeThumb(src, dst, w = 480) {
  let at = 0;
  for (const ss of [0, 0.4, 1, 2]) { const v = await lum(src, ss); if (v >= 14) { at = ss; break; } if (v < 0 && ss > 0) break; }
  return run(['-y', '-ss', String(at), '-i', src, '-frames:v', '1', '-vf', 'scale=' + w + ':-2', '-q:v', '3', dst], 15000);
}
const bt = t => { t = String(t || ''); while (Buffer.byteLength(t) > 100) t = t.slice(0, -1); return t; };   // Drive: max 124 bytes per eigenschap
const thumbUrl = x => { const f = path.join(UD(), 'thumbs', x + '.jpg'); let v = 0; try { v = Math.round(fs.statSync(f).mtimeMs); } catch (e) {} return pathToFileURL(f).href + '?v=' + v; };
async function fixThumbs() {   // oude (zwarte) voorbeeldplaatjes eenmalig vervangen door het eerste beeld
  try {
    const td = path.join(UD(), 'thumbs'); fs.mkdirSync(td, { recursive: true }); let n = 0;
    for (const f of fs.readdirSync(S.folder).filter(x => x.endsWith('.mp4'))) {
      if ((jr('clips.json', {})[f] || {}).tv === 2) continue;
      await makeThumb(path.join(S.folder, f), path.join(td, f + '.jpg'));
      const m = jr('clips.json', {}); m[f] = Object.assign(m[f] || { game: f.split('_')[0], fav: false }, { tv: 2 }); jw('clips.json', m); n++;
      await new Promise(r => setTimeout(r, 300));
    }
    if (n) changed();
  } catch (e) {}
}
function encode(args, total, cb, limit) {
  return new Promise(r => {
    const p = spawn(FF, ['-progress', 'pipe:1', '-nostats', ...args], { windowsHide: true }); let buf = '', errTail = '';
    try { os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}   // niet ten koste van je game
    p.stdout.on('data', d => { buf += d; const m = [...buf.matchAll(/out_time_(?:us|ms)=(\d+)/g)]; if (m.length) { cb && cb(Math.min(0.97, +m[m.length - 1][1] / 1e6 / total)); buf = buf.slice(-200); } });
    p.stderr.on('data', d => { errTail = (errTail + d).slice(-3000); });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, limit || 180000);
    p.on('exit', (c, sig) => {
      clearTimeout(t);
      if (c !== 0) { try { fs.appendFileSync(path.join(UD(), 'clip-log.txt'), '\n[' + new Date().toISOString() + '] ffmpeg stopte met code ' + c + (sig ? ' signaal ' + sig : '') + (sig ? ' (waarschijnlijk te lang bezig)' : '') + '\n' + errTail + '\n'); } catch (e) {} }
      r(c === 0);
    });
    p.on('error', () => r(false));
  });
}
async function saveClip() {
  const T0 = Date.now();   // het moment van indrukken: hier eindigt de clip
  // Collect available segments
  let f = [];
  try { f = fs.readdirSync(BUF).filter(x => x.endsWith('.ts')).sort(); } catch (e) {}
  if (!f.length) {
    // Buffer not running or empty
    try {
      const { Notification } = require('electron');
      new Notification({ title: 'Wistic', body: tr('Buffer is niet actief. Start een game of zet mode op Always.') + ' [' + (!proc ? 'ffmpeg draait niet (modus: ' + S.mode + ')' : 'ffmpeg draait, maar schrijft geen bestanden') + ']' }).show();
    } catch (e) {}
    if (!proc) startBuffer();
    return;
  }

  // Alleen segmenten van de huidige bufferrun: oude restanten van eerder (bijv. na een mislukte opruiming) horen niet in een nieuwe clip.
  if (proc && lastStart && !lrec) f = f.filter(x => { try { return fs.statSync(path.join(BUF, x)).birthtimeMs >= lastStart - 3000; } catch (e) { return false; } });
  // Het lopende deel (nog niet afgemaakt) nemen we mee tot een stukje ná het indrukmoment, zodat het
  // laatste geluid erin zit. Of dat bestand nog loopt, zien we aan hoe vers het is.
  let live = '';
  if (proc && f.length) {
    // Bepaald op hoe vers het bestand is, niet op het aantal: bij een bijna lege buffer werd het
    // enige (nog lopende) bestand anders als afgelezen en werd de clip een seconde lang.
    const kandidaat = f[f.length - 1];
    try { if (Date.now() - fs.statSync(path.join(BUF, kandidaat)).mtimeMs < 1500) live = f.pop(); } catch (e) {}
  }
  // Buffer uit of vastgelopen? Dan staan er nog oude segmenten van een eerdere sessie. Die slaan we niet op als "nieuwe" clip.
  let newest = 0;
  for (const x of f) { try { newest = Math.max(newest, fs.statSync(path.join(BUF, x)).mtimeMs); } catch (e) {} }
  if (!newest || Date.now() - newest > 30000) {
    const why = !proc ? 'ffmpeg draait niet (modus: ' + S.mode + ')' : (!newest ? 'ffmpeg draait, maar schrijft geen bestanden' : 'laatste opname is ' + Math.round((Date.now() - newest) / 1000) + 's oud');
    try { new Notification({ title: 'Wistic', body: tr('Buffer is niet actief. Start een game of zet mode op Always.') + ' [' + why + ']' }).show(); } catch (e) {}
    if (!proc) startBuffer();
    return;
  }
  if (saving) { toastShow({ state: 'saving', title: 'Clip wordt al opgeslagen…', sub: 'Even wachten', pct: 0.5 }, 2500); return; }
  saving = true;
  let liveSec = 0;
  // De clip loopt door tot een tikje ná het indrukken. Geluid komt namelijk altijd een beetje achter
  // de klop aan binnen: het hulpprogramma houdt er zo'n 200 ms aan, de microfoon en de codering
  // nog wat. Wat er tussen de laatste letter en F8 gebeurde moet er gewoon in staan, dus we geven
  // de clip een stukje extra.
  const extra = 0.45;
  const tail = Math.max(0, Math.min(4000, Number(S.audioTail) || 60)) / 1000;
  if (live) { try { await new Promise(r => setTimeout(r, 800)); } catch (e) {} }
  // Onze eigen piep moet buiten de clip vallen, dus die wacht tot de clip bij de knop is afgelopen.
  beep();
  // Het lopende stuk gaan we nooit meer weggooien: ook al is het nog geen halve seconde oud, het is
  // het stuk vlak vóór de knop en dat wil je hebben. Alleen als er geen bestand is, valt het weg.
  if (live) { try { liveSec = Math.max(0.2, Math.min(SEG - 0.05, (T0 - fs.statSync(path.join(BUF, live)).birthtimeMs) / 1000 + extra - tail)); } catch (e) {} }
  const pick = f.slice(-Math.max(1, Math.ceil((secs() - liveSec) / SEG)));
  if (!pick.length) { saving = false; try { toastShow({ state: 'err', title: 'Buffer vult nog even', sub: 'Geef het een seconde en probeer opnieuw', pct: 1 }, 2500); } catch (e) {} return; }
  // Pieptonen die eerder klonken (vorige clip, start van een opname) zitten nog in het geluid: die zetten we stil.
  let mute = '';
  try {
    const b0 = fs.statSync(path.join(BUF, pick[0])).birthtimeMs;
    const parts = beeps.filter(b => b0 > 0 && b.t + b.ms + 300 > b0 && b.t < T0).map(b => { const rel = (b.t - b0) / 1000, a = Math.max(0, rel - 0.25); return beepCut(b.kind, a, Math.max(a + 0.5, rel + b.ms / 1000 + 0.5)); });
    mute = parts.join(',');
  } catch (e) {}

  saving = true;
  try {
    const list = path.join(BUF, 'list.txt');
    const writeList = withLive => fs.writeFileSync(list, pick.concat(withLive && live ? [live] : []).map(x => `file '${path.join(BUF, x).replace(/\\/g, '/')}'`).join('\n'));
    writeList(true);
    fs.mkdirSync(S.folder, { recursive: true });
    const g = game || 'Desktop', name = `${g}_${stamp()}.mp4`;
    const out = path.join(S.folder, name), part = out + '.part';
    const td = path.join(UD(), 'thumbs'); fs.mkdirSync(td, { recursive: true });
    const tp = path.join(td, name + '.jpg');
    let total = pick.length * SEG + (live ? liveSec : 0);
    toastShow({ state: 'saving', title: 'Clip opslaan…', sub: g, pct: 0.05 });
    const prog = p => toastShow({ pct: p });
    // Snel: de stukken zijn al H.264/AAC, dus alleen aan elkaar plakken (seconden i.p.v. minuten, nauwelijks CPU).
    const runCopy = (withLive, withMute) => encode([
      '-y', '-f', 'concat', '-safe', '0', '-i', list,
      ...(withMute && mute ? ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', mute] : ['-c', 'copy']),
      ...(withLive && live ? ['-t', total.toFixed(2)] : []),
      '-movflags', '+faststart', '-f', 'mp4', part
    ], total, prog, 60000 + total * 1000);
    // Traag maar degelijk: opnieuw coderen (alleen als plakken niet lukt). Tijdslimiet groeit mee met de lengte, maar nooit langer dan 15 min.
    const run = (withLive, withMute) => encode([
      '-y', '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', list,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', ...(withMute && mute ? ['-af', mute] : []),
      '-r', String(Math.max(15, Math.min(Number(S.fps) || 30, 60))), '-vsync', 'cfr', '-movflags', '+faststart', '-avoid_negative_ts', 'make_zero',
      ...(withLive && live ? ['-t', total.toFixed(2)] : []),
      '-f', 'mp4', part
    ], total, prog, Math.min(900000, 120000 + total * 3000));
    const dbg = ['clip ' + new Date().toISOString(), 'segmenten=' + pick.length + ' live=' + (live || '-') + ' liveSec=' + liveSec.toFixed(2), 'mute=' + (mute || '-')];
    let ok = await runCopy(true, true); dbg.push('poging 1 (snel plakken, lopend deel + stil): ' + (ok ? 'ok' : 'mislukt'));
    if (!ok) { try { fs.rmSync(part, { force: true }); } catch (e) {} ok = await run(true, true); dbg.push('poging 2 (opnieuw coderen, lopend deel + stil): ' + (ok ? 'ok' : 'mislukt')); }
    if (!ok && live) {   // plan B: zonder het lopende deel, maar wel de piep stilzetten
      try { fs.rmSync(part, { force: true }); } catch (e) {}
      writeList(false); total = pick.length * SEG;
      ok = await runCopy(false, true); dbg.push('poging 3 (snel, zonder lopend deel): ' + (ok ? 'ok' : 'mislukt'));
      if (!ok) { try { fs.rmSync(part, { force: true }); } catch (e) {} ok = await run(false, true); dbg.push('poging 4 (coderen, zonder lopend deel): ' + (ok ? 'ok' : 'mislukt')); }
    }
    if (!ok && mute) {   // plan C: zoals vroeger (zonder stil zetten)
      try { fs.rmSync(part, { force: true }); } catch (e) {}
      writeList(false); total = pick.length * SEG;
      ok = await runCopy(false, false); dbg.push('poging 5 (snel, zonder stil zetten): ' + (ok ? 'ok' : 'mislukt'));
    }
    try { fs.writeFileSync(path.join(UD(), 'clip-debug.txt'), dbg.join('\n') + '\n'); } catch (e) {}
    if (ok) {
      fs.renameSync(part, out); // pas nu zichtbaar in de library -> altijd afspeelbaar
      await makeThumb(out, tp);   // definitief voorbeeldplaatje = eerste beeld van de clip zelf
      const m = jr('clips.json', {}); m[name] = { game: g, fav: false, tv: 2 }; jw('clips.json', m); enforce();
      toastShow({ state: 'done', title: 'Clip opgeslagen ✓', sub: `${g} · ${total}s`, img: dataUrl(tp, 'image/jpeg'), pct: 1 }, 4500);
      changed();
    } else {
      try { fs.rmSync(part, { force: true }); } catch (e) {}
      toastShow({ state: 'err', title: 'Clip opslaan mislukt', sub: 'Check clip-log.txt in AppData', pct: 1 }, 5000);
    }
  } finally { saving = false; }
}
function enforce() {
  const m = jr('clips.json', {}); let fl;
  try { fl = fs.readdirSync(S.folder).filter(x => x.endsWith('.mp4') || x.endsWith('.png')).map(x => ({ x, s: fs.statSync(path.join(S.folder, x)) })); } catch (e) { return; }
  let tot = fl.reduce((a, b) => a + b.s.size, 0);
  for (const c of fl.filter(c => !(m[c.x] && m[c.x].fav)).sort((a, b) => a.s.mtimeMs - b.s.mtimeMs)) {
    if (tot <= S.maxGB * 1e9) break;
    fs.rmSync(path.join(S.folder, c.x), { force: true });
    try { fs.rmSync(path.join(UD(), 'thumbs', c.x + '.jpg'), { force: true }); } catch (e) {}
    tot -= c.s.size;
  }
}
async function shot() {
  fs.mkdirSync(S.folder, { recursive: true });
  const name = `${game || 'Desktop'}_${stamp()}.png`;
  const out = path.join(S.folder, name);
  beep();
  if (await run(['-y', '-f', 'gdigrab', ...region(), '-i', 'desktop', '-frames:v', '1', out], 10000)) {
    // use the png itself as thumbnail
    const td = path.join(UD(), 'thumbs'); fs.mkdirSync(td, { recursive: true });
    try { fs.copyFileSync(out, path.join(td, name + '.jpg')); } catch (e) {}
    const m = jr('clips.json', {}); m[name] = { game: game || 'Desktop', fav: false, type: 'shot' }; jw('clips.json', m);
    toastShow({ state: 'done', title: 'Screenshot opgeslagen ✓', sub: game || 'Desktop', img: dataUrl(out, 'image/png'), pct: 1 }, 3500);
    changed();
  }
}
// ---- Lange opname: neemt alles op tot je stopt (gebruikt dezelfde opnamebuffer, maar gooit niets meer weg) ----
let lrec = null, prHold = false;
// Hoe lang het "opname gestart/gestopt"-geluid ongeveer duurt (zodat het niet in de opname terechtkomt)
const beepMs = (kind = S.sound) => kind === 'none' ? 0 : kind === 'custom' ? 2000 : Math.round((({ ping: 1.0, chime: 1.3, pop: 0.35, sparkle: 1.2 }[kind] || 1) + 0.5) * 1000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const segs = () => { try { return fs.readdirSync(BUF).filter(x => /^s_\d+\.ts$/.test(x)).sort(); } catch (e) { return []; } };
const recEvt = () => { try { win && win.webContents.send('rec:state'); } catch (e) {} };
async function startLong() {
  if (lrec) return;
  const was = !!proc;
  const beepT = Date.now();
  beep();   // eerst de piep: hij klinkt terwijl ffmpeg nog laadt, dus hij is al (bijna) voorbij als de opname echt begint
  if (!was) {
    // ffmpeg start pas als de piep helemaal voorbij is (+ marge voor de vertraging van de geluidskaart), zodat hij niet in de opname komt.
    const bd = beepMs();
    if (bd > 0) { toastShow({ state: 'saving', title: 'Opname starten…', sub: game || 'Desktop', pct: 0.05 }); await sleep(bd + 600); }
    await startBuffer(); await sleep(300);
  }
  if (!proc) { toastShow({ state: 'err', title: 'Opname starten mislukt', sub: 'Check ffmpeg-log.txt in AppData', pct: 1 }, 4000); return; }
  prHold = false;
  const L = lrec = { t0: Date.now(), beepT, game: game || 'Desktop', forced: !was, first: was ? (segs().pop() || '') : '', stopping: false };
  L.timer = setInterval(() => {   // veiligheid: stop na 4 uur, bij 30 GB of als de schijf bijna vol is
    let stop = Date.now() - L.t0 > 4 * 3600e3;
    try { if (segs().reduce((a, x) => a + fs.statSync(path.join(BUF, x)).size, 0) > 30e9) stop = true; } catch (e) {}
    try { const f = fs.statfsSync(BUF); if (f.bavail * f.bsize < 3e9) stop = true; } catch (e) {}
    if (stop) stopLong();
  }, 15000);
  toastShow({ state: 'done', title: 'Opname gestart ●', sub: `${L.game} · stoppen met ${(S.keys && S.keys.rec) || 'Alt+F8'}`, pct: 1 }, 2800);
  tray && tray.setToolTip('Wistic — OPNAME bezig'); recEvt();
}
async function stopLong() {
  const L = lrec; if (!L || L.stopping) return;
  L.stopping = true; clearInterval(L.timer); recEvt();
  const before = segs().pop() || '';
  for (let i = 0; i < 28 && proc && (segs().pop() || '') === before; i++) await sleep(250);   // wacht tot het lopende deel klaar is (max 7 s)
  const f = segs().filter(x => x >= L.first);
  if (proc && f.length > 1) f.pop();   // het laatste deel is nog niet klaar
  prHold = true;                       // niets opruimen zolang we aan het opslaan zijn
  beep();                              // pas nu het stopgeluid: de opname is dan al afgebakend, dus het staat er niet in
  let ok = false, name = '', out = '', part = '';
  const total = f.length * SEG;
  if (f.length) {
    const list = path.join(BUF, 'rec_list.txt');
    fs.writeFileSync(list, f.map(x => `file '${path.join(BUF, x).replace(/\\/g, '/')}'`).join('\n'));
    fs.mkdirSync(S.folder, { recursive: true });
    name = `${L.game}_${stamp()}_opname.mp4`; out = path.join(S.folder, name); part = out + '.part';
    // Het startgeluid zit in het geluidsspoor: alleen daar een stukje stilte van maken, het beeld blijft helemaal intact.
    let mute = '';
    try {
      const bd = beepMs(), b0 = fs.statSync(path.join(BUF, f[0])).birthtimeMs;
      if (bd > 0 && b0 > 0) {
        // De startpiep klonk vóór het begin van de opname (of vlak erna). rel = hoeveel seconden na het begin van het eerste bestand de piep begon (negatief = ervoor).
        // Startte de opname de buffer zelf (forced), dan zit er een marge in omdat het bestand wat later wordt aangemaakt dan het geluid begint.
        const rel = (L.beepT - b0) / 1000;
        const a = L.forced ? 0 : Math.max(0, rel - 0.25), e = rel + bd / 1000 + (L.forced ? 1.0 : 0.6);
        const sb = beeps.find(x => Math.abs(x.t - L.beepT) < 1500);   // welk geluid klonk er bij de start
        if (e > 0.2) mute = beepCut(sb ? sb.kind : S.sound, a, Math.max(e, a + 0.5));
      }
    } catch (e) {}
    ok = await encode(['-y', '-f', 'concat', '-safe', '0', '-i', list, ...(mute ? ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', mute] : ['-c', 'copy']), '-movflags', '+faststart', '-f', 'mp4', part], total, null, 120000 + total * 1500);
    if (!ok) {   // plan B: opnieuw coderen
      try { fs.rmSync(part, { force: true }); } catch (e) {}
      ok = await encode(['-y', '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', ...(mute ? ['-af', mute] : []), '-movflags', '+faststart', '-f', 'mp4', part],
        total, null, 120000 + total * 6000);
    }
  }
  if (ok) {
    fs.renameSync(part, out);
    const td = path.join(UD(), 'thumbs'); fs.mkdirSync(td, { recursive: true }); await makeThumb(out, path.join(td, name + '.jpg'));
    const m = jr('clips.json', {}); m[name] = { game: L.game, fav: false, tv: 2, long: true }; jw('clips.json', m); enforce();
    prHold = false;
    toastShow({ state: 'done', title: 'Opname opgeslagen ✓', sub: `${L.game} · ${Math.floor(total / 60)} min`, pct: 1 }, 5000);
  } else {
    try { if (part) fs.rmSync(part, { force: true }); } catch (e) {}
    toastShow({ state: 'err', title: f.length ? 'Opname opslaan mislukt' : 'Niets opgenomen', sub: f.length ? 'Check ffmpeg-log.txt in AppData' : 'Probeer het opnieuw', pct: 1 }, 7000);
  }
  prHold = false;
  if (L.forced && !game && S.mode !== 'always') stopBuffer();
  lrec = null; tray && tray.setToolTip(proc ? 'Wistic — buffer actief' : 'Wistic — gepauzeerd'); recEvt(); changed();
}
const toggleLong = () => (lrec ? stopLong() : startLong());
function keys() {
  globalShortcut.unregisterAll();
  const k = S.keys || {};
  for (const [acc, fn] of [[k.save || 'F8', saveClip], [k.shot || 'F7', shot], [k.rec || 'Alt+F8', toggleLong]]) { try { globalShortcut.register(acc, fn); } catch (e) {} }
}
function cleanName(exe) {
  return exe.replace(/\.exe$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || 'Game';
}
const JC = { t: 0, ok: false };
function watch() {
  setInterval(() => {
    // Game detection is always on; in 'always' mode the buffer just keeps running too
    if (S.mode === 'always' && !proc) startBuffer();

    // Prefer known games first (fast path via tasklist)
    execFile('tasklist', ['/fo', 'csv', '/nh'], { maxBuffer: 1e7 }, (e, o) => {
      if (e) return;
      let g = null;
      running = new Set();
      const known = [];
      let javaExe = '';   // java.exe / javaw.exe: pas Minecraft als de opdrachtregel dat bevestigt (Modrinth, Prism, CurseForge, enz.)
      for (const l of (o || '').split('\n')) {
        const m = l.match(/^"([^"]+)"/);
        if (!m) continue;
        const exe = m[1];
        if (/^javaw?\.exe$/i.test(exe)) { javaExe = exe; continue; }
        if (GAMES[exe]) {
          const name = GAMES[exe];
          running.add(name); gameExe[name] = exe.toLowerCase();
          if ((S.games[name] || { on: true }).on) known.push(name);
        }
      }
      const step = () => {
      if (known.length) g = known[0];

      // Fallback: detect any visible non-blacklisted process that looks like a game
      if (!g && S.detectAny !== false) {
        // Get processes with a real window + memory usage, sorted by memory (games usually use more)
        const ps = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.MainWindowHandle -ne 0 } | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 ProcessName, @{N='MB';E={[int]($_.WorkingSet64/1MB)}} | ForEach-Object { "$($_.ProcessName)|$($_.MB)" }`;
        execFile('powershell', ['-NoProfile', '-Command', ps], { maxBuffer: 2e6, timeout: 8000 }, (err, out) => {
          if (err || !out) return finish(g);
          const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          for (const line of lines) {
            const [name, mbStr] = line.split('|');
            if (!name) continue;
            const mb = parseInt(mbStr, 10) || 0;
            const exe = name.toLowerCase().endsWith('.exe') ? name : name + '.exe';
            const key = exe.toLowerCase();
            if (BLACKLIST.has(key) || NOT_GAMES.test(key) || NOT_GAMES.test(name)) continue;
            if (SKIP_PATTERNS.test(key) || SKIP_PATTERNS.test(name)) continue;
            // Skip very light processes (< 80 MB) – almost never a real game
            if (mb > 0 && mb < 80) continue;
            const nice = GAMES[exe] || GAMES[name + '.exe'] || cleanName(exe);
            running.add(nice); gameExe[nice] = key;
            if (!g) g = nice; // first = highest memory = most likely the actual game
          }
          finish(g);
        });
      } else {
        finish(g);
      }
      };
      const addMc = () => { running.add('Minecraft'); gameExe['Minecraft'] = javaExe.toLowerCase(); if ((S.games['Minecraft'] || { on: true }).on) known.push('Minecraft'); };
      if (javaExe && Date.now() - JC.t < 20000) { if (JC.ok) addMc(); step(); }   // niet elke paar seconden PowerShell starten
      else if (javaExe) {
        const cmd = "Get-CimInstance Win32_Process -Filter \"Name='java.exe' OR Name='javaw.exe'\" | ForEach-Object { $_.CommandLine }";
        execFile('powershell', ['-NoProfile', '-Command', cmd], { maxBuffer: 2e6, timeout: 8000, windowsHide: true }, (er, out) => {
          JC.ok = !er && !!out && /minecraft|modrinth|--gameDir|neoforge|forge|fabric|quilt|launchwrapper|cpw\.mods/i.test(out); JC.t = Date.now();
          if (JC.ok) addMc();
          step();
        });
      } else step();
    });

    function finish(g) {
      const always = S.mode === 'always';
      try { if (finish.last !== String(g)) { finish.last = String(g); fs.appendFileSync(path.join(UD(), 'detect.log'), new Date().toISOString() + ' mode=' + S.mode + ' detectAny=' + S.detectAny + ' game=' + g + '\n'); } } catch (e) {}
      if (g && g !== game) {
        game = g;
        if (!always && !lrec) { stopBuffer(); setTimeout(startBuffer, 800); }
        else if (!proc) startBuffer();
      }
      else if (g && !proc) startBuffer();
      else if (!g && game) { game = null; if (!always && !lrec) stopBuffer(); }
      if (always && !proc) startBuffer();
    }
  }, 8000); // check a bit more often
}
function parseAudio(t) {
  const out = []; let inA = false;
  for (const l of t.split(/\r?\n/)) {
    let m = l.match(/"([^"]+)"\s+\(audio\)/); if (m) { out.push(m[1]); continue; }
    if (/DirectShow audio devices/i.test(l)) { inA = true; continue; }
    if (/DirectShow video devices/i.test(l)) { inA = false; continue; }
    if (inA && !/Alternative name/i.test(l)) { m = l.match(/\]\s+"([^"]+)"/); if (m) out.push(m[1]); }
  }
  return [...new Set(out)];
}
function region() {
  if (S.display === 'all') return [];
  const d = screen.getAllDisplays().find(x => String(x.id) === String(S.display)) || screen.getPrimaryDisplay();
  const r = screen.dipToScreenRect(null, d.bounds), ev = n => n - (n % 2);
  return ['-offset_x', String(r.x), '-offset_y', String(r.y), '-video_size', `${ev(r.width)}x${ev(r.height)}`];
}
// Grootte van het beeld dat opgenomen wordt: precies wat region() aan ffmpeg geeft.
function opnameRes() {
  const rs = S.display === 'all'
    ? screen.getAllDisplays().map(d => screen.dipToScreenRect(null, d.bounds))
    : [screen.dipToScreenRect(null, (screen.getAllDisplays().find(x => String(x.id) === String(S.display)) || screen.getPrimaryDisplay()).bounds)];
  const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y));
  const x1 = Math.max(...rs.map(r => r.x + r.width)), y1 = Math.max(...rs.map(r => r.y + r.height));
  return `${x1 - x0}×${y1 - y0}`;
}
function openWin() {
  if (win) return win.focus();
  const wa0 = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({ width: Math.min(1440, wa0.width), height: Math.min(900, wa0.height), minWidth: 900, minHeight: 600, backgroundColor: '#000000', show: false, autoHideMenuBar: true, frame: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  vastzetten(win);
  win.once('ready-to-show', () => { if (win) win.show(); }); win.loadFile('index.html'); win.on('closed', () => (win = null));
}

// ---- Google Drive: favorieten synchroniseren ----
let cloud = [], up = { busy: false, name: '', pct: 0, err: '' }, dn = { busy: false, name: '', pct: 0, err: '' }, dq = Promise.resolve();
async function driveRefresh() {
  if (!AUTH.driveOn()) { cloud = []; return; }
  const files = await DR.list(), th = {};
  files.filter(f => (f.appProperties || {}).blips === 'thumb').forEach(f => { th[f.appProperties.clip] = f.id; });
  cloud = files.filter(f => (f.appProperties || {}).blips === 'clip').map(f => ({ id: f.id, name: f.appProperties.clip, size: +f.size || 0,
    game: f.appProperties.game || '', title: f.appProperties.title || '', t: +f.appProperties.t || Date.parse(f.createdTime) || 0, thumbId: th[f.appProperties.clip] || '' }));
  const dir = path.join(UD(), 'cloudthumbs'); fs.mkdirSync(dir, { recursive: true });
  for (const c of cloud) { const dst = path.join(dir, c.name + '.jpg'); if (c.thumbId && !fs.existsSync(dst)) { try { await DR.download(c.thumbId, dst); } catch (e) {} } }
}
function driveUp(n) { dq = dq.then(() => driveUpOne(n)).catch(() => {}); }
async function driveUpOne(n) {
  if (!AUTH.driveOn() || S.driveSync === false) return;
  const file = path.join(S.folder, n); if (!fs.existsSync(file)) return;
  try {
    up = { busy: true, name: n, pct: 0, err: '' };
    if (!cloud.length) await driveRefresh();
    if (cloud.some(c => c.name === n)) { up.busy = false; return; }
    const meta = jr('clips.json', {})[n] || {}, st = fs.statSync(file);
    await DR.upload(file, n, Object.assign({ blips: 'clip', clip: n, game: meta.game || n.split('_')[0], t: String(Math.round(st.mtimeMs)) }, meta.title ? { title: bt(meta.title) } : {}),
      n.endsWith('.png') ? 'image/png' : 'video/mp4', p => { up.pct = p; });
    const th = path.join(UD(), 'thumbs', n + '.jpg');
    if (fs.existsSync(th)) { try { await DR.uploadSmall(th, n + '.thumb.jpg', { blips: 'thumb', clip: n }, 'image/jpeg'); } catch (e) {} }
    await driveRefresh();
    up = { busy: false, name: n, pct: 1, err: '' }; changed();
  } catch (e) { up = { busy: false, name: n, pct: 0, err: e.message }; }
}
async function driveSync() {
  await driveRefresh();
  const m = jr('clips.json', {}), have = new Set(cloud.map(c => c.name));
  for (const n of Object.keys(m)) if (m[n].fav && !have.has(n) && fs.existsSync(path.join(S.folder, n))) driveUp(n);
  changed();
}

// ===== Clips delen via een link (Wistic Share: Cloudflare Worker + R2) =====
const SHARE = require('./share-config');
const shareOn = () => !!SHARE.base && !/JOUW-NAAM/.test(SHARE.base);
const shareBase = () => SHARE.base.replace(/\/+$/, '');
const SHARE_MAX = 90 * 1024 * 1024;   // zelfde limiet als op de server
async function shareApi(method, url, body, headers) {
  const tok = await AUTH.idToken();
  let r;
  try { r = await ((body === undefined || typeof body === 'string') ? AUTH.nfetch : fetch)(shareBase() + url, { method, headers: Object.assign({ Authorization: 'Bearer ' + tok }, headers || {}), body }); }
  catch (e) { throw AUTH.netErr(e); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Delen mislukt (' + r.status + ' ' + method + ' ' + String(url).replace(/\/clips\/[^\/?]+/, '/clips/…') + ').'); e.data = j; e.status = r.status; throw e; }
  return j;
}
const mediaDur = file => new Promise(res => execFile(FF, ['-hide_banner', '-i', file], { timeout: 15000, windowsHide: true }, (e, so, se) => {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(se || '')); res(m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 60); }));
let sharing = false;
async function shareClip(n) {
  if (!shareOn()) return { ok: false, error: 'Delen is nog niet ingesteld (zie share-config.js).' };
  if (!AUTH.current()) return { ok: false, error: 'Log eerst in bij Wistic om clips te delen.' };
  if (!n.endsWith('.mp4')) return { ok: false, error: 'Alleen video\'s kunnen worden gedeeld.' };
  const src = path.join(S.folder, n); if (!fs.existsSync(src)) return { ok: false, error: 'Clip niet gevonden.' };
  let m = jr('clips.json', {}); const meta = m[n] || {};
  if (meta.share) {   // staat de link nog online? Dan alleen opnieuw kopiëren (en de clip blijft 30 dagen langer staan).
    let up = false;
    try { up = (await fetch(meta.share.url, { method: 'HEAD' })).ok; } catch (e) { return { ok: false, error: 'Geen internetverbinding.' }; }
    if (up) { clipboard.writeText(meta.share.url); toastShow({ state: 'done', title: 'Link gekopieerd ✓', sub: 'Plak hem waar je wilt', pct: 1 }, 3500); return { ok: true, url: meta.share.url }; }
  }
  if (sharing) return { ok: false, error: 'Er wordt al een clip gedeeld. Even wachten.' };
  sharing = true;
  const tmp = path.join(os.tmpdir(), 'blips-share-' + Date.now() + '.mp4'), g = meta.game || n.split('_')[0];
  try {
    toastShow({ state: 'saving', title: 'Link maken…', sub: g + ' · klaarmaken', pct: 0.02 });
    const total = await mediaDur(src);
    // Zelfinkstellende kwaliteit: eerst 1080p. Pas als de clip te groot wordt voor de gratis opslag
    // gaat hij een stap omlaag (720p, dan 540p). Korte clips houden dus hun volle scherpte,
    // lange clips worden automatisch kleiner in plaats van geweigerd.
    const TARGET = 40 * 1024 * 1024;
    const LADDER = [['1080', '26', '5M', '12M', '112k'], ['720', '27', '3M', '6M', '96k'], ['540', '28', '1.8M', '4M', '80k']];
    const osz = fs.statSync(src).size;
    let file = '', size = 0;
    for (let i = 0; i < LADDER.length; i++) {
      const q = LADDER[i];
      const ok = await encode(['-y', '-i', src, '-vf', 'scale=-2:min(' + q[0] + '\\,ih)', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', q[1], '-maxrate', q[2], '-bufsize', q[3], '-r', '30', '-c:a', 'aac', '-b:a', q[4],
        '-movflags', '+faststart', '-f', 'mp4', tmp], total, p => toastShow({ pct: (i + p) / LADDER.length * 0.6 }), 120000 + total * 8000);
      if (ok && fs.existsSync(tmp)) { file = tmp; size = fs.statSync(tmp).size; }
      if (size && size <= TARGET) break;   // klein genoeg: kwaliteit blijft zo hoog mogelijk
    }
    if (!file) throw new Error('Klaarmaken voor delen mislukt.');
    if (osz < size && osz <= TARGET) { file = src; size = osz; }   // het origineel is al kleiner
    if (size > SHARE_MAX) throw new Error('Deze clip is te groot om te delen (max 90 MB). Snij hem bij.');
    toastShow({ sub: g + ' · uploaden', pct: 0.65 });
    const { id } = await shareApi('POST', '/api/clips', JSON.stringify({ title: meta.title || '', game: g, size }), { 'Content-Type': 'application/json' });
    try {
      const tp = path.join(UD(), 'thumbs', n + '.jpg');
      if (fs.existsSync(tp)) await shareApi('PUT', '/api/clips/' + id + '/thumb', fs.readFileSync(tp), { 'Content-Type': 'image/jpeg' });
      toastShow({ pct: 0.75 });
      await shareApi('PUT', '/api/clips/' + id + '/video', fs.readFileSync(file), { 'Content-Type': 'video/mp4' });
    } catch (e) { try { await shareApi('DELETE', '/api/clips/' + id); } catch (x) {} throw e; }
    const url = shareBase() + '/c/' + id;
    m = jr('clips.json', {}); m[n] = Object.assign(m[n] || {}, { share: { id, url, t: Date.now() } }); jw('clips.json', m);
    clipboard.writeText(url);
    toastShow({ state: 'done', title: 'Link gekopieerd ✓', sub: g + ' · plak hem in Discord of waar je wilt', pct: 1 }, 5000);
    changed(); return { ok: true, url };
  } catch (e) {
    toastShow({ state: 'err', title: 'Link maken mislukt', sub: e.message, pct: 1 }, 6000);
    return { ok: false, error: e.message };
  } finally { sharing = false; try { fs.rmSync(tmp, { force: true }); } catch (e) {} }
}
async function unshareClip(n) {
  const m = jr('clips.json', {}), s = (m[n] || {}).share; if (!s) return { ok: true };
  try { await shareApi('DELETE', '/api/clips/' + s.id); } catch (e) { if (!/niet gevonden/i.test(e.message)) return { ok: false, error: e.message }; }
  delete m[n].share; jw('clips.json', m); changed(); return { ok: true };
}
// Waarschuwt als een link binnen 3 dagen verloopt en haalt links weg die op de server niet meer bestaan.
async function shareExpiryCheck() {
  try {
    if (!shareOn() || !AUTH.current()) return;
    const { clips } = await shareApi('GET', '/api/clips'), now = Date.now();
    const soon = clips.filter(c => c.expires > now && c.expires - now < 3 * 86400000);
    if (soon.length) new Notification({ title: 'Wistic', body: tr(soon.length === 1
      ? 'Je clip-link "' + (soon[0].title || soon[0].game || 'clip') + '" verdwijnt binnen 3 dagen. Open de link om hem 30 dagen langer te bewaren.'
      : soon.length + ' clip-links verdwijnen binnen 3 dagen. Open ze om ze 30 dagen langer te bewaren.') }).show();
    const live = new Set(clips.map(c => c.id)), m = jr('clips.json', {}); let ch = false;
    for (const k of Object.keys(m)) if (m[k].share && !live.has(m[k].share.id) && Date.now() - m[k].share.t > 120000) { delete m[k].share; ch = true; }
    if (ch) { jw('clips.json', m); changed(); }
  } catch (e) {}
}


// ---------- Automatisch updaten ----------
// Werkt alleen in de geinstalleerde app (niet bij "npm start"). De nieuwe versie staat op de Wistic Share-website (/updates).
const UPD = { state: 'none', version: '' };
let autoUpdater = null;
function setupUpdater() {
  if (!app.isPackaged) return;
  try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { return; }
  autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', i => { UPD.state = 'downloading'; UPD.version = i.version; });
  autoUpdater.on('update-downloaded', i => {
    UPD.state = 'ready'; UPD.version = i.version;
    try { win && win.webContents.send('upd:ready'); } catch (e) {}
    try { const n = new Notification({ title: 'Wistic', body: tr('Versie ' + i.version + ' staat klaar. Open Wistic en klik op Nu updaten.') }); n.on('click', openWin); n.show(); } catch (e) {}
  });
  autoUpdater.on('error', () => {});
  const check = () => { try { autoUpdater.checkForUpdates().catch(() => {}); } catch (e) {} };
  setTimeout(check, 10000); setInterval(check, 4 * 3600 * 1000);
}


// ---------- Discord: "<game> with Wistic" ----------
// Laat in Discord zien dat je Wistic gebruikt (Rich Presence). Staat er een game aan: "GTA V with Wistic", anders "Clipping with Wistic".
// Werkt alleen als Discord open staat; aan/uit te zetten bij Instellingen.
let rpc = null, rpcReady = false, rpcTimer = null, rpcTick = null, rpcText = '', rpcStart = Date.now();
let rpcIcons = null;   // game-logo's uit Discords eigen lijst: { byName, byExe }
const rpcNorm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
async function rpcLoadIcons() {
  if (rpcIcons) return;
  try {
    const r = await AUTH.nfetch('https://discord.com/api/v10/applications/detectable');
    const list = await r.json(), byName = {}, byExe = {};
    for (const a of list) {
      const ic = a.icon || a.icon_hash; if (!ic) continue;
      const url = 'https://cdn.discordapp.com/app-icons/' + a.id + '/' + ic + '.png';
      byName[rpcNorm(a.name)] = url;
      for (const ex of a.executables || []) if (ex.os === 'win32' && !/^(javaw?|python\w*|node|electron)\.exe$/i.test(ex.name)) byExe[ex.name.replace(/^>/, '').split('/').pop().toLowerCase()] = url;
    }
    rpcIcons = { byName, byExe };
  } catch (e) { rpcIcons = null; }
}
const rpcSteam = {};   // spelnaam -> logo-url van Steam ('' = niet gevonden)
function rpcIcon(g) {
  if (!g) return '';
  if (rpcIcons) {
    const n = rpcNorm(g); if (rpcIcons.byName[n]) return rpcIcons.byName[n];   // eerst op naam (voorkomt dat javaw.exe het logo van een willekeurige Java-game geeft)
    const ex = gameExe[g]; if (ex && rpcIcons.byExe[ex]) return rpcIcons.byExe[ex];
    for (const exe of Object.keys(GAMES)) if (GAMES[exe] === g && rpcIcons.byExe[exe.toLowerCase()]) return rpcIcons.byExe[exe.toLowerCase()];
    if (n.length >= 4) { const k = Object.keys(rpcIcons.byName).filter(x => x.endsWith(n)).sort((p, q) => p.length - q.length)[0]; if (k) return rpcIcons.byName[k]; }
  }
  return rpcSteam[g] || '';
}
// Staat de game niet in Discords lijst, dan zoeken we de cover in de Steam-winkel.
async function rpcSteamLookup(g) {
  if (!g || g in rpcSteam) return;
  rpcSteam[g] = '';
  try {
    const r = await AUTH.nfetch('https://store.steampowered.com/api/storesearch/?l=english&cc=us&term=' + encodeURIComponent(g));
    const j = await r.json(), n = rpcNorm(g);
    const hit = (j.items || []).find(i => { const m = rpcNorm(i.name); return m === n || (n.length >= 4 && m.endsWith(n)) || (m.length >= 4 && n.endsWith(m)); });   // streng: liever geen logo dan een verkeerde game
    if (hit) {
      // Nieuwere Steam-games hebben afbeeldingen met een hash in het pad; tiny_image uit de zoekresultaten is daarom het betrouwbaarst.
      // Staande cover (past beter in Discords vierkante vak) via Steams eigen asset-lijst; lukt dat niet, dan de brede afbeelding.
      let port = '';
      try {
        const q = encodeURIComponent(JSON.stringify({ ids: [{ appid: hit.id }], context: { language: 'english', country_code: 'US' }, data_request: { include_assets: true } }));
        const gi = await (await AUTH.nfetch('https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=' + q)).json();
        const it = gi.response && gi.response.store_items && gi.response.store_items[0], as = it && it.assets;
        const f = as && (as.library_capsule || as.library_capsule_2x);
        if (as && f && as.asset_url_format) port = 'https://shared.akamai.steamstatic.com/store_item_assets/' + as.asset_url_format.replace('${FILENAME}', f);
      } catch (e) {}
      const cands = [port, hit.tiny_image, 'https://cdn.akamai.steamstatic.com/steam/apps/' + hit.id + '/header.jpg'].filter(u => u && u.length < 250);
      for (const u of cands) {
        try { const h = await AUTH.nfetch(u, { method: 'HEAD' }); if (h.ok) { rpcSteam[g] = u; rpcUpdate(true); break; } } catch (e) {}
      }
    }
  } catch (e) {}
}
function rpcUpdate(force) {
  if (!rpc || !rpcReady) return;
  const g = game ? String(game).slice(0, 100) : '';
  if (!force && g === rpcText) return;
  if (g !== rpcText) rpcStart = Date.now();   // timer begint opnieuw bij een andere game
  rpcText = g;
  const gd = g === 'FiveM' ? 'GTA V' : g;   // FiveM is GTA V: toon in Discord de naam en het logo van GTA V
  const icon = rpcIcon(gd);
  if (gd && !icon && rpcIcons) rpcSteamLookup(gd);
  // Zoals Medal: game-logo groot, Wistic-logo klein rechtsonder (asset 'wistic' in Discord Developer Portal > Rich Presence > Art Assets)
  const assets = icon ? { large_image: icon, large_text: gd, small_image: 'wistic-discord-icon', small_text: 'Wistic' } : { large_image: 'wistic-discord-icon', large_text: 'Wistic' };
  const activity = { type: 0, status_display_type: 2, details: 'Clipping' + (gd ? ' ' + gd : '') + ' with Wistic', timestamps: { start: rpcStart }, assets, instance: false,
    buttons: [{ label: 'Follow on Wistic', url: 'https://wistic.net' }, { label: 'Download Wistic', url: 'https://wistic.net/updates/Wistic-Setup.exe' }] };
  try { rpc.request('SET_ACTIVITY', { pid: process.pid, activity }).catch(() => {}); } catch (e) {}
}
function stopDiscord() {
  clearTimeout(rpcTimer); rpcTimer = null; clearInterval(rpcTick); rpcTick = null; rpcReady = false; rpcText = '';
  const c = rpc; rpc = null;
  if (c) { try { c.clearActivity().catch(() => {}); } catch (e) {} try { c.destroy().catch(() => {}); } catch (e) {} }
}
function startDiscord() {
  stopDiscord();
  if (false) return;
  let cfg, RPC; try { cfg = require('./discord-config'); RPC = require('discord-rpc'); } catch (e) { return; }
  if (!cfg.clientId || /^PLAK_/.test(cfg.clientId)) return;
  const retry = () => { if (false) return; clearTimeout(rpcTimer); rpcTimer = setTimeout(startDiscord, 15000); };
  const c = new RPC.Client({ transport: 'ipc' }); rpc = c;
  c.on('ready', () => { rpcReady = true; rpcUpdate(true); rpcLoadIcons().then(() => rpcUpdate(true)); rpcTick = setInterval(() => rpcUpdate(false), 10000); });
  c.on('disconnected', () => { if (rpc === c) { rpcReady = false; clearInterval(rpcTick); rpcTick = null; rpc = null; retry(); } });
  c.login({ clientId: cfg.clientId }).catch(() => { if (rpc === c) { rpc = null; rpcReady = false; try { c.destroy().catch(() => {}); } catch (e) {} retry(); } });
}
function applyDiscord() { if (false) stopDiscord(); else if (!rpc && !rpcTimer) startDiscord(); }

// ===== Gebruikersnaam: uniek op de server, 1 keer per 7 dagen te wijzigen =====
const nameDate = t => new Date(t).toLocaleDateString(app.getLocale(), { day: 'numeric', month: 'long' });
const nameErr = e => (e && e.data && e.data.next) ? 'Je kunt je gebruikersnaam maar 1 keer per 7 dagen wijzigen. Weer mogelijk op ' + nameDate(e.data.next) + '.' : e.message;
const nameJson = { 'Content-Type': 'application/json' };
// Haalt je naam van de server en claimt de huidige naam als je nog geen naam hebt. Is hij van iemand anders, dan geeft dit taken:true.
async function nameSync() {
  if (!AUTH.current() || !shareOn()) return { ok: false };
  try {
    let r = await shareApi('GET', '/api/username'), taken = false;
    if (!r.name && S.user && S.user !== 'Gast') {
      try { r = await shareApi('POST', '/api/username', JSON.stringify({ name: S.user }), nameJson); }
      catch (e) { if (e.status === 409 || e.status === 400) taken = true; else throw e; }
    }
    if (r.name && r.name !== S.user) { S.user = r.name; jw('settings.json', S); }
    return { ok: true, name: r.name || '', next: r.next || 0, taken };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Profielfoto per account bewaren, zodat hij na uitloggen en weer inloggen terug is (S.avatars = { uid: foto }).
const avUid = () => { const c = AUTH.current(); return c ? c.uid : ''; };
function avLoad() { const k = avUid(); S.avatar = (k && S.avatars && S.avatars[k]) || ''; }
function avSave() { const k = avUid(); if (!k) return; S.avatars = S.avatars || {}; if (S.avatar) S.avatars[k] = S.avatar; else delete S.avatars[k]; }

const H = {
  'auth:signup': async ({ email, password, name }) => { try { if (shareOn() && name) { let c = null; try { c = await (await AUTH.nfetch(shareBase() + '/api/username/check?name=' + encodeURIComponent(name))).json(); } catch (x) { c = null; }   // naam-server onbereikbaar: niet blokkeren, nameSync() claimt de naam straks
      if (c && c.available === false) throw new Error(c.error || 'Deze gebruikersnaam is al in gebruik.'); }
      const u = await AUTH.signup(email, password, name); S.user = u.name; avLoad(); jw('settings.json', S); await nameSync(); u.name = S.user; return { ok: true, user: u }; } catch (e) { return { ok: false, error: e.message }; } },
  'auth:login': async ({ email, password }) => { try { const u = await AUTH.login(email, password); S.user = u.name; avLoad(); jw('settings.json', S); await nameSync(); u.name = S.user; return { ok: true, user: u }; } catch (e) { return { ok: false, error: e.message }; } },
  'auth:google': async () => { try { const u = await AUTH.google(); S.user = u.name; avLoad();
    if (u.photo && (u.isNew || !S.avatar)) { try { const r = await fetch(u.photo.replace(/=s\d+-c$/, '=s256-c')); if (r.ok) S.avatar = 'data:' + (r.headers.get('content-type') || 'image/jpeg') + ';base64,' + Buffer.from(await r.arrayBuffer()).toString('base64'); } catch (x) {} }
    avSave(); jw('settings.json', S); await nameSync(); u.name = S.user; if (win) win.focus(); if (u.drive) setTimeout(() => driveSync().catch(() => {}), 800); return { ok: true, user: u }; } catch (e) { if (win) win.focus(); return { ok: false, error: e.message }; } },
  'profile:pick': async () => { const o = { properties: ['openFile'], filters: [{ name: 'Afbeeldingen', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] };
    const r = win ? await dialog.showOpenDialog(win, o) : await dialog.showOpenDialog(o);
    if (r.canceled || !r.filePaths[0]) return null; const f = r.filePaths[0];
    if (fs.statSync(f).size > 15e6) return null;
    let ext = path.extname(f).slice(1).toLowerCase(); if (ext === 'jpg') ext = 'jpeg';
    return 'data:image/' + ext + ';base64,' + fs.readFileSync(f).toString('base64'); },
  'profile:name': () => nameSync(),
  'profile:save': async ({ name, avatar }) => { name = String(name || '').trim().slice(0, 24);
    if (name.length < (AUTH.current() ? 3 : 2)) return { ok: false, error: 'Gebruikersnaam: minimaal ' + (AUTH.current() ? 3 : 2) + ' tekens.' };
    if (AUTH.current() && shareOn() && name !== S.user) {   // alleen de server vragen als de naam echt verandert (alleen een nieuwe foto werkt dus ook zonder server)
      try { const r = await shareApi('POST', '/api/username', JSON.stringify({ name }), nameJson); name = r.name || name; }
      catch (e) { if (!(name === S.user && !e.status)) return { ok: false, error: nameErr(e) }; }
    }
    S.user = name;
    if (typeof avatar === 'string' && (avatar === '' || (avatar.startsWith('data:image/') && avatar.length < 500000))) S.avatar = avatar;
    avSave(); jw('settings.json', S);
    if (AUTH.current()) { try { await AUTH.setName(name); } catch (e) {} }
    return { ok: true }; },
  'auth:reset': async ({ email }) => { try { await AUTH.reset(email); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
  'auth:logout': () => { avSave(); AUTH.logout(); DR.reset(); cloud = []; up = { busy: false, name: '', pct: 0, err: '' }; S.user = ''; S.avatar = ''; jw('settings.json', S); return true; },
  'auth:me': () => AUTH.current(),
  // Vrienden, chats en rollen: het venster stuurt een verzoek, hier gaat het met het Firebase-token naar de Wistic Share-server.
  'social': async ({ method, path, body }) => {
    try {
      if (!AUTH.current()) return { ok: false, error: 'Log eerst in bij Wistic.', status: 401 };
      if (!shareOn()) return { ok: false, error: 'Delen is nog niet ingesteld (zie share-config.js).' };
      path = String(path || '').replace(/^\/+/, '');
      if (!/^[A-Za-z0-9_\-\/?=&%.]{1,300}$/.test(path)) return { ok: false, error: 'Ongeldig verzoek.' };
      if (path === 'myclips') return { ok: true, data: await shareApi('GET', '/api/clips'), base: shareBase() };
      const mt = ['GET', 'POST', 'DELETE'].includes(method) ? method : 'GET';
      const r = await shareApi(mt, '/api/social/' + path, body == null ? undefined : JSON.stringify(body), body == null ? undefined : nameJson);
      return { ok: true, data: r, base: shareBase() };
    } catch (e) { return { ok: false, error: e.message, status: e.status || 0 }; }
  },
  'open:url': ({ url }) => { try { const u = new URL(String(url)); if (shareOn() && u.origin === new URL(shareBase()).origin) { shell.openExternal(u.href); return true; } } catch (e) {} return false; },
  'lang:set': v => { S.lang = ['auto'].concat(I18N.LANGS).includes(v) ? v : 'auto'; jw('settings.json', S); I18N.set(S.lang, app.getLocale()); buildTray(); return true; },
  'settings:get': () => { customSoundOk(); return S; },
  'sound:pick': async () => {
    const o = { title: tr('Kies een geluid'), properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'm4a', 'wma', 'aac', 'flac'] }] };
    const r = win ? await dialog.showOpenDialog(win, o) : await dialog.showOpenDialog(o);
    const f = !r.canceled && r.filePaths[0];
    if (!f || !AUDIO_EXT.test(f)) return null;
    S.customWav = f; S.sound = 'custom'; jw('settings.json', S); syncSound(); return f;
  },
  'sound:clear': () => { S.customWav = ''; if (S.sound === 'custom') S.sound = 'ping'; jw('settings.json', S); return true; },
  'settings:set': s => { S = Object.assign({}, DEF, s, { lang: S.lang || 'auto' }); forceNoAudio = false; mixerBroken = false; jw('settings.json', S); syncSound(); keys(); app.setLoginItemSettings({ openAtLogin: !!S.startup }); applyDiscord();
    if (proc && !lrec) { stopBuffer(); setTimeout(startBuffer, 800); } return true; },
  status: async () => ({ rec: !!proc, game, encoder: enc || (await encoder()), seconds: secs() }),
  'clips:list': () => {
    const k = [S.folder, fmt(S.folder), fmt(path.join(UD(), 'clips.json')), fmt(path.join(UD(), 'thumbs')), cloud.length].join('|');
    if (CLC.v && CLC.k === k && Date.now() - CLC.t < 30000) return CLC.v;
    const r = H['clips:list0'](); CLC.k = k; CLC.v = r; CLC.t = Date.now(); return r;
  },
  'clips:list0': () => { const m = jr('clips.json', {}), cmap = new Map(cloud.map(c => [c.name, c.id])); try {
    return fs.readdirSync(S.folder).filter(x => x.endsWith('.mp4') || x.endsWith('.png')).map(x => {
      const st = fs.statSync(path.join(S.folder, x));
      const isShot = x.endsWith('.png');
      const meta = m[x] || {};
      return {
        name: x, size: st.size, t: st.mtimeMs,
        game: meta.game || x.split('_')[0],
        fav: !!meta.fav, title: meta.title || '', long: !!meta.long, share: (meta.share || {}).url || '',
        cloud: cmap.has(x), cid: cmap.get(x) || '',
        type: isShot ? 'shot' : 'clip',
        url: pathToFileURL(path.join(S.folder, x)).href,
        thumb: thumbUrl(x)
      };
    }).sort((a, b) => b.t - a.t);
  } catch (e) { return []; } },
  'clips:fav': n => {
    if (!SAFE.safeClipName(n)) return false;
    const m = jr('clips.json', {}); m[n] = Object.assign(m[n] || {}, { fav: !(m[n] || {}).fav }); jw('clips.json', m); if (m[n].fav) driveUp(n); return true;
  },
  'clips:del': n => {
    const vol = SAFE.clipPath(S.folder, n);
    if (!vol) return false;
    fs.rmSync(vol, { force: true });
    try { fs.rmSync(path.join(UD(), 'thumbs', SAFE.safeClipName(n) + '.jpg'), { force: true }); } catch (e) {}
    const m = jr('clips.json', {}); delete m[n]; jw('clips.json', m);
    return true;
  },
  'clips:open': n => { const vol = SAFE.clipPath(S.folder, n); if (!vol) return false; shell.showItemInFolder(vol); return true; },
  'clip:save': () => { saveClip(); return true; },
  'folder:open': () => { fs.mkdirSync(S.folder, { recursive: true }); shell.openPath(S.folder); return true; },
  'drive:status': () => ({ connected: AUTH.driveOn(), auto: S.driveSync !== false, count: cloud.length, up, dn }),
  'drive:sync': async () => { try { await driveSync(); return { ok: true, count: cloud.length }; } catch (e) { up.err = e.message; return { ok: false, error: e.message }; } },
  'drive:cloud': () => { let local = new Set(); try { local = new Set(fs.readdirSync(S.folder)); } catch (e) {}
    return cloud.filter(c => !local.has(c.name)).map(c => ({ name: c.name, id: c.id, cid: c.id, size: c.size, t: c.t, game: c.game || c.name.split('_')[0], title: c.title || '', fav: true, cloud: true,
      type: c.name.endsWith('.png') ? 'shot' : 'clip', thumb: pathToFileURL(path.join(UD(), 'cloudthumbs', c.name + '.jpg')).href })); },
  'drive:get': async ({ id, name, size }) => { try {
    dn = { busy: true, name, pct: 0, err: '' }; fs.mkdirSync(S.folder, { recursive: true });
    await DR.download(id, path.join(S.folder, name), p => { dn.pct = p; }, size);
    const cc0 = cloud.find(x => x.id === id) || {}; const m = jr('clips.json', {}); m[name] = Object.assign(m[name] || {}, { fav: true }, cc0.game ? { game: cc0.game } : {}, cc0.title ? { title: cc0.title } : {}); jw('clips.json', m);
    const ct = path.join(UD(), 'cloudthumbs', name + '.jpg'), td = path.join(UD(), 'thumbs'); fs.mkdirSync(td, { recursive: true });
    try { fs.copyFileSync(ct, path.join(td, name + '.jpg')); } catch (e) {}
    dn = { busy: false, name, pct: 1, err: '' }; changed(); return { ok: true };
  } catch (e) { dn = { busy: false, name, pct: 0, err: e.message }; return { ok: false, error: e.message }; } },
  'drive:del': async id => { try { await DR.remove(id); await driveRefresh(); changed(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
  'clips:rename': async ({ n, title }) => {
    title = String(title || '').trim().slice(0, 60);
    const m = jr('clips.json', {}); m[n] = Object.assign(m[n] || {}, { title }); jw('clips.json', m);
    const c = cloud.find(x => x.name === n); if (c) { c.title = title; try { await DR.setProps(c.id, { title: bt(title) || null }); } catch (e) {} }
    changed(); return true; },
  // Bijsnijden: maakt een NIEUWE clip (het origineel blijft staan), nauwkeurig tot op de tiende seconde
  'clips:trim': async ({ n, a, b }) => {
    if (!n.endsWith('.mp4')) return { ok: false, error: 'Alleen video\'s kunnen worden bijgesneden.' };
    a = Math.max(0, +a || 0); b = +b; const total = b - a;
    if (!(total >= 0.3)) return { ok: false, error: 'Kies een stuk van minstens 0,3 seconden.' };
    const m = jr('clips.json', {}), meta = m[n] || {}, g = meta.game || n.split('_')[0];
    const name = `${g}_${stamp()}.mp4`, out = path.join(S.folder, name), part = out + '.part';
    const ok = await encode(['-y', '-ss', String(a), '-i', path.join(S.folder, n), '-t', String(total),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-f', 'mp4', part],
      total, null, 120000 + total * 5000);
    if (!ok) { try { fs.rmSync(part, { force: true }); } catch (e) {} toastShow({ state: 'err', title: 'Bijsnijden mislukt', sub: 'Check ffmpeg-log.txt in AppData', pct: 1 }, 4000); return { ok: false, error: 'Bijsnijden mislukt.' }; }
    fs.renameSync(part, out);
    const td = path.join(UD(), 'thumbs'); fs.mkdirSync(td, { recursive: true }); await makeThumb(out, path.join(td, name + '.jpg'));
    const m2 = jr('clips.json', {}); m2[name] = { game: g, fav: false, tv: 2, title: meta.title ? (meta.title + ' (' + tr('bijgesneden') + ')').slice(0, 60) : '' }; jw('clips.json', m2);
    enforce(); toastShow({ state: 'done', title: 'Bijgesneden clip opgeslagen ✓', sub: `${g} · ${Math.round(total)}s`, pct: 1 }, 4000); changed();
    return { ok: true, name }; },
  'clips:share': n => shareClip(n),
  'clips:unshare': n => unshareClip(n),
  'sound:test': () => { beep(); return true; },
  'update:state': () => ({ state: UPD.state, version: UPD.version, current: app.getVersion() }),
  'update:install': () => { if (autoUpdater && UPD.state === 'ready') { setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; } return false; },
  'folder:pick': async () => { const r = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; },
  'mixer:gain': a => {
    if (!a || !a.key) return false;
    S.appGains = Object.assign({}, S.appGains); S.appGains[String(a.key)] = Math.max(0, Math.min(200, +a.pct || 0));
    jw('settings.json', S); pushGains(String(a.key)); return true;
  },
  'mixer:apps': async () => {
    const sys = (S.systemAudio || '').trim();
    const dn = sys ? sysDevName(sys) : 'default';
    const mp = dn === null ? null : await mixPath();
    const out = mp ? await helperRun(mp, ['apps', dn === 'default' ? '' : dn]) : null;
    if (out == null) return { ok: false, apps: [], broken: mixerBroken };
    const apps = out.split(/\r?\n/).map(l => l.split('\t')).filter(p => p.length >= 4 && p[0])
      .map(p => ({ key: p[0], name: p[1] || p[0], active: p[2] === '1', peak: Math.max(0, Math.min(100, +p[3] || 0)) }))
      .sort((x, y) => (y.active - x.active) || x.name.localeCompare(y.name));
    return { ok: true, apps, broken: mixerBroken };
  },
  'audio:list': async () => {
    // All dshow audio devices
    const dshow = await new Promise(r => execFile(FF, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { timeout: 10000 }, (e, so, se) => r(parseAudio(String(se || '') + String(so || '')))));
    // Alle uitvoerapparaten (headset, speakers...) via het loopback-hulpprogramma
    const hp = await helperPath();
    const outs = hp ? ((await helperRun(hp, ['list'])) || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean) : [];

    // Stereo Mix / Cable e.d. (DirectShow) blijven als extra optie
    const sysPatterns = /stereo mix|what u hear|wave out|cable|loopback/i;
    const mics = [], sysFromDshow = [];
    for (const d of dshow) {
      if (sysPatterns.test(d)) sysFromDshow.push({ id: 'dshow:' + d, label: d + ' (DirectShow)' });
      else mics.push({ id: d, label: d });
    }

    const system = [
      { id: 'out:default', label: 'Standaard uitvoer van Windows' },
      ...[...new Set(outs)].map(n => ({ id: 'out:' + n, label: '🎧 ' + n })),
      ...sysFromDshow
    ];

    return { mics, system };
  },
  'display:list': () => {
    const p = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => {
      const r = screen.dipToScreenRect(null, d.bounds);
      // Echte monitornaam van Windows; bij een generieke of lege naam terugvallen op "Screen N".
      const raw = String(d.label || '').trim();
      const generic = !raw || /^(generic|standaard|default|display\s*\d*$)/i.test(raw) || /pnp/i.test(raw);
      const name = generic ? `Screen ${i + 1}` : raw;
      return { id: String(d.id), label: `${name} — ${r.width}×${r.height}${d.id === p ? ' (primary)' : ''}`, primary: d.id === p };
    });
  },
  detector: () => ({ running: [...running], current: game, rec: !!proc, seconds: secs(), res: opnameRes(), fps: Math.max(15, Math.min(Number(S.fps) || 30, 60)), lrec: lrec ? { t0: lrec.t0, game: lrec.game, saving: !!lrec.stopping } : null }),
  'rec:toggle': async () => { await toggleLong(); return { on: !!lrec }; },
  win: (a, e) => { const w = BrowserWindow.fromWebContents(e.sender); if (a === 'min') w.minimize(); else if (a === 'max') w.isMaximized() ? w.unmaximize() : w.maximize(); else w.close(); return true; },
  // Prestaties: RAM = "privé werkgeheugen" (zoals Taakbeheer, zonder gedeelde pagina's dubbel te tellen),
  // CPU = gemeten over ~1,2 s met een echte stopwatch en als % van je hele processor (alle kernen), voor app en recorder op dezelfde manier.
  perf: async () => {
    const sample = pids => new Promise(res => {
      pids = [...new Set(pids)].filter(n => Number.isInteger(n) && n > 0);
      if (!pids.length) return res(null);
      const ps = [
        '$ids=@(' + pids.join(',') + ')',
        '$a=@{};foreach($i in $ids){$p=Get-Process -Id $i -ErrorAction SilentlyContinue;if($p){$a[$i]=$p.TotalProcessorTime.TotalSeconds}}',
        '$sw=[Diagnostics.Stopwatch]::StartNew();Start-Sleep -Milliseconds 1200',
        '$cpu=0;foreach($i in @($a.Keys)){$p=Get-Process -Id $i -ErrorAction SilentlyContinue;if($p){$cpu+=$p.TotalProcessorTime.TotalSeconds-$a[$i]}};$s=$sw.Elapsed.TotalSeconds',
        '$ram=0;try{$f=($ids|ForEach-Object{"IDProcess=$_"}) -join " OR ";$ram=(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter $f -ErrorAction Stop|Measure-Object WorkingSetPrivate -Sum).Sum}catch{foreach($i in $ids){$p=Get-Process -Id $i -ErrorAction SilentlyContinue;if($p){$ram+=$p.PrivateMemorySize64}}}',
        '[string]::Format([Globalization.CultureInfo]::InvariantCulture,"{0} {1}",[math]::Round($ram/1MB),[math]::Round($cpu*100/$s/' + os.cpus().length + ',1))'
      ].join(';');
      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 15000 }, (e, o) => {
        if (e) return res(null);
        const t = String(o).trim().replace(/,/g, '.').split(/\s+/).map(Number);
        res(t.length === 2 && t.every(isFinite) ? { ram: t[0], cpu: t[1] } : null);
      });
    });
    const ffp = [proc && proc.pid, capProc && capProc.pid];
    const [u, f] = await Promise.all([sample(app.getAppMetrics().map(x => x.pid)), ffp.some(Boolean) ? sample(ffp) : Promise.resolve(null)]);
    return { uiRamMB: u ? u.ram : null, uiCpu: u ? u.cpu : null, ffRamMB: f ? f.ram : null, ffCpu: f ? f.cpu : null };
  }
};
// Alleen het hoofdscherm mag API-aanroepen doen, en alleen voor een functie die echt in H staat.
// Anders zou een willekeurige sleutel (bijv. 'constructor') als functie kunnen worden aangeroepen.
ipcMain.handle('api', (e, n, a) => {
  try {
    if (!win || e.sender !== win.webContents) return false;
    if (typeof n !== 'string' || !Object.prototype.hasOwnProperty.call(H, n)) return false;
    if (typeof H[n] !== 'function') return false;
    return H[n](a, e);
  } catch (err) { return false; }
});

// Geen nieuwe vensters en geen navigatie weg van de eigen bestanden.
function vastzetten(w) {
  if (!w || !w.webContents) return w;
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (ev, url) => { if (!String(url).startsWith('file://')) ev.preventDefault(); });
  w.webContents.on('will-attach-webview', ev => ev.preventDefault());
  return w;
}
function buildTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([{ label: tr('Open Wistic'), click: openWin }, { label: tr('Clip opslaan'), click: saveClip }, { label: tr('Opname starten / stoppen'), click: toggleLong }, { type: 'separator' }, { label: tr('Afsluiten'), click: () => { stopBuffer(); app.quit(); } }]));
  tray.setToolTip(tray._src || 'Wistic');
}
app.whenReady().then(() => {
  setupUpdater();
  setTimeout(shareExpiryCheck, 25000); setInterval(shareExpiryCheck, 12 * 3600 * 1000);
  S = Object.assign({}, DEF, jr('settings.json', {}));
  // Nieuwe installatie: gebruik de echte Windows-map 'Video's' (die kan door OneDrive verplaatst zijn) in plaats van een vast pad.
  try { if (!jr('settings.json', {}).folder && !fs.existsSync(DEF.folder)) S.folder = path.join(app.getPath('videos'), 'Wistic'); } catch (e) {}
  if (['click', 'soft', 'camera', 'digital', 'minimal'].includes(S.sound)) S.sound = 'ping';   // oude geluiden zijn verwijderd
  I18N.set(S.lang, app.getLocale());
  startDiscord();
  // Oude standaardmap 'Blips' wordt 'Wistic' (clips verhuizen mee). Een zelf gekozen map blijft ongemoeid.
  try {
    const oldDir = path.join(os.homedir(), 'Videos', 'Blips'), newDir = path.join(os.homedir(), 'Videos', 'Wistic');
    if (path.resolve(S.folder) === path.resolve(oldDir)) {
      if (!fs.existsSync(oldDir)) { S.folder = newDir; jw('settings.json', S); }
      else if (!fs.existsSync(newDir)) { fs.renameSync(oldDir, newDir); S.folder = newDir; jw('settings.json', S); }
    }
  } catch (e) {}
  try { fs.mkdirSync(S.folder, { recursive: true }); } catch (e) {}   // de clipsmap bestaat meteen, ook voordat er een clip is opgeslagen
  AUTH.restore().then(u => { if (!u && S.user && S.user !== 'Gast') { S.user = ''; jw('settings.json', S); } if (u && u.drive) setTimeout(() => driveSync().catch(() => {}), 4000); }).catch(() => {});
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')));
  { const st = tray.setToolTip.bind(tray); tray.setToolTip = s => { tray._src = s; st(tr(s)); }; }
  tray.setToolTip('Wistic'); buildTray();
  tray.on('click', openWin); keys(); makeToast(); watch(); if (!process.argv.includes('--hidden')) openWin();
  setTimeout(fixThumbs, 6000);
});
app.on('window-all-closed', () => {});
app.on('will-quit', () => { globalShortcut.unregisterAll(); stopBuffer(); stopDiscord(); });
