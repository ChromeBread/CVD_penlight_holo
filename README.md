# CVDp-h

*Release title: TBD*

An unofficial, fan-made web app so fans with **color vision diversity** can hold a penlight in one hand,
their phone in the other, and always know which penlight color is on — and which hololive member it stands for.

Made by **BlackDream feat. ChromeBread(Dead Beats)**.

> This is an unofficial fan work. It is not affiliated with COVER Corporation, hololive production, or any penlight maker.

## Features

| Page | What it does |
|---|---|
| 1 Penlight | Two half-circle buttons (striped / plain) step through the penlight's color order. Shows the members for the current color, a soft "penlight glow" of their color, the color code, the same color as seen by a chosen color vision type, and the previous / next colors. Layout editor with presets, mis-tap guards (off by default), a movable lock button, keep-screen-on. State is restored after closing the browser. |
| 2 How to use & safety | "Do not swing your phone", per-page help, pre-live checklist. |
| 3 Color match with your neighbor | Two-player game on one screen (top half upside down). |
| 5 Oshi color challenge | Quiz for common color vision fans. |
| 13 About | Hashtag, debug switch, version, update check / clear cache, credits. In debug mode also data management: backup, restore, delete what you added. |
| 15 Penlight cycle chart (circle) | Pick a live and a penlight: every color in button order around a circle, with the members for each color; size slider. |
| 16 Penlight cycle chart (vertical) | The same as a vertical list, easy to read on a phone. Both charts can be saved or shared as one 1080 px PNG (live, date, penlight, legend, chart, unofficial note); drawn on a canvas, works offline. |
| 67 (internally page 20) About this beta | States plainly that CVDp-h is a development test (beta) build and what that means. Visible to everyone. |
| 4, 6–12, 14, 17–19 | Debug mode pages: 4 read colors from a picture; 6 phrase cards; 7 “Thank you!👍”, 8 “Sorry”, 9 Ultra orange🚫🍊✨, 10 Photos🚫📸, 11 “🚑Medical emergency!” (its page number shows the emergency number of the language: 119 / 911 / 120 / 999); 12 test color bars; 14 debug settings (surprise guests, hit-area overlay, image opacity, return to the editor); 17 live data viewer; 18 live data editor (your own live / penlight data, CSV file load / save, autosave); 19 CSV editor, an optional add-on downloaded on the About page (every column in a grid, built-in tables open as copies, save as file or add to the app). Page 1 in debug mode: Hot Button, lock size, size / position of the display parts, member image overlay. |

Languages: 日本語 / English / 한국어 / 简体中文 / 繁體中文 / Bahasa Indonesia (auto-detected from the device / browser).

Wording: we say **color vision diversity** and **C type (common color vision)**, P / D / T / A type — never negative terms.

## Data (fans can edit)

Tables live in [`data/`](data/README.md) as CSV so anyone can add future lives or non-hololive lives
with a spreadsheet app. **The current rows are samples and must be replaced with checked data.**

## Offline use

The app is a PWA: open it once while online and it keeps working without signal (service worker cache).
"Add to Home Screen" on iPhone / "Install app" on Android to launch it like an app.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. Settings → Pages → *Deploy from a branch* → `main` / root.
3. Open `https://<user>.github.io/<repo>/`.

No build step. Everything is plain HTML / CSS / JavaScript modules.

Before each release: raise `VERSION` in `sw.js` and `version` in `js/core.js`, then run
`powershell -ExecutionPolicy Bypass -File tools/app-size.ps1`. It writes `app-size.json`, the expected download sizes the About page shows for the app and the CSV editor add-on (`addons/`, kept in its own cache and only downloaded when someone asks for it).

## Run locally

Serve the folder with any static server (service workers and `fetch` do not work from `file://`), e.g.
`npx serve .` or `python -m http.server`.

When you change files, bump `VERSION` in `sw.js` so phones get the update.

## Terms

See [docs/terms-review.md](docs/terms-review.md) (hololive derivative work guidelines vs. web / Android / iOS release).
