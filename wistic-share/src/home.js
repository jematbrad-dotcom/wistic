// Homepage van Wistic. De downloadknop gebruikt DOWNLOAD_URL uit wrangler.toml.
// Opzet: alles links naar rechts, met visuele elementen (recorder-kaart, app-venster).
import { shell, table, dlInfo, esc } from './theme.js';
import { PARTIES } from './vergelijkingen.js';

const FEATS = [
  ['Bijsnijden', 'Sleep de randen en houd alleen het mooiste stuk. Het origineel blijft staan.'],
  ['Alles opnemen', 'Wil je een hele sessie bewaren? Start een lange opname met <kbd>Alt</kbd>+<kbd>F8</kbd>. Wistic stopt vanzelf na 4 uur.'],
  ['Screenshots', 'Druk op <kbd>F7</kbd> voor een screenshot. Die komt in dezelfde bibliotheek als je clips.'],
  ['Games herkend', 'Wistic zet de naam van de game bij je clip, zodat je alles makkelijk terugvindt.'],
  ['Meerdere schermen', 'Kies welk scherm je opneemt, of het hele bureaublad.'],
  ['Mic en game apart', 'Je microfoon en het geluid van je headset of game hebben elk hun eigen volume.'],
  ['Eigen sneltoetsen', 'Kies zelf de toetsen voor een clip, screenshot en lange opname.'],
  ['Eigen geluidje', 'Kies een eigen geluid voor als een clip is opgeslagen (mp3, wav, m4a en meer).'],
  ['Discord-status', 'Onder je naam in Discord staat welke game je speelt, met Wistic.'],
  ['Start met Windows', 'Wistic start mee en draait stil door in het systeemvak.'],
  ['Updates vanzelf', 'Is er een nieuwe versie, dan krijg je een melding met één knop om te updaten.'],
  ['12 talen', 'Nederlands, English, Deutsch, Français, Español en meer. Automatisch in de taal van Windows.']
];

const CSS = `
/* ---------- hero: tekst links, beeld rechts ---------- */
.hero{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);gap:clamp(24px,4vw,56px);align-items:center;padding:clamp(36px,6vw,76px) 0 clamp(26px,4vw,44px)}
.hero h1{font-weight:800;font-size:clamp(2.5rem,6.4vw,5.2rem);line-height:.96;letter-spacing:-.04em;margin:0 0 20px;max-width:11ch}
.hero .lead{font-size:clamp(1.05rem,1.9vw,1.22rem);color:var(--tx2);max-width:31em;margin:0 0 26px}
.hero .note{margin:16px 0 0}
.rec{background:var(--pn);border:1px solid var(--bd);border-radius:14px;overflow:hidden}
.rec-bar{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--pn2);border-bottom:1px solid var(--bd);font:600 12px/1 system-ui,sans-serif;color:var(--mu)}
.rec-bar .dot{width:9px;height:9px;border-radius:50%;background:#c2504c}
.rec-bar .nm{color:var(--tx2)}
.rec-bar .tm{margin-left:auto;font-variant-numeric:tabular-nums}
.rec-screen{position:relative;aspect-ratio:16/10;background:linear-gradient(155deg,#1d2518 0%,#0d0f0c 55%,#141b12 100%)}
.rec-screen:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,#ffffff08 0 1px,transparent 1px 3px)}
.play{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;border-radius:50%;background:var(--ac);display:grid;place-items:center;box-shadow:0 10px 30px -12px #000}
.play:after{content:"";border-left:15px solid var(--on);border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:4px}
.keycap{position:absolute;right:14px;bottom:14px;font:800 12px/1 system-ui,sans-serif;color:var(--tx2);background:var(--pn);border:1px solid var(--bd);border-bottom-width:3px;border-radius:8px;padding:8px 10px}
.rec-foot{display:flex;align-items:center;gap:10px;padding:13px 14px;border-top:1px solid var(--bd);font:700 13px/1.4 system-ui,sans-serif}
.rec-foot span{color:var(--mu);font-weight:400}

/* ---------- feitenrij links naar rechts ---------- */
.facts{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.facts li{background:var(--pn);border:1px solid var(--bd);border-radius:12px;padding:16px 18px}
.facts b{display:block;font:800 1.45rem/1.15 system-ui,sans-serif;letter-spacing:-.02em;margin-bottom:5px}
.facts span{color:var(--tx2);font-size:.9rem}

/* ---------- stappen links naar rechts met pijlen ---------- */
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.steps li{position:relative;background:var(--pn);border:1px solid var(--bd);border-radius:12px;padding:22px}
.steps li+li:before{content:"\\2192";position:absolute;left:-24px;top:50%;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--bg);border:1px solid var(--bd);color:var(--mu);font-size:15px;z-index:2}
.steps .n{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--ac2);color:var(--gr);font:800 14px/1 system-ui,sans-serif;margin-bottom:14px}
.steps h3{font-weight:700;font-size:1.1rem;margin:0 0 6px}
.steps p{margin:0;color:var(--tx2);font-size:.95rem}

/* ---------- app-venster ---------- */
.showc{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:clamp(24px,4vw,56px);align-items:center}
.showc p.intro{font-size:1.06rem;color:var(--tx2);margin:0 0 20px;max-width:32em}
.ticks{list-style:none;margin:0;padding:0;display:grid;gap:11px}
.ticks li{color:var(--tx2);padding-left:26px;position:relative}
.ticks li:before{content:"";position:absolute;left:0;top:.48em;width:11px;height:6px;border-left:2px solid var(--ac);border-bottom:2px solid var(--ac);transform:rotate(-45deg)}
.app{display:grid;grid-template-columns:126px minmax(0,1fr);background:var(--pn);border:1px solid var(--bd);border-radius:14px;overflow:hidden}
.sb{border-right:1px solid var(--bd);padding:16px 12px;display:flex;flex-direction:column;gap:9px;font-size:.9rem}
.sb b{color:var(--tx);display:flex;align-items:center;gap:8px}
.sb img{width:18px;height:18px;border-radius:5px;display:block}
.sb span{color:var(--mu)}
.mn{padding:20px;min-width:0}
.mn small{color:var(--mu)}
.mn .hi{font:800 1.25rem/1.2 system-ui,sans-serif;letter-spacing:-.02em;margin:4px 0 12px}
.badge{display:inline-block;padding:5px 11px;border-radius:999px;background:var(--ac2);color:var(--gr);font:700 12px/1 system-ui,sans-serif;margin-bottom:14px}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.tiles i{aspect-ratio:16/10;border-radius:8px;background:var(--pn2);border:1px solid var(--bd);position:relative}
.tiles i:first-child{background:linear-gradient(150deg,#233019,#111510)}
.tiles i:after{content:"";position:absolute;left:50%;top:50%;width:15px;height:15px;margin:-8px 0 0 -8px;border-radius:50%;border:1px solid var(--ac2)}

.band{position:relative}
.band:before{content:"";position:absolute;top:0;bottom:0;left:50%;width:100vw;transform:translateX(-50%);background:var(--pn2);border-block:1px solid var(--bd);z-index:-1}

/* ---------- functies in rijen ---------- */
.rows{display:grid;border-top:1px solid var(--bd)}
.rows .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:clamp(16px,4vw,48px);padding:17px 4px;border-bottom:1px solid var(--bd);align-items:baseline}
.rows h3{font-weight:700;font-size:1.05rem;margin:0;color:var(--tx)}
.rows span{color:var(--tx2);font-size:.95rem}

/* ---------- vergelijking ---------- */
.wins{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
.tick{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--ac);color:var(--on);font-weight:800;margin-bottom:12px}
.wins h3{font-weight:700;font-size:1.05rem;margin:0 0 6px}
.wins p{margin:0;color:var(--tx2);font-size:.95rem}
.fine{color:var(--mu);font-size:.85rem;margin:16px 0 0;max-width:54em}

/* ---------- vragen ---------- */
.faq{max-width:46rem}
details{border-bottom:1px solid var(--bd)}
details:first-of-type{border-top:1px solid var(--bd)}
summary{cursor:pointer;list-style:none;padding:18px 40px 18px 0;font-weight:700;font-size:1.05rem;position:relative}
summary::-webkit-details-marker{display:none}
summary:after{content:"+";position:absolute;right:4px;top:50%;transform:translateY(-50%);font:400 1.5rem system-ui,sans-serif;color:var(--ac)}
details[open] summary:after{content:"\\2212"}
details p{margin:0 0 20px;color:var(--tx2);max-width:38em}
details a{color:var(--gr)}

/* ---------- slot ---------- */
.end>div{background:var(--pn);border:1px solid var(--ac2);border-radius:12px;padding:clamp(28px,5vw,52px)}
.end h2{max-width:none;margin-bottom:22px}

@media(max-width:900px){
  .hero,.showc{grid-template-columns:1fr}
  .hero{padding-top:24px}
  .facts{grid-template-columns:repeat(2,minmax(0,1fr))}
  .steps,.wins{grid-template-columns:1fr}
  .steps li+li:before{display:none}
  .rows .row{grid-template-columns:1fr;gap:4px}
}
@media(max-width:560px){.facts{grid-template-columns:1fr}.app{grid-template-columns:1fr}.sb{flex-direction:row;flex-wrap:wrap;gap:14px;border-right:0;border-bottom:1px solid var(--bd)}}
`;

export function homePage(env, assets = { logo: '/logo.png', favicon: '/favicon.png' }) {
  const i = dlInfo(env);
  const medal = PARTIES.find(p => p.id === 'medal');
  const desc = 'Wistic bewaart op de achtergrond de laatste seconden van je game. Druk op F8 en je clip staat klaar. Deel hem met een link.';
  const body = `
<div class="wrap hero">
<div>
<h1>Geen overlay. Alleen clips.</h1>
<p class="lead">Wistic bewaart op de achtergrond de laatste seconden van je game. Gebeurt er iets goeds? Druk op F8 en de clip staat klaar om te delen.</p>
<div class="cta">${i.dlBtn}<a class="btn" href="#stappen">Zo werkt het</a>${i.dcBtn}${i.repoBtn}</div>
<p class="note">Voor Windows.</p>
</div>
<div class="rec" aria-hidden="true">
<div class="rec-bar"><span class="dot"></span><span class="nm">Wistic</span><span class="tm">0:58</span></div>
<div class="rec-screen"><span class="play"></span><span class="keycap">F8</span></div>
<div class="rec-foot">Clip opgeslagen<span>Video's/Wistic</span></div>
</div>
</div>

<section style="padding-top:0"><div class="wrap">
<ul class="facts">
<li><b>60 s</b><span>Standaard opname</span></li>
<li><b>10 tot 600 s</b><span>Kies je eigen lengte</span></li>
<li><b>4 uur</b><span>Lange opname</span></li>
<li><b>1080p</b><span>Bij het delen</span></li>
</ul>
</div></section>

<section id="stappen"><div class="wrap">
<h2 class="d">Zo werkt het</h2>
<ol class="steps">
<li><span class="n">1</span><h3>Speel gewoon</h3><p>Wistic draait onopvallend in het systeemvak rechtsonder. Er staat geen overlay in je beeld, alleen een kleine melding als een clip is opgeslagen.</p></li>
<li><span class="n">2</span><h3>Druk op <kbd>F8</kbd></h3><p>De laatste 60 seconden worden opgeslagen, met beeld en geluid. De toets en de lengte stel je zelf in.</p></li>
<li><span class="n">3</span><h3>Maak een link</h3><p>Kies bij de clip voor Link maken en plak de link in Discord. De clip speelt daar meteen af, zonder dat iemand iets hoeft te downloaden.</p></li>
</ol>
</div></section>

<section style="padding-top:0"><div class="wrap">
<div class="showc">
<div>
<h2 class="d" style="margin-bottom:16px">Al je clips op één plek</h2>
<p class="intro">In de Wistic-app vind je al je clips en screenshots terug. Zoek op naam, filter op game en geef je clips een mooie naam.</p>
<ul class="ticks">
<li>Op Home: je laatste clip, recente clips, je games en je capture streak</li>
<li>Favorieten worden nooit automatisch verwijderd</li>
<li>Beheer opslag: zie hoeveel ruimte je clips innemen</li>
<li>Profiel met eigen gebruikersnaam en foto, of gewoon als gast</li>
</ul>
</div>
<div class="app" aria-hidden="true">
<div class="sb"><b><img src="/favicon.png" width="18" height="18" alt="">Home</b><span>Bibliotheek</span><span>Favorieten</span><span>Instellingen</span></div>
<div class="mn"><small>Goedemiddag</small><div class="hi">Al je gaming-momenten, op één plek.</div><span class="badge">12 dagen capture streak</span><div class="tiles"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
</div>
</div>
</div></section>

<section class="band"><div class="wrap">
<h2 class="d">Wat je er verder mee kunt</h2>
<div class="rows">${FEATS.map(([h, p]) => `<div class="row"><h3>${h}</h3><span>${p}</span></div>`).join('')}</div>
</div></section>

<section id="why-wistic"><div class="wrap">
<h2 class="d" style="max-width:20ch">Waarom Wistic in plaats van Medal?</h2>
<div class="wins">
<div class="card"><span class="tick">✓</span><h3>Geen gedoe vooraf</h3><p>Installeren, F8 en klaar. Opnemen kan ook als gast.</p></div>
<div class="card"><span class="tick">✓</span><h3>Je clips blijven van jou</h3><p>Alles blijft op je pc. Online komt alleen wat jij zelf deelt.</p></div>
<div class="card"><span class="tick">✓</span><h3>Links ruimen zichzelf op</h3><p>Een gedeelde clip speelt in Discord en verdwijnt vanzelf als niemand hem meer bekijkt.</p></div>
</div>
${table(medal.name, medal.rows)}
<div class="cta" style="margin-top:26px"><a class="btn pri" href="${esc(i.dlOk ? i.dl : '#')}">Probeer Wistic</a><a class="btn" href="/compare">Alle vergelijkingen</a></div>
<p class="fine">Gecontroleerd in oktober 2026 op openbare informatie van Medal; dit kan veranderen. Wistic is niet verbonden aan Medal.</p>
</div></section>

<section><div class="wrap"><h2 class="d">Vragen</h2><div class="faq">
<details><summary>Blijft mijn clip op mijn computer staan?</summary><p>Ja. Elke clip wordt eerst op je eigen pc opgeslagen, in de map Video's/Wistic. Online komt alleen wat jij zelf deelt.</p></details>
<details><summary>Hoe lang blijft een link werken?</summary><p>Tot 30 dagen nadat hij voor het laatst is bekeken. Elke keer dat iemand de link opent, begint de teller opnieuw. Drie dagen voordat een link verdwijnt, krijg je een melding in Wistic. Je eigen kopie op je pc blijft altijd staan.</p></details>
<details><summary>Kan iedereen mijn gedeelde clip zien?</summary><p>Iedereen met de link kan hem bekijken. De link is niet te raden, maar deel hem alleen met mensen die de clip mogen zien. Je kunt een link altijd weer verwijderen.</p></details>
<details><summary>Is er een limiet aan delen?</summary><p>Een gedeelde clip mag maximaal 90 MB zijn. Wistic maakt hem daarvoor automatisch kleiner, tot 1080p. Je kunt 20 clips tegelijk gedeeld hebben, samen maximaal 500 MB.</p></details>
<details><summary>Ik heb een bug gevonden of hulp nodig. Wat nu?</summary><p>Open een ticket op de <a href="/support">supportpagina</a>. Je kunt er screenshots en bestanden bij doen, en alleen de maker van Wistic kan het lezen. Je antwoord staat op de ticketpagina die je na het versturen krijgt.${i.dcOk ? ` Liever chatten? Kom naar onze <a href="${esc(i.dc)}" rel="noopener">Discord</a>.` : ''}</p></details>
<details><summary>Heb ik een account nodig?</summary><p>Om clips te delen log je in met e-mail of Google. Opnemen en clips bewaren op je eigen pc kan ook als gast.</p></details>
</div></div></section>

<section class="end"><div class="wrap"><div>
<h2 class="d">Klaar voor je eerste clip?</h2>
<div class="cta">${i.dlBtn}${i.dcBtn}${i.repoBtn}<a class="btn" href="/support">Hulp nodig? Open een ticket</a></div>
</div></div></section>`;
  return shell(env, { title: 'Wistic: geen overlay, alleen clips', desc, css: CSS, body }, assets);
}