/**
 * THE multiplier stack (spec §9) — the single place that composes boosts.
 *
 * Phases 0–2 only have Layer-0 sources; the composition order and the
 * breakdown structure are established now so later layers slot in without
 * rework. Tier-specific and resource-specific multipliers (Density, Focus,
 * Ignition, Cascade, Dimension Boosts) are composed HERE too, but exposed as
 * separate functions because they apply inside their own systems.
 *
 * Composition order (append-only as layers unlock):
 *   base
 *   × achievementMult        (Phase 7)
 *   × starChartMult          (Phase 3)
 *   × elementMult            (Phase 4)
 *   × researchMult           (Phase 5)
 *   × challengeRewardMult    (Phase 4)
 *   × shardMult              (Phase 3)
 *   × prismMult              (Phase 4)
 *   × aeonMult               (Phase 5)
 *   × singularityMult        (Phase 6)
 *   × boostManagerMult       (Phase 5)
 *   × fluxBoostMult          (Phase 5)
 *   → cleanMul(result)
 */
import { BAL } from '../balance';
import { D, Decimal, ONE, cleanMul, softcap } from '../numbers';
import { GameState } from '../types';
import { sparkUpgradeDef, sparkUpgradeLevel, upgradeMult } from './upgrades';
import { moteUpgradeDef, moteUpgradeLevel } from './motes';
import { starGlobalMult, starSpeedMult, starTierMult } from './starchart';
import {
  challengeActive,
  challengeSpeedMult,
  challengeTierMult,
} from './challengeperks';
import { elementGlobalMult, elementSparkMult, elementSpeedMult } from './elements';
import { kindlerMult } from './managers';
import { fluxBoostMult } from './timeflux';

/**
 * Shard multiplier: softcap(1 + 0.25·shardsEver). Computed every time — never
 * stored — so it survives every reset correctly (§19).
 *
 * Deliberately based on LIFETIME shards, not the current balance: with the
 * spec's literal "current shards" reading, spending on the Star Chart cut the
 * global multiplier and the measured re-run after Collapse #1 was *slower*
 * than the first climb — inverting §10's "re-runs 3–10× faster" rule. Spend
 * freely; the multiplier only grows.
 */
export function shardMult(state: GameState): Decimal {
  const raw = ONE.add(BAL.collapse.multPerShard.mul(state.shardsEver));
  return cleanMul(softcap(raw, BAL.softcap.shard.t, BAL.softcap.shard.p));
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

/** Prism grid: Amplify (all production ×2 per level). */
export function amplifyMult(state: GameState): Decimal {
  return cleanMul(D(2).pow(state.prismGrid['amplify'] ?? 0));
}

/** Prism grid: Momentum (speed ×1.5 per level). */
function momentumMult(state: GameState): Decimal {
  return cleanMul(D(1.5).pow(state.prismGrid['momentum'] ?? 0));
}

/** Research contribution to the global multiplier (Gyre Heart). Inline to keep this leaf-clean. */
function researchGlobal(state: GameState): Decimal {
  return state.research['gyreHeart'] ? D(2) : ONE;
}

/**
 * Singularity multiplier: ×10 per lifetime Singularity (plus the Singular
 * Engine), persisting across EVERY reset — singularityEver never resets.
 * Exponent clamped against tampered saves; legit play earns a handful.
 */
export function singularityMult(state: GameState): Decimal {
  const n = Math.min(1e3, Math.max(0, state.singularityEver.toNumber()));
  let m = BAL.unify.multPer.pow(n);
  if (state.metaShop['metaEngine']) m = m.mul(3);
  return cleanMul(m);
}

/** Global production multiplier applied to every tier's output. */
export function globalMult(state: GameState): Decimal {
  // Dim challenge: the global multiplier is forced to ×1 during the run.
  if (challengeActive(state, 'dim')) return ONE;
  // §9 composition order — append-only as layers unlock.
  return cleanMul(
    starGlobalMult(state)
      .mul(elementGlobalMult(state))
      .mul(researchGlobal(state))
      .mul(shardMult(state))
      .mul(prismMult(state))
      .mul(amplifyMult(state))
      .mul(singularityMult(state)),
  );
}

/**
 * Aeon multiplier on ALL tiers: tierMultPer^aeonEver × Deep Engine. Lifetime
 * Aeon, same never-punish-spending rule as shards/prism. Exponent clamped —
 * aeon grows log2-slow, but a tampered save must not overflow pow().
 */
export function aeonMult(state: GameState): Decimal {
  const n = Math.min(1e4, Math.max(0, state.aeonEver.toNumber()));
  let m = BAL.converge.tierMultPer.pow(n);
  if (state.aeonTree['dimPower']) m = m.mul(2);
  return cleanMul(m);
}

/**
 * Production-speed multiplier (Focus). A real production multiplier applied to
 * all tiers — the stage also reads it to spin orbiters faster.
 */
export function speedMult(state: GameState): Decimal {
  // Still Ring challenge: speed locked to ×1 during the run.
  if (challengeActive(state, 'stillRing')) return ONE;
  const focus = moteUpgradeDef('focus');
  const focusRaw = focus ? upgradeMult(focus, moteUpgradeLevel(state, 'focus')) : ONE;
  return cleanMul(
    softcap(focusRaw, BAL.softcap.focus.t, BAL.softcap.focus.p)
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

/** Per-tier multiplier (1-indexed). Boosts, Ignition, Cascade, stars, Solitary, Aeon. */
export function tierMult(state: GameState, tier: number): Decimal {
  let m = BAL.dimBoost.mult
    .pow(state.dimBoosts)
    .mul(starTierMult(state, tier))
    .mul(challengeTierMult(state))
    .mul(aeonMult(state));

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
    { label: 'Dimension Boosts', value: BAL.dimBoost.mult.pow(state.dimBoosts) },
    { label: 'Spark upgrades', value: sparkMult(state) },
    { label: 'Orbit speed', value: speedMult(state) },
    { label: 'Star Chart', value: starGlobalMult(state) },
    { label: 'Elements', value: elementGlobalMult(state) },
    { label: 'Challenge rewards', value: challengeTierMult(state) },
    { label: 'Research', value: researchGlobal(state) },
    { label: 'Shards', value: shardMult(state) },
    { label: 'Prism', value: prismMult(state) },
    { label: 'Prism grid', value: amplifyMult(state) },
    { label: 'Aeon', value: aeonMult(state) },
    { label: 'Singularity', value: singularityMult(state) },
    { label: 'Managers', value: kindlerMult(state) },
    { label: 'Flux boost', value: fluxBoostMult(state) },
    { label: 'Global (total)', value: globalMult(state) },
  ];
}
