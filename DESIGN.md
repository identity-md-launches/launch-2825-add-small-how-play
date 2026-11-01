# Wheel Merge design

## Overview

Wheel Merge is a compact arcade game centered on a pixel-art hamster wheel. The existing dark instrument-panel layout, dot patterns, canvas artwork and local fonts remain the visual system. The only added interface is a small top-bar help control and its first-visit rules dialog. Source of truth: `app.css`, `index.html`, `how-to-play.css` and `how-to-play.js`.

## Colors

The existing hex tokens in `app.css` are unchanged.

| Tokens | Values | Implemented role |
| --- | --- | --- |
| `--bench`, `--panel`, `--raised` | `#1a1a20`, `#0b0b0d`, `#0f0f12` | Page, panel/dialog and field/review surfaces |
| `--line`, `--line2` | `#1c1c24`, `#26262f` | Table separators; panel borders and dots |
| `--gray`, `--ink`, `--white` | `#82828f`, `#e6e6ec`, `#f2f2f4` | Secondary labels, prose, values/primary-button fill |
| `--active` | `#7fd4ff` | Hover/selected states, help numbering and help focus rings |
| `--green`, `--red`, `--gold` | `#35d07f`, `#f44a5e`, `#f2c230` | Existing transaction success/error and timer/score emphasis |
| `--dim`, `--blue`, `--orange`, `--cream` | `#3a3a46`, `#5b7cfa`, `#e8b04a`, `#fdfbc8` | Retained existing palette; no new help roles |

The help dialog uses an opaque `--panel` surface and a `#0b0b0dcc` backdrop. Measured Chromium text contrast on the opaque dialog: rules 15.82:1, title 17.59:1, list numbers 11.95:1 and Close 17.59:1. These are identified text pairs, not a claim about all canvas artwork or the dimmed background. See `artifacts/accessibility.json` for the computed colors and audit limits.

## Typography

Five existing WOFF2 files in `fonts/` are copied intact to the export; no new fonts are loaded.

| Role | Family and available weights | CSS treatment |
| --- | --- | --- |
| UI/data | `--f-data`: IBM Plex Mono, ui-monospace, monospace; 400/600 | Body 400 13px/1.5, `.02em`; `.label` 12px, `.12em`, uppercase |
| Values/display | `--f-display`: Barlow Condensed, Arial Narrow, sans-serif; 200/300 | `.value` 300 26px/1.1, `-.01em`, tabular numbers; `.big` 44px and `.huge` 64px |
| Friendly prose | `--f-voice`: Quicksand, system-ui, sans-serif; 600 | `.voice` 600 14px/1.4; rules override line-height to 1.5 and letter-spacing to normal |

The help heading reuses `.value` at 26px. The help trigger reuses `.btn` with 12px sentence case and normal letter spacing so the label fits beside the title at 390px. Close keeps the existing 13px uppercase button treatment. Rule text wraps naturally; it is not truncated. The existing game also has 11px review terms, 12px notes/tabs and a 15px nickname input. These were not normalized as part of this change. At the tested initial states the probe observed four sizes at 390px and five at 1440px.

The rendered help uses loaded Barlow Condensed 300, IBM Plex Mono 400 and Quicksand 600 faces. Barlow Condensed 200 is supplied but was not loaded in the inspected state.

## Layout

The unchanged `.app` grid has a 1440px maximum width, 16px padding and 14px gaps. Desktop columns are `minmax(240px,300px) minmax(0,640px) minmax(280px,360px)`, with a full-width flex top bar. At 1180px and below, the stage and right column sit above the left column. At 860px and below, the grid becomes top bar, HUD, stage, leaderboard with 12px outer padding; the original long sidebar help is hidden, and score values become 26px.

The new help control is immediately after the logo canvas in the existing wrapping flex row. At 390 × 844 the game and Drop action are visible after closing the first-visit dialog; Drop ends at approximately y=770. At 320px the header wraps further without document overflow. The original intermediate 860px layout places Drop below the initial viewport; its game layout was preserved.

The dialog is at most 440px wide, with at least 16px viewport clearance and 24px internal padding. Its maximum height is the viewport minus 32px, using `dvh` with a percentage fallback. The ordered list has 18px/24px block margins, 24px start padding and 12px between rules. The closing action is aligned to the trailing edge. Short viewports scroll inside the dialog; `overscroll-behavior: contain` and `html:has(.play-help[open])` keep background scrolling contained. Close remains reachable with doubled rule/heading text.

Chromium coverage: widths 320, 390, 860, 1024 and 1440, plus 568 × 320 landscape. Native browser zoom, physical devices and WebKit rendering were not verified. Text enlargement was tested separately from native zoom.

## Elevation & Depth

The existing decor canvas is fixed at z-index 0; `.app` is at z-index 1. Panels use borders and dot patterns. The native modal dialog lives in the browser's top layer and uses the dark backdrop for separation, with a 1px structural border and no shadow. The original game-over overlay retains its existing gold glow. No new animation or transition was added.

## Shapes

Panels and the help dialog use 10px corner radii and 1px `--line2` borders. Buttons and fields retain 4px radii. The help trigger and Close have minimum 44px heights; the existing smaller game controls are unchanged. Dot spacing in `.dots` remains 14px. The local favicon uses the wheel and hamster palette; the 1200 × 630 share image is generated from the existing game canvases without live-data claims.

## Components

| Pattern | Source | Behavior and reuse |
| --- | --- | --- |
| Panel | `app.css`, `.panel`, `.dots` | Existing dark bordered surface; optional dotted background |
| Button | `app.css`, `.btn`, `.primary` | Neutral outline secondary; white filled primary; cyan hover; disabled opacity `.35` |
| Help trigger | `index.html:24`, `how-to-play.css:6` | Native button, `aria-haspopup="dialog"`, `aria-controls="playHelp"`; keyboard/pointer activation |
| Rules dialog | `index.html:103`, `how-to-play.css:15`, `how-to-play.js` | Native named dialog; five rules; Close and Escape dismissal; no backdrop dismissal |
| Focus | `how-to-play.css:58` | Help-only 2px cyan outline with 3px offset; system `Highlight` in forced-colors mode |
| Values/timer | `app.css`, `.value`, `.timer`, `.cells` | Existing tabular display and segmented timer; low state red |
| Modes/leaderboards | `index.html`, `main.js`, `.tabs` | Existing select, mode/source tabs, empty/loading/error rows; unchanged |
| Score review | `index.html`, `main.js`, `#over`, `#review` | Existing optional Sepolia save flow; unchanged |

Opening help focuses Close and makes background controls inert. Tab and Shift+Tab stay on the dialog's only interactive control. Closing restores focus to How to play without scrolling. A capture-phase handler prevents game shortcuts while help is open; after closing, the original controls work. An active game timer continues while help is open: the dialog does not pause or reset the game.

The module remembers that help was shown under `wheel-merge:how-to-play:seen`, without touching game-storage keys. It writes localStorage for future visits and sessionStorage as a fallback. If both are blocked, help still opens/closes, but first-visit memory cannot survive a reload. Clearing browser storage also resets the introduction.

## Do's and Don'ts

- Reuse the existing surface, font and button tokens. Keep new help styles scoped to `.help-trigger` and `.play-help`.
- Use the named native dialog pattern for this help content; retain the explicit closing action and keyboard behavior.
- Add rules as short complete sentences. If adding another interactive dialog control, update the current single-control Tab handling.
- Keep static assets relative and local. Rebuild `dist/` after source changes.
- Preserve the game runtime, wallet flow, contract configuration and CSP. Do not normalize the original dashboard typography or replace the grid for this feature.

Design review used the pinned Better Interface guidance; documentation structure was adapted from Impeccable. Attribution and licenses are retained in `docs/design-guidance-NOTICE.md` and `docs/design-guidance-LICENSE.txt`.
