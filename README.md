# GYRE

A pixel-art idle/incremental about a mote of light that becomes a self-sustaining
cosmic engine. Four nested prestige layers, a dozen interlocking upgrade sources,
numbers that never break.

Built to the GYRE design spec: all economy tunables live in `src/game/balance.ts`,
every game quantity is a `Decimal` (break_infinity.js), and the pure core
(`src/game/`, `src/render/particles.ts`, `src/render/scene.ts`) has zero React
imports so it runs under plain Node for tests and the balancing harness.

## Status — all 10 phases complete

| Layer | Currency | Unlocks |
|---|---|---|
| Layer 0 | Spark ✦ / Motes ◦ | 8-tier orbiter chain, Dimension Boosts |
| P1 Collapse | Shards ◆ | Star Chart, autobuyers |
| P2 Ascend | Prism ▲ | Elements, Challenges, full automation |
| P3 Converge | Aeon ✧ | Minerals & Research, Boost Managers, Time Flux |
| P4 Unify | Singularity ⦿ | Meta Shop, auto-prestige |

Plus 55 achievements, a Stats screen showing the whole multiplier stack, a
Canvas 2D stage with pooled particles, Web Audio cues, and rewarded-ad hooks
(off by default — see below).

## Commands

| Command | What |
|---|---|
| `npm run web` | Dev server in the browser (the dev loop on this machine) |
| `npm test` | Full suite (pure core under ts-jest + app under jest-expo) |
| `npm run test:core` | Fast pure-core tests, incl. the pacing + ladder harnesses |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:apk` | EAS cloud build, Android APK (commit first — EAS archives the committed tree) |

Note that `npm test` runs Jest with an enlarged heap: the balance harnesses are
real simulations and the default heap is not sized for them.

## Balancing

`src/game/__tests__/ladder.test.ts` walks one save from a fresh start up the
whole prestige ladder and prints a balance report, asserting the spec's §10
pacing windows. Retune `balance.ts` against those numbers, never by feel. Run
a shorter walk while iterating:

```
LADDER_HOURS=3 npm run test:core -- ladder
```

Times are *bot-seconds*: the harness buys optimally every second from minute
one, so pre-automation numbers run roughly 2× ahead of a real first session.
After P1 the autobuyers do the same thing, so later numbers are honest.

The bot's "is this reset worth taking?" rule is not the harness's own — it is
`worth{Collapsing,Ascending,Converging}` from `systems/prestige.ts`, the same
rule the auto-prestige toggles use. The bot in the report and the autobuyers a
player leaves running must not be playing different games; when that rule was
wrong, the report showed a ladder that opened on schedule and then seized.

First-reach times alone cannot see a stalled ladder, so the report also lists
every Converge in the walk and asserts the gaps between them.

The second report, `the trials` in `trials.test.ts`, walks to the first Ascend
and times tier 1 of each challenge - that is where the `BAL.challenges` goals
come from, and the only place their thousand-fold spread makes sense. It gets
its own file, and the player model both reports drive sits beside them in
`harness.ts` (deliberately not a test file, so jest does not pick it up):
each report is a multi-hour simulation, and with the two of them sharing one
jest worker the worker ran out of heap - which surfaces as `Test suite failed
to run`, not as anything resembling a balance failure.

## Architecture

```
src/
  game/      pure TS core: numbers, balance, types, loop, offline, save, systems/
  render/    particles.ts + scene.ts are PURE and tested; StageCanvas.web.tsx
             paints them on Canvas 2D, StageCanvas.tsx is the native fallback
  audio/     throttle.ts is pure; audio.web.ts synthesises cues via Web Audio
  services/  storage (MMKV/localStorage), ads (native/web split), monetization
  state/     zustand store wrapping GameState + actions
  ui/        App, screens, components, theme
```

Platform-split files (`*.web.tsx` / `*.tsx`) are the Renderer seam from spec §3:
Metro picks the web file on web and the bare one elsewhere. Swapping in Skia or
a real native audio backend means replacing exactly one file each.

## Turning ads on

Ads ship **off** (`MONETIZATION_ENABLED = false` in `src/services/monetization.ts`)
and the game is fully playable without them. To enable:

1. AdMob console → your GYRE app → create **two Rewarded ad units**.
2. Paste their ids into `ADMOB.rewardedProductionBoost` / `rewardedDoubleOffline`.
3. Flip `MONETIZATION_ENABLED` to `true`.
4. `npm run build:apk` — ads need a native build; they cannot work on web or in Expo Go.

The Android App ID is already wired into `app.json`'s config plugin. Google's
always-fill test id is in `ADMOB_TEST_IDS` for verifying the flow on a device
before your real units are approved — never ship it, and never click your own
live ads.
