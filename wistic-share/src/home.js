// Homepage van Wistic. De downloadknop gebruikt DOWNLOAD_URL uit wrangler.toml.
import { shell, table, dlInfo, esc } from './theme.js';
import { PARTIES } from './vergelijkingen.js';

const CSS = `
.hero{display:grid;grid-template-columns:1.05fr 1fr;gap:clamp(28px,5vw,64px);align-items:center;padding:clamp(40px,6vw,80px) 0 32px}
h1{font-weight:800;font-size:clamp(2.4rem,7.5vw,5.5rem);line-height:.98;letter-spacing:-.03em;margin:0 0 22px;max-width:10ch}
.lead{font-size:clamp(1.05rem,2vw,1.25rem);color:var(--tx2);max-width:34em;margin:0 0 28px}.note{color:var(--mu);font-size:.9rem;margin:14px 0 0}
.tl{padding:24px;background:var(--pn);border:1px solid var(--bd);border-radius:12px}
.tl svg{width:100%;height:auto;display:block;overflow:visible}
.tl .old{stroke:#2c322b;stroke-width:3;stroke-linecap:round}
.tl .tick{stroke:var(--ac);stroke-width:3;stroke-linecap:round}
.tl .brk{fill:none;stroke:var(--ac);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.tl text{font-family:system-ui,sans-serif;fill:var(--tx2);font-size:21px}.tl .dim{fill:var(--mu)}
.tl .key rect{fill:var(--bg);stroke:#3a4038;stroke-width:2}.tl .key text{fill:var(--tx);font-weight:700;font-size:24px}
.tl .now{stroke:var(--gr);stroke-width:3;stroke-linecap:round}.tl .nowt{fill:var(--gr);font-weight:700}
.tl p{color:var(--mu);font-size:.9rem;margin:14px 0 0}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;counter-reset:s}
.steps li{counter-increment:s;background:var(--pn);border:1px solid var(--bd);border-radius:12px;padding:24px 24px 26px}
.steps li:before{content:counter(s);display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--ac);color:var(--on);font:800 1rem system-ui,sans-serif;margin-bottom:16px}
.steps h3,.feat h3,.wins h3{font-weight:700;font-size:1.15rem;margin:0 0 6px}.steps p,.feat p,.wins p{margin:0;color:var(--tx2);font-size:.95rem}
.showc{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(24px,5vw,64px);align-items:center}
.ticks{list-style:none;margin:0;padding:0;display:grid;gap:10px}.ticks li{padding-left:26px;position:relative;color:var(--tx2)}
.ticks li:before{content:"";position:absolute;left:0;top:.5em;width:12px;height:7px;border-left:3px solid var(--ac);border-bottom:3px solid var(--ac);transform:rotate(-45deg)}
.app{display:grid;grid-template-columns:150px 1fr;border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:var(--bg)}
.sb{background:var(--pn);border-right:1px solid var(--bd);padding:16px 12px;display:grid;gap:4px;align-content:start}.sb b,.sb span{padding:8px 12px;border-radius:8px;font-weight:600;font-size:.88rem;color:var(--tx2)}.sb b{background:var(--pn2);color:var(--gr)}
.mn{padding:20px}.mn small{color:var(--mu)}.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
.tiles i{aspect-ratio:16/10;border-radius:8px;background:radial-gradient(80% 90% at 30% 20%,#2c3d24,#141714 75%);border:1px solid var(--bd)}.tiles i:nth-child(2n){background:radial-gradient(80% 90% at 70% 30%,#24301f,#121512 75%)}
.badge{display:inline-block;padding:3px 12px;border-radius:99px;font-size:.8rem;font-weight:600;background:var(--pn2);color:var(--gr);border:1px solid var(--bd)}
.band{position:relative}.band:before{content:"";position:absolute;top:0;bottom:0;left:50%;width:100vw;transform:translateX(-50%);background:var(--pn2);border-block:1px solid var(--bd);z-index:-1}
.feat{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0;padding:0;list-style:none}.feat li{background:var(--pn);border:1px solid var(--bd);border-radius:12px;padding:22px;min-height:140px}
.wins{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
.tick{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--ac);color:var(--on);font-weight:800;margin-bottom:14px}
.fine{color:var(--mu);font-size:.85rem;margin:16px 0 0;max-width:54em}
.faq{max-width:46rem}details{border-bottom:1px solid var(--bd)}details:first-of-type{border-top:1px solid var(--bd)}
summary{cursor:pointer;list-style:none;padding:18px 40px 18px 0;font-weight:700;font-size:1.05rem;position:relative}summary::-webkit-details-marker{display:none}
summary:after{content:"+";position:absolute;right:4px;top:50%;transform:translateY(-50%);font:400 1.5rem system-ui,sans-serif;color:var(--ac)}details[open] summary:after{content:"\\2212"}
details p{margin:0 0 20px;color:var(--tx2);max-width:38em}details a{color:var(--gr)}
.end>div{background:var(--pn);border:1px solid var(--ac2);border-radius:12px;padding:clamp(28px,5vw,56px)}.end h2{max-width:18ch}
@media(max-width:820px){.hero,.showc,.steps,.wins{grid-template-columns:1fr}.feat{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.feat{grid-template-columns:1fr}.feat li{min-height:0}.app{grid-template-columns:1fr}.sb{grid-auto-flow:column;overflow-x:auto;border-right:0;border-bottom:1px solid var(--bd);padding:10px}.sb b,.sb span{white-space:nowrap}.mn{padding:16px}.tiles{grid-template-columns:repeat(2,1fr)}.tl{padding:16px}}
`;

function timeline() {
  let t = '';
  for (let k = 0; k < 31; k++) {
    const x = 20 + k * 20, tall = k % 5 === 0, y1 = tall ? 74 : 82, y2 = tall ? 118 : 110;
    t += k < 11 ? `<line class="old" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>` : `<line class="tick" style="--i:${k - 11}" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`;
  }
  return `<svg viewBox="0 0 640 210" role="img" aria-label="Een tijdlijn van je game. De laatste 60 seconden voor het indrukken van F8 worden een clip.">
<path class="brk" d="M240 58V44H620V58"/><text x="430" y="30" text-anchor="middle">laatste 60 seconden</text>${t}
<line class="now" x1="620" y1="62" x2="620" y2="126"/><text class="nowt" x="620" y="150" text-anchor="end">nu</text><text class="dim" x="20" y="150">eerder</text>
<g class="key"><rect x="556" y="164" width="64" height="40" rx="9"/><text x="588" y="192" text-anchor="middle">F8</text></g><text class="dim" x="540" y="191" text-anchor="end">druk op</text></svg>`;
}

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

export function homePage(env, assets = { logo: '/logo.png', favicon: '/favicon.png' }) {
  const i = dlInfo(env);
  const medal = PARTIES.find(p => p.id === 'medal');
  const desc = 'Wistic bewaart op de achtergrond de laatste seconden van je game. Druk op F8 en je clip staat klaar. Deel hem met een link.';
  const body = `
<div class="wrap hero"><div>
<h1>Geen overlay. Alleen clips.</h1>
<p class="lead">Wistic bewaart op de achtergrond de laatste seconden van je game. Gebeurt er iets goeds? Druk op F8 en de clip staat klaar om te delen.</p>
<div class="cta">${i.dlBtn}<a class="btn" href="#how-it-works">Zo werkt het</a>${i.dcBtn}${i.repoBtn}</div>
<p class="note">Voor Windows.</p></div>
<div class="tl">${timeline()}<p>Standaard de laatste 60 seconden. Je kiest zelf een lengte van 10 tot 600 seconden.</p></div></div>

<section id="how-it-works"><div class="wrap"><h2 class="d">Zo werkt het</h2>
<ol class="steps">
<li><h3>Speel gewoon</h3><p>Wistic draait onopvallend in het systeemvak rechtsonder. Er staat geen overlay in je beeld, alleen een kleine melding als een clip is opgeslagen.</p></li>
<li><h3>Druk op <kbd>F8</kbd></h3><p>De laatste 60 seconden worden opgeslagen, met beeld en geluid. De toets en de lengte stel je zelf in.</p></li>
<li><h3>Maak een link</h3><p>Kies bij de clip voor Link maken en plak de link in Discord. De clip speelt daar meteen af, zonder dat iemand iets hoeft te downloaden.</p></li>
</ol></div></section>

<section><div class="wrap"><h2 class="d">Al je clips op één plek</h2><div class="showc">
<div><p style="font-size:1.1rem;color:var(--tx2);margin:0 0 18px;max-width:30em">In de Wistic-app vind je al je clips en screenshots terug. Zoek op naam, filter op game en geef je clips een mooie naam.</p>
<ul class="ticks"><li>Op Home: je laatste clip, recente clips, je games en je capture streak</li><li>Favorieten worden nooit automatisch verwijderd</li><li>Beheer opslag: zie hoeveel ruimte je clips innemen</li><li>Profiel met eigen gebruikersnaam en foto, of gewoon als gast</li></ul></div>
<div class="app" aria-hidden="true"><div class="sb"><b>Home</b><span>Bibliotheek</span><span>Favorieten</span><span>Instellingen</span></div>
<div class="mn"><small>Goedemiddag</small><div class="d" style="font-size:1.35rem;margin:2px 0 12px">Al je gaming-momenten, op één plek.</div><span class="badge">12 dagen capture streak</span><div class="tiles"><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>
</div></div></section>

<section class="band"><div class="wrap"><h2 class="d">Wat je er verder mee kunt</h2><ul class="feat">${FEATS.map(([h, p]) => `<li><h3>${h}</h3><p>${p}</p></li>`).join('')}</ul></div></section>

<section id="why-wistic"><div class="wrap"><h2 class="d" style="max-width:20ch">Waarom Wistic in plaats van Medal?</h2>
<div class="wins"><div class="card"><span class="tick">✓</span><h3>Geen gedoe vooraf</h3><p>Installeren, F8 en klaar. Opnemen kan ook als gast.</p></div>
<div class="card"><span class="tick">✓</span><h3>Je clips blijven van jou</h3><p>Alles blijft op je pc. Online komt alleen wat jij zelf deelt.</p></div>
<div class="card"><span class="tick">✓</span><h3>Links ruimen zichzelf op</h3><p>Een gedeelde clip speelt in Discord en verdwijnt vanzelf als niemand hem meer bekijkt.</p></div></div>
${table(medal.name, medal.rows)}
<div class="cta" style="margin-top:26px"><a class="btn pri" href="${esc(i.dlOk ? i.dl : '#')}">Probeer Wistic</a><a class="btn" href="/compare">Alle vergelijkingen</a></div>
<p class="fine">Gecontroleerd in oktober 2026 op openbare informatie van Medal; dit kan veranderen. Wistic is niet verbonden aan Medal.</p></div></section>

<section><div class="wrap"><h2 class="d">Vragen</h2><div class="faq">
<details><summary>Blijft mijn clip op mijn computer staan?</summary><p>Ja. Elke clip wordt eerst op je eigen pc opgeslagen, in de map Video's/Wistic. Online komt alleen wat jij zelf deelt.</p></details>
<details><summary>Hoe lang blijft een link werken?</summary><p>Tot 30 dagen nadat hij voor het laatst is bekeken. Elke keer dat iemand de link opent, begint de teller opnieuw. Drie dagen voordat een link verdwijnt, krijg je een melding in Wistic. Je eigen kopie op je pc blijft altijd staan.</p></details>
<details><summary>Kan iedereen mijn gedeelde clip zien?</summary><p>Iedereen met de link kan hem bekijken. De link is niet te raden, maar deel hem alleen met mensen die de clip mogen zien. Je kunt een link altijd weer verwijderen.</p></details>
<details><summary>Is er een limiet aan delen?</summary><p>Een gedeelde clip mag maximaal 90 MB zijn. Wistic maakt hem daarvoor automatisch kleiner, tot 1080p. Je kunt 20 clips tegelijk gedeeld hebben, samen maximaal 500 MB.</p></details>
<details><summary>Ik heb een bug gevonden of hulp nodig. Wat nu?</summary><p>Open een ticket op de <a href="/support">supportpagina</a>. Je kunt er screenshots en bestanden bij doen, en alleen de maker van Wistic kan het lezen. Je antwoord staat op de ticketpagina die je na het versturen krijgt.${i.dcOk ? ` Liever chatten? Kom naar onze <a href="${esc(i.dc)}" rel="noopener">Discord</a>.` : ''}</p></details>
<details><summary>Heb ik een account nodig?</summary><p>Om clips te delen log je in met e-mail of Google. Opnemen en clips bewaren op je eigen pc kan ook als gast.</p></details>
</div></div></section>

<section class="end"><div class="wrap"><div><h2 class="d">Klaar voor je eerste clip?</h2><div class="cta">${i.dlBtn}${i.dcBtn}${i.repoBtn}<a class="btn" href="/support">Hulp nodig? Open een ticket</a></div></div></div></section>`;
  return shell(env, { title: 'Wistic: geen overlay, alleen clips', desc, css: CSS, body }, assets);
}
