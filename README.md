# Wheel Merge

A fast arcade merge game powered by **Squeekchain**, the hamster-powered proof-of-work blockchain.

Hamsters sit on a 12-slot wheel. Drop the next hamster into the targeted slot: two neighbours of the
same level merge into the next level, in chains, up to the Legend. The timer is tight, and every merge
buys back a little time.

The **How to play** button in the top bar opens five short rules. The introduction appears
automatically on the first visit. Close it with **Close** or **Escape**; the button can reopen it
at any time. Focus stays inside the dialog and returns to the help button when it closes.
The game timer keeps running if you open help during a round.

## Powered by the real hamster

- **Live wheel.** In Live mode the wheel turns at the real speed of Squeektoshi's wheel, read from
  Squeekchain's public status API. When he sleeps, you turn the wheel yourself.
- **Real blocks.** Every completed Squeekchain block drops a ★ joker into your queue.
- **On-chain stamp.** Every saved score is stamped with the Squeekchain block height, read on-chain
  from the SqueekCore contract at the moment of submission.

## Modes and leaderboards

| Mode | Wheel |
|---|---|
| Live | Squeektoshi's real wheel |
| Auto-spin | Simulated running wheel (practice) |
| Manual | Simulated sleeping wheel, turned by the player (practice) |

Each mode has its own **weekly** leaderboard (new season every Thursday 00:00 UTC) and **all-time**
leaderboard, stored on Sepolia.

## What players sign

Playing needs no wallet. Saving a score is optional and sends **one** transaction on the **Sepolia
testnet**:

- function: `submitScore(mode, score, maxLevel, nickname, version)`
- value: **0 ETH** (only a small fee in free Sepolia test ETH)
- no token access, no approvals, no signature of messages

The game shows a full summary before the wallet opens and refuses to send anything outside Sepolia.

## Contracts (Sepolia)

| Contract | Address |
|---|---|
| Wheel Merge Leaderboard | [`0xa66c68edd8df3090557ab677444f8f0e1fa0df06`](https://sepolia.etherscan.io/address/0xa66c68edd8df3090557ab677444f8f0e1fa0df06) · [verified source](https://repo.sourcify.dev/11155111/0xa66c68edd8df3090557ab677444f8f0e1fa0df06) |
| SqueekCore (Squeekchain) | [`0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44`](https://sepolia.etherscan.io/address/0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44) |

The leaderboard holds no funds and accepts no ETH. Its owner can moderate (remove entries, exclude
addresses, pause submissions), reset leaderboards and tune the game rules.

## Install, build and preview

The supplied project is plain HTML/CSS with an already bundled game runtime. Building requires
Node.js 18.2 or later and **no package installation**. The new help module uses browser APIs only.

```bash
node scripts/build.mjs
node scripts/preview.mjs
```

Open `http://127.0.0.1:8080/preview/`. An optional preview port is the first argument, for example
`node scripts/preview.mjs 8081`. Stop the preview with Ctrl+C.

`dist/index.html` and its 15 accompanying files are the finished production export. Publish the
**contents of `dist/`** with any static host. Every script, stylesheet, font, favicon and share
image uses a relative URL; the `/preview/` path deliberately checks subpath hosting. Run the build
again after changing source or assets. There is no server component, install step, bundler or
secret configuration required at runtime.

The input contains no package manifest or lockfile. This assignment explicitly forbids touching
`package.json` and lockfiles, so none was introduced. That restriction takes precedence over the
generic source-plus-lockfile criterion. Optional validation tooling is version-pinned below and
installed outside the repository; it is not shipped to players.

## Validation

Production build and preservation checks:

```bash
node scripts/build.mjs
node scripts/check-export.mjs
node --check main.js
node --check decor.js
node --check how-to-play.js
```

For the typecheck and browser validation, optionally install the exact tooling outside the repo:

```bash
npm install --prefix /tmp/wheel-merge-tools --cache /tmp/wheel-merge-npm-cache --no-audit --no-fund --ignore-scripts typescript@5.9.3 playwright@1.56.1 @axe-core/playwright@4.10.2
PLAYWRIGHT_BROWSERS_PATH=/tmp/wheel-merge-browsers /tmp/wheel-merge-tools/node_modules/.bin/playwright install chromium webkit
/tmp/wheel-merge-tools/node_modules/.bin/tsc --allowJs --checkJs --noEmit --strict --target ES2022 --lib ES2022,DOM how-to-play.js
PLAYWRIGHT_BROWSERS_PATH=/tmp/wheel-merge-browsers node scripts/check-interactions.mjs --playwright /tmp/wheel-merge-tools/node_modules/playwright/index.mjs
PLAYWRIGHT_BROWSERS_PATH=/tmp/wheel-merge-browsers node scripts/check-accessibility.mjs --playwright /tmp/wheel-merge-tools/node_modules/playwright/index.mjs --axe /tmp/wheel-merge-tools/node_modules/@axe-core/playwright
```

The scripts start and stop their own local preview, check the actual export under `/preview/`, and
write temporary results/screenshots under `test/scratch/`. They deliberately abort the two existing
external API/RPC hosts instead of supplying invented responses. They do not connect a wallet or sign.
The strict typecheck covers the new browser module; the original prebundled runtime has syntax and
preservation checks rather than reconstructed TypeScript sources.

Actual results for this change:

- Production build, strict help-module typecheck and export integrity: **passed**.
- Chromium: **passed** first-visit display, reload/new-tab persistence, reopening, Close, Escape,
  focus containment/return, background input blocking, storage-failure recovery, Drop, canvas/Space
  input, restart, mode changes and local-leaderboard selection. No uncaught script errors or missing
  local assets. The existing blocked API reads produce expected browser resource errors.
- Responsive checks: **passed** at widths 320, 390, 860, 1024 and 1440; no document overflow. At
  390 × 844 the wheel and Drop are on the first screen after closing help. Close remains reachable
  at 568 × 320 and with doubled dialog text. Reduced-motion and forced-colors checks passed.
- Scoped axe scans: **zero violations**, with incomplete contrast checks and a scoped
  `aria-controls` check explicitly retained in the evidence. The relationship targets the existing
  named dialog. Separately measured opaque dialog text contrast is 11.95:1 or better.
- Pinned design probe: **11/16 passed**. Existing casing, tracking, HUD-label/eyebrow, monospace-prose
  and desktop copy-budget findings remain under “Keep everything else exactly as it is.” They are
  documented in the review; no unrelated redesign was made.
- WebKit: **not verified**; its downloaded engine could not launch because required runtime libraries
  were unavailable. Native screen-reader sessions, physical devices and browser-native zoom were
  not performed. Text enlargement is a separate check, not a claim of native zoom coverage.

The pinned probe was run during this assignment with:

```bash
IMD_PLAYWRIGHT=/tmp/wheel-merge-tools/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/tmp/wheel-merge-browsers node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline
```

The pinned input is removed after submission; the results are retained in `artifacts/taste.json`.
The explicit module path avoids the probe's automatic home-cache discovery.

See [DESIGN.md](DESIGN.md) for implemented tokens/components and
[artifacts/validation.md](artifacts/validation.md) for the six-domain review, screenshots, actual
results and limits. The original runtime, stylesheet, contract/wallet implementation and CSP are
preserved, checked in [artifacts/preservation.json](artifacts/preservation.json).

## First-visit storage and limitations

Help writes only `wheel-merge:how-to-play:seen` to localStorage and sessionStorage. Local storage
remembers future visits on the same origin; session storage is a fallback when local storage is
blocked. To see the introduction again, clear this key in both stores. If both stores are unavailable,
the dialog still works but can reappear after reload. Clearing site data also resets it.

Live API health, completed blocks, wallet connection and signed transactions were not verified by
this change. No chain data or transaction results were fabricated. The existing contract addresses,
RPC/API configuration, wallet flow, game rules and Content-Security-Policy were left intact.

The checked-in `share.png` needs no regeneration to build. To regenerate its local artwork from
the existing game canvases, use the optional Playwright tools, then rebuild:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/wheel-merge-browsers node scripts/generate-share.mjs --playwright /tmp/wheel-merge-tools/node_modules/playwright/index.mjs
node scripts/build.mjs
```

## License

MIT for the game code. Third-party components are listed in `THIRD_PARTY_NOTICES.md`.
