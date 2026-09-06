/**
 * ALL tunable economy constants (spec §17). Single source of truth.
 *
 * Systems import `BAL` and never hardcode economy literals. A designer tunes
 * the game here and only here; the pacing harness in __tests__/pacing.test.ts
 * measures the short game and __tests__/longwalk.test.ts measures the month.
 *
 * PURE MODULE — no React, no React Native.
 *
 * ===========================================================================
 * THE THREE RULES OF THIS ECONOMY (the Phase 12 rebalance)
 * ===========================================================================
 *
 * 1. NOTHING IS ADDITIVE. A reward stated as "+100,000 Spark" is worth
 *    everything at 10 Spark and nothing at 10 million, which is how a game
 *    ends up full of upgrades nobody looks at twice. Every buff in GYRE is a
 *    MULTIPLIER on something, so its value is the same fraction of your
 *    output on day 1 and on day 30. The two that broke this rule before —
 *    the achievement bonus (1 + 0.01·n) and the raw Shard multiplier — are
 *    now 1.03^n and a softcapped lane whose real sink is the Star Chart.
 *
 * 2. EVERY CURRENCY HAS AN ENDLESS SINK. A finite tree is a dead tree: it is
 *    bought out, and from then on the currency that buys it is a number that
 *    goes up for no reason. Spark, Motes, Shards, Prism, Ore, Aeon and
 *    Singularity each own at least one uncapped, geometrically-priced
 *    multiplier (fluxLattice, crystallize, shardLens/the chart, amplify,
 *    deepRefine, aeonWell, eternalFlame). That is what keeps a currency worth
 *    earning at hour 600.
 *
 * 3. LAYERS GATE EACH OTHER SIDEWAYS, not just upward. Converge needs Prism
 *    AND completed Trials; Unify needs Aeon AND Ore-bought Research AND more
 *    Trials. You cannot ride one lane to the end — the fast route is the one
 *    that keeps every lane moving, and choosing WHICH lane to push next is
 *    the whole game. (`gates` below.)
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
  | { kind: 'ore'; mult: Decimal }
  | { kind: 'tap'; mult: Decimal }
  | { kind: 'speed'; mult: Decimal }
  | { kind: 'offlineCapH'; hours: number }
  | { kind: 'autobuyTier'; tier: number };

/**
 * A Star Chart node is RANKED, not a switch.
 *
 * As a set of one-time toggles the whole chart was worth a fixed ×3 and was
 * bought out during the first Ascend — after which Shards, the entire reward
 * of the P1 layer, bought nothing at all. Ranks with a geometric price turn
 * the chart into the Shard sink for the rest of the game, and `mult` is now
 * PER RANK.
 */
export interface StarNodeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: Decimal; // in Shards, for rank 1
  costGrowth: Decimal;
  /** null = endless. */
  maxRank: number | null;
  ring: 1 | 2 | 3;
  /** All must be at rank ≥ 1. */
  requires: string[];
  effect: StarNodeEffect;
}

/**
 * Shard upgrade (P1's own tree, spec §7).
 *
 * Most are STRUCTURAL (keep motes, keep boosts, faster autobuyers) and their
 * effects are bespoke in shardperks.ts. `effectPerLevel` is for the ones that
 * are a plain multiplier, so the number lives here rather than in the system —
 * see the note on `PrismUpgradeDef`.
 */
export interface ShardUpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: Decimal; // in Shards
  costGrowth: Decimal;
  maxLevel: number | null;
  effectPerLevel?: Decimal;
}

/**
 * A repeatable grid entry — the Prism grid, the Aeon grid, repeatable
 * Research, and the Meta grid all share this shape.
 *
 * `effectPerLevel` is NOT optional decoration. Before it existed, "All
 * production ×2" lived in the `desc` string here and `D(2).pow(level)` lived
 * in multipliers.ts, so a retune could change the label without changing the
 * game — the exact class of drift this file's "single source of truth" header
 * exists to prevent. What the effect APPLIES to is still per-system; how big
 * it is, is here.
 */
export interface PrismUpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: Decimal;
  costGrowth: Decimal;
  maxLevel: number | null;
  effectPerLevel: Decimal;
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

/** Meta Shop entry (P4, spec §7): one-time, bought with Singularity. */
export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: string;
  cost: Decimal; // in Singularity
}

/**
 * Achievement (spec §8.5). `check` is a pure predicate over GameState,
 * evaluated in the tick's unlock step (already-earned ones are skipped).
 * Grouped only for the UI grid.
 */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  group: 'spark' | 'orbiters' | 'motes' | 'prestige' | 'depths' | 'mastery';
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
   * A tap is ALSO worth this many seconds of your current production,
   * whichever is larger.
   *
   * Without it, tapping is dead content by minute three and stays dead for a
   * month — and every Collapse, Ascend and Trial entry drops you back to zero
   * production with nothing to do but wait for the autobuyers. With it, the
   * opening of every run rewards hands on the screen (about +50% at a human
   * five taps a second) without ever being mandatory. It is the cheapest
   * "active play beats idle play" lever in the game, and it is the first
   * thing a speedrun route leans on.
   */
  tapProductionSeconds: 0.1,

  /**
   * Orbiter dimension chain (spec §6.2). Index 0 = Tier 1.
   *
   * costGrowth is per SINGLE purchase, so it must stay shallow (1.2–1.6):
   * the spec's draft values of 1.6–2.3 made ten purchases cost ×100+ the base
   * and walled Dimension Boosts behind the Collapse threshold, inverting the
   * §10 pacing. Measured by __tests__/pacing.test.ts — retune there, not by
   * feel.
   *
   * The FIRST FOUR are deliberately steeper than the rest: those are the only
   * tiers a player buys by hand, and at a shallow draft one MAX-buy bought
   * forty orbiters at a stroke, so the opening minutes had no resistance in
   * them at all.
   */
  dimensions: [
    { baseCost: D(10), costGrowth: D(1.24), perOrbiter: D(0.4) },
    { baseCost: D(1e2), costGrowth: D(1.28), perOrbiter: D(0.09) },
    { baseCost: D(1e3), costGrowth: D(1.32), perOrbiter: D(0.07) },
    { baseCost: D(1e4), costGrowth: D(1.36), perOrbiter: D(0.055) },
    { baseCost: D(1e6), costGrowth: D(1.38), perOrbiter: D(0.045) },
    { baseCost: D(1e8), costGrowth: D(1.42), perOrbiter: D(0.036) },
    { baseCost: D(1e11), costGrowth: D(1.48), perOrbiter: D(0.028) },
    { baseCost: D(1e15), costGrowth: D(1.58), perOrbiter: D(0.02) },
  ] as DimensionDef[],

  /** Tiers 1..N are available from the start; each Dimension Boost unlocks one more. */
  startingTiers: 4,

  /**
   * Dimension Boost (spec §6.2): requires `requirement` purchases of the
   * highest unlocked tier; resets Spark + tier purchases; grants ×mult to all
   * tier multipliers, permanently (until Collapse), and unlocks the next tier.
   */
  dimBoost: {
    requirement: 12,
    /**
     * Each boost needs this many MORE purchases of the top tier than the last.
     * Without any growth the requirement stays flat while each boost doubles
     * production — measured runaway: 3000+ boosts and 1e14000 spark within two
     * simulated hours.
     */
    requirementGrowth: 5,
    mult: D(2),
    /**
     * Granted after the reset so the run restarts itself: exactly enough to
     * buy the first Tier-1 orbiter. Without it a boost leaves zero spark, zero
     * production and nothing to do but tap — a soft-deadlock for idle players.
     */
    startingSpark: D(10),
  },

  /**
   * Spark upgrade branch (spec §6.3).
   *
   * Six lanes, each owning a different part of the machine so none is ever
   * strictly dominated: tap (the opening of every run), flat Spark, Tier 1,
   * Tiers 2+, speed, and depth. `overdrive` and `chainReaction` are new — the
   * old four left Spark with nothing to buy above 1e12 except more Flux
   * Lattice, which is exactly the "one upgrade matters" shape this pass is
   * about.
   */
  sparkUpgrades: [
    {
      id: 'chargeCoil',
      name: 'Charge Coil',
      desc: 'Tap power ×3',
      baseCost: D(50),
      costGrowth: D(5),
      effectPerLevel: D(3),
      maxLevel: 20,
    },
    {
      id: 'fluxLattice',
      name: 'Flux Lattice',
      desc: 'All Spark +28%',
      baseCost: D(250),
      costGrowth: D(2.1),
      effectPerLevel: D(1.28),
      maxLevel: null,
    },
    {
      id: 'ignition',
      name: 'Ignition',
      desc: 'Tier-1 production ×2.5',
      baseCost: D(5e3),
      costGrowth: D(15),
      effectPerLevel: D(2.5),
      maxLevel: 12,
    },
    {
      id: 'cascade',
      name: 'Cascade',
      desc: 'Tier 2+ production +15%',
      baseCost: D(2e4),
      costGrowth: D(3.2),
      effectPerLevel: D(1.15),
      maxLevel: null,
    },
    {
      id: 'overdrive',
      name: 'Overdrive',
      desc: 'Production speed +10%',
      baseCost: D(5e6),
      costGrowth: D(4.5),
      effectPerLevel: D(1.1),
      maxLevel: null,
    },
    {
      /**
       * Compounds PER TIER INDEX: tier k gets effectPerLevel^(k·level).
       * The one upgrade that pays you for going deep rather than wide, so
       * Dimension Boosts have a second reason to exist besides the flat ×2.
       */
      id: 'chainReaction',
      name: 'Chain Reaction',
      desc: 'Each tier +3% per level, compounding with its depth',
      baseCost: D(1e10),
      costGrowth: D(7),
      effectPerLevel: D(1.03),
      maxLevel: null,
    },
  ] as RepeatableUpgradeDef[],

  /** Motes & Resonance branch (spec §6.4). Costs are in Motes. */
  motes: {
    /** moteRate = base * sqrt(Tier-1 amount) * resonanceMult, per second. */
    base: D(0.04),
    upgrades: [
      {
        id: 'focus',
        name: 'Focus',
        desc: 'Orbit speed +18% (production speed, all tiers)',
        baseCost: D(12),
        costGrowth: D(2.4),
        effectPerLevel: D(1.18),
        maxLevel: null,
      },
      {
        id: 'density',
        name: 'Density',
        desc: 'Spark per orbiter +40%',
        baseCost: D(30),
        costGrowth: D(2.8),
        effectPerLevel: D(1.4),
        maxLevel: null,
      },
      {
        id: 'resonance',
        name: 'Resonance',
        desc: 'Mote gain +50%',
        baseCost: D(60),
        costGrowth: D(3),
        effectPerLevel: D(1.5),
        maxLevel: null,
      },
      {
        /**
         * Motes' one GLOBAL lane. Without it the Mote economy only ever feeds
         * itself — motes buy mote gain buys motes — and a player who ignored
         * the tab entirely lost almost nothing. This is what makes the Mote
         * curve worth optimising against the Spark curve.
         */
        id: 'crystallize',
        name: 'Crystallize',
        desc: 'All production ×1.25',
        baseCost: D(600),
        costGrowth: D(3.6),
        effectPerLevel: D(1.25),
        maxLevel: null,
      },
    ] as RepeatableUpgradeDef[],
  },

  /**
   * P1 — Collapse (spec §7).
   *
   * Gain is LOGARITHMIC in Spark: shards = floor(perDecade · log10(best/coef)).
   * The spec offers "sublinear (sqrt/log)" and the sqrt draft does not survive
   * contact with the dimension chain: Spark's exponent grows roughly linearly
   * with time, so sqrt gains grow *exponentially* with time and one deep run
   * clears every threshold above it at once. Log gain makes a Shard cost a
   * fixed number of Spark decades, which is what turns the ladder back into a
   * ladder.
   *
   * `perDecade` is the single strongest pacing constant in the game: it sets
   * how many decades of Spark one Shard costs, and every layer above is
   * denominated in Shards. It came down from 0.7 to 0.5 in this pass, and
   * `unlockSpark` went 1e7 → 1e10, which is most of why the first Collapse
   * moved from seven minutes to half an hour.
   *
   * Effect: global ×(1 + multPerShard·shards), softcapped (softcap.shard).
   * That softcap is deliberate and is NOT the reason to earn Shards — the
   * Star Chart is. Shards buy ranks; ranks are uncapped.
   */
  collapse: { unlockSpark: D(1e13), coef: D(1e11), perDecade: 0.5, multPerShard: D(0.25) },

  /** Shard upgrade tree (P1's own tree). Effects are implemented in prestige.ts/shardperks.ts. */
  shardUpgrades: [
    {
      id: 'swiftServos',
      name: 'Swift Servos',
      desc: 'Autobuyers act 2× faster',
      baseCost: D(5),
      costGrowth: D(4),
      maxLevel: 8,
    },
    {
      id: 'emberBank',
      name: 'Ember Bank',
      desc: 'Start runs with Spark (×10 per level)',
      baseCost: D(3),
      costGrowth: D(4.5),
      maxLevel: 20,
    },
    {
      id: 'moteEcho',
      name: 'Mote Echo',
      desc: 'Keep 20% of Motes per level on Collapse',
      baseCost: D(6),
      costGrowth: D(5),
      maxLevel: 5,
    },
    {
      id: 'boostEcho',
      name: 'Boost Echo',
      desc: 'Keep 1 Dimension Boost per level on Collapse',
      baseCost: D(10),
      costGrowth: D(4),
      maxLevel: 12,
    },
    {
      /** The endless one. Every Shard past the capped four still buys power. */
      id: 'shardLens',
      name: 'Shard Lens',
      desc: 'All production ×1.6',
      baseCost: D(30),
      costGrowth: D(2.6),
      maxLevel: null,
      effectPerLevel: D(1.6),
    },
  ] as ShardUpgradeDef[],

  /**
   * Star Chart (spec §8.1) — the primary Shard sink, and now RANKED.
   *
   * Ring 1 opens at P1, ring 2 at P2 (Ascend), ring 3 at P3 (Converge).
   * `mult` on every effect is PER RANK, and the endless nodes (ignite,
   * corona, gyreSpin, outerIgnite, outerSpin, deepVein, deepCore) are what a
   * player with ten thousand Shards actually spends them on.
   *
   * `deepVein` is the deliberate cross-lane node: Shards — the P1 currency —
   * buying Ore gain, the P3 lane. It is there so that pushing Collapses is a
   * legitimate way to accelerate mining, which is one half of rule 3 above.
   */
  starChart: [
    // trunk
    { id: 'ignite', name: 'Ignite', desc: 'All production +12%', baseCost: D(1), costGrowth: D(1.9), maxRank: null, ring: 1, requires: [], effect: { kind: 'global', mult: D(1.12) } },
    // production branch
    { id: 'kindling', name: 'Kindling', desc: 'Tier 1 production ×1.5', baseCost: D(3), costGrowth: D(2.1), maxRank: 20, ring: 1, requires: ['ignite'], effect: { kind: 'tier', tier: 1, mult: D(1.5) } },
    { id: 'lattice', name: 'Lattice', desc: 'Tier 2 production ×1.5', baseCost: D(5), costGrowth: D(2.1), maxRank: 20, ring: 1, requires: ['kindling'], effect: { kind: 'tier', tier: 2, mult: D(1.5) } },
    { id: 'corona', name: 'Corona', desc: 'All production +25%', baseCost: D(12), costGrowth: D(2.4), maxRank: null, ring: 1, requires: ['lattice'], effect: { kind: 'global', mult: D(1.25) } },
    // mote branch
    { id: 'moteStream', name: 'Mote Stream', desc: 'Mote gain ×2', baseCost: D(3), costGrowth: D(2.3), maxRank: 15, ring: 1, requires: ['ignite'], effect: { kind: 'mote', mult: D(2) } },
    { id: 'moteFlood', name: 'Mote Flood', desc: 'Mote gain ×2.5', baseCost: D(8), costGrowth: D(2.6), maxRank: 12, ring: 1, requires: ['moteStream'], effect: { kind: 'mote', mult: D(2.5) } },
    { id: 'moteSea', name: 'Mote Sea', desc: 'Mote gain ×3', baseCost: D(20), costGrowth: D(3), maxRank: 10, ring: 1, requires: ['moteFlood'], effect: { kind: 'mote', mult: D(3) } },
    // automation / QoL branch
    { id: 'handspark', name: 'Handspark', desc: 'Tap power ×5', baseCost: D(3), costGrowth: D(3), maxRank: 8, ring: 1, requires: ['ignite'], effect: { kind: 'tap', mult: D(5) } },
    { id: 'servo4', name: 'Fourth Servo', desc: 'Autobuyer for Tier 4', baseCost: D(8), costGrowth: D(1), maxRank: 1, ring: 1, requires: ['handspark'], effect: { kind: 'autobuyTier', tier: 4 } },
    { id: 'driftClock', name: 'Drift Clock', desc: 'Offline cap +2h', baseCost: D(12), costGrowth: D(2), maxRank: 8, ring: 1, requires: ['servo4'], effect: { kind: 'offlineCapH', hours: 2 } },
    { id: 'gyreSpin', name: 'Gyre Spin', desc: 'Orbit speed +18%', baseCost: D(15), costGrowth: D(2.5), maxRank: null, ring: 1, requires: ['driftClock'], effect: { kind: 'speed', mult: D(1.18) } },
    // ring 2 — opens at Ascend
    { id: 'outerIgnite', name: 'Outer Ignite', desc: 'All production ×1.5', baseCost: D(60), costGrowth: D(2.8), maxRank: null, ring: 2, requires: ['corona'], effect: { kind: 'global', mult: D(1.5) } },
    { id: 'outerMote', name: 'Outer Stream', desc: 'Mote gain ×5', baseCost: D(80), costGrowth: D(3), maxRank: 12, ring: 2, requires: ['moteSea'], effect: { kind: 'mote', mult: D(5) } },
    { id: 'outerSpin', name: 'Outer Spin', desc: 'Orbit speed ×1.4', baseCost: D(120), costGrowth: D(3), maxRank: null, ring: 2, requires: ['gyreSpin'], effect: { kind: 'speed', mult: D(1.4) } },
    // ring 3 — opens at Converge
    { id: 'deepVein', name: 'Deep Vein', desc: 'Ore gain ×2', baseCost: D(400), costGrowth: D(3), maxRank: null, ring: 3, requires: ['outerIgnite'], effect: { kind: 'ore', mult: D(2) } },
    { id: 'deepCore', name: 'Deep Core', desc: 'All production ×2', baseCost: D(700), costGrowth: D(3.2), maxRank: null, ring: 3, requires: ['outerIgnite'], effect: { kind: 'global', mult: D(2) } },
    { id: 'deepClockNode', name: 'Long Drift', desc: 'Offline cap +6h', baseCost: D(600), costGrowth: D(2.5), maxRank: 10, ring: 3, requires: ['deepCore'], effect: { kind: 'offlineCapH', hours: 6 } },
  ] as StarNodeDef[],

  /** Automation v1 (spec §8.7). Base seconds between autobuyer passes. */
  automation: { baseInterval: 1 },

  /**
   * "Is this reset worth taking?" — the shared rule behind the auto-prestige
   * toggles and the balance harness's player model (systems/prestige.ts).
   *
   * COLLAPSE USES A DIFFERENT RULE FROM THE OTHER THREE, and the difference is
   * the single most important thing on this page.
   *
   * Ascend, Converge and Unify all gain a POWER of the layer below
   * (√shardsEver, √prismEver, aeonEver^0.55), and the layer below grows
   * exponentially with time — so their gains grow exponentially too, and "is
   * this gain at least a tenth of everything I have earned?" is a rule that
   * keeps firing forever. Those three are fractions.
   *
   * Collapse gains the LOG of Spark: half a Shard per decade. A run's gain
   * therefore grows only as fast as the Spark exponent, which is roughly
   * linear in time, while `shardsEver` is the SUM of every run so far and
   * grows without bound. gain / shardsEver decays to zero no matter what
   * fraction you pick, so any fraction rule eventually stops firing and the
   * whole ladder above it starves. Measured at the old 0.25: Collapses fell
   * from one a minute to one an hour by hour 20, Ascends stalled at fifteen,
   * and Converge never arrived at all inside a 48-hour walk.
   *
   * So Collapse asks a scale-free question instead: IS THIS RUN BETTER THAN MY
   * BEST RUN THIS CYCLE, by `collapseBeatsBest`?
   *
   * It has to be the BEST and not the average. Measured with a mean, the rule
   * eats itself: every quick Collapse drags the average down, which lowers the
   * bar, which justifies a quicker Collapse — the walk settled into 1,800
   * Collapses an hour, one every two seconds, with runs that never passed 1e8
   * Spark. A running maximum only ever goes up, so it cannot be gamed
   * downwards, and it rises at exactly the rate the player's runs improve.
   *
   * `collapsePatienceSeconds` is the escape hatch that makes the rule safe.
   * A monotone bar can in principle become unreachable (a run that cannot beat
   * the best by 10% stalls forever), and a stalled P1 starves every layer
   * above it. After this long in one run, any Collapse worth ≥ 1 Shard is
   * taken. It is also simply what a person does: nobody stares at the same run
   * for an hour waiting for a rule to clear.
   */
  prestigeStep: {
    collapseBeatsBest: 1.1,
    collapsePatienceSeconds: 1800,
    ascend: 0.06,
    converge: 0.06,
    unify: 0.15,
  },

  /**
   * P2 — Ascend (spec §7). Gain: prism = floor((shardsEver/coef)^exp), plus
   * one free Prism per completed Dim challenge tier. Effect: everything
   * ×2^softcap(prismEver) — exponent capped via softcap.prismExp.
   *
   * `unlockShards` is the bar for EACH cycle (Ascend resets shardsEver), so
   * it is the main lever on how long an Ascend cycle runs.
   */
  ascend: { unlockShards: D(6000), coef: D(250), exp: 0.5 },

  /**
   * Prism grid (P2's own tree). Repeatable, rising Prism cost.
   *
   * `resolve` here and `aeonReach` in the Aeon grid are THE TWO GAIN
   * ACCELERATORS, and they are unlike everything else in the game.
   *
   * Every other upgrade multiplies PRODUCTION. These two multiply a prestige
   * layer's GAIN FORMULA — Resolve buys Shards per decade of Spark, Long Reach
   * buys Prism per Ascend — so they change the SHAPE of the curve rather than
   * its height.
   *
   * That distinction is why the deep game works at all. Prism climbs at a rate
   * set by how often you Ascend, and that rate is independent of how big your
   * multipliers are: production growth cancels exactly against a bar that
   * grows with the square of your Prism. Measured without these two, Converge
   * settled at a flat twelve hours forever and the first Unify was 1,200 hours
   * away. With them the cadence accelerates as you invest — a curve instead of
   * a queue.
   */
  prismGrid: [
    {
      id: 'amplify',
      name: 'Amplify',
      desc: 'All production ×2',
      baseCost: D(3),
      costGrowth: D(3.2),
      maxLevel: null,
      effectPerLevel: D(2),
    },
    {
      id: 'momentum',
      name: 'Momentum',
      desc: 'Production speed ×1.5',
      baseCost: D(4),
      costGrowth: D(3.4),
      maxLevel: null,
      effectPerLevel: D(1.5),
    },
    {
      id: 'abundance',
      name: 'Abundance',
      desc: 'Mote gain ×3',
      baseCost: D(3),
      costGrowth: D(4),
      maxLevel: null,
      effectPerLevel: D(3),
    },
    {
      /**
       * Prism buying SHARD GAIN — the other half of rule 3. A layer that only
       * multiplied production would leave the layer below it obsolete the
       * moment you passed it; this makes P2 a reason to care about P1's rate
       * forever, and it is the single biggest lever a routed/speedrun player
       * has on the back half of the ladder.
       */
      id: 'resolve',
      name: 'Resolve',
      desc: 'Shard gain per decade +25%',
      baseCost: D(4),
      costGrowth: D(2.4),
      maxLevel: null,
      effectPerLevel: D(1.25),
    },
    {
      id: 'refine',
      name: 'Refine',
      desc: 'Ore gain ×2.5',
      baseCost: D(8),
      costGrowth: D(4),
      maxLevel: null,
      effectPerLevel: D(2.5),
    },
  ] as PrismUpgradeDef[],

  /**
   * Elements (spec §8.2). Points come from Ascends, challenge completions and
   * a slow passive trickle; allocation is free to respec.
   *
   * The per-element ALLOCATION is softcapped (softcap.element), not the
   * multiplier: points arrive at a steady rate forever, so 1.12^points is an
   * exponential in wall-clock time and would eventually be the only number in
   * the game that mattered. Capping the exponent leaves it a major lane and
   * keeps respec a real decision, because the marginal point is worth most in
   * an element you have not yet filled.
   */
  elements: {
    defs: [
      { id: 'ignis', symbol: '△', name: 'Ignis', desc: 'Spark +12% per point' },
      { id: 'aqua', symbol: '○', name: 'Aqua', desc: 'Motes +12% per point' },
      { id: 'terra', symbol: '□', name: 'Terra', desc: 'Ore +12% per point (Converge)', locked: true },
      { id: 'aer', symbol: '◇', name: 'Aer', desc: 'Speed +12% per point' },
      { id: 'lux', symbol: '☆', name: 'Lux', desc: 'Everything +6% per point' },
    ] as ElementDef[],
    perPoint: { ignis: D(1.12), aqua: D(1.12), terra: D(1.12), aer: D(1.12), lux: D(1.06) },
    /** Capstone thresholds in ONE element; each cleared step multiplies globally. */
    capstones: [10, 25, 50, 100],
    capstoneMult: D(1.25),
    pointsPerAscend: 2,
    pointsPerChallenge: 2,
    /** Seconds of play per passive point once unlocked. */
    passiveSeconds: 2400,
  },

  /**
   * Challenges — "Trials" (spec §8.4): a run under a restriction; reaching the
   * Spark goal completes the tier for a permanent reward.
   *
   * TRIALS ARE NO LONGER OPTIONAL. `gates` below requires completed tiers to
   * Converge and to Unify, which is the sideways interlock rule 3 describes:
   * the main loop makes Trials winnable, and Trials are what let the main loop
   * go deeper. A player who runs Trials early compounds their rewards for the
   * rest of the game — that is the routing decision the whole endgame is
   * built around, and it is what a speedrun optimises.
   *
   * GOALS ARE PER-CHALLENGE, and the spread between them is enormous — 1e8
   * against 1e1500 — because the restrictions bite by wildly different
   * amounts. They are not guesses: each pair was read off a measured Spark
   * curve of that challenge's own run (trials.test.ts enters the challenge
   * with completion suppressed and logs bestSparkRun over time). At ten
   * minutes into a first-Ascend run the same player reaches ~1e8 Spark under
   * Solitary and ~1e1500 under Brittle. One shared goal cannot ask a fair
   * question of both.
   *
   * Dim is the odd one: it forces the global multiplier to ×1, which nulls
   * Shards, Prism and Singularity alike, so its difficulty barely moves for
   * the whole game. Its goalGrowth is correspondingly savage — that is the
   * curve, not a typo.
   *
   * Anything at or above 1e309 MUST be written as a string: D(1e400) is
   * Infinity before the Decimal ever sees it.
   */
  challenges: {
    defs: [
      {
        id: 'stillRing',
        name: 'Still Ring',
        restriction: 'Production speed locked to 1',
        rewardDesc: 'Base speed ×1.6 per tier',
        maxTier: 8,
        goalBase: D('1e1400'),
        goalGrowth: D('1e150'),
      },
      {
        id: 'famine',
        name: 'Famine',
        restriction: 'Motes disabled',
        rewardDesc: 'Mote gain ×4 per tier',
        maxTier: 8,
        goalBase: D('1e1400'),
        goalGrowth: D('1e110'),
      },
      {
        id: 'solitary',
        name: 'Solitary',
        restriction: 'Only Tier-1 orbiters can be bought',
        rewardDesc: 'All tier production ×1.3 per tier',
        maxTier: 8,
        goalBase: D('1e11'),
        goalGrowth: D('1e3'),
      },
      {
        id: 'brittle',
        name: 'Brittle',
        restriction: 'Orbiter costs grow much faster',
        rewardDesc: 'Cost growth −5% per tier',
        maxTier: 8,
        goalBase: D('1e1400'),
        goalGrowth: D('1e380'),
      },
      {
        id: 'dim',
        name: 'Dim',
        restriction: 'Global multiplier forced to ×1',
        rewardDesc: '+1 free Prism on every Ascend per tier',
        maxTier: 8,
        goalBase: D('1e10'),
        goalGrowth: D('1e900'),
      },
    ] as ChallengeDef[],
    /** Brittle restriction: costGrowth ^ this while inside the run. */
    brittleGrowthExp: 1.25,
    /** Brittle reward: costGrowth ^ (this ^ tiers). */
    brittleRewardExp: 0.95,
    stillRingReward: D(1.6),
    famineReward: D(4),
    solitaryReward: D(1.3),
  },

  /**
   * THE SIDEWAYS GATES (rule 3).
   *
   * Prism/Aeon alone are not enough to go deeper: the deep layers also demand
   * that you have been playing the OTHER systems. This is the structure that
   * makes GYRE a set of interlocking lanes rather than one number climbing —
   * and it is what makes a route (and therefore a speedrun) exist at all.
   *
   * A gate is only ever a count of things a normal player earns anyway; it
   * decides the ORDER you do them in, never whether you can.
   */
  gates: {
    /** Converge also needs this many completed Trial tiers (of 40). */
    convergeTrialTiers: 5,
    /** Unify also needs this many completed Trial tiers, plus the Seed research. */
    unifyTrialTiers: 15,
    /** Unify also needs this many levels of Deep Refinement (the Ore lane). */
    unifyRefineLevels: 3,
  },

  /**
   * P3 — Converge (spec §7). Gain: aeon = floor((prismEver/coef)^exp).
   * Effect: all tier multipliers ×tierMultPer per lifetime Aeon, offline cap
   * +offlineCapHPer hours per lifetime Aeon.
   *
   * This was floor(log2(prismEver + 1)), and that is what made the endgame a
   * wall. Prism grows exponentially with time, so a log2 gain grows only
   * LINEARLY with time while aeonEver — the running sum of those gains —
   * grows quadratically: gain/aeonEver falls to zero and a Converge stops
   * ever looking worth taking. Measured on a 14-hour walk, the 4th Converge
   * landed at 5.9h and the 5th never came at all.
   *
   * A power law is safe here despite the P1 lesson, because Aeon sits two
   * sublinear steps above Spark: prism ∝ √shardsEver and shards ∝
   * log10(spark) — self-damping, not runaway.
   *
   * `exp` is 0.75 and not the 0.55 it started at, and that constant is the
   * whole late-game cadence. The bar a Converge has to clear grows as
   * prismEver ∝ (step · aeonEver)^(1/exp), so a low exponent makes the
   * required Prism explode: at 0.55 the twenty-fifth Converge wanted sixteen
   * times the Prism of the tenth, and the gaps between them ran to forty
   * hours and kept growing. 0.75 lets the cadence stretch — which it should,
   * this is a month-long game — without running away from the player.
   */
  converge: { unlockPrism: D(60), coef: D(10), exp: 0.75, tierMultPer: D(1.8), offlineCapHPer: 1 },

  /** Aeon tree (P3's own tree): permanent structural nodes. */
  aeonTree: [
    { id: 'autoCollapse', name: 'Standing Wave', desc: 'Auto-Collapse when the gain is worthwhile', cost: D(3) },
    { id: 'keepMotes', name: 'Mote Memory', desc: 'Keep 50% of Motes through Ascend', cost: D(5) },
    { id: 'dimPower', name: 'Deep Engine', desc: 'All tier production ×2', cost: D(8) },
    { id: 'keepChart', name: 'Fixed Stars', desc: 'Star Chart ranks survive Ascend', cost: D(14) },
    { id: 'keepElements', name: 'Held Spectrum', desc: 'Element allocation survives Converge', cost: D(22) },
    { id: 'autoTrial', name: 'Recurring Trial', desc: 'A finished Trial re-enters itself automatically', cost: D(35) },
  ] as AeonNodeDef[],

  /** Aeon's endless lane — so Aeon past the tree is still worth earning. */
  aeonUpgrades: [
    {
      id: 'aeonWell',
      name: 'Aeon Well',
      desc: 'All production ×4',
      baseCost: D(20),
      costGrowth: D(3),
      maxLevel: null,
      effectPerLevel: D(4),
    },
    {
      id: 'aeonReach',
      name: 'Long Reach',
      desc: 'Prism gain ×1.5',
      baseCost: D(4),
      costGrowth: D(2.4),
      maxLevel: null,
      effectPerLevel: D(1.5),
    },
  ] as PrismUpgradeDef[],

  /**
   * Miners (spec §8.3): Ore producers, bought with Spark.
   *
   * Ore/Miners now survive CONVERGE and reset only at Unify — the spec always
   * called Minerals "the permanent, slow, compounding backbone", but resetting
   * them every Converge meant a lane that was wiped roughly once an hour and
   * therefore never compounded at all. That, plus a flat 0.1 Ore/sec against a
   * Spark curve running to 1e400, is why mining "didn't do much".
   *
   * Five miners now, not three, so the lane keeps opening new rungs as Spark
   * grows; costGrowth stays steep so miner COUNT tracks log(Spark) and Ore
   * remains the slowest number on the screen. That slowness is the point: Ore
   * is the currency that measures how long you have played, not how big your
   * last run was.
   */
  miners: [
    { id: 'drill', name: 'Drill', baseCost: D(1e8), costGrowth: D(3.5), orePerSec: D(0.1) },
    { id: 'auger', name: 'Auger', baseCost: D(1e12), costGrowth: D(4), orePerSec: D(0.5) },
    { id: 'rig', name: 'Rig', baseCost: D(1e17), costGrowth: D(4.5), orePerSec: D(2.5) },
    { id: 'bore', name: 'Bore', baseCost: D(1e24), costGrowth: D(5), orePerSec: D(12) },
    { id: 'abyss', name: 'Abyssal', baseCost: D(1e34), costGrowth: D(5.5), orePerSec: D(60) },
  ] as MinerDef[],

  /**
   * Ore's own global multiplier: (1 + oreEver)^oreMultExp on ALL production.
   *
   * This is the fix for "mining doesn't do much" in one line. Research alone
   * could never carry the lane — it is a finite list, so it is bought out and
   * then Ore is a number with nowhere to go. A power law on lifetime Ore is
   * always growing, never runs away (0.30 against a log-ish Ore curve is very
   * flat), and makes every single miner purchase worth something forever.
   */
  oreMultExp: 0.3,

  /** Research tree: one-time Ore purchases; the permanent slow backbone. */
  research: [
    { id: 'oreSluice', name: 'Sluice', desc: 'Ore gain ×2', cost: D(50) },
    { id: 'fastServos', name: 'Overclock', desc: 'Autobuyers act 2× faster', cost: D(300) },
    { id: 'deepClock', name: 'Deep Clock', desc: 'Offline cap +4h', cost: D(1200) },
    { id: 'slotA', name: 'Quarters I', desc: '+1 Boost Manager slot', cost: D(4e3) },
    { id: 'oreVein', name: 'Rich Veins', desc: 'Ore gain ×3', cost: D(1.5e4) },
    { id: 'slotB', name: 'Quarters II', desc: '+1 Boost Manager slot', cost: D(6e4) },
    { id: 'gyreHeart', name: 'Gyre Heart', desc: 'All production ×3', cost: D(2.5e5) },
    { id: 'coreSample', name: 'Core Sample', desc: 'Miner costs ÷1,000', cost: D(1e6) },
    { id: 'slotC', name: 'Quarters III', desc: '+1 Boost Manager slot', cost: D(5e6) },
    { id: 'singularitySeed', name: 'Singularity Seed', desc: 'Opens the path to Unify (P4)', cost: D(5e7) },
  ] as ResearchDef[],

  /**
   * Repeatable research — Ore's endless lane, and a Unify gate (`gates`).
   * Deep Refinement is deliberately on the critical path: you cannot reach
   * the endgame on prestige resets alone, you have to have mined.
   */
  researchGrid: [
    {
      id: 'deepRefine',
      name: 'Deep Refinement',
      desc: 'All production ×2.5',
      baseCost: D(1e4),
      costGrowth: D(6),
      maxLevel: null,
      effectPerLevel: D(2.5),
    },
    {
      id: 'oreEngine',
      name: 'Ore Engine',
      desc: 'Ore gain ×2',
      baseCost: D(2e3),
      costGrowth: D(5),
      maxLevel: null,
      effectPerLevel: D(2),
    },
  ] as PrismUpgradeDef[],

  /** Boost Managers (spec §8.7): assign to limited slots. */
  managers: {
    baseSlots: 1,
    defs: [
      { id: 'kindler', name: 'Kindler', desc: 'Spark ×5 while assigned' },
      { id: 'weaver', name: 'Weaver', desc: 'Mote gain ×4 while assigned' },
      { id: 'warden', name: 'Warden', desc: 'Autobuyers 2× faster while assigned' },
      { id: 'seer', name: 'Seer', desc: 'Offline cap ×2 while assigned' },
      { id: 'smith', name: 'Smith', desc: 'Ore gain ×3 while assigned' },
    ] as ManagerDef[],
  },

  /**
   * Rewarded boosts (spec §15). The GAME defines what the reward is; the ad
   * SDK only decides whether it was earned. That split is deliberate — the
   * core stays playable, testable and ad-free, and `monetization` gating
   * lives entirely in the service layer.
   */
  rewards: {
    /** Rewarded "×2 production for 15 min" — mirrors a Boost Manager. */
    production: { mult: D(2), seconds: 900 },
    /** Rewarded "double offline" on the away summary. */
    offlineMult: D(2),
  },

  /**
   * Time Flux (spec §8.6): offline overflow banks as Flux once P3 is reached,
   * and a slow ONLINE trickle joins it — without that, a player who never
   * closes the app never sees the system at all, which is a strange thing to
   * say about a feature the Mine tab devotes a third of its height to.
   */
  timeflux: {
    fluxPerOverflowMinute: D(1),
    fluxPerOnlineMinute: D(0.2),
    warp: { cost: D(100), mult: 2, seconds: 300 },
    boost: { cost: D(50), mult: D(4), seconds: 180 },
  },

  /**
   * P4 — Unify (spec §7), the endgame/meta layer. Gated on Aeon AND the
   * Singularity Seed research AND Trial tiers AND Deep Refinement (`gates`).
   * Gain: singularity = floor((bestAeon/coef)^exp) — cheap first one, long
   * tail. Effect: ×multPer global per lifetime Singularity, persisting across
   * every reset, plus the Meta Shop.
   *
   * `exp` and `coef` are set by one measurement: a month-long walk must earn
   * enough Singularity to actually BUY the Meta Shop. At the sqrt draft it
   * earned four against a shop costing seventeen — five endgame upgrades
   * designed, built, and never seen by anyone. A shop the game's own intended
   * length cannot finish is the same dead content this whole pass is about,
   * one layer higher up.
   *
   * `unlockAeon` is a bar EVERY cycle has to clear, not just the first, and it
   * is therefore the length of a Unify CYCLE rather than a one-off gate. At 80
   * the second Unify wanted twenty-seven Converges at thirty-five hours each —
   * nine hundred hours for one button. At 20 a cycle is about seven Converges,
   * which puts four Unifies inside a month and the Meta Shop inside four.
   *
   * `multPer` IS ENORMOUS ON PURPOSE — ×10,000,000 per Singularity, against
   * the ×10 it started at. A reset layer has to be worth more than what it
   * takes away, and Unify takes away everything: at the gate the player is
   * carrying about 1.8^80 ≈ 1e20 from Aeon alone, plus Prism, plus a fully
   * ranked Star Chart. Measured with ×10, the first Unify cut the global
   * multiplier from 1e40 to 1e12 and cost 250 hours to climb back — a button
   * whose only reward is that it is required. At 1e7 the three Singularity a
   * first Unify pays are worth 1e21 on their own, they never reset again, and
   * cycle two overtakes cycle one instead of repeating it.
   */
  unify: { unlockAeon: D(20), coef: D(3), exp: 0.75, multPer: D(1e7) },

  /**
   * Achievements (spec §8.5): a small, always-relevant global boost that
   * rewards natural play. Multiplier = perAchievement ^ unlockedCount.
   *
   * It used to be 1 + 0.01·n — the textbook version of the bug this whole
   * pass is about. At ×1e40 of other multipliers, "+60%" spread over sixty
   * achievements is not a reward, it is a rounding error. As an exponent it
   * is worth the same fraction of your output on day 1 and day 30.
   *
   * The definitions (with their predicates) live in systems/achievements.ts;
   * only the tunables live here.
   */
  achievements: { perAchievement: D(1.03) },

  /**
   * Meta Shop: permanent QoL + automation-of-prestiges.
   *
   * Eternal Archive is priced at 1 — the same as the first Singularity —
   * because Unify wipes Research, and Research is what gates Unify (the
   * Singularity Seed costs 5e7 Ore). At a higher price, cycles two and three
   * each had to re-grind the whole research tree before Unify was even legal
   * again. That was the worst wall in the game.
   *
   * THE WHOLE SHOP COSTS 17, and that number is set by measurement, not taste:
   * a month-long walk earns roughly twenty Singularity, and a shop a player
   * cannot finish inside the game's own intended length is eight upgrades
   * designed, built and never seen. Anything past the shop goes into Eternal
   * Flame, which is uncapped.
   */
  metaShop: [
    { id: 'keepResearch', name: 'Eternal Archive', desc: 'Research survives Unify', cost: D(1) },
    { id: 'autoAscend', name: 'Recurrence I', desc: 'Auto-Ascend when worthwhile', cost: D(1) },
    /*
     * Buried Fleet is priced at 1 — the cheapest thing here — because
     * Unify wiping Ore is the single most expensive reset in the game: the Ore
     * multiplier is a power law on a lifetime counter, so losing it costs five
     * orders of magnitude that take days to rebuild. Measured with it priced
     * out of reach of a first Unify, cycle two ran SLOWER than cycle one.
     */
    { id: 'keepMiners', name: 'Buried Fleet', desc: 'Miners and Ore survive Unify', cost: D(1) },
    /*
     * Fixed Heaven is the OTHER cheap keep, for the same reason. A Unify wipes
     * every ranked Star Chart node, and the chart is where the accelerators
     * live (Resolve's Shard rate, Long Reach's Prism rate) — measured without
     * these two keeps, the second Unify cycle ran four times SLOWER than the
     * first and the walk never reached a third.
     */
    { id: 'keepChart2', name: 'Fixed Heaven', desc: 'Star Chart ranks survive Unify', cost: D(2) },
    { id: 'autoConverge', name: 'Recurrence II', desc: 'Auto-Converge when worthwhile', cost: D(2) },
    { id: 'starterAeon', name: 'Deep Memory', desc: 'Begin each cycle with 5 Aeon', cost: D(3) },
    { id: 'metaEngine', name: 'Singular Engine', desc: 'All production ×5', cost: D(3) },
    { id: 'autoUnify', name: 'Recurrence III', desc: 'Auto-Unify when worthwhile', cost: D(4) },
  ] as MetaUpgradeDef[],

  /** Singularity's endless lane — the last currency in the game still has one. */
  metaGrid: [
    {
      id: 'eternalFlame',
      name: 'Eternal Flame',
      desc: 'All production ×10',
      baseCost: D(6),
      costGrowth: D(3),
      maxLevel: null,
      effectPerLevel: D(10),
    },
  ] as PrismUpgradeDef[],

  /**
   * Softcaps (spec §6.5). Focus and Density are capped beyond the spec's
   * list because Motes scale with Tier-1 throughput: spark → motes → speed/
   * density → spark is a feedback loop, and uncapped it amplifies the
   * lategame polynomially.
   */
  softcap: {
    /**
     * Applied to the EXPONENT of the Dimension Boost multiplier (2^boosts).
     *
     * This is the one the prototype died without. Boosts feed themselves:
     * more boosts → more production → more purchases → more boosts, each
     * worth a flat ×2. Measured uncapped, a bot reached 2,259 boosts and a
     * Spark exponent of 1e26562 inside two hours — the exact
     * "super-exponential runaway" §7 warns about, and it flattened the whole
     * prestige ladder because every threshold above it fell at once.
     * Capping the exponent makes boosts grow the multiplier polynomially
     * instead of exponentially, while still always being worth taking.
     */
    dimBoostExp: { t: 40, p: 0.55 },
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
    /**
     * Applied to the ALLOCATION of each element (points, not the multiplier).
     * Points arrive at a fixed rate forever, so an uncapped 1.12^points is an
     * exponential in wall-clock time — the one shape §7 forbids.
     */
    element: { t: 25, p: 0.4 },
  },

  /** Offline progress (spec §5, §8.6). */
  offline: { baseCapH: 4, chunkSteps: 100 },

  /** Logic ticks per second. */
  tickRate: 20,

  /** Autosave cadence, seconds. */
  autosaveSeconds: 10,
} as const;

/**
 * Milestones the game timestamps for the speedrun clock (Stats tab).
 *
 * `state.milestones[id] = timePlayed` the first time each is reached, and it
 * is never reset by anything — so a route can be compared against a previous
 * route, which is the only thing a speedrun actually needs from the game.
 */
export const MILESTONES = [
  { id: 'firstOrbiter', name: 'First orbiter' },
  { id: 'dimBoost', name: 'First Dimension Boost' },
  { id: 'collapse', name: 'First Collapse' },
  { id: 'ascend', name: 'First Ascend' },
  { id: 'trial', name: 'First Trial cleared' },
  { id: 'converge', name: 'First Converge' },
  { id: 'unify', name: 'First Unify' },
  { id: 'metaAll', name: 'Meta Shop complete' },
  { id: 'trialsAll', name: 'Every Trial cleared' },
  { id: 'complete', name: 'GYRE complete' },
] as const;

export type MilestoneId = (typeof MILESTONES)[number]['id'];
