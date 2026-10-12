// De pagina /vergelijkingen. Elke vergelijking is gecontroleerd in oktober 2026 op openbare informatie van de makers.
// Zet er alleen dingen in die je kunt aantonen, en controleer ze elke paar maanden opnieuw.
import { shell, table, dlInfo } from './theme.js';

const MELDING = 'Geen overlay in je beeld, alleen een kleine melding.';
const KAART = 'Werkt met NVIDIA-, AMD- en Intel-videokaarten.';

export const PARTIES = [
  { id: 'medal', name: 'Medal', rows: [
    ['Beginnen', 'Direct opnemen, ook als gast. Een account heb je alleen nodig om te delen.', 'Account nodig om te uploaden en te delen.'],
    ['Je clips', 'Blijven op je eigen pc. Er gaat niets online tenzij jij Link maken kiest.', 'Worden eerst lokaal opgeslagen. Om te delen upload je naar Medal. Automatische cloud-sync is Premium.'],
    ['Delen', 'Een link van wistic.net die in Discord meteen afspeelt en vanzelf verdwijnt na 30 dagen zonder weergave.', 'Delen met een link via medal.tv. Kwaliteit en lengte van uploads zijn op de gratis versie begrensd.']] },
  { id: 'outplayed', name: 'Outplayed', rows: [
    ['Extra platform', 'Alleen Wistic zelf.', 'Draait op het Overwolf-platform, dus je installeert ook de Overwolf-client.'],
    ['Overlay', MELDING, 'Heeft een overlay in het spel bij ondersteunde games.'],
    ['Beginnen', 'Installeren, F8 en klaar.', 'Op het gratis Essentials-plan staat een watermerk, tot je inlogt met een Overwolf-account.']] },
  { id: 'nvidia', name: 'NVIDIA App', rows: [
    ['Videokaart', KAART, 'Instant Replay werkt alleen met een GeForce-videokaart van NVIDIA.'],
    ['Overlay', 'Geen overlay in je beeld.', 'Instant Replay hoort bij de NVIDIA-overlay, die je opent met Alt+Z.']] },
  { id: 'xbox', name: 'Xbox Game Bar', rows: [
    ['Welk scherm', 'Kies zelf welk scherm je opneemt, of het hele bureaublad.', 'Neemt het venster van één app tegelijk op.'],
    ['Overlay', MELDING, 'Win+G opent een overlay bovenop je spel.']] },
  { id: 'obs', name: 'OBS Studio', rows: [
    ['Starten', 'Draait stil op de achtergrond. Je hoeft geen buffer te starten.', 'De Replay Buffer zet je eerst zelf aan en start je vóór het spelen.'],
    ['Instellen', 'Installeren, F8 en klaar.', 'Aanzetten onder Instellingen > Uitvoer en daarna zelf een sneltoets instellen.'],
    ['Delen', 'Link maken met één klik.', 'Slaat een bestand op. Je deelt het zelf.']] },
  { id: 'steam', name: 'Steam Game Recording', rows: [
    ['Games', 'Werkt met elke game, ook buiten Steam.', 'Games buiten Steam moet je eerst als non-Steam game toevoegen.'],
    ['Clip gebruiken', "Je clips zijn gewoon bestanden in de map Video's/Wistic.", 'Je bekijkt een clip in Steam. Exporteren naar mp4 is een aparte stap.']] },
  { id: 'amd', name: 'AMD ReLive', rows: [
    ['Videokaart', KAART, 'Hoort bij de AMD-software voor Radeon-videokaarten.'],
    ['Overlay', 'Geen overlay in je beeld.', 'De Radeon Overlay opent met Alt+R.'],
    ['Beginnen', 'Draait stil op de achtergrond.', 'Instant Replay zet je zelf aan in de AMD-software.']] }
];

const CSS = `
.hd{padding:clamp(40px,6vw,80px) 0 16px}.hd h1{font-weight:800;font-size:clamp(2.2rem,5.5vw,4rem);line-height:1;max-width:14ch;margin-bottom:14px}
.lead{font-size:1.1rem;color:var(--tx2);max-width:38em;margin:0 0 22px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.vs{padding:clamp(24px,4vw,40px) 0}.vs h2{font-size:clamp(1.4rem,3.5vw,2rem);margin-bottom:18px;max-width:none}
.fine{color:var(--mu);font-size:.85rem;max-width:54em;margin:22px 0 0}
`;

export function vergelijkingenPage(env, assets) {
  const i = dlInfo(env);
  const body = `<div class="wrap">
<div class="hd"><h1>Wistic vergeleken</h1>
<p class="lead">Alle tools bewaren de laatste seconden van je game. Dit zijn de verschillen met de bekendste, zodat je zelf kunt kiezen.</p>
<div class="chips">${PARTIES.map(p => `<a class="btn s" href="#v-${p.id}">${p.name}</a>`).join('')}</div></div>
${PARTIES.map(p => `<section class="vs" id="v-${p.id}"><h2 class="d">Wistic naast ${p.name}</h2>${table(p.name, p.rows)}</section>`).join('')}
<section><div class="card"><b>Probeer het zelf</b><p style="margin:6px 0 16px;color:var(--tx2)">Installeren, F8 en klaar.</p><div class="cta">${i.dlBtn}${i.dcBtn}</div></div>
<p class="fine">Gecontroleerd in oktober 2026 op openbare informatie van de makers; dit kan veranderen. Wistic is niet verbonden aan Medal, Overwolf, NVIDIA, Microsoft, OBS, Valve of AMD. Alle namen zijn merken van hun eigenaren.</p></section>
</div>`;
  return shell(env, { title: 'Wistic vergeleken met Medal, Outplayed en meer', desc: 'Hoe verschilt Wistic van Medal, Outplayed, NVIDIA App, Xbox Game Bar, OBS, Steam en AMD ReLive? Een eerlijke vergelijking.', css: CSS, body }, assets);
}
