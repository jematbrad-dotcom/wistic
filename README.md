# Wistic

A lightweight clip recorder for Windows. No overlay, no clutter — just clips.

Wistic lives in your system tray. Press **F8** to save the last moments of gameplay, **F7** for a screenshot, and **Alt+F8** to record until you stop. Any clip can become a link that plays right inside Discord.

*Prototype — work in progress.*

## Features

- **Buffered clips** — capture the last 10–600 seconds, with per-game presets (FiveM, Rust, Minecraft, GTA V, …)
- **Long recordings** — stop whenever you want; auto-stops after 4 hours, 30 GB, or a nearly full disk
- **Smart game detection** — tells your game apart from your browser, launcher, or overlay (OBS and friends are never flagged as a game)
- **Clip editing** — trim, retitle, favorite, and automatic thumbnails
- **Share links** — clips up to 90 MB, auto-scaled to 1080p; play in browsers and Discord; expire 30 days after the last view
- **Per-app audio** — WASAPI loopback capture with an individual volume per app, without changing what you hear
- **Accounts** — sign up or sign in with Google (OAuth 2.0 + PKCE); sessions encrypted with Windows safeStorage
- **Social** — friends, chats, community posts, and earnable roles
- **Support** — built-in tickets with screenshots and attachments
- **11 languages** — Dutch, English, German, French, Spanish, Italian, Portuguese (BR), Polish, Turkish, Russian, Japanese, Simplified Chinese, or Automatic
- **Discord Rich Presence** — "*game* with Wistic" under your name

## Tech

| Part | Stack |
| --- | --- |
| Desktop app | Electron 31 · ffmpeg · C# WASAPI helpers (compiled at first run) |
| Share site | Cloudflare Workers · R2 (clips) · D1 (metadata) |
| Auth | Firebase Authentication (Identity Toolkit REST) |

## Project structure

```
├── main.js          app core: tray, hotkeys, recorder, updater, IPC
├── audiocap.js      C# helper: device loopback capture (WASAPI)
├── audiomix.js      C# helper: per-app capture and mixing
├── auth.js          login: email + Google (PKCE), safeStorage sessions
├── drive.js         favorites backup in your Google Drive (drive.file scope)
├── i18n.js          translation engine (Dutch/English rows)
├── i18n-talen.js    all other languages, same row order
├── index.html       main window UI
├── toast.html       toasts
├── quotes.js        loading-screen quotes
├── test-logos.js    dev tool: checks game logos against Discord's app list
└── wistic-share/    the link-sharing website (Cloudflare Worker)
```

## Development

```
npm install
npm run setup   # fetch Electron + ffmpeg binaries
npm start
```

The real `firebase-config.js` and `wrangler.toml` are gitignored (they hold your credentials). Create them from the templates before running:

```
cp firebase-config.example.js firebase-config.js
cp wistic-share/wrangler.example.toml wistic-share/wrangler.toml
```

Build an installer: `npm run dist` → `dist/Wistic-Setup-<version>.exe`

## Configuration

| File | Purpose |
| --- | --- |
| `firebase-config.js` | Firebase project + Google OAuth credentials |
| `share-config.js` | base URL of your Wistic Share instance |
| `discord-config.js` | Discord application ID (Rich Presence) |

## Privacy & security

- Clips are recorded locally; your library stays on your PC unless you share a link
- Sessions live in `%AppData%\Blips` and are encrypted with Windows safeStorage when available
- Anyone with a share link can view a clip (8 random characters) — treat links as public
- Only signed-in users can upload; you can only delete your own clips

## License

MIT
