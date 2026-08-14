# Frietkot Imperium

Idle tycoon for iOS + Android. Start with one Belgian frietkot, end with a global
F&B conglomerate.

## Status: economy, UI, localisation, juice and progression

Done: the pure economy core with profit *and* speed milestones, the Zustand
store with MMKV persistence, the full UI, localisation (English + Dutch,
system-detected), the juice pass — floating `+€X`, coin bursts, an eased cash
counter, milestone pops, haptics, the golden frietzak — and progression: the
daily streak and 15 achievements.

Not yet built: ads, IAP, GDPR consent and push. All four need a real device
build and external accounts, so none of them can be verified on web.

```
src/
  core/                    pure TS, framework-agnostic, 134 tests
    numbers.ts             Decimal helpers, formatBig() / money() / formatTime()
    types.ts               GameState, BusinessDef, AchievementDef, BuyAmount…
    businesses.ts          10 business defs + every economy constant
    economy.ts             costs, milestones, multipliers, revenue, prestige
    achievements.ts        15 achievement defs + the unlock check
    streak.ts              local-calendar day maths, reward curve
    engine.ts              advance, buy, tap, prestige, offline, streak…
    index.ts               public barrel
  services/
    storage.ts             MMKV save/load, Decimal <-> string, hostile-input safe
  store/
    gameStore.ts           Zustand store + autosave; the only core→React bridge
  ui/
    theme.ts               colour / spacing / type tokens
    i18n/                  Strings contract + en/nl, system-locale detection
    juice/                 FloatingPayouts, CoinBurst, GoldenFries,
                           AchievementToast, useEasedDecimal, haptics
    App.tsx                root: hydrate, tick loop, AppState, modals
    components/            TopBar, BusinessRow, BuyAmountToggle, BottomBar,
                           OfflineModal, PrestigeModal, StreakModal,
                           AchievementsModal, CycleBar
```

## Commands

```bash
npm test              # 294 tests across both projects
npm run test:core     # pure economy only, ~1s, no React Native
npm run test:app      # services + store + UI
npm run test:coverage # with the coverage gate (95/82/95/95)
npm run typecheck     # tsc --noEmit, strict

npm start             # Expo dev client (requires a prebuild — see below)
npm run web           # browser, no native toolchain needed
```

### Running in the browser

The fastest way to see the game. `react-native-mmkv` ships a real web
implementation backed by `localStorage`, so persistence works for real — saves
survive a reload.

```bash
npm run web           # http://localhost:8081
```

What web does **not** cover: `AppState` backgrounding behaves differently from a
real device, so the offline-earnings path is only properly exercised on a phone;
and the phase-4 ad SDK has no web build at all. Treat web as the layout and
economy sandbox, not as release validation.

### Running on a device

The app uses native modules (MMKV, Reanimated/worklets, haptics, localization),
so **Expo Go will not work**. It needs a real build.

#### An APK you can just install and play (no local toolchain)

```bash
npm run eas -- login  # once; interactive
npm run build:apk     # cloud build, ~10-20 min on the free tier
```

**EAS requires a git repository**, and it archives the *committed* tree — an
uncommitted change is not in the build. Commit before building, or you will be
testing an APK of code you have already moved past.

Three traps, the last two already worked around in the scripts:

- Without a JDK there is no local `keytool`, so EAS generates the upload
  keystore in the cloud on the first build. That is fine and needs no input; the
  keystore then lives on the Expo servers for every later build.

- The package is `eas-cli`, the command is `eas`. **`npx eas login` fails** with
  "could not determine executable to run", because npx looks for a package
  called `eas`.
- **`eas-cli@22.0.0` is a broken release** — it depends on
  `@expo/eas-build-job@22.0.0`, which was never published, so installing it
  fails outright. The scripts pin `21.8.0`. Drop the pin once 22.x is fixed.

EAS CLI is deliberately *not* a project dependency; `expo-doctor` fails the
project if it is. The scripts call it through `npx` instead.

EAS builds in the cloud and hands back a QR code and a download link. Open it on
the phone, install, play. Nothing needs to be installed locally — the `preview`
profile is a standalone release APK, so it does not need Metro running.

`npm run build:dev` produces a dev-client APK instead: same native code, but it
loads JS from your machine, so it needs `npm start` and is what you want for
iterating rather than playing.

#### Building locally instead

Needs JDK 17 + Android Studio + the SDK, with `ANDROID_HOME` set:

```bash
npx expo prebuild     # generates ios/ and android/
npm run android       # or: npm run ios
```

If `expo run:android` reports `Failed to resolve the Android SDK path`, that
toolchain is not installed — use the EAS route above instead.

#### Before any build

```bash
npx expo-doctor       # 20 checks; all should pass
```

This is worth running after any dependency change. It is what caught
`react-native-worklets` missing from `package.json` — present in `node_modules`
as a transitive dependency, so everything worked on web and in tests, but a
native build would have been missing it.

## Architecture rule (non-negotiable)

`src/core/` must never import React, React Native, Expo, or any service. UI and
services depend on the core, never the reverse. This keeps the economy
unit-testable without a device and portable to a server later for anti-cheat.
**The rule is enforced by a test** (`economy.test.ts` → "architecture rule"),
which greps the core sources for forbidden imports.

The store follows from it: `gameStore.ts` contains **no game logic**. Every
action delegates to `core/engine`, takes the returned state and stores it.

## Money is always `Decimal`

Cash overflows `Number.MAX_SAFE_INTEGER` within an hour of play. Every money
value is a `break_infinity.js` `Decimal`. Never store money as a JS number —
`assertDecimal()` exists to catch it in development.

`decToString()` / `decFromString()` in `numbers.ts` are the canonical
serialization pair used by `services/storage.ts`.

## Engine notes

- **`advance(state, dtSeconds)`** is the single source of truth for the running
  economy and returns `{ state, earned, payouts }`.
- Managed businesses are computed analytically (`cycles = floor(progress + dt/cycleTime)`),
  so a 100ms tick and a 4-hour catch-up take the same code path.
- A manually tapped business pays **at most one cycle** per tap, however large
  the `dt`.
- If a profit boost expires inside a step, the step is **split at the expiry** so
  the boosted and un-boosted portions are both paid correctly.
- Cycle completion uses a `1e-9` epsilon, because summing `dt / cycleTime` over
  many 100ms ticks lands a hair under 1.0 in floating point.
- Every engine function is pure and returns a **new** state — never mutates the
  input. Actions that cannot apply return the *same* object, and `advance` keeps
  object identity for businesses that cannot have changed, so React rows only
  re-render when they actually move.

## Store notes

- **Payout events bypass React.** Coin bursts and floating `+€X` fire many times
  a second; routing them through component state would re-render the tree for a
  purely visual effect. `subscribeToPayouts()` delivers them straight to the
  juice layer (phase 3) and they are never stored.
- **Autosave** every ~5 simulated seconds, plus immediately on prestige, offline
  claim and backgrounding.
- **`MAX_TICK_SECONDS` (60)** clamps a single tick. Long absences are paid by the
  offline calculation, not by a giant catch-up tick; the clamp stops a paused-JS
  gap from being paid twice.
- **`lastActiveAt` is re-anchored as soon as an offline payout is computed**, so
  the same seconds can never be paid a second time.

## Persistence notes

A save file is untrusted input. `deserializeState` never throws: it returns
`null` for input that is not a save at all, and clamps anything merely odd
(negative counts, out-of-range progress, a `lastActiveAt` in the future that
would otherwise mint free offline earnings). A save that crashes on load is the
worst bug an idle game can ship.

Businesses are merged **by id** onto a fresh roster, so adding a tier in a future
version (v1.3 regions) loads old saves with no migration.

## Testing

Two Jest projects, on purpose:

| Project | Runner | Scope |
|---|---|---|
| `core` | ts-jest, plain Node | `src/core` — no RN, no transform pipeline, ~1s |
| `app` | jest-expo | services, store, UI, i18n, juice |

Each project measures its own coverage: both would otherwise instrument
`src/core` with different transformers, and the mismatched coverage maps merge
badly and under-report it.

Two test-environment notes worth knowing:

- `react-native-nitro-modules` is stubbed (`test/mocks/`). The real package runs
  `installWorkletsSupport()` at import time, which needs a native TurboModule.
  MMKV imports it eagerly but only uses it lazily, and swaps in an in-memory
  store under Jest — so persistence is still tested for real, not against a
  hand-written mock.
- `@testing-library/react-native` v14 made `render` and `fireEvent` **async**.
  Every call must be awaited or `screen` stays empty.
- Reanimated 4 runs on `react-native-worklets`, whose `.native` entry points want
  a TurboModule that Jest has no way to provide. `jest.config.js` uses the
  resolver the package ships (`react-native-worklets/jest/resolver`), which
  strips those extensions — so the animations run for real in tests instead of
  against a mock.
- Payouts and the golden-bag timer update state from **outside** React, so every
  `tick()` and `advanceTimersByTime()` in the juice tests is wrapped in `act()`.

## Juice

Reanimated only — no Skia. Every phase-3 effect (floating `+€X`, coin bursts,
the eased counter, milestone pops, the golden bag) is cheap enough without a
canvas, and staying off CanvasKit keeps the web build working with no extra
Metro configuration. Skia remains an option if particle density ever demands it.

The animations are decorative by design: every one of them **ends in the resting
state that is already correct**. That is what makes the layer safe to disable —
see reduced motion below.

- **`FloatingPayouts`** subscribes to `subscribeToPayouts()`. Payout events
  deliberately bypass React, so the only state is the list of *visible* labels:
  one `setState` per spawn, never one per frame. A burst across ten tiers is
  summed into one number, and payouts arriving inside the throttle window are
  **carried into the next label rather than dropped**.
- **`useEasedDecimal`** eases the cash readout on the **JS thread, not in a
  worklet** — `Decimal` is a class instance and cannot cross the worklet
  boundary. Smoothing is `1 - e^(-k·dt)`, so a dropped frame changes the timing
  of the ease and never its destination. It snaps at zero, or prestige would
  crawl toward it forever.
- **`GoldenFries`** keeps its spawn timing in the UI layer, not the core: pacing
  is not economy. The *reward* is `startBoost()`, which is already an engine
  rule, so the core stays free of timers and randomness.

### Reduced motion

With the OS accessibility setting on, Reanimated skips animations and fires the
completion callback **synchronously**. The policy is *less movement, not less
feedback*:

- **Decoration obeys the setting.** Coin bursts, the tap bounce and the milestone
  pop carry no information, so they simply do not play. Haptics still fire, which
  is feedback without motion.
- **The floating `+€X` does not use animation at all when the setting is on.**
  It is the only confirmation a payout happened, so `FloatingPayouts` renders a
  `StillLabel` instead: a plain `Text` on a plain `setTimeout`, visible for
  1.3s. Nothing there can be skipped by an accessibility setting.

Opting the animation out with `ReduceMotion.Never` was tried first and does not
hold up: on web the value still lands on its end state, so the label sat at zero
opacity — present in the DOM, invisible to the player. Rendering it statically is
the version that actually works, and it is simpler.

A consequence worth remembering when writing new juice: a component that retires
itself from a timing callback does so during its own mount. Hold those callbacks
in refs, never in effect dependencies — a changing identity would restart the
animation the instant it finished.

## Speed milestones and continuous production

`MILESTONES` double a tier's *profit*; `SPEED_MILESTONES` halve its **cycle
time**. That second curve is what turns a tier from "automatic" into "constant":
each threshold doubles the rate, and once the cycle drops under the 100ms tick
the bar stops visibly cycling. A Fry Shack starts at 1.5s and runs non-stop by
300 owned.

**`cycleTimeFor(def, owned)` is the only place cycle length is decided.**
`def.cycleTime` is the value at zero speed milestones and must never be read
directly by the engine, the income maths or the UI — halving it doubles income,
so a caller using the raw number silently disagrees with the rest of the game
about what a tier earns. `speed.test.ts` pins that with the invariant that
matters: `advance()` must pay exactly what `perSecond()` advertises, checked
across the thresholds. Reverting the engine to `def.cycleTime` fails six of them.

Late tiers stay slow on purpose: the Global F&B Empire's 768s cycle is still 24s
after every halving, so speed never turns the end game into a sprint.

### The bar

The store ticks ten times a second, which is far too coarse to draw a 1.5s
cycle — fifteen visible steps read as stutter. `CycleBar` therefore animates the
fill on the **UI thread** at the true linear rate and re-seeds it from real
progress on every tick: the animation supplies smoothness, the store supplies
truth, and they cannot drift by more than one tick.

Past `CONTINUOUS_CYCLE_SECONDS` the cycle is shorter than the tick itself.
Drawing a filling bar there would be a lie — several cycles complete between
frames — so it becomes a solid bar and the label reads "non-stop".

With reduce-motion enabled the bar tracks the store directly instead. Coarser,
but honest: `withTiming` completes on the spot under that setting, which would
otherwise peg the bar at 100%.

## Progression

### Daily streak

A "day" is the player's **local calendar day**, as a whole-number index from
`dayIndex()`. Local rather than UTC, because "did I play yesterday?" is a
question about the player's own calendar — a UTC boundary would break streaks at
01:00 for anyone east of Greenwich. The index is built from the local Y/M/D
through `Date.UTC`, which is what makes it immune to daylight saving: a local day
is sometimes 23 or 25 hours long, but the index still steps by exactly one.

The state stores the **day index**, not a timestamp. Comparing days is the whole
question, and keeping raw milliseconds around invites off-by-one bugs at
midnight.

The reward is a slice of the player's *current* income, so it stays worth
collecting at every stage rather than becoming pocket change by tier 4. It grows
to a cap at `STREAK_MAX_DAYS` and then holds — a 90-day run is a badge, not a
runaway multiplier — with a floor so day one of a fresh save is never €0.

**The claim happens before the modal is shown**, and saves immediately. A player
who force-quits while the modal is up keeps the reward instead of being offered
it again.

It runs on `hydrate()` **and on `onForeground()`**. A phone left in a pocket
overnight never relaunches the app, so claiming only on hydrate would skip the
day for anyone who leaves it running. `claimStreak()` is a no-op once today is
banked, which is what makes calling it on every resume safe.

`StreakModal` holds itself back while an offline payout is pending. Both can be
waiting on the same launch, and "welcome back" is the one that explains the cash
that just appeared.

### Achievements

Each one is a threshold on a number read from the state — `progress` + `goal`,
never a free-form predicate. That is what lets the list show a progress bar for
all fifteen without a single special case. Titles live in `ui/i18n`, keyed by id,
for the same reason business names do.

`settleAchievements()` returns the **same state object** when nothing unlocked.
That identity is load-bearing: it runs on every tick, and the store relies on it
to avoid re-rendering the tree ten times a second for nothing.

Unlocks reach the UI through `subscribeToUnlocks()`, the same
bypass-React channel the payouts use. `AchievementToast` shows them one at a
time — several thresholds can fall in a single purchase, and a stack of banners
is unreadable.

`hydrate()` deliberately does **not** settle achievements. The toast only mounts
once `hydrated` flips true, which is after hydrate runs, so an unlock announced
there would be shouted into an empty room — and never shown again, because the
next check finds it already banked. The first tick, 100ms later, does it with
the toast listening.

### Save migration

`SAVE_VERSION` is 2. There is no migration code, and that is the design: missing
fields land on the fresh defaults, exactly as an unknown business tier does. A v1
save simply loads with `streakDays: 0`, `lastStreakDay: 0` and `unlocked: []`.

Achievement ids from the save are filtered against the ids this build defines,
and de-duplicated — a renamed achievement or a tampered file cannot inflate the
count or crash the list.

## Localisation

English is the default and the fallback; Dutch ships alongside it. The device
language decides, via `expo-localization`, at app start. There is no in-game
language switcher yet — `setLocale()` in `ui/i18n/index.ts` is the seam one
would use, and `useStrings()` is the hook that would re-render.

Every user-visible string lives in `ui/i18n/en.ts` and `nl.ts`, behind the
`Strings` contract in `types.ts`. Two properties make that contract carry weight:

- **Parameterised strings are functions, not templates.** `nextMilestone(24)`
  rather than `"Next ×2 in {n} units"`. Word order and pluralisation are the
  translator's decision — Dutch and English agree here, French and German will not.
- **`businesses` is a total `Record<BusinessId, string>`.** Adding an 11th tier
  is a compile error until every locale names it.

Region is stripped: `nl-BE` and `nl-NL` share one locale. If Flemish and Dutch
ever need to diverge, `resolveLocale()` is where that splits.

### Business names live in two places, on purpose

`core/businesses.ts` carries an English `name`. The core may not import the i18n
layer (see the architecture rule), so the UI resolves display names by id from
the locale files instead — `def.name` is the fallback and the debug label.
Duplicated text drifts silently, so `i18n.test.ts` asserts `en.businesses`
always matches the core names, and that no tier was left untranslated.

### Tests pin the locale

`jest.setup.js` calls `setLocale('en')` before each test. Without it, UI
assertions read whatever language the machine happens to use — passing in
Brussels and failing in CI. Detection itself is tested directly, by handing
`resolveLocale()` tag lists rather than mocking the native module.

## Balancing

Every tunable lives in `src/core/businesses.ts`. Changing the curve should never
require touching `economy.ts` or `engine.ts`.

### Prestige

`lifetimeEarnings` accumulates across *all* runs and is never reset. Investors
gained by prestiging = `floor(150 · √(lifetime / 1e9)) − investors already banked`.
This keeps the spec's formula intact while making repeated prestiges
non-exploitable. First investor lands at ~€44.4k lifetime earnings.

### Known spec deviation

`truck` (Foodtruck-franchise) has `baseRevenue: 7_464_200` — the spec's literal
value. Every other tier uses exactly ×0.5 of `baseCost`, which would give
`7_464_960` here. Kept verbatim, flagged for balancing.

## Next

**Everything left needs a real device build.** Ads (AppLovin MAX + GDPR
consent), IAP and push all require native modules and external accounts, so none
of them can be written against anything verifiable on web. Get a dev client onto
a phone first — locally (JDK + Android Studio) or through an EAS cloud build.

The three ad placements already have their UI and are marked `PHASE 4` in
`BottomBar.tsx`, `OfflineModal.tsx` and `PrestigeModal.tsx`. Each currently
grants its reward directly and must be gated behind `ads.showRewarded()`.

Still open, unrelated to any of that: the game has never been played through, so
the curve is unvalidated — including the `truck` deviation noted above.
