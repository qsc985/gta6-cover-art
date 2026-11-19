# Neon Coast — GTA-style Cover Maker

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/qsc985/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/qsc985/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Entry for the [gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01): an offline web app that turns your own photos and a caption into GTA 6-style multi-panel cover art, exported as a PNG to share.

## What it does

- **Multi-panel poster art** — six layouts (Hero + 3, nine-grid, four-panel, wide strip, tilted snapshots, full bleed) with white poster gutters, a sunset sky and sun disc behind the panels.
- **Any photo** — add photos from your machine (nothing is uploaded), crop by dragging, zoom with the scroll wheel or slider, fill every panel with one photo or a different photo per panel.
- **Colour grades** — five gradient-map grades (Vice Sunset, Neon Nights, Miami Heat, Dusk Purple, Teal Noir) with strength, film grain, halftone title dots and vignette.
- **Lettering** — huge Anton title with neon offset shadows, Pacifico script subtitle, a badge ribbon and a five-star heat meter; title, subtitle and badge are all editable.
- **Fast** — photo to PNG in a few clicks, in 1080×1080, 1080×1350 and 1920×1080, with undo/redo and a shuffle button.
- **Original** — no Rockstar Games logo, artwork or fonts. Lettering uses Anton and Pacifico, vendored under the SIL Open Font License (`app/fonts/OFL.txt`).

## Run it

No build step, no network. Serve `app/` with any static server and open it in desktop Chrome:

```sh
node serve.ts        # serves app/ at http://localhost:8080
```

or `python3 -m http.server --directory app 8080`.

## How to use

1. Click **Add photos** (or **Load samples** to try the two included sample photos).
2. Pick a layout, a size and a colour grade.
3. Click a panel to select it, drag the photo to position it, scroll to zoom.
4. Edit the title, subtitle and badge, then **Export PNG**.

## Layout

- `main.ts` — entry program: copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with `vendor/makefun-app.ts`.
- `app/` — the static web app (`index.html`, `style.css`, `app.js`, vendored fonts, sample photos).
- `screenshots/` — screenshots of the app and covers it exported.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.

## License

MIT — see [LICENSE](LICENSE).
