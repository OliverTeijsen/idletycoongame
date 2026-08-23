/**
 * ALL tunable economy constants (spec §17). Single source of truth.
 *
 * Systems import `BAL` and never hardcode economy literals. A designer tunes
 * the game here and only here; the pacing harness in __tests__/pacing.test.ts
 * measures the result.
 *
 * PURE MODULE — no React, no React Native.
 */
import { D, Decimal } from './numbers';

export interface DimensionDef {
  /** Cost of the first purchase, in Spark. */
  baseCost: Decimal;
  /** Cost multiplier per single purchase. */
  costGrowth: Decimal;
  /** Base production per orbiter per second (Spark for T1, lower-tier orbiters above). */
  perOrbiter: Decimal;
}

export interface RepeatableUpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: Decimal;
  costGrowth: Decimal;
  /** Multiplier granted per level (composition is per-system). */
  effectPerLevel: Decimal;
  /** null = endless. */
  maxLevel: number | null;
}

export const BAL = {
  /** Spark granted per tap before Charge Coil. */
  tapBase: D(1),

  /**
   * Orbiter dimension chain (spec §6.2). Index 0 = Tier 1.
   *
   * costGrowth is per SINGLE purchase, so it must stay shallow (1.15–1.5):
   * the spec's draft values of 1.6–2.3 made ten purchases cost ×100+ the base
   * and walled Dimension Boosts behind the Collapse threshold, inverting the
   * §10 pacing (boosts at 2–10 min, first Collapse ~15 min). Measured by
   * __tests__/pacing.test.ts — retune there, not by feel.
   */
  dimensions: [
    { baseCost: D(10), costGrowth: D(1.15), perOrbiter: D(0.5) },
    { baseCost: D(1e2), costGrowth: D(1.18), perOrbiter: D(0.1) },
    { baseCost: D(1e3), costGrowth: D(1.21), perOrbiter: D(0.08) },
    { baseCost: D(1e4), costGrowth: D(1.25), perOrbiter: D(0.06) },
    { baseCost: D(1e6), costGrowth: D(1.3), perOrbiter: D(0.05) },
    { baseCost: D(1e8), costGrowth: D(1.35), perOrbiter: D(0.04) },
    { baseCost: D(1e11), costGrowth: D(1.4), perOrbiter: D(0.03) },
    { baseCost: D(1e15), costGrowth: D(1.5), perOrbiter: D(0.02) },
  ] as DimensionDef[],

  /** Tiers 1..N are available from the start; each Dimension Boost unlocks one more. */
  startingTiers: 4,

  /**
   * Dimension Boost (spec §6.2): requires `requirement` purchases of the
   * highest unlocked tier; resets Spark + tier purchases; grants ×mult to all
   * tier multipliers, permanently (until Collapse), and unlocks the next tier.
   */
  dimBoost: {
    requirement: 10,
    /**
     * Once every tier is unlocked, each further boost needs this many MORE
     * purchases of the top tier. Without this the requirement stays flat while
     * each boost doubles production — measured runaway: 3000+ boosts and
     * 1e14000 spark within two simulated hours.
     */
    requirementGrowth: 8,
    mult: D(2),
    /**
     * Granted after the reset so the run restarts itself: exactly enough to
     * buy the first Tier-1 orbiter. Without it a boost leaves zero spark, zero
     * production and nothing to do but tap — a soft-deadlock for idle players.
     */
    startingSpark: D(10),
  },

  /** Spark upgrade branch (spec §6.3). */
  sparkUpgrades: [
    {
      id: 'chargeCoil',
      name: 'Charge Coil',
      desc: 'Tap power ×2',
      baseCost: D(50),
      costGrowth: D(4),
      effectPerLevel: D(2),
      maxLevel: null,
    },
    {
      id: 'fluxLattice',
      name: 'Flux Lattice',
      desc: 'All Spark +25%',
      baseCost: D(200),
      costGrowth: D(1.8),
      effectPerLevel: D(1.25),
      maxLevel: null,
    },
    {
      id: 'ignition',
      name: 'Ignition',
      desc: 'Tier-1 production ×2',
      baseCost: D(2500),
      costGrowth: D(12),
      effectPerLevel: D(2),
      maxLevel: 8,
    },
    {
      id: 'cascade',
      name: 'Cascade',
      desc: 'Tier 2+ production +10%',
      baseCost: D(1e4),
      costGrowth: D(3),
      effectPerLevel: D(1.1),
      maxLevel: null,
    },
  ] as RepeatableUpgradeDef[],

  /** Motes & Resonance branch (spec §6.4). Costs are in Motes. */
  motes: {
    /** moteRate = base * sqrt(Tier-1 amount) * resonanceMult, per second. */
    base: D(0.05),
    upgrades: [
      {
        id: 'focus',
        name: 'Focus',
        desc: 'Orbit speed +20% (production speed, all tiers)',
        baseCost: D(10),
        costGrowth: D(2.2),
        effectPerLevel: D(1.2),
        maxLevel: null,
      },
      {
        id: 'density',
        name: 'Density',
        desc: 'Spark per orbiter +50%',
        baseCost: D(25),
        costGrowth: D(2.6),
        effectPerLevel: D(1.5),
        maxLevel: null,
      },
      {
        id: 'resonance',
        name: 'Resonance',
        desc: 'Mote gain +50%',
        baseCost: D(50),
        costGrowth: D(3),
        effectPerLevel: D(1.5),
        maxLevel: null,
      },
    ] as RepeatableUpgradeDef[],
  },

  /** P1 teaser + gain formula (implemented in Phase 3; threshold shown as the locked-tab hint now). */
  collapse: { unlockSpark: D(1e6), coef: D(1e4), exp: 0.5 },

  /**
   * Softcaps (spec §6.5). Focus and Density are capped beyond the spec's
   * list because Motes scale with Tier-1 throughput: spark → motes → speed/
   * density → spark is a feedback loop, and uncapped it amplifies the
   * lategame polynomially.
   */
  softcap: {
    /** Applied to the composed Resonance multiplier. */
    resonance: { t: D(1e4), p: 0.5 },
    /** Applied to the composed Flux Lattice multiplier. */
    fluxLattice: { t: D(1e6), p: 0.5 },
    /** Applied to the composed Focus (speed) multiplier. */
    focus: { t: D(100), p: 0.5 },
    /** Applied to the composed Density multiplier. */
    density: { t: D(1e3), p: 0.5 },
  },

  /** Offline progress (spec §5, §8.6). */
  offline: { baseCapH: 4, chunkSteps: 100 },

  /** Logic ticks per second. */
  tickRate: 20,

  /** Autosave cadence, seconds. */
  autosaveSeconds: 10,
} as const;
