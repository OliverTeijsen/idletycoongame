/**
 * THE multiplier stack (spec §9) — the single place that composes boosts.
 *
 * EVERY entry here is a MULTIPLIER, never an addend. That is not a style
 * choice: an economy whose output spans 1 to 1e5000 has no meaningful
 * "+100,000", because the same reward is a fortune at minute one and invisible
 * at minute ten. A multiplier is worth the same fraction of your output
 * forever, which is the only way an upgrade bought on day 1 can still be worth
 * having on day 30. See the three rules at the top of balance.ts.
 *
 * Composition order (append-only as layers unlock):
 *   base
 *   × achievementMult        (1.03^earned)
 *   × starChartMult          (ranked)
 *   × elementMult
 *   × researchMult           (Gyre Heart + Deep Refinement)
 *   × oreMult                (lifetime Ore — the mining lane)
 *   × challengeRewardMult
 *   × shardMult
 *   × shardLensMult
 *   × prismMult
 *   × prismGridMult
 *   × aeonMult / aeonWellMult
 *   × singularityMult / eternalFlameMult
 *   × boostManagerMult
 *   × fluxBoostMult
 *   → cleanMul(result)
 */
import { BAL } from '../balance';
import { D, Decimal, ONE, cleanMul, softcap } from '../numbers';
import { GameState } from '../types';
import { gridMult, sparkUpgradeDef, sparkUpgradeLevel, upgradeMult } from './upgrades';
import { moteUpgradeDef, moteUpgradeLevel } from './motes';
import { achievementMult } from './achievements';
import { starGlobalMult, starSpeedMult, starTierMult } from './starchart';
import {
  challengeActive,
  challengeSpeedMult,
  challengeTierMult,
} from './challengeperks';
import { elementGlobalMult, elementSparkMult, elementSpeedMult } from './elements';
import { kindlerMult } from './managers';
import { fluxBoostMult, rewardBoostMult } from './timeflux';

/**
 * Shard multiplier: softcap(1 + 0.25·shardsEver). Computed every time — never
 * stored — so it survives every reset correctly (§19).
 *
 * Deliberately based on LIFETIME shards, not the current balance: with the
 * spec's literal "current shards" reading, spending on the Star Chart cut the
 * global multiplier and the measured re-run after Collapse #1 was *slower*
 * than the first climb — inverting §10's "re-runs 3–10× faster" rule. Spend
 * freely; the multiplier only grows.
 *
 * It is softcapped hard, and that is fine: this is not what Shards are FOR
 * any more. The Star Chart and Shard Lens are, and both are uncapped.
 */
export function shardMult(state: GameState): Decimal {
  const raw = ONE.add(BAL.collapse.multPerShard.mul(state.shardsEver));
  return cleanMul(softcap(raw, BAL.softcap.shard.t, BAL.softcap.shard.p));
}

/** Shard Lens: the endless Shard-tree multiplier. */
export function shardLensMult(state: GameState): Decimal {
  return gridMult(BAL.shardUpgrades, state.shardUpgrades, 'shardLens');
}

/**
 * Prism multiplier: 2^softcap(prismEver). The exponent (not the result) is
 * softcapped so it can never overflow (§7 P2). Based on lifetime-this-cycle
 * Prism for the same reason shardMult is — spending must never punish.
 */
export function prismMult(state: GameState): Decimal {
  const raw = Math.max(0, state.prismEver.toNumber());
  const t = BAL.softcap.prismExp.t;
  const capped = raw <= t ? raw : t * Math.pow(raw / t, BAL.softcap.prismExp.p);
  return cleanMul(D(2).pow(capped));
}

/** Prism grid: Amplify — all production, per level. */
export function amplifyMult(state: GameState): Decimal {
  return gridMult(BAL.prismGrid, state.prismGrid, 'amplify');
}

/** Prism grid: Momentum — production speed, per level. */
function momentumMult(state: GameState): Decimal {
  return gridMult(BAL.prismGrid, state.prismGrid, 'momentum');
}

/** Aeon grid: Aeon Well — all production, per level. */
export function aeonWellMult(state: GameState): Decimal {
  return gridMult(BAL.aeonUpgrades, state.aeonGrid, 'aeonWell');
}

/** Meta grid: Eternal Flame — all production, per level. */
export function eternalFlameMult(state: GameState): Decimal {
  return gridMult(BAL.metaGrid, state.metaGrid, 'eternalFlame');
}

/**
 * Research contribution to the global multiplier: Gyre Heart (a one-time node,
 * so its magnitude is bespoke) and Deep Refinement (the endless lane, read
 * from its def) — Ore's own production lane.
 */
export function researchGlobalMult(state: GameState): Decimal {
  let m = state.research['gyreHeart'] ? D(3) : ONE;
  m = m.mul(gridMult(BAL.researchGrid, state.researchGrid, 'deepRefine'));
  return cleanMul(m);
}

/**
 * THE MINING MULTIPLIER: (1 + oreEver)^0.30 on all production.
 *
 * This is the answer to "mining doesn't do much". Research is a finite list,
 * so once it is bought out Ore has nowhere to go and every miner purchase
 * after that is worthless — which is exactly how the lane died. A power law on
 * LIFETIME Ore is always growing and never runs away: Ore itself only tracks
 * log(Spark) (miner counts are logarithmic in cost), so a 0.30 exponent on top
 * of that is about as gentle as a permanent multiplier gets. Every miner you
 * ever buy still pays, at hour 600.
 */
export function oreMult(state: GameState): Decimal {
  const ever = state.oreEver;
  if (ever.lte(ONE)) return ONE;
  return cleanMul(ever.add(ONE).pow(BAL.oreMultExp));
}

/**
 * Singularity multiplier: `BAL.unify.multPer` per lifetime Singularity (plus
 * the Singular Engine and Eternal Flame), persisting across EVERY reset —
 * singularityEver never resets. Exponent clamped against tampered saves; legit
 * play earns a few dozen.
 */
export function singularityMult(state: GameState): Decimal {
  const n = Math.min(1e3, Math.max(0, state.singularityEver.toNumber()));
  let m = BAL.unify.multPer.pow(n);
  if (state.metaShop['metaEngine']) m = m.mul(5);
  m = m.mul(eternalFlameMult(state));
  return cleanMul(m);
}

/** Global production multiplier applied to every tier's output. */
export function globalMult(state: GameState): Decimal {
  // Dim challenge: the global multiplier is forced to ×1 during the run.
  if (challengeActive(state, 'dim')) return ONE;
  // §9 composition order — append-only as layers unlock.
  return cleanMul(
    achievementMult(state)
      .mul(starGlobalMult(state))
      .mul(elementGlobalMult(state))
      .mul(researchGlobalMult(state))
      .mul(oreMult(state))
      .mul(shardMult(state))
      .mul(shardLensMult(state))
      .mul(prismMult(state))
      .mul(amplifyMult(state))
      .mul(aeonWellMult(state))
      .mul(singularityMult(state))
      .mul(rewardBoostMult(state)),
  );
}

/**
 * Aeon multiplier on ALL tiers: tierMultPer^aeonEver × Deep Engine. Lifetime
 * Aeon, same never-punish-spending rule as shards/prism. Exponent clamped —
 * aeon grows sqrt-slow, but a tampered save must not overflow pow().
 */
export function aeonMult(state: GameState): Decimal {
  const n = Math.min(1e4, Math.max(0, state.aeonEver.toNumber()));
  let m = BAL.converge.tierMultPer.pow(n);
  if (state.aeonTree['dimPower']) m = m.mul(2);
  return cleanMul(m);
}

/**
 * Production-speed multiplier. A real production multiplier applied to all
 * tiers — the stage also reads it to spin orbiters faster.
 */
export function speedMult(state: GameState): Decimal {
  // Still Ring challenge: speed locked to ×1 during the run.
  if (challengeActive(state, 'stillRing')) return ONE;
  const focus = moteUpgradeDef('focus');
  const focusRaw = focus ? upgradeMult(focus, moteUpgradeLevel(state, 'focus')) : ONE;
  const overdrive = sparkUpgradeDef('overdrive');
  const overdriveMult = overdrive
    ? upgradeMult(overdrive, sparkUpgradeLevel(state, 'overdrive'))
    : ONE;
  return cleanMul(
    softcap(focusRaw, BAL.softcap.focus.t, BAL.softcap.focus.p)
      .mul(overdriveMult)
      .mul(starSpeedMult(state))
      .mul(elementSpeedMult(state))
      .mul(momentumMult(state))
      .mul(challengeSpeedMult(state)),
  );
}

/** Multiplier on Spark output specifically (Tier-1 production). */
export function sparkMult(state: GameState): Decimal {
  let m = ONE;

  const lattice = sparkUpgradeDef('fluxLattice');
  if (lattice) {
    const raw = upgradeMult(lattice, sparkUpgradeLevel(state, 'fluxLattice'));
    m = m.mul(softcap(raw, BAL.softcap.fluxLattice.t, BAL.softcap.fluxLattice.p));
  }

  const density = moteUpgradeDef('density');
  if (density) {
    const raw = upgradeMult(density, moteUpgradeLevel(state, 'density'));
    m = m.mul(softcap(raw, BAL.softcap.density.t, BAL.softcap.density.p));
  }

  m = m.mul(elementSparkMult(state));
  m = m.mul(kindlerMult(state));
  m = m.mul(fluxBoostMult(state));

  return cleanMul(m);
}

/** Motes' global lane: Crystallize (×1.25 per level, all production). */
export function crystallizeMult(state: GameState): Decimal {
  const def = moteUpgradeDef('crystallize');
  if (!def) return ONE;
  return upgradeMult(def, moteUpgradeLevel(state, 'crystallize'));
}

/**
 * Dimension Boost multiplier: mult^softcap(boosts). The EXPONENT is capped
 * (see BAL.softcap.dimBoostExp) so the boost feedback loop cannot run away.
 */
export function dimBoostMult(state: GameState): Decimal {
  const n = Math.max(0, state.dimBoosts);
  const { t, p } = BAL.softcap.dimBoostExp;
  const capped = n <= t ? n : t * Math.pow(n / t, p);
  return cleanMul(BAL.dimBoost.mult.pow(capped));
}

/**
 * Chain Reaction (Spark upgrade): tier k gets 1.03^(k·level).
 *
 * The only multiplier in the game that grows with a tier's DEPTH, so the
 * upper tiers — which the autobuyers reach and the player never thinks about
 * — become something worth deliberately pushing Dimension Boosts for.
 */
function chainReactionMult(state: GameState, tier: number): Decimal {
  const def = sparkUpgradeDef('chainReaction');
  if (!def) return ONE;
  const level = sparkUpgradeLevel(state, 'chainReaction');
  if (level <= 0) return ONE;
  return cleanMul(def.effectPerLevel.pow(level * tier));
}

/** Per-tier multiplier (1-indexed). Boosts, Ignition, Cascade, stars, Solitary, Aeon. */
export function tierMult(state: GameState, tier: number): Decimal {
  let m = dimBoostMult(state)
    .mul(starTierMult(state, tier))
    .mul(challengeTierMult(state))
    .mul(aeonMult(state))
    .mul(crystallizeMult(state))
    .mul(chainReactionMult(state, tier));

  if (tier === 1) {
    const ignition = sparkUpgradeDef('ignition');
    if (ignition) m = m.mul(upgradeMult(ignition, sparkUpgradeLevel(state, 'ignition')));
  } else {
    const cascade = sparkUpgradeDef('cascade');
    if (cascade) m = m.mul(upgradeMult(cascade, sparkUpgradeLevel(state, 'cascade')));
  }

  return cleanMul(m);
}

export interface MultBreakdownEntry {
  label: string;
  value: Decimal;
}

/** Stats-screen breakdown (spec §11) — every source visible, for players and balancing. */
export function multBreakdown(state: GameState): MultBreakdownEntry[] {
  return [
    { label: 'Achievements', value: achievementMult(state) },
    { label: 'Dimension Boosts', value: dimBoostMult(state) },
    { label: 'Spark upgrades', value: sparkMult(state) },
    { label: 'Orbit speed', value: speedMult(state) },
    { label: 'Motes (Crystallize)', value: crystallizeMult(state) },
    { label: 'Star Chart', value: starGlobalMult(state) },
    { label: 'Elements', value: elementGlobalMult(state) },
    { label: 'Challenge rewards', value: challengeTierMult(state) },
    { label: 'Research', value: researchGlobalMult(state) },
    { label: 'Ore (lifetime)', value: oreMult(state) },
    { label: 'Shards', value: shardMult(state) },
    { label: 'Shard Lens', value: shardLensMult(state) },
    { label: 'Prism', value: prismMult(state) },
    { label: 'Prism grid', value: amplifyMult(state) },
    { label: 'Aeon', value: aeonMult(state) },
    { label: 'Aeon Well', value: aeonWellMult(state) },
    { label: 'Singularity', value: singularityMult(state) },
    { label: 'Managers', value: kindlerMult(state) },
    { label: 'Flux boost', value: fluxBoostMult(state) },
    { label: 'Rewarded boost', value: rewardBoostMult(state) },
    { label: 'Global (total)', value: globalMult(state) },
  ];
}
