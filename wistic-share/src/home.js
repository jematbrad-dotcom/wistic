// Homepage van Wistic. De downloadknop gebruikt DOWNLOAD_URL uit wrangler.toml.
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
.hero{text-align:center;padding:clamp(56px,9vw,120px) 0 clamp(36px,5vw,56px)}
.hero h1{font-weight:800;font-size:clamp(2.8rem,9vw,6.5rem);line-height:.95;letter-spacing:-.04em;margin:0 0 24px}
.hero .lead{font-size:clamp(1.1rem,2.4vw,1.35rem);color:var(--tx2);max-width:30em;margin:0 auto 32px}
.hero .cta{justify-content:center}
.hero .note{margin:18px 0 0}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.steps li{background:var(--pn);border:1px solid var(--bd);border-radius:12px;padding:24px}
.steps b{display:block;font:800 2rem/1 system-ui,sans-serif;color:var(--ac);margin-bottom:14px}
.steps h3{font-weight:700;font-size:1.1rem;margin:0 0 6px}
.steps p{margin:0;color:var(--tx2);font-size:.95rem}
.rows{display:grid;border-top:1px solid var(--bd)}
.rows .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:clamp(16px,4vw,48px);padding:16px 4px;border-bottom:1px solid var(--bd);align-items:baseline}
.rows h3{font-weight:700;font-size:1.05rem;margin:0;color:var(--tx)}
.rows span{color:var(--tx2);font-size:.95rem}
.ticks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 32px}
.ticks li{color:var(--tx2);padding-left:24px;position:relative}
.ticks li:before{content:"";position:absolute;left:0;top:.55em;width:10px;height:6px;border-left:2px solid var(--ac);border-bottom:2px solid var(--ac);transform:rotate(-45deg)}
.wins{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
.tick{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--ac);color:var(--on);font-weight:800;margin-bottom:12px}
.wins h3{font-weight:700;font-size:1.05rem;margin:0 0 6px}.wins p{margin:0;color:var(--tx2);font-size:.95rem}
.band{position:relative}.band:before{content:"";position:absolute;top:0;bottom:0;left:50%;width:100vw;transform:translateX(-50%);background:var(--pn2);border-block:1px solid var(--bd);z-index:-1}
.fine{color:var(--mu);font-size:.85rem;margin:16px 0 0;max-width:54em}
.faq{max-width:46rem}details{border-bottom:1px solid var(--bd)}details:first-of-type{border-top:1px solid var(--bd)}
summary{cursor:pointer;list-style:none;padding:18px 40px 18px 0;font-weight:700;font-size:1.05rem;position:relative}summary::-webkit-details-marker{display:none}
summary:after{content:"+";position:absolute;right:4px;top:50%;transform:translateY(-50%);font:400 1.5rem system-ui,sans-serif;color:var(--ac)}details[open] summary:after{content:"\\2212"}
details p{margin:0 0 20px;color:var(--tx2);max-width:38em}details a{color:var(--gr)}
.end>div{background:var(--pn);border:1px solid var(--ac2);border-radius:12px;padding:clamp(28px,5vw,56px);text-align:center}.end h2{max-width:none}
.cta.center{justify-content:center}
@media(max-width:820px){.steps,.wins{grid-template-columns:1fr}.rows .row{grid-template-columns:1fr;gap:4px}.ticks{grid-template-columns:1fr}}
@media(max-width:520px){.cta .btn{flex:1 1 100%}}
`;

export function homePage(env, assets = { logo: '/logo.png', favicon: '/favicon.png' }) {
  const i = dlInfo(env);
  const medal = PARTIES.find(p => p.id === 'medal');
  const desc = 'Wistic bewaart op de achtergrond de laatste seconden van je game. Druk op F8 en je clip staat klaar. Deel hem met een link.';
  const body = `
<div class="wrap hero">
<h1>Geen overlay. Alleen clips.</h1>
<p class="lead">Wistic bewaart op de achtergrond de laatste seconden van je game. Gebeurt er iets goeds? Druk op F8 en de clip staat klaar om te delen.</p>
<div class="cta center">${i.dlBtn}<a class="btn" href="#stappen">Zo werkt het</a>${i.dcBtn}${i.repoBtn}</div>
<p class="note">Voor Windows.</p>
</div>

<section id="stappen"><div class="wrap">
<ol class="steps">
<li><b>1</b><h3>Speel gewoon</h3><p>Wistic draait onopvallend in het systeemvak rechtsonder. Er staat geen overlay in je beeld, alleen een kleine melding als een clip is opgeslagen.</p></li>
<li><b>2</b><h3>Druk op <kbd>F8</kbd></h3><p>De laatste 60 seconden worden opgeslagen, met beeld en geluid. De toets en de lengte stel je zelf in.</p></li>
<li><b>3</b><h3>Maak een link</h3><p>Kies bij de clip voor Link maken en plak de link in Discord. De clip speelt daar meteen af, zonder dat iemand iets hoeft te downloaden.</p></li>
</ol>
</div></section>

<section class="band"><div class="wrap">
<h2 class="d">Wat je er verder mee kunt</h2>
<div class="rows">${FEATS.map(([h, p]) => `<div class="row"><h3>${h}</h3><span>${p}</span></div>`).join('')}</div>
</div></section>

<section><div class="wrap">
<h2 class="d">Al je clips op één plek</h2>
<ul class="ticks">
<li>Op Home: je laatste clip, recente clips, je games en je capture streak</li>
<li>Favorieten worden nooit automatisch verwijderd</li>
<li>Beheer opslag: zie hoeveel ruimte je clips innemen</li>
<li>Profiel met eigen gebruikersnaam en foto, of gewoon als gast</li>
</ul>
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

<section class="end"><div class="wrap"><div><h2 class="d">Klaar voor je eerste clip?</h2><div class="cta center">${i.dlBtn}${i.dcBtn}${i.repoBtn}<a class="btn" href="/support">Hulp nodig? Open een ticket</a></div></div></div></section>`;
  return shell(env, { title: 'Wistic: geen overlay, alleen clips', desc, css: CSS, body }, assets);
}
