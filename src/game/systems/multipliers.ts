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
import { Decimal, ONE, cleanMul, softcap } from '../numbers';
import { GameState } from '../types';
import { sparkUpgradeDef, sparkUpgradeLevel, upgradeMult } from './upgrades';
import { moteUpgradeDef, moteUpgradeLevel } from './motes';

/** Global production multiplier applied to every tier's output. */
export function globalMult(_state: GameState): Decimal {
  // Layer 0 has no global sources yet; prestige layers multiply in here.
  return cleanMul(ONE);
}

/**
 * Production-speed multiplier (Focus). A real production multiplier applied to
 * all tiers — the stage also reads it to spin orbiters faster.
 */
export function speedMult(state: GameState): Decimal {
  const focus = moteUpgradeDef('focus');
  if (!focus) return ONE;
  const raw = upgradeMult(focus, moteUpgradeLevel(state, 'focus'));
  return cleanMul(softcap(raw, BAL.softcap.focus.t, BAL.softcap.focus.p));
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

  return cleanMul(m);
}

/** Per-tier multiplier (1-indexed tier). Dimension Boosts, Ignition, Cascade. */
export function tierMult(state: GameState, tier: number): Decimal {
  let m = BAL.dimBoost.mult.pow(state.dimBoosts);

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
    { label: 'Orbit speed (Focus)', value: speedMult(state) },
    { label: 'Global', value: globalMult(state) },
  ];
}
