# GYRE

A pixel-art idle/incremental about a mote of light that becomes a self-sustaining
cosmic engine. Nested prestige layers, interlocking upgrade sources, numbers that
never break.

Built per the GYRE design spec: all economy tunables live in
`src/game/balance.ts`, every game quantity is a `Decimal` (break_infinity.js),
and the pure core (`src/game/`) has zero React imports so it runs under plain
Node for tests and the balancing harness.

## Status

**Phases 0–2 complete:**

- Tap the Core for Spark; buy Tier-1 Orbiters to automate.
- 8-tier dimension chain (tier k produces tier k−1), Buy 1/10/MAX.
- Spark upgrades (Charge Coil, Flux Lattice, Ignition, Cascade).
- Motes trickle + Resonance branch (Focus, Density, Resonance), softcapped.
- Dimension Boost soft reset: ×2 all tiers, unlocks the next tier, escalating
  requirement.
- Versioned, migratable, corruption-proof saves with a backup slot; offline
  progress with a 4h cap; export/import.
- Options: notation modes, reduced motion, confirm-on-reset, hard reset.

Next: Phase 3 — Collapse (P1), Shards, automation v1, Star Chart.

## Commands

| Command | What |
|---|---|
| `npm run web` | Dev server in the browser (the dev loop on this machine) |
| `npm test` | Full suite (pure core under ts-jest + app under jest-expo) |
| `npm run test:core` | Fast pure-core tests incl. the pacing harness |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:apk` | EAS cloud build, Android APK (commit first — EAS archives the committed tree) |

## Architecture

```
src/
  game/      pure TS core: numbers, balance, types, loop, offline, save, systems/
  services/  storage adapter (MMKV native / localStorage web)
  state/     zustand store wrapping GameState + actions
  render/    Stage (placeholder until the Phase 8 art pass)
  ui/        App, screens, components, theme
```

The pacing harness (`src/game/__tests__/pacing.test.ts`) simulates a greedy
player at full tick resolution and logs time-to-milestone — retune
`balance.ts` against those numbers, not by feel.
