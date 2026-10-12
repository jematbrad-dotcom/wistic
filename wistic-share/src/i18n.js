// Automatisch Engels voor bezoekers die geen Nederlands gebruiken.
// - Taalkeuze: ?lang=nl of ?lang=en (wordt onthouden in een cookie), anders de taal van de browser.
//   Staat er ergens nl in de taallijst van de browser, dan blijft het Nederlands. Anders wordt het Engels.
// - Alleen de publieke pagina's worden vertaald (homepage, supportpagina's, clippagina). /admin blijft Nederlands.
// - Nieuwe tekst op de site? Voeg hieronder een regel toe: ['nederlandse tekst', 'English text'].

const PAIRS = [
  // ----- homepage -----
  ['Wistic: geen overlay, alleen clips', 'Wistic: no overlay, just clips'],
  ['Wistic bewaart op de achtergrond de laatste seconden van je game. Druk op F8 en je clip staat klaar. Deel hem met een link.',
   'Wistic quietly saves the last seconds of your game in the background. Press F8 and your clip is ready. Share it with a link.'],
  ['Wistic bewaart op de achtergrond de laatste seconden van je game. Gebeurt er iets goeds? Druk op F8 en de clip staat klaar om te delen.',
   'Wistic quietly saves the last seconds of your game in the background. Something good happen? Press F8 and the clip is ready to share.'],
  ['Download voor Windows', 'Download for Windows'],
  ['Download volgt binnenkort', 'Download coming soon'],
  ['Join onze Discord', 'Join our Discord'],
  ['Zo werkt het', 'How it works'],
  ['Geen overlay. Alleen clips.', 'No overlay. Just clips.'],
  ['>Voor Windows.<', '>For Windows.<'],
  ['Standaard de laatste 60 seconden. Je kiest zelf een lengte van 10 tot 600 seconden.',
   'The last 60 seconds by default. You choose the length yourself, from 10 to 600 seconds.'],
  ['Een tijdlijn van je game. De laatste 60 seconden voor het indrukken van F8 worden een clip.',
   'A timeline of your game. The last 60 seconds before you press F8 become a clip.'],
  ['>laatste 60 seconden<', '>last 60 seconds<'],
  ['>nu<', '>now<'],
  ['>eerder<', '>earlier<'],
  ['>druk op<', '>press<'],
  ['Speel gewoon', 'Just play'],
  ['Wistic draait onopvallend in het systeemvak rechtsonder. Er staat geen overlay in je beeld, alleen een kleine melding als een clip is opgeslagen.',
   'Wistic runs quietly in the system tray at the bottom right. There is no overlay on your screen, just a small notification when a clip has been saved.'],
  ['Druk op <kbd>F8</kbd>', 'Press <kbd>F8</kbd>'],
  ['De laatste 60 seconden worden opgeslagen, met beeld en geluid. De toets en de lengte stel je zelf in.',
   'The last 60 seconds are saved, with video and sound. You set the key and the length yourself.'],
  ['Maak een link', 'Make a link'],
  ['Kies bij de clip voor Link maken en plak de link in Discord. De clip speelt daar meteen af, zonder dat iemand iets hoeft te downloaden.',
   'Choose "Link maken" (create link) on the clip and paste the link into Discord. The clip plays right there, without anyone having to download anything.'],
  ['Wat je er verder mee kunt', 'What else you can do'],
  ['>Bijsnijden<', '>Trim<'],
  ['Sleep de randen en houd alleen het mooiste stuk. Het origineel blijft staan.',
   'Drag the edges and keep only the best part. The original stays untouched.'],
  ['<h3>Alles opnemen</h3>', '<h3>Record everything</h3>'],
  ['Wil je een hele sessie bewaren? Start een lange opname met <kbd>Alt</kbd>+<kbd>F8</kbd>. Wistic stopt vanzelf na 4 uur.',
   'Want to keep a whole session? Start a long recording with <kbd>Alt</kbd>+<kbd>F8</kbd>. Wistic stops by itself after 4 hours.'],
  ['Favorieten in je eigen Google Drive', 'Favorites in your own Google Drive'],
  ['Clips die je favoriet maakt, bewaart Wistic in je eigen Drive. Ze staan dus niet bij ons.',
   'Clips you mark as favorite are stored in your own Drive, so they are not stored with us.'],
  ['Druk op <kbd>F7</kbd> voor een screenshot. Die komt in dezelfde bibliotheek als je clips.',
   'Press <kbd>F7</kbd> for a screenshot. It goes into the same library as your clips.'],
  ['Games herkend', 'Games recognized'],
  ['Wistic zet de naam van de game bij je clip, zodat je alles makkelijk terugvindt.',
   'Wistic adds the name of the game to your clip, so everything is easy to find again.'],
  ['<h2 class="display">Vragen</h2>', '<h2 class="display">Questions</h2>'],
  ['<h2 class="d">Vragen</h2>', '<h2 class="d">Questions</h2>'],
  ['Blijft mijn clip op mijn computer staan?', 'Does my clip stay on my computer?'],
  ["Ja. Elke clip wordt eerst op je eigen pc opgeslagen, in de map Video's/Wistic. Online komt alleen wat jij zelf deelt.",
   'Yes. Every clip is first saved on your own PC, in the Videos/Wistic folder. Only what you choose to share goes online.'],
  ['Hoe lang blijft een link werken?', 'How long does a link keep working?'],
  ['Tot 30 dagen nadat hij voor het laatst is bekeken. Elke keer dat iemand de link opent, begint de teller opnieuw. Drie dagen voordat een link verdwijnt, krijg je een melding in Wistic. Je eigen kopie op je pc blijft altijd staan.',
   'Up to 30 days after it was last viewed. Every time someone opens the link, the counter starts over. Three days before a link disappears, you get a notification in Wistic. Your own copy on your PC always stays.'],
  ['Kan iedereen mijn gedeelde clip zien?', 'Can everyone see my shared clip?'],
  ['Iedereen met de link kan hem bekijken. De link is niet te raden, maar deel hem alleen met mensen die de clip mogen zien. Je kunt een link altijd weer verwijderen.',
   "Anyone with the link can watch it. The link can't be guessed, but only share it with people who are allowed to see the clip. You can always delete a link again."],
  ['Is er een limiet aan delen?', 'Is there a limit to sharing?'],
  ['Een gedeelde clip mag maximaal 90 MB zijn. Wistic maakt hem daarvoor automatisch kleiner, tot 1080p. Je kunt 20 clips tegelijk gedeeld hebben, samen maximaal 500 MB.',
   'A shared clip can be 90 MB at most. Wistic automatically shrinks it for that, to 1080p. You can have 20 clips shared at once, 500 MB in total.'],
  ['Ik heb een bug gevonden of hulp nodig. Wat nu?', 'I found a bug or need help. What now?'],
  ['Open een ticket op de <a href="/support">supportpagina</a>. Je kunt er screenshots en bestanden bij doen, en alleen de maker van Wistic kan het lezen. Je antwoord staat op de ticketpagina die je na het versturen krijgt.',
   'Open a ticket on the <a href="/support">support page</a>. You can add screenshots and files, and only the creator of Wistic can read it. The answer appears on the ticket page you get after sending.'],
  [' Liever chatten? Kom naar onze ', ' Prefer to chat? Come to our '],
  ['Heb ik een account nodig?', 'Do I need an account?'],
  ['Om clips te delen log je in met e-mail of Google. Opnemen en clips bewaren op je eigen pc kan ook als gast.',
   'To share clips you log in with email or Google. Recording and keeping clips on your own PC also works as a guest.'],
  ['Klaar voor je eerste clip?', 'Ready for your first clip?'],
  ['Hulp nodig? Open een ticket', 'Need help? Open a ticket'],
  ['Wistic. Geen overlay, alleen clips.', 'Wistic. No overlay, just clips.'],
  ['Clip opgeslagen', 'Clip saved'],
  ['Standaard opname', 'Default recording'],
  ['Kies je eigen lengte', 'Choose your own length'],
  ['Lange opname', 'Long recording'],
  ['Bij het delen', 'When you share'],

  // ----- supportpagina -----
  ['Een bug gevonden, een vraag of een idee? Open hier een ticket. Alleen de maker van Wistic kan het lezen. Je kunt screenshots en andere bestanden meesturen.',
   'Found a bug, have a question or an idea? Open a ticket here. Only the creator of Wistic can read it. You can include screenshots and other files.'],
  ['Liever even chatten? ', 'Prefer to chat? '],
  ['Kom naar de Discord-server', 'Come to the Discord server'],
  ['Waar gaat het over?', 'What is it about?'],
  ['Bug of probleem', 'Bug or problem'],
  ['>Vraag<', '>Question<'],
  ['Idee of wens', 'Idea or wish'],
  ['>Anders<', '>Other<'],
  ['>Onderwerp<', '>Subject<'],
  ['Kort, bijvoorbeeld: opnemen start niet', "Short, for example: recording won't start"],
  ['Wat is er aan de hand?', "What's going on?"],
  ['Wat deed je, wat verwachtte je en wat gebeurde er? Noem ook je Wistic-versie en Windows-versie.',
   'What did you do, what did you expect and what happened? Please also mention your Wistic version and Windows version.'],
  ['Screenshots of bestanden (optioneel)', 'Screenshots or files (optional)'],
  ['Maximaal 5 bestanden van elk 10 MB', 'At most 5 files of 10 MB each'],
  ['Een grote video? Maak een Wistic-link en plak die in je bericht.', 'A big video? Make a Wistic link and paste it into your message.'],
  ['Naam (optioneel)', 'Name (optional)'],
  ['E-mail (optioneel)', 'Email (optional)'],
  ['Je e-mailadres gebruik ik alleen om je zo nodig te bereiken over dit ticket. Mijn antwoord staat op de ticketpagina die je na het versturen krijgt.',
   'I only use your email address to reach you about this ticket if needed. My answer appears on the ticket page you get after sending.'],
  ['Ticket versturen', 'Send ticket'],
  ['Privacy: je bericht en bijlagen worden alleen gebruikt om je te helpen. Gesloten tickets worden na 90 dagen automatisch gewist.',
   'Privacy: your message and attachments are only used to help you. Closed tickets are automatically deleted after 90 days.'],
  ['Kies maximaal 5 bestanden.', 'Choose at most 5 files.'],
  ['is groter dan 10 MB. Maak van een grote video liever een Wistic-link en plak die in je bericht.',
   'is larger than 10 MB. Better turn a big video into a Wistic link and paste it into your message.'],
  ['is groter dan 10 MB.', 'is larger than 10 MB.'],
  ['Versturen…', 'Sending…'],
  ['Versturen mislukt. Probeer het opnieuw.', 'Sending failed. Please try again.'],
  ['Versturen mislukt. Controleer je internet en probeer het opnieuw.', 'Sending failed. Check your internet connection and try again.'],

  // ----- ticketpagina -----
  ['>Gesloten<', '>Closed<'],
  ['Je ticket is verstuurd.', 'Your ticket has been sent.'],
  ['Bewaar deze pagina (bladwijzer of kopieer de link): mijn antwoord verschijnt hier. Iedereen met deze link kan het ticket lezen, deel hem dus niet.',
   "Save this page (bookmark it or copy the link): my answer will appear here. Anyone with this link can read the ticket, so don't share it."],
  ['Bewaar deze pagina. Mijn antwoord verschijnt hier.', 'Save this page. My answer will appear here.'],
  ['Link kopiëren', 'Copy link'],
  ['Gekopieerd', 'Copied'],
  ['<b>Jij</b>', '<b>You</b>'],
  ['<h2>Reageren</h2>', '<h2>Reply</h2>'],
  ['Typ hier je reactie…', 'Type your reply here…'],
  ['aria-label="Je reactie"', 'aria-label="Your reply"'],
  ['>Versturen<', '>Send<'],
  ['Ticket niet gevonden', 'Ticket not found'],
  ['De link klopt niet, of het ticket is verwijderd.', 'The link is wrong, or the ticket has been deleted.'],
  ['Open een nieuw ticket', 'Open a new ticket'],

  ['Dat lukte niet', 'That did not work'],
  ['Terug naar het formulier', 'Back to the form'],
  ['Terug naar het ticket', 'Back to the ticket'],

  // ----- meldingen van het formulier (JSON) -----
  ['Verzoek geweigerd.', 'Request refused.'],
  ['Je hebt net al meerdere tickets gestuurd. Probeer het over een uur opnieuw.', 'You have just sent several tickets already. Try again in an hour.'],
  ['Vul een onderwerp in.', 'Please enter a subject.'],
  ['Schrijf kort wat er aan de hand is.', 'Briefly describe what is going on.'],
  ['Bijlagen kunnen nu niet worden opgeslagen. Stuur je ticket zonder bijlagen of probeer het later opnieuw.',
   'Attachments cannot be stored right now. Send your ticket without attachments or try again later.'],
  ['Bijlagen kunnen nu niet worden opgeslagen. Probeer het zonder bijlagen.', 'Attachments cannot be stored right now. Try without attachments.'],
  ['Je hebt veel berichten gestuurd. Probeer het later opnieuw.', 'You have sent a lot of messages. Try again later.'],
  ['Schrijf eerst een bericht.', 'Write a message first.'],
  ['Dit is te groot. Stuur minder of kleinere bestanden (samen maximaal 25 MB).', 'This is too large. Send fewer or smaller files (25 MB in total at most).'],
  ['Het formulier kon niet worden gelezen. Probeer het opnieuw.', 'The form could not be read. Please try again.'],
  ['kan niet worden verstuurd. Toegestaan:', 'cannot be sent. Allowed:'],
  ['De bestanden zijn samen te groot (maximaal 25 MB).', 'The files together are too large (25 MB at most).'],

  // ----- clippagina -----
  ['Bekijk deze clip op Wistic', 'Watch this clip on Wistic'],
  ['<span>door <b>', '<span>by <b>'],
  ['>Downloaden<', '>Download<'],
  ['Deze clip verdwijnt 30 dagen nadat hij voor het laatst is bekeken.', 'This clip disappears 30 days after it was last viewed.'],
  ['Clip niet gevonden - Wistic', 'Clip not found - Wistic'],
  ['Deze clip is er niet meer', 'This clip is gone'],
  ['De link klopt niet, of de clip is verwijderd. Clips verdwijnen 30 dagen nadat ze voor het laatst zijn bekeken.',
   'The link is wrong, or the clip has been deleted. Clips disappear 30 days after they were last viewed.'],
].sort((a, b) => b[0].length - a[0].length);

const MONTHS_LONG = { januari: 'January', februari: 'February', maart: 'March', april: 'April', mei: 'May', juni: 'June', juli: 'July', augustus: 'August', september: 'September', oktober: 'October', november: 'November', december: 'December' };
const MONTHS_SHORT = { jan: 'Jan', feb: 'Feb', mrt: 'Mar', apr: 'Apr', mei: 'May', jun: 'Jun', jul: 'Jul', aug: 'Aug', sep: 'Sep', okt: 'Oct', nov: 'Nov', dec: 'Dec' };

export function pickLang(req) {
  const c = (req.headers.get('cookie') || '').match(/(?:^|;\s*)lang=(nl|en)\b/);
  if (c) return c[1];
  const al = (req.headers.get('accept-language') || '').toLowerCase();
  if (!al) return 'en'; // zoekmachines (Googlebot) sturen geen taal mee: toon hun Engels
  return /(^|[,;\s])nl(?![a-z])/.test(al) ? 'nl' : 'en';
}

export function toEnglish(t) {
  for (const [nl, en] of PAIRS) if (t.includes(nl)) t = t.split(nl).join(en);
  t = t.replace(/(\d+) weergaven</g, '$1 views<').replace(/(\d+) weergave</g, '$1 view<');
  t = t.replace(/(\d{1,2}) (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december) (\d{4})/g, (m, d, mo, y) => d + ' ' + MONTHS_LONG[mo] + ' ' + y);
  t = t.replace(/(\d{1,2}) (jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\.?(?= \d{1,2}:\d{2})/g, (m, d, mo) => d + ' ' + MONTHS_SHORT[mo]);
  return t.replace('<html lang="nl"', '<html lang="en"');
}

const SWITCH = (href, label) => `<a href="${href}" rel="nofollow" style="position:fixed;right:14px;bottom:14px;z-index:50;background:#181b1c;border:1px solid #2a2f2d;color:#cdd3c8;font:600 13px system-ui,sans-serif;padding:7px 12px;border-radius:999px;text-decoration:none">${label}</a>`;

// Vertaalt een antwoord van de server als de bezoeker Engels moet zien. Andere antwoorden (video, app-updates, /admin) blijven ongemoeid.
export async function localize(req, res) {
  const path = new URL(req.url).pathname;
  if (path.startsWith('/admin')) return res;
  const ct = res.headers.get('content-type') || '';
  const isHtml = /text\/html/i.test(ct);
  const isSupportJson = /application\/json/i.test(ct) && path.startsWith('/api/support');
  if (!isHtml && !isSupportJson) return res;
  const lang = pickLang(req);
  if (lang === 'nl' && !isHtml) return res;
  let t = await res.text();
  if (lang === 'en') t = toEnglish(t);
  if (isHtml) t = t.replace('</body>', SWITCH(lang === 'en' ? '?lang=nl' : '?lang=en', lang === 'en' ? 'Nederlands' : 'English') + '</body>');
  const h = new Headers(res.headers);
  h.delete('content-length');
  h.set('vary', 'Accept-Language, Cookie');
  return new Response(t, { status: res.status, headers: h });
}
