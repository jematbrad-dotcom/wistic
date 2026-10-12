// Taalkiezer voor Wistic (Nederlands / English). Werkt in het hoofdproces (require) én in het venster (<script src="i18n.js">).
// Elke regel hieronder is [nederlands, engels]. {0}, {1} = stukjes tekst die variabel zijn (getallen, namen).
// Vertalen werkt in beide richtingen: ook de teksten die in de code al Engels waren, krijgen dus een Nederlandse versie.
// Extra talen (Duits, Frans, ...) staan in i18n-talen.js: per taal een lijst in dezelfde volgorde als de regels hieronder.
// Een nieuwe taal toevoegen: zet hem in META (met vlag-code) en voeg in i18n-talen.js een lijst toe; ontbreekt een regel, dan blijft die English.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./i18n-talen'));
  else root.I18N = factory(root.I18N_TALEN || {});
})(typeof self !== 'undefined' ? self : this, function (X) {
  const P = [
    // ---- algemeen / navigatie ----
    ['Bibliotheek', 'Library'],
    ['Favorieten', 'Favorites'],
    ['Instellingen', 'Settings'],
    ['Opslag', 'Storage'],
    ['Beheer opslag', 'Manage storage'],
    ['{0} GB van {1} GB', '{0} GB of {1} GB'],
    ['Leg het moment vast.', 'Capture the moment.'],
    ['Clip nu opslaan', 'Save clip now'],
    ['Opname starten / stoppen', 'Start / stop recording'],
    ['Test geluid', 'Test sound'],
    ['Prestaties', 'Performance'],
    ['Profiel / instellingen', 'Profile / settings'],
    ['Meer', 'More'],
    ['Sluiten', 'Close'],
    ['Annuleren', 'Cancel'],
    ['Opslaan', 'Save'],
    ['Opgeslagen', 'Saved'],
    ['Verwijderen', 'Delete'],
    ['Verwijderen', 'Remove'],
    ['Bezig…', 'Working…'],
    ['Laden…', 'Loading…'],
    ['Geen', 'None'],
    ['Wijzigen', 'Change'],
    ['Verbinden', 'Connect'],
    ['Verbonden', 'Connected'],
    ['in Drive', 'in Drive'],
    ['uploaden', 'uploading'],
    ['Vernieuwen', 'Refresh'],
    ['Map openen', 'Open folder'],

    // ---- opnemen (kop + chips) ----
    ['Opname', 'Recording'],
    ['Opname starten', 'Start recording'],
    ['Opname stoppen', 'Stop recording'],
    ['Opslaan…', 'Saving…'],
    ['Opname opslaan…', 'Saving recording…'],
    ['Clip opslaan', 'Save clip'],
    ['Opname klaar', 'Ready to record'],
    ['Wachten op game…', 'Waiting for game…'],
    ['Opnemen: {0}', 'Recording: {0}'],

    // ---- home ----
    ['GOEDE NACHT', 'GOOD NIGHT'],
    ['GOEDEMORGEN', 'GOOD MORNING'],
    ['GOEDEMIDDAG', 'GOOD AFTERNOON'],
    ['GOEDENAVOND', 'GOOD EVENING'],
    ['Al je gaming-momenten, op één plek.', 'All your gaming moments, in one place.'],
    ['LAATSTE CLIP', 'LATEST CLIP'],
    ['RECENTE CLIPS', 'RECENT CLIPS'],
    ['Alles bekijken →', 'View all →'],
    ['JOUW GAMES', 'YOUR GAMES'],
    ['Nog geen clips', 'No clips yet'],
    ['Start een game en druk op {0}.', 'Start a game and press {0}.'],
    ['{0} DAG CAPTURE STREAK', '{0} DAY CAPTURE STREAK'],
    ['{0} DAGEN CAPTURE STREAK', '{0} DAYS CAPTURE STREAK'],
    ['Snelle acties', 'Quick actions'],
    ['Populaire games', 'Popular games'],
    ['Alles ›', 'All ›'],
    ['Nog geen games. Pak je eerste clip!', 'No games yet. Grab your first clip!'],
    ['Clip-activiteit', 'Clip activity'],
    ['Nog niets opgeslagen.', 'Nothing saved yet.'],
    ['Clip opgeslagen!', 'Clip saved!'],
    ['Screenshot opgeslagen!', 'Screenshot saved!'],
    ['zojuist', 'just now'],
    ['{0} min geleden', '{0} min ago'],
    ['{0} uur geleden', '{0} h ago'],
    ['{0} dagen geleden', '{0} days ago'],
    ['Vandaag', 'Today'],
    ['Gisteren', 'Yesterday'],

    // ---- bibliotheek / clips ----
    ['Al je clips en screenshots.', 'All your clips and screenshots.'],
    ['Je opgenomen clips.', 'Your recorded clips.'],
    ['Je favorieten worden nooit automatisch verwijderd.', 'Your favorites are never deleted automatically.'],
    ['Je favorieten staan ook in je Google Drive ({0} in Drive).', 'Your favorites are also in your Google Drive ({0} in Drive).'],
    ['Log in met Google om je favorieten in je Drive te bewaren en op andere apparaten te zien.', 'Sign in with Google to keep your favorites in your Drive and see them on other devices.'],
    ['Zoeken…', 'Search…'],
    ['Alle games', 'All games'],
    ['Nieuwste', 'Newest'],
    ['Oudste', 'Oldest'],
    ['Grootste', 'Largest'],
    ['Nog geen clips. Start je game en druk op je sneltoets.', 'No clips yet. Start your game and press your hotkey.'],
    ['Staat ook in Google Drive', 'Also in Google Drive'],
    ['Alleen in Google Drive', 'Only in Google Drive'],
    ['Alleen in Drive', 'Only in Drive'],
    ['Alleen in je Google Drive · {0} MB', 'Only in your Google Drive · {0} MB'],
    ['Downloaden naar deze pc', 'Download to this PC'],
    ['Uit Drive verwijderen', 'Delete from Drive'],
    ['Downloaden… {0}%', 'Downloading… {0}%'],
    ['Verwijderen uit je Google Drive? Dit kan niet ongedaan worden gemaakt.', 'Delete from your Google Drive? This cannot be undone.'],
    ['Verwijderen uit je Google Drive? Het bestand op deze pc blijft staan.', 'Delete from your Google Drive? The file on this PC stays.'],
    ['Deze clip definitief verwijderen?', 'Delete this clip permanently?'],
    ['Dit definitief verwijderen?', 'Delete this permanently?'],
    ['De link werkt dan niet meer. Doorgaan?', 'The link will stop working. Continue?'],
    ['Naam wijzigen', 'Rename'],
    ['Geef je clip een mooie naam.', 'Give your clip a nice name.'],
    ['Bijsnijden', 'Trim'],
    ['Geen favoriet meer', 'Remove favorite'],
    ['Favoriet', 'Favorite'],
    ['Link kopiëren', 'Copy link'],
    ['Link maken', 'Create link'],
    ['Link verwijderen', 'Remove link'],
    ['Bijsnijden en exporteren', 'Trim & export'],
    ['Einde', 'End'],
    ['Lengte', 'Length'],
    ['Staat ook in je Google Drive', 'Also stored in your Google Drive'],

    // ---- speler ----
    ['Afspelen / pauzeren (spatie)', 'Play / pause (space)'],
    ['Geluid (m)', 'Sound (m)'],
    ['Volledig scherm (f)', 'Fullscreen (f)'],
    ['Bijsnijden en opslaan', 'Trim and save'],
    ['Selectie herstellen', 'Reset selection'],
    ['TITEL', 'TITLE'],
    ['Bijsnijden maakt een nieuwe clip; het origineel blijft staan.', 'Trimming creates a new clip; the original stays.'],
    ['Spatie = pauze · M = geluid · F = volledig scherm · ← → = andere clip', 'Space = pause · M = sound · F = fullscreen · ← → = other clip'],
    ['Kies een stuk van minstens 0,3 seconden.', 'Pick a section of at least 0.3 seconds.'],
    ['Sleep eerst de witte randen om een stuk te kiezen.', 'First drag the white edges to select a section.'],
    ['Bijsnijden… dit kan even duren.', 'Trimming… this may take a moment.'],
    ['Bijsnijden mislukt.', 'Trimming failed.'],
    ['Link maken… dit kan even duren.', 'Creating link… this may take a moment.'],
    ['Link gekopieerd', 'Link copied'],
    ['Delen mislukt.', 'Sharing failed.'],

    // ---- clip-lengte ----
    ['Clip-lengte', 'Clip length'],
    ['Eigen (sec)', 'Custom (sec)'],
    ['Kies tussen 10 en 600 seconden. Geldt voor alle games. De opnamebuffer start opnieuw.', 'Choose between 10 and 600 seconds. Applies to all games. The recording buffer restarts.'],

    // ---- inloggen / profiel ----
    ['Geen overlay. Geen afleiding. Alleen clips.', 'No overlay. No distractions. Just clips.'],
    ['Gebruikersnaam', 'Username'],
    ['E-mailadres', 'Email address'],
    ['Wachtwoord (min. 6 tekens)', 'Password (min. 6 characters)'],
    ['of', 'or'],
    ['Doorgaan met Google', 'Continue with Google'],
    ['Wachtwoord vergeten?', 'Forgot password?'],
    ['Doorgaan als gast', 'Continue as guest'],
    ['Welkom bij Wistic', 'Welcome to Wistic'],
    ['Account maken', 'Create account'],
    ['Inloggen', 'Sign in'],
    ['Heb je al een account? Inloggen', 'Already have an account? Sign in'],
    ['Nog geen account? Maak er een', "Don't have an account? Create one"],
    ['Vul e-mail en wachtwoord in.', 'Enter your email and password.'],
    ['Kies een gebruikersnaam.', 'Choose a username.'],
    ['Vul eerst je e-mailadres in.', 'Enter your email address first.'],
    ['Reset-mail verstuurd (check ook je spam).', 'Reset email sent (check your spam too).'],
    ['Log in bij Google in je browser…', 'Sign in to Google in your browser…'],
    ['Maak je profiel', 'Create your profile'],
    ['Profiel bewerken', 'Edit profile'],
    ['Kies een gebruikersnaam en eventueel een andere profielfoto.', 'Choose a username and optionally a different profile photo.'],
    ['Pas je gebruikersnaam en foto aan.', 'Change your username and photo.'],
    ['Foto kiezen', 'Choose photo'],
    ['Foto verwijderen', 'Remove photo'],
    ['Later', 'Later'],
    ['Dit bestand is geen geldige afbeelding.', 'This file is not a valid image.'],
    ['Gebruikersnaam: minimaal 2 tekens.', 'Username: at least 2 characters.'],

    // ---- instellingen ----
    ['Taal', 'Language'],
    ['Taal van de app', 'App language'],
    ['Automatisch', 'Automatic'],
    ['Profiel', 'Profile'],
    ['Ingelogd als', 'Signed in as'],
    ['Uitloggen', 'Sign out'],
    ['Favorieten in Drive', 'Favorites in Drive'],
    ['Automatisch uploaden', 'Automatic upload'],
    ['favorieten direct uploaden', 'upload favorites immediately'],
    ['Nu synchroniseren', 'Sync now'],
    ['Synchroniseren…', 'Syncing…'],
    ['Niet verbonden. Log in met Google om te verbinden.', 'Not connected. Sign in with Google to connect.'],
    ['Scherm om op te nemen', 'Screen to record'],
    ['Terugspeelbuffer (sec)', 'Replay buffer (sec)'],
    ['Microfoon', 'Microphone'],
    ['Microfoon volume', 'Microphone volume'],
    ['Headset / game-geluid', 'Headset / game audio'],
    ['Game volume', 'Game volume'],
    ['Kies hier je headset (uitvoer): alles wat die headset afspeelt (game, Discord, muziek) komt in de clip. Kies ook je microfoon om jezelf mee op te nemen.', 'Choose your headset (output) here: everything it plays (game, Discord, music) ends up in the clip. Also pick your microphone to record yourself.'],
    ['Geen microfoon gevonden', 'No microphone found'],
    ['Geen systeem-audio gevonden', 'No system audio found'],
    ['Standaard uitvoer van Windows', 'Windows default output'],
    ['Alle schermen (hele bureaublad)', 'All screens (whole desktop)'],
    ['Scherm {0} — {1}', 'Screen {0} — {1}'],
    ['{0} (hoofdscherm)', '{0} (primary)'],
    ['Sneltoetsen', 'Hotkeys'],
    ['Lange opname', 'Long recording'],
    ['Geluiden', 'Sounds'],
    ['Geluid bij opgeslagen clip', 'Clip saved sound'],
    ['Eigen geluid', 'Custom sound'],
    ['Kies bestand…', 'Choose file…'],
    ['Geen bestand gekozen (mp3, wav, m4a, wma). Als het bestand verwijderd of verplaatst wordt, verdwijnt het geluid.', 'No file chosen (mp3, wav, m4a, wma). If the file is deleted or moved, the sound is removed.'],
    ['Clipmap', 'Clip folder'],
    ['Game-detectie', 'Game detection'],
    ['Games automatisch herkennen', 'Auto-detect games'],
    ['Elke game herkennen (aanbevolen)', 'Detect any game (recommended)'],
    ['Wistic starten met Windows', 'Start Wistic with Windows'],
    ['Bekende games krijgen eigen instellingen. Met <b>Elke game herkennen</b> pakt Wistic ook alle andere games automatisch op.', 'Known games get their own settings. With <b>Detect any game</b>, Wistic also picks up all other games automatically.'],
    ['Wat Wistic zelf op dit moment gebruikt. Sluit dit venster om het te verlagen; de opname blijft draaien in het systeemvak.', 'What Wistic itself uses right now. Close this window to lower it; recording keeps running in the tray.'],
    ['Nu meten', 'Measure now'],
    ['Meten…', 'Measuring…'],
    ['Appvenster: {0}', 'App window: {0}'],
    ['Recorder (ffmpeg): {0}', 'Recorder (ffmpeg): {0}'],
    ['buffer uit', 'buffer off'],
    ['Nieuwe versie {0} staat klaar', 'New version {0} is ready'],
    ['Nu updaten', 'Update now'],

    // ---- meldingen (toast / systeem) ----
    ['Clip opgeslagen', 'Clip saved'],
    ['Clip opslaan mislukt', 'Saving clip failed'],
    ['Check ffmpeg-log.txt in AppData', 'Check ffmpeg-log.txt in AppData'],
    ['Screenshot opgeslagen', 'Screenshot saved'],
    ['Opname starten mislukt', 'Starting recording failed'],
    ['Opname gestart', 'Recording started'],
    ['{0} · stoppen met {1}', '{0} · stop with {1}'],
    ['Opname opgeslagen', 'Recording saved'],
    ['Opname opslaan mislukt', 'Saving recording failed'],
    ['Niets opgenomen', 'Nothing recorded'],
    ['Probeer het opnieuw', 'Try again'],
    ['Plak hem waar je wilt', 'Paste it wherever you like'],
    ['Link maken…', 'Creating link…'],
    ['{0} · klaarmaken', '{0} · preparing'],
    ['{0} · uploaden', '{0} · uploading'],
    ['{0} · plak hem in Discord of waar je wilt', '{0} · paste it in Discord or wherever you like'],
    ['Link maken mislukt', 'Creating link failed'],
    ['Bijsnijden mislukt', 'Trimming failed'],
    ['Bijgesneden clip opgeslagen', 'Trimmed clip saved'],
    ['bijgesneden', 'trimmed'],
    ['Headset-audio kon niet gestart worden. Opname gaat verder zonder game-geluid.', 'Headset audio could not be started. Recording continues without game audio.'],
    ['Buffer is niet actief. Start een game of zet mode op Always.', 'Buffer is not active. Start a game or set mode to Always.'],
    ['Versie {0} staat klaar. Open Wistic en klik op Nu updaten.', 'Version {0} is ready. Open Wistic and click Update now.'],
    ['Je clip-link "{0}" verdwijnt binnen 3 dagen. Open de link om hem 30 dagen langer te bewaren.', 'Your clip link "{0}" disappears within 3 days. Open the link to keep it 30 days longer.'],
    ['{0} clip-links verdwijnen binnen 3 dagen. Open ze om ze 30 dagen langer te bewaren.', '{0} clip links disappear within 3 days. Open them to keep them 30 days longer.'],
    ['Kies een geluid', 'Choose a sound'],
    ['Open Wistic', 'Open Wistic'],
    ['Afsluiten', 'Quit'],
    ['Wistic — buffer actief', 'Wistic — buffer active'],
    ['Wistic — buffer actief ({0})', 'Wistic — buffer active ({0})'],
    ['Wistic — gepauzeerd', 'Wistic — paused'],
    ['Wistic — OPNAME bezig', 'Wistic — RECORDING'],

    // ---- foutmeldingen (inloggen, Drive, delen) ----
    ['Er bestaat al een account met dit e-mailadres.', 'An account with this email address already exists.'],
    ['Dit e-mailadres is ongeldig.', 'This email address is invalid.'],
    ['Vul een wachtwoord in.', 'Enter a password.'],
    ['Wachtwoord te zwak: minimaal 6 tekens.', 'Password too weak: at least 6 characters.'],
    ['Verkeerd e-mailadres of wachtwoord.', 'Wrong email address or password.'],
    ['Dit account is uitgeschakeld.', 'This account has been disabled.'],
    ['Te veel pogingen. Probeer het later opnieuw.', 'Too many attempts. Try again later.'],
    ['Deze inlogmethode staat uit in je Firebase-project (Authentication > Sign-in method).', 'This sign-in method is turned off in your Firebase project (Authentication > Sign-in method).'],
    ['Google-login mislukt. Probeer het opnieuw.', 'Google sign-in failed. Try again.'],
    ['Firebase API-key klopt niet (zie firebase-config.js).', 'Firebase API key is incorrect (see firebase-config.js).'],
    ['Firebase is nog niet ingesteld (zie firebase-config.js).', 'Firebase is not set up yet (see firebase-config.js).'],
    ['Geen internetverbinding.', 'No internet connection.'],
    ['Er ging iets mis ({0}).', 'Something went wrong ({0}).'],
    ['Inloggen met Google geannuleerd.', 'Google sign-in cancelled.'],
    ['Kon lokale login-server niet starten.', 'Could not start the local sign-in server.'],
    ['Google-login duurde te lang. Probeer het opnieuw.', 'Google sign-in took too long. Try again.'],
    ['Google-login is nog niet ingesteld (zie firebase-config.js).', 'Google sign-in is not set up yet (see firebase-config.js).'],
    ['Google-login mislukt ({0}).', 'Google sign-in failed ({0}).'],
    ['Niet ingelogd.', 'Not signed in.'],
    ['Sessie verlopen.', 'Session expired.'],
    ['Sessie verlopen. Log opnieuw in bij Wistic.', 'Session expired. Sign in to Wistic again.'],
    ['Log eerst in bij Wistic om clips te delen.', 'Sign in to Wistic first to share clips.'],
    ['Google Drive: log opnieuw in met Google.', 'Google Drive: sign in with Google again.'],
    ['Google Drive is niet verbonden.', 'Google Drive is not connected.'],
    ['Zet de Google Drive API aan in Google Cloud (APIs & Services > Library).', 'Turn on the Google Drive API in Google Cloud (APIs & Services > Library).'],
    ['Je Google Drive zit vol.', 'Your Google Drive is full.'],
    ['Google Drive-fout ({0}).', 'Google Drive error ({0}).'],
    ['Google Drive: upload kon niet starten.', 'Google Drive: upload could not start.'],
    ['Google Drive-upload mislukt ({0}).', 'Google Drive upload failed ({0}).'],
    ['Delen is nog niet ingesteld (zie share-config.js).', 'Sharing is not set up yet (see share-config.js).'],
    ["Alleen video's kunnen worden gedeeld.", 'Only videos can be shared.'],
    ["Alleen video's kunnen worden bijgesneden.", 'Only videos can be trimmed.'],
    ['Clip niet gevonden.', 'Clip not found.'],
    ['Er wordt al een clip gedeeld. Even wachten.', 'A clip is already being shared. Please wait.'],
    ['Klaarmaken voor delen mislukt.', 'Preparing to share failed.'],
    ['Deze clip is te groot om te delen (max 90 MB). Snij hem bij.', 'This clip is too large to share (max 90 MB). Trim it first.'],
    ['Ingelogd bij Wistic', 'Signed in to Wistic'],
    ['Je kunt dit tabblad sluiten en terug naar de app gaan.', 'You can close this tab and go back to the app.'],
    ['Inloggen mislukt', 'Sign-in failed'],
    ['Ga terug naar Wistic en probeer het opnieuw.', 'Go back to Wistic and try again.'],
    // ---- vrienden, chats en rollen ----
    ["Vrienden", "Friends"],
    ["Chats", "Chats"],
    ["Rollen", "Roles"],
    ["Eigenaar", "Owner"],
    ["Admin", "Admin"],
    ["Moderator", "Moderator"],
    ["VIP", "VIP"],
    ["Groepseigenaar", "Group owner"],
    ["Log in om verder te gaan", "Log in to continue"],
    ["Vrienden en chats werken met je Wistic-account. Opnemen en clips bewaren kan ook als gast.", "Friends and chats use your Wistic account. Recording and saving clips also works as a guest."],
    ["Voeg vrienden toe op gebruikersnaam en chat met ze.", "Add friends by username and chat with them."],
    ["Vriend toevoegen", "Add friend"],
    ["Zoek op gebruikersnaam…", "Search by username…"],
    ["Verzoek sturen", "Send request"],
    ["Verstuurd", "Sent"],
    ["Toevoegen", "Add"],
    ["Accepteren", "Accept"],
    ["Weigeren", "Decline"],
    ["Verzoeken", "Requests"],
    ["Geblokkeerd", "Blocked"],
    ["Deblokkeren", "Unblock"],
    ["Blokkeren", "Block"],
    ["Chat", "Chat"],
    ["Niemand gevonden.", "Nobody found."],
    ["Typ de gebruikersnaam van je vriend.", "Type your friend's username."],
    ["Nog geen vrienden", "No friends yet"],
    ["Zoek hierboven op gebruikersnaam en stuur een verzoek.", "Search by username above and send a request."],
    ["Verzoek verstuurd naar {0}.", "Request sent to {0}."],
    ["Je bent nu vrienden met {0}!", "You are now friends with {0}!"],
    ["Verwijderen uit je vriendenlijst?", "Remove from your friends list?"],
    ["Blokkeren?", "Block?"],
    ["Jullie zijn dan geen vrienden meer en deze persoon kan je niet meer vinden.", "You will no longer be friends and this person can no longer find you."],
    ["Groep verlaten?", "Leave group?"],
    ["Groep voor iedereen verwijderen? Dit kan niet ongedaan worden gemaakt.", "Delete the group for everyone? This cannot be undone."],
    ["+ Nieuwe groep", "+ New group"],
    ["Kies een chat", "Choose a chat"],
    ["Klik links op een gesprek.", "Click a conversation on the left."],
    ["Je hebt nog geen chats. Ga naar Vrienden en klik op Chat, of maak een groep.", "You have no chats yet. Go to Friends and click Chat, or create a group."],
    ["Nog geen chats.", "No chats yet."],
    ["{0} leden", "{0} members"],
    ["Chat niet beschikbaar", "Chat unavailable"],
    ["Nog geen berichten. Zeg hallo!", "No messages yet. Say hello!"],
    ["Gesprek", "Conversation"],
    ["Leden", "Members"],
    ["Typ een bericht…", "Type a message…"],
    ["Verstuur", "Send"],
    ["Clip delen", "Share clip"],
    ["Kies een clip die al online staat.", "Choose a clip that is already online."],
    ["Je hebt nog geen clips online. Klik bij een clip op Link maken, daarna kun je hem hier delen.", "You have no clips online yet. Click Create link on a clip, then you can share it here."],
    ["Nieuwe groepschat", "New group chat"],
    ["Naam van de groep", "Group name"],
    ["Kies de vrienden die erbij komen:", "Choose the friends to add:"],
    ["Maak groep", "Create group"],
    ["Je hebt nog geen vrienden. Voeg eerst vrienden toe op het tabblad Vrienden.", "You have no friends yet. Add friends first on the Friends tab."],
    ["Naam wijzigen", "Rename"],
    ["Groep verlaten", "Leave group"],
    ["Groep verwijderen", "Delete group"],
    ["Clip niet meer online", "Clip no longer online"],
    ["Jij bent de eigenaar. Geef anderen een rol; die staat als label bij hun naam.", "You are the owner. Give others a role; it shows as a label next to their name."],
    ["Rol geven", "Give role"],
    ["Geen rol", "No role"],
    ["Wat mag welke rol?", "What can each role do?"],
    ["Alles, en alleen jij kunt rollen uitdelen.", "Everything, and only you can hand out roles."],
    ["Berichten van anderen verwijderen in elke chat en groepen verwijderen.", "Delete others' messages in any chat and delete groups."],
    ["Berichten van anderen verwijderen in elke chat.", "Delete others' messages in any chat."],
    ["Alleen een label bij de naam.", "Just a label next to the name."],
    ["Nog niemand. Geef hierboven iemand een rol.", "Nobody yet. Give someone a role above."],
    ["Mensen met een rol", "People with a role"],
    ["Alleen de eigenaar van Wistic kan rollen uitdelen.", "Only the owner of Wistic can hand out roles."],
    ["Typ een gebruikersnaam.", "Type a username."],
    ["{0} is nu {1}.", "{0} is now {1}."],
    ["{0} heeft geen rol meer.", "{0} no longer has a role."],
    ["Kies eerst een gebruikersnaam (Instellingen > Profiel bewerken).", "Choose a username first (Settings > Edit profile)."],
    ["Geen gebruiker met die naam gevonden.", "No user found with that name."],
    ["Je kunt jezelf niet toevoegen.", "You can't add yourself."],
    ["Je kunt deze gebruiker niet toevoegen.", "You can't add this user."],
    ["Jullie zijn al vrienden.", "You are already friends."],
    ["Je hebt al een verzoek gestuurd.", "You already sent a request."],
    ["Dit verzoek bestaat niet meer.", "This request no longer exists."],
    ["Kies minstens één vriend.", "Choose at least one friend."],
    ["Geef de groep een naam (minstens 2 tekens).", "Give the group a name (at least 2 characters)."],
    ["Je kunt alleen vrienden toevoegen.", "You can only add friends."],
    ["Chat niet gevonden.", "Chat not found."],
    ["Rustig aan, je verstuurt te snel.", "Slow down, you're sending too fast."],
    ["Typ eerst een bericht.", "Type a message first."],
    ["Die clip staat niet online. Maak eerst een link bij de clip.", "That clip is not online. Create a link for the clip first."],
    ["Je mag dit bericht niet verwijderen.", "You can't delete this message."],
    ["Bericht niet gevonden.", "Message not found."],
    ["Alleen de eigenaar van de groep kan leden toevoegen.", "Only the group owner can add members."],
    ["Alleen de eigenaar van de groep kan leden verwijderen.", "Only the group owner can remove members."],
    ["Alleen de eigenaar van de groep kan de naam wijzigen.", "Only the group owner can rename the group."],
    ["Alleen de eigenaar van de groep kan hem verwijderen.", "Only the group owner can delete it."],
    ["Deze vriend zit al in de groep.", "This friend is already in the group."],
    ["Je kunt in dit gesprek geen berichten sturen.", "You can't send messages in this conversation."],
    ["Alleen de eigenaar mag rollen beheren.", "Only the owner can manage roles."],
    ["Onbekende rol.", "Unknown role."],
    ["Je bent zelf de eigenaar; die rol kun je niet wijzigen.", "You are the owner yourself; you can't change that role."],
    ["Log eerst in bij Wistic.", "Log in to Wistic first."],
    ["Ongeldig verzoek.", "Invalid request."],
    // ---- geluid per app ----
    ["🎚️ Geluid per app", "🎚️ Sound per app"],
    ["Per app instellen", "Set per app"],
    ["Wistic ziet welke apps geluid maken (game, Discord, muziek…). Sleep een schuif om te bepalen hoe hard die app in je clip staat. Dit verandert niet wat je zelf hoort. Zet het aan en klik op Opslaan; daarna werken de schuiven direct. Dan worden alleen apps opgenomen, geen Windows-systeemgeluiden.",
     "Wistic sees which apps make sound (game, Discord, music…). Drag a slider to set how loud that app is in your clip. This does not change what you hear yourself. Turn it on and click Save; after that the sliders work instantly. Only apps are recorded then, not Windows system sounds."],
    ["Apps zoeken…", "Looking for apps…"],
    ["Nog geen apps gevonden. Start een game of speel muziek af.", "No apps found yet. Start a game or play some music."],
    ["Geluid per app wordt niet ondersteund op deze pc. Wistic neemt het totale headset-geluid op.", "Sound per app is not supported on this PC. Wistic records the full headset sound instead."]
  ];

  // ---------- talen ----------
  // c = taalcode, n = naam in de eigen taal, l = locale (datums/tijden), f = vlag (zie FLAGS in index.html)
  const META = {
    nl: { n: 'Nederlands', l: 'nl-NL', f: 'nl' },
    en: { n: 'English', l: 'en-GB', f: 'gb' },
    de: { n: 'Deutsch', l: 'de-DE', f: 'de' },
    fr: { n: 'Français', l: 'fr-FR', f: 'fr' },
    es: { n: 'Español', l: 'es-ES', f: 'es' },
    it: { n: 'Italiano', l: 'it-IT', f: 'it' },
    pt: { n: 'Português (Brasil)', l: 'pt-BR', f: 'br' },
    pl: { n: 'Polski', l: 'pl-PL', f: 'pl' },
    tr: { n: 'Türkçe', l: 'tr-TR', f: 'tr' },
    ru: { n: 'Русский', l: 'ru-RU', f: 'ru' },
    ja: { n: '日本語', l: 'ja-JP', f: 'jp' },
    zh: { n: '简体中文', l: 'zh-CN', f: 'cn' }
  };
  const LANGS = Object.keys(META);   // 'nl' en 'en' staan voorop: de teksten in de code zijn Nederlands of Engels
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile(s) {
    const names = []; let src = '';
    s.split(/(\{\d+\})/).forEach(p => { const m = /^\{(\d+)\}$/.exec(p); if (m) { names.push(+m[1]); src += '([\\s\\S]*?)'; } else src += esc(p); });
    return { re: new RegExp('^' + src + '$'), names };
  }
  const fill = (tpl, vals) => tpl.replace(/\{(\d+)\}/g, (_, i) => (vals[i] == null ? '' : vals[i]));

  // Elke regel: e[taal] voor alle talen. Zoeken kan vanuit elke taal (ook uit een al vertaald scherm), dus alles gaat in de tabellen.
  const exact = new Map(), dyn = [];
  P.forEach(([nl, en], i) => {
    const e = { nl, en };
    LANGS.forEach(L => { if (L !== 'nl' && L !== 'en') e[L] = (X[L] && X[L][i]) || en; });
    if (/\{\d+\}/.test(nl + en)) {
      e.c = {}; LANGS.forEach(L => { e.c[L] = compile(e[L]); });
      e.len = nl.replace(/\{\d+\}/g, '').length + en.replace(/\{\d+\}/g, '').length; dyn.push(e);
    } else LANGS.forEach(L => { if (!exact.has(e[L])) exact.set(e[L], e); });
  });
  dyn.sort((a, b) => b.len - a.len);

  let cur = 'nl';
  const cache = new Map();

  function lookup(s, lang, depth) {
    const e = exact.get(s);
    if (e) return e[lang];
    for (const d of dyn) {
      for (const side of LANGS) {
        const m = d.c[side].re.exec(s);
        if (!m) continue;
        const vals = {};
        d.c[side].names.forEach((n, i) => {
          const v = m[i + 1];
          const r = depth < 2 ? lookup(v, lang, depth + 1) : null;
          vals[n] = r == null ? v : r;
        });
        return fill(d[lang], vals);
      }
    }
    return null;
  }

  // Emoji/symbolen vooraan (✂ ★ ☁ 🗑 …) en vinkjes achteraan (✓ ●) blijven staan; alleen de woorden worden vertaald.
  const PRE = /^[\s\u2190-\u2BFF\u2013\u2014\u2022\u00B7\uFE0F\u{1F000}-\u{1FFFF}]+/u;
  const SUF = /[\s\u2713\u25CF\u2022\u25B6\uFE0F]+$/u;

  function T(s, lang) {
    if (typeof s !== 'string' || !s) return s;
    lang = lang || cur;
    const key = lang + '\u0000' + s;
    if (cache.has(key)) return cache.get(key);
    let r = lookup(s, lang, 0);
    if (r == null) {
      const pm = PRE.exec(s), sm = SUF.exec(s);
      const a = pm ? pm[0].length : 0, b = sm ? s.length - sm[0].length : s.length;
      if (b > a && (a > 0 || b < s.length)) {
        const rr = lookup(s.slice(a, b), lang, 0);
        if (rr != null) r = s.slice(0, a) + rr + s.slice(b);
      }
    }
    if (r == null) r = s;
    if (cache.size > 4000) cache.clear();
    cache.set(key, r);
    return r;
  }

  // 'auto' = taal van Windows/de browser (als wij die hebben), anders English
  function resolve(pref, locale) {
    if (LANGS.includes(pref)) return pref;
    const c = String(locale || '').toLowerCase().slice(0, 2);
    return LANGS.includes(c) ? c : 'en';
  }
  function set(pref, locale) { cur = resolve(pref, locale); I.lang = cur; return cur; }
  function locale() { const n = typeof navigator !== 'undefined' ? navigator.language || '' : ''; return cur === 'en' ? (/^en/i.test(n) ? n : 'en-GB') : META[cur].l; }

  // ---------- DOM (alleen in het venster) ----------
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, VIDEO: 1, CANVAS: 1 };
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  let obs = null;

  function textNode(n) {
    const p = n.parentNode;
    if (!p || SKIP[p.nodeName]) return;
    const v = n.nodeValue; if (!v || !/\S/.test(v)) return;
    const r = T(v); if (r !== v) n.nodeValue = r;
  }
  function attrs(el) {
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v) { const r = T(v); if (r !== v) el.setAttribute(a, r); } }
  }
  function tree(root) {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    if (SKIP[root.nodeName]) return;
    attrs(root);
    root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(attrs);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) textNode(n);
  }
  function start() {
    if (obs || typeof MutationObserver === 'undefined') return;
    const cfg = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };
    obs = new MutationObserver(muts => {
      obs.disconnect();
      try {
        for (const m of muts) {
          if (m.type === 'childList') m.addedNodes.forEach(tree);
          else if (m.type === 'characterData') textNode(m.target);
          else if (m.type === 'attributes') attrs(m.target);
        }
      } finally { obs.observe(document.documentElement, cfg); }
    });
    tree(document.body);
    obs.observe(document.documentElement, cfg);
    document.documentElement.lang = cur;
  }
  function retranslate(root) {
    cache.clear();
    if (obs) obs.disconnect();
    tree(root || document.body);
    if (obs) obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    if (typeof document !== 'undefined') document.documentElement.lang = cur;
  }

  const I = { lang: cur, LANGS, META, T, set, resolve, locale, start, retranslate, _pairs: P };
  return I;
});
