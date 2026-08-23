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

/** Star Chart node (spec §8.1). Effects compose in multipliers.ts. */
export type StarNodeEffect =
  | { kind: 'global'; mult: Decimal }
  | { kind: 'tier'; tier: number; mult: Decimal }
  | { kind: 'mote'; mult: Decimal }
  | { kind: 'tap'; mult: Decimal }
  | { kind: 'speed'; mult: Decimal }
  | { kind: 'offlineCapH'; hours: number }
  | { kind: 'autobuyTier'; tier: number };

export interface StarNodeDef {
  id: string;
  name: string;
  desc: string;
  cost: Decimal; // in Shards
  ring: 1 | 2 | 3;
  requires: string[]; // all must be active
  effect: StarNodeEffect;
}

/** Shard upgrade (P1's own tree, spec §7). Effects are bespoke per id. */
export interface ShardUpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: Decimal; // in Shards
  costGrowth: Decimal;
  maxLevel: number | null;
}

/** Prism grid entry (P2's own tree, spec §7). Cost in Prism. */
export interface PrismUpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: Decimal;
  costGrowth: Decimal;
  maxLevel: number | null;
}

export type ElementId = 'ignis' | 'aqua' | 'terra' | 'aer' | 'lux';

/** Aeon tree node (P3's own tree, spec §7): one-time structural perks. */
export interface AeonNodeDef {
  id: string;
  name: string;
  desc: string;
  cost: Decimal; // in Aeon
}

/** Miner def (spec §8.3). Bought with Spark; produces Ore continuously. */
export interface MinerDef {
  id: string;
  name: string;
  baseCost: Decimal; // in Spark
  costGrowth: Decimal;
  orePerSec: Decimal;
}

/** Research node (spec §8.3): one-time, bought with Ore, survives Converge. */
export interface ResearchDef {
  id: string;
  name: string;
  desc: string;
  cost: Decimal; // in Ore
}

/** Boost Manager (spec §8.7): assignable to limited slots. */
export interface ManagerDef {
  id: string;
  name: string;
  desc: string;
}

export interface ElementDef {
  id: ElementId;
  symbol: string;
  name: string;
  desc: string;
  /** Terra allocates only once Minerals exist (P3). */
  locked?: boolean;
}

export interface ChallengeDef {
  id: string;
  name: string;
  restriction: string;
  rewardDesc: string;
  maxTier: number;
  /** Spark goal for completing tier `tier` (0-indexed next tier). */
  goalBase: Decimal;
  goalGrowth: Decimal;
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

  /**
   * P1 — Collapse (spec §7). Gain: shards = floor((bestSparkRun/coef)^exp).
   * Effect: global ×(1 + multPerShard·shards), softcapped (softcap.shard).
   */
  collapse: { unlockSpark: D(1e6), coef: D(1e4), exp: 0.5, multPerShard: D(0.25) },

  /** Shard upgrade tree (P1's own tree). Effects are implemented in prestige.ts/shardperks.ts. */
  shardUpgrades: [
    {
      id: 'swiftServos',
      name: 'Swift Servos',
      desc: 'Autobuyers act 2× faster',
      baseCost: D(3),
      costGrowth: D(3),
      maxLevel: 5,
    },
    {
      id: 'emberBank',
      name: 'Ember Bank',
      desc: 'Start runs with Spark (×10 per level)',
      baseCost: D(2),
      costGrowth: D(4),
      maxLevel: 8,
    },
    {
      id: 'moteEcho',
      name: 'Mote Echo',
      desc: 'Keep 20% of Motes per level on Collapse',
      baseCost: D(4),
      costGrowth: D(4),
      maxLevel: 5,
    },
    {
      id: 'boostEcho',
      name: 'Boost Echo',
      desc: 'Keep 1 Dimension Boost per level on Collapse',
      baseCost: D(6),
      costGrowth: D(6),
      maxLevel: 3,
    },
  ] as ShardUpgradeDef[],

  /**
   * Star Chart (spec §8.1). Ring 1 opens at P1; rings 2/3 gate on later
   * prestige layers (teased now, purchasable in their phases).
   */
  starChart: [
    // trunk
    { id: 'ignite', name: 'Ignite', desc: 'All production +10%', cost: D(1), ring: 1, requires: [], effect: { kind: 'global', mult: D(1.1) } },
    // production branch
    { id: 'kindling', name: 'Kindling', desc: 'Tier 1 production ×1.5', cost: D(2), ring: 1, requires: ['ignite'], effect: { kind: 'tier', tier: 1, mult: D(1.5) } },
    { id: 'lattice', name: 'Lattice', desc: 'Tier 2 production ×1.5', cost: D(3), ring: 1, requires: ['kindling'], effect: { kind: 'tier', tier: 2, mult: D(1.5) } },
    { id: 'corona', name: 'Corona', desc: 'All production +25%', cost: D(6), ring: 1, requires: ['lattice'], effect: { kind: 'global', mult: D(1.25) } },
    // mote branch
    { id: 'moteStream', name: 'Mote Stream', desc: 'Mote gain ×2', cost: D(2), ring: 1, requires: ['ignite'], effect: { kind: 'mote', mult: D(2) } },
    { id: 'moteFlood', name: 'Mote Flood', desc: 'Mote gain ×2', cost: D(4), ring: 1, requires: ['moteStream'], effect: { kind: 'mote', mult: D(2) } },
    { id: 'moteSea', name: 'Mote Sea', desc: 'Mote gain ×3', cost: D(8), ring: 1, requires: ['moteFlood'], effect: { kind: 'mote', mult: D(3) } },
    // automation / QoL branch
    { id: 'handspark', name: 'Handspark', desc: 'Tap power ×4', cost: D(2), ring: 1, requires: ['ignite'], effect: { kind: 'tap', mult: D(4) } },
    { id: 'servo4', name: 'Fourth Servo', desc: 'Autobuyer for Tier 4', cost: D(5), ring: 1, requires: ['handspark'], effect: { kind: 'autobuyTier', tier: 4 } },
    { id: 'driftClock', name: 'Drift Clock', desc: 'Offline cap +2h', cost: D(6), ring: 1, requires: ['servo4'], effect: { kind: 'offlineCapH', hours: 2 } },
    { id: 'gyreSpin', name: 'Gyre Spin', desc: 'Orbit speed +25%', cost: D(8), ring: 1, requires: ['driftClock'], effect: { kind: 'speed', mult: D(1.25) } },
    // ring 2 teasers (purchasable from Phase 4 / Ascend)
    { id: 'outerIgnite', name: 'Outer Ignite', desc: 'All production +50%', cost: D(15), ring: 2, requires: ['corona'], effect: { kind: 'global', mult: D(1.5) } },
    { id: 'outerMote', name: 'Outer Stream', desc: 'Mote gain ×5', cost: D(20), ring: 2, requires: ['moteSea'], effect: { kind: 'mote', mult: D(5) } },
  ] as StarNodeDef[],

  /** Automation v1 (spec §8.7). Base seconds between autobuyer passes. */
  automation: { baseInterval: 1 },

  /**
   * P2 — Ascend (spec §7). Gain: prism = floor(sqrt(bestShards/coef)), plus
   * one free Prism per completed Dim challenge tier. Effect: everything
   * ×2^softcap(prismEver) — exponent capped via softcap.prismExp.
   */
  ascend: { unlockShards: D(50), coef: D(8), exp: 0.5 },

  /** Prism grid (P2's own tree). Repeatable, rising Prism cost. */
  prismGrid: [
    {
      id: 'amplify',
      name: 'Amplify',
      desc: 'All production ×2',
      baseCost: D(2),
      costGrowth: D(3),
      maxLevel: null,
    },
    {
      id: 'momentum',
      name: 'Momentum',
      desc: 'Production speed ×1.5',
      baseCost: D(3),
      costGrowth: D(3),
      maxLevel: null,
    },
    {
      id: 'abundance',
      name: 'Abundance',
      desc: 'Mote gain ×3',
      baseCost: D(2),
      costGrowth: D(4),
      maxLevel: null,
    },
  ] as PrismUpgradeDef[],

  /**
   * Elements (spec §8.2). Points come from Ascends (+2), challenge
   * completions (+1) and a slow passive trickle; allocation is free to respec.
   */
  elements: {
    defs: [
      { id: 'ignis', symbol: '△', name: 'Ignis', desc: 'Spark +10% per point' },
      { id: 'aqua', symbol: '○', name: 'Aqua', desc: 'Motes +10% per point' },
      { id: 'terra', symbol: '□', name: 'Terra', desc: 'Ore +10% per point (Converge)', locked: true },
      { id: 'aer', symbol: '◇', name: 'Aer', desc: 'Speed +10% per point' },
      { id: 'lux', symbol: '☆', name: 'Lux', desc: 'Everything +5% per point' },
    ] as ElementDef[],
    perPoint: { ignis: D(1.1), aqua: D(1.1), terra: D(1.1), aer: D(1.1), lux: D(1.05) },
    /** ≥ capstoneAt points in one element: extra global multiplier. */
    capstoneAt: 10,
    capstoneMult: D(1.2),
    pointsPerAscend: 2,
    pointsPerChallenge: 1,
    /** Seconds of play per passive point once unlocked. */
    passiveSeconds: 3600,
  },

  /**
   * Challenges (spec §8.4): a run under a restriction; reaching the Spark
   * goal completes the tier for a permanent reward. Goals scale per tier.
   */
  challenges: {
    defs: [
      {
        id: 'stillRing',
        name: 'Still Ring',
        restriction: 'Production speed locked to 1',
        rewardDesc: 'Base speed +50% per tier',
        maxTier: 3,
        goalBase: D(1e7),
        goalGrowth: D(1e3),
      },
      {
        id: 'famine',
        name: 'Famine',
        restriction: 'Motes disabled',
        rewardDesc: 'Mote gain ×3 per tier',
        maxTier: 3,
        goalBase: D(1e7),
        goalGrowth: D(1e3),
      },
      {
        id: 'solitary',
        name: 'Solitary',
        restriction: 'Only Tier-1 orbiters can be bought',
        rewardDesc: 'All tier production +10% per tier',
        maxTier: 3,
        goalBase: D(3e6),
        goalGrowth: D(1e3),
      },
      {
        id: 'brittle',
        name: 'Brittle',
        restriction: 'Orbiter costs grow much faster',
        rewardDesc: 'Cost growth −5% per tier',
        maxTier: 3,
        goalBase: D(1e7),
        goalGrowth: D(1e3),
      },
      {
        id: 'dim',
        name: 'Dim',
        restriction: 'Global multiplier forced to ×1',
        rewardDesc: '+1 free Prism on every Ascend per tier',
        maxTier: 3,
        goalBase: D(3e6),
        goalGrowth: D(1e3),
      },
    ] as ChallengeDef[],
    /** Brittle restriction: costGrowth ^ this while inside the run. */
    brittleGrowthExp: 1.25,
    /** Brittle reward: costGrowth ^ (this ^ tiers). */
    brittleRewardExp: 0.95,
    stillRingReward: D(1.5),
    famineReward: D(3),
    solitaryReward: D(1.1),
  },

  /**
   * P3 — Converge (spec §7). Gain: aeon = floor(log2(bestPrism + 1)) — slow
   * on purpose. Effect: all tier multipliers ×tierMultPer per lifetime Aeon,
   * offline cap +offlineCapHPer hours per lifetime Aeon.
   */
  converge: { unlockPrism: D(30), tierMultPer: D(1.5), offlineCapHPer: 1 },

  /** Aeon tree (P3's own tree): permanent structural nodes. */
  aeonTree: [
    { id: 'autoCollapse', name: 'Standing Wave', desc: 'Auto-Collapse when the gain is worthwhile', cost: D(2) },
    { id: 'keepMotes', name: 'Mote Memory', desc: 'Keep 50% of Motes through Ascend', cost: D(3) },
    { id: 'dimPower', name: 'Deep Engine', desc: 'All tier production ×2', cost: D(4) },
    { id: 'keepChart', name: 'Fixed Stars', desc: 'Star Chart nodes survive Ascend', cost: D(5) },
  ] as AeonNodeDef[],

  /** Miners (spec §8.3): Ore producers. Only Converge/Unify reset them. */
  miners: [
    { id: 'drill', name: 'Drill', baseCost: D(1e8), costGrowth: D(4), orePerSec: D(0.1) },
    { id: 'auger', name: 'Auger', baseCost: D(1e12), costGrowth: D(5), orePerSec: D(0.6) },
    { id: 'rig', name: 'Rig', baseCost: D(1e17), costGrowth: D(6), orePerSec: D(3) },
  ] as MinerDef[],

  /** Research tree: one-time Ore purchases; the permanent slow backbone. */
  research: [
    { id: 'oreSluice', name: 'Sluice', desc: 'Ore gain ×2', cost: D(50) },
    { id: 'fastServos', name: 'Overclock', desc: 'Autobuyers act 2× faster', cost: D(120) },
    { id: 'deepClock', name: 'Deep Clock', desc: 'Offline cap +4h', cost: D(250) },
    { id: 'slotA', name: 'Quarters I', desc: '+1 Boost Manager slot', cost: D(400) },
    { id: 'oreVein', name: 'Rich Veins', desc: 'Ore gain ×3', cost: D(800) },
    { id: 'slotB', name: 'Quarters II', desc: '+1 Boost Manager slot', cost: D(1500) },
    { id: 'gyreHeart', name: 'Gyre Heart', desc: 'All production ×2', cost: D(3000) },
    { id: 'singularitySeed', name: 'Singularity Seed', desc: 'Opens the path to Unify (P4)', cost: D(10000) },
  ] as ResearchDef[],

  /** Boost Managers (spec §8.7): assign to limited slots. */
  managers: {
    baseSlots: 1,
    defs: [
      { id: 'kindler', name: 'Kindler', desc: 'Spark ×2 while assigned' },
      { id: 'weaver', name: 'Weaver', desc: 'Mote gain ×1.5 while assigned' },
      { id: 'warden', name: 'Warden', desc: 'Autobuyers 2× faster while assigned' },
      { id: 'seer', name: 'Seer', desc: 'Offline cap ×1.5 while assigned' },
    ] as ManagerDef[],
  },

  /** Time Flux (spec §8.6): offline overflow banks as Flux once P3 is reached. */
  timeflux: {
    fluxPerOverflowMinute: D(1),
    warp: { cost: D(60), mult: 2, seconds: 300 },
    boost: { cost: D(30), mult: D(3), seconds: 120 },
  },

  /**
   * Softcaps (spec §6.5). Focus and Density are capped beyond the spec's
   * list because Motes scale with Tier-1 throughput: spark → motes → speed/
   * density → spark is a feedback loop, and uncapped it amplifies the
   * lategame polynomially.
   */
  softcap: {
    /** Applied to the Shard multiplier (1 + 0.25·shards). */
    shard: { t: D(1e3), p: 0.5 },
    /** Applied to the EXPONENT of the Prism multiplier (2^prism). */
    prismExp: { t: 60, p: 0.5 },
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
