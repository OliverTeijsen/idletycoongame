# GYRE

A pixel-art idle/incremental about a mote of light that becomes a self-sustaining
cosmic engine. Four nested prestige layers, a dozen interlocking upgrade sources,
numbers that never break.

Built to the GYRE design spec: all economy tunables live in `src/game/balance.ts`,
every game quantity is a `Decimal` (break_infinity.js), and the pure core
(`src/game/`, `src/render/particles.ts`, `src/render/scene.ts`) has zero React
imports so it runs under plain Node for tests and the balancing harness.

## Status — all 10 phases complete, rebalanced for a month-long game

| Layer | Currency | Unlocks | Opens around |
|---|---|---|---|
| Layer 0 | Spark ✦ / Motes ◦ | 8-tier orbiter chain, Dimension Boosts | minute 1 |
| P1 Collapse | Shards ◆ | Star Chart (ranked), autobuyers | ~10–30 min |
| P2 Ascend | Prism ▲ | Elements, Trials, full automation | ~30–90 min |
| P3 Converge | Aeon ✧ | Minerals & Research, Boost Managers, Time Flux | ~19h |
| P4 Unify | Singularity ⦿ | Meta Shop, auto-prestige | ~day 6 |

Measured on a 720-hour simulated walk (`WALK_HOURS=720 npm run test:core --
longwalk`): five Unifies, 39 of 40 Trial tiers and the whole Meta Shop inside a
month, with Converges still arriving every day or so at the end. The walk runs
deliberately pessimistic — see the resolution note below — so a real player is
somewhat ahead of those numbers.

Plus 71 achievements, a Stats screen showing the whole multiplier stack and
your speedrun splits, a Canvas 2D stage with pooled particles, Web Audio cues,
and rewarded-ad hooks (off by default — see below).

### The three rules of the economy

Stated in full at the top of `src/game/balance.ts`; in short:

1. **Nothing is additive.** A reward of "+100,000" is a fortune at 10 Spark and
   invisible at 10 million. Every buff is a MULTIPLIER, so it is worth the same
   fraction of your output on day 1 and day 30.
2. **Every currency has an endless sink.** A finite tree is a dead tree. Spark,
   Motes, Shards, Prism, Ore, Aeon and Singularity each own at least one
   uncapped, geometrically-priced multiplier.
3. **Layers gate each other sideways.** Converge needs Prism *and* cleared
   Trials; Unify needs Aeon *and* the Singularity Seed *and* more Trials *and*
   Deep Refinement levels. You cannot ride one lane to the end — choosing which
   lane to push next is the game, and it is what makes a route (and a speedrun)
   exist. See `BAL.gates`.

### Routing and speedruns

Because the gates cut across systems, the ORDER you push them in changes the
finishing time by a large factor — Trials are the clearest example, since their
rewards are permanent and compound for the rest of the run, so clearing them
early is worth far more than clearing them when the gate forces you to. The
Stats tab keeps splits (`state.milestones`, stamped in played time and never
reset) so two routes can be compared. Active play has a real edge too: a tap is
worth the larger of its flat power and `BAL.tapProductionSeconds` of your
current output, which is about +50% while you are actually tapping.

## Commands

| Command | What |
|---|---|
| `npm run web` | Dev server in the browser (the dev loop on this machine) |
| `npm test` | Full suite (pure core under ts-jest + app under jest-expo) |
| `npm run test:core` | Fast pure-core tests, incl. the pacing + ladder harnesses |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:apk` | EAS cloud build, Android APK (commit first — EAS archives the committed tree) |

Use `npm test`, not a bare `npx jest`: the script runs Jest with an enlarged
heap, and the balance harnesses are real simulations that need it. There are
five of them now (pacing, ladder, trials, longwalk, resolution) running across
workers in parallel, and at the default heap one of them intermittently dies —
which Jest reports as a failed suite, never as anything resembling a balance
problem.

## Balancing

There are three simulated reports, and they answer different questions.

`ladder.test.ts` walks one save from a fresh start at full resolution and
prints the first day: it is the ACCURATE one, and it asserts the spec's §10
pacing windows. Retune `balance.ts` against those numbers, never by feel.

```
LADDER_HOURS=3 npm run test:core -- ladder
```

`longwalk.test.ts` walks DAYS at a coarser resolution — it is the FAR-SIGHTED
one, and it is what proves the endgame keeps beating rather than seizing at
hour six. It is env-tunable and slow, so keep it out of quick loops:

```
WALK_HOURS=720 TRACE=1 npm run test:core -- longwalk    # the full month
```

`TRACE=1` prints a sampled curve of every counter — collapses, ascends, the
Spark and global exponents, Shards/Prism/Aeon/Ore. Tuning a five-layer ladder
from first-reach times alone is guesswork; when Converge lands twenty hours
late the times cannot tell you whether Prism accrues too slowly, Shards do, or
the "worth taking?" rule is holding the Ascend back. The trace can.

`resolution.test.ts` measures what the coarse walk costs in accuracy (both its
larger timestep and its lazier shopping make it read SLOW, which is the safe
direction for a pacing floor) so the long report can be read correctly.

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

`trials.test.ts` walks to the first Ascend and times tier 1 of each Trial -
that is where the `BAL.challenges` goals come from, and the only place their
thousand-fold spread (1e8 for Solitary against 1e1400 for Brittle) makes sense.
Trials gate Converge and Unify now, so it also asserts that a normal player
clears the Converge gate inside the first day.

Each report gets its own file, and the player model they all drive sits beside
them in `harness.ts` (deliberately not a test file, so jest does not pick it
up). Each report is a multi-hour simulation, and with two of them sharing one
jest worker the worker ran out of heap - which surfaces as `Test suite failed
to run`, not as anything resembling a balance failure. The player model runs
Trials, because a bot that never entered one would stall at P2 and report that
the game is broken.

## The UI smoke test

`src/ui/__tests__/screens.test.tsx` mounts every screen against a fresh save
and a deep one. It does not assert layouts — it asserts that a screen still
renders at all, which is otherwise unguarded: a screen reads state through a
dozen system functions, and a rename or a shape change turns into a white
screen that no core test can see.

It uses `react-test-renderer` rather than `@testing-library/react-native`, and
that is load-bearing rather than a preference. On this stack (RNTL 14 / React
19 / jest-expo) RNTL's `render` neither renders nor reports: measured against a
component whose whole body is `throw new Error()`, it returns an object with no
queries, throws nothing, and logs nothing. A smoke test written on it passes
whatever happens. If you ever migrate that file, break a component on purpose
first and check the test goes red.

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
