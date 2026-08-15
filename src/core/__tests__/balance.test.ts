/**
 * Pacing, measured rather than argued about.
 *
 * Every other test here pins a formula. None of them can tell you the game is
 * over in an afternoon, because that is not a property of any one formula — it
 * is what the formulas do to each other once a player is spending money in the
 * obvious order. So this file plays the game.
 *
 * `simulate()` is a greedy idle player: it hires every manager it can afford,
 * then repeatedly buys whichever single purchase adds the most income per euro,
 * which is close enough to what a real player converges on. The assertions are
 * pacing floors — "tier 10 must not arrive before X hours" — and they are
 * deliberately loose. They exist to catch a system that is out by an order of
 * magnitude, not to freeze the tuning.
 */
import { BUSINESSES, getDef } from '../businesses';
import {
  canBuyUpgrade,
  costOfNext,
  getBusiness,
  managerCost,
  businessPerSecond,
  perSecond,
  prestigeGain,
  totalUpgradeLevels,
  unitCostMultiplier,
  upgradeCost,
  upgradeLevel,
} from '../economy';
import { Decimal, ZERO } from '../numbers';
import { availableInvestors, canBuyPerk } from '../perks';
import {
  advance,
  buy,
  buyPerk,
  buyUpgrade,
  createInitialState,
  hireManager,
  prestige,
  tap,
} from '../engine';
import type { BusinessId, GameState } from '../types';

/** One simulated step. Coarse enough to run a day in a second of CPU. */
const STEP_SECONDS = 2;

interface Snapshot {
  /** Simulated seconds since the run started. */
  t: number;
  income: Decimal;
  tiersOwned: number;
  upgradeLevels: number;
  frietOwned: number;
  frietUpgrades: number;
}

interface SimResult {
  /** Seconds until the player first owned a unit of each tier, by tier index. */
  tierUnlockedAt: (number | null)[];
  /** Seconds until a prestige was first worth taking. */
  firstPrestigeAt: number | null;
  snapshots: Snapshot[];
  final: GameState;
}

/**
 * Income per second the state would have after one more purchase, minus what it
 * has now. The greedy policy ranks every option by this over its price.
 */
/**
 * Income counting every owned tier as if it were automated.
 *
 * `perSecond` counts managers only, which is right for the game and wrong for
 * this policy: the first unit of a new tier has no manager yet, so its marginal
 * gain reads as zero and the simulated player never opens a second tier at all.
 * A real player buys the unit *intending* to hire, and this is that intent.
 */
function potentialPerSecond(state: GameState): Decimal {
  let total = ZERO;
  for (const def of BUSINESSES) {
    if (getBusiness(state, def.id).owned > 0) total = total.add(businessPerSecond(state, def.id));
  }
  return total;
}

/**
 * How long the player is willing to sit on their hands for a better buy.
 *
 * Without a horizon the policy degenerates: spend-everything-now never saves
 * enough for an upgrade, and save-for-the-best stalls forever on a purchase
 * hours away and stops opening new tiers. Ten minutes is roughly how long a
 * real player will wait while watching the bar.
 */
const SAVE_HORIZON_SECONDS = 600;

interface Option {
  apply: (s: GameState) => GameState;
  cost: Decimal;
  value: number;
}

/** The single best-value purchase available right now, or null. */
function bestPurchase(
  state: GameState,
  allowUpgrades = true,
  affordableOnly = false,
): Option | null {
  let best: Option | null = null;
  // Hoisted out of `consider`: this is the inner loop of a day-long simulation
  // and recomputing the baseline for all twenty options doubled the runtime.
  const baseRate = potentialPerSecond(state);

  // Affordability is deliberately NOT a filter here. A player who only ever
  // buys what they can afford right now drains their cash on the cheapest
  // option forever and never saves for anything bigger — which would leave the
  // upgrade track untested and make this whole file lie about the pacing.
  const consider = (cost: Decimal, apply: (s: GameState) => GameState): void => {
    if (cost.lte(ZERO)) return;
    if (affordableOnly && state.cash.lt(cost)) return;
    const gain = potentialPerSecond(apply(state)).sub(baseRate);
    if (gain.lte(ZERO)) return;
    // Rate gained per euro spent. A plain number is fine: it is only a ranking.
    const value = gain.div(cost).toNumber();
    if (!Number.isFinite(value) || value <= 0) return;
    if (!best || value > best.value) best = { apply, cost, value };
  };

  for (const def of BUSINESSES) {
    const bs = getBusiness(state, def.id);
    // Only ever buy into a tier that is (or is about to be) automated — an
    // idle player does not sit tapping.
    if (bs.owned > 0 || state.cash.gte(costOfNext(def, 0, unitCostMultiplier(state)))) {
      consider(costOfNext(def, bs.owned, unitCostMultiplier(state)), (s) => buy(s, def.id, 1));
    }
    // `canBuyUpgrade` also checks affordability, which would reintroduce the
    // filter `consider` deliberately drops. Only the owned-a-unit gate matters.
    if (allowUpgrades && bs.owned > 0) {
      consider(upgradeCost(state, def.id), (s) => buyUpgrade(s, def.id));
    }
  }

  return best;
}

/** Tap every owned tier that has no manager yet. */
function tapWhatIsManual(state: GameState): GameState {
  let next = state;
  for (const def of BUSINESSES) {
    const bs = getBusiness(next, def.id);
    if (bs.owned > 0 && !bs.managed && !bs.active) next = tap(next, def.id);
  }
  return next;
}

/** Hire anything affordable that is not automated yet. */
function hireWhatWeCan(state: GameState): GameState {
  let next = state;
  for (const def of BUSINESSES) {
    const bs = getBusiness(next, def.id);
    if (bs.owned > 0 && !bs.managed && next.cash.gte(managerCost(next, def.id))) {
      next = hireManager(next, def.id);
    }
  }
  return next;
}

/** Spend every free investor on the cheapest useful node: profit, then the rest. */
function spendInvestors(state: GameState): GameState {
  let next = state;
  let guard = 20_000;
  while (availableInvestors(next) > 0 && guard-- > 0) {
    if (canBuyPerk(next, 'profit')) {
      next = buyPerk(next, 'profit');
      continue;
    }
    break;
  }
  return next;
}

/**
 * Play the game for `seconds`, greedily.
 *
 * `prestigeWhenWorth` mirrors a player who resets as soon as it pays: it takes
 * the sale the moment the payout would at least double the investors already
 * banked, then dumps everything into the profit node.
 */
function simulate(
  seconds: number,
  opts: { prestige?: boolean; upgrades?: boolean } = {},
): SimResult {
  let state = createInitialState(0);
  // The very first cycle has to come from somewhere; a real player taps. Give
  // the run the few euros that represents rather than modelling taps.
  state = { ...state, cash: new Decimal(10) };

  const tierUnlockedAt: (number | null)[] = BUSINESSES.map(() => null);
  const snapshots: Snapshot[] = [];
  let firstPrestigeAt: number | null = null;

  for (let t = 0; t < seconds; t += STEP_SECONDS) {
    // A tier that is owned but not yet automated earns nothing on its own, and
    // the opening minutes of the game are exactly that situation. Tapping every
    // step is what a player actually does until the first manager lands.
    state = tapWhatIsManual(state);
    state = advanceAndSettle(state);

    state = hireWhatWeCan(state);

    // Buy the best-value option when affordable. When it is not, save for it
    // only if it is within the horizon; otherwise fall back to the best thing
    // that can be bought right now.
    let guard = 500;
    for (;;) {
      if (guard-- <= 0) break;
      const best = bestPurchase(state, opts.upgrades !== false);
      if (!best) break;

      if (state.cash.gte(best.cost)) {
        state = best.apply(state);
        continue;
      }

      const rate = potentialPerSecond(state);
      const withinReach =
        rate.gt(ZERO) && best.cost.sub(state.cash).div(rate).lte(SAVE_HORIZON_SECONDS);
      if (withinReach) break;

      const affordable = bestPurchase(state, opts.upgrades !== false, true);
      if (!affordable) break;
      state = affordable.apply(state);
    }

    BUSINESSES.forEach((def, i) => {
      if (tierUnlockedAt[i] === null && getBusiness(state, def.id).owned > 0) {
        tierUnlockedAt[i] = t;
      }
    });

    if (firstPrestigeAt === null && worthPrestiging(state)) firstPrestigeAt = t;

    if (opts.prestige && worthPrestiging(state)) {
      state = spendInvestors(prestige(state));
      state = { ...state, cash: new Decimal(10) };
    }

    if (t % 600 === 0) {
      snapshots.push({
        t,
        income: perSecond(state),
        tiersOwned: state.businesses.filter((b) => b.owned > 0).length,
        upgradeLevels: totalUpgradeLevels(state),
        frietOwned: getBusiness(state, 'friet').owned,
        frietUpgrades: upgradeLevel(state, 'friet'),
      });
    }
  }

  return { tierUnlockedAt, firstPrestigeAt, snapshots, final: state };
}

function advanceAndSettle(state: GameState): GameState {
  return advance(state, STEP_SECONDS).state;
}

function worthPrestiging(state: GameState): boolean {
  const gain = prestigeGain(state);
  return gain >= 1 && gain >= state.investors;
}

const HOUR = 3600;

// ---------------------------------------------------------------------------

const DAY = 24 * HOUR;

describe('pacing of a first run', () => {
  let run: SimResult;

  beforeAll(() => {
    run = simulate(DAY);
  });

  it('reports the timeline', () => {
    const lines = BUSINESSES.map((def, i) => {
      const at = run.tierUnlockedAt[i];
      return `  ${String(i + 1).padStart(2)}. ${def.name.padEnd(26)} ${
        at === null ? 'never' : `${(at / 3600).toFixed(2)} h`
      }`;
    });
    // Printed, not asserted. Tuning the economy without this in front of you is
    // guesswork, and guesswork is what put a 10^60 runaway in the game.
    // eslint-disable-next-line no-console
    console.log(
      [
        'First unit of each tier:',
        ...lines,
        `Upgrade levels after a day: ${totalUpgradeLevels(run.final)}`,
        `Income after a day:         ${perSecond(run.final).toString()}`,
      ].join('\n'),
    );
    expect(run.snapshots.length).toBeGreaterThan(0);
  });

  /**
   * THE regression guard.
   *
   * A greedy player who never sleeps reached €1e64/s in the first hour when the
   * upgrade track was mispriced. The ceiling here sits about five orders of
   * magnitude above what a correctly tuned day produces, which is wide enough
   * that ordinary retuning will not trip it and narrow enough that a runaway of
   * that shape cannot hide behind it.
   */
  it('does not produce absurd income in a day', () => {
    expect(perSecond(run.final).lt(new Decimal('1e15'))).toBe(true);
  });

  it('still opens the whole tier list within a day', () => {
    // The opposite failure: a fix that makes the game unplayably slow. Every
    // tier should be reachable inside a day of ideal play.
    for (const at of run.tierUnlockedAt) expect(at).not.toBeNull();
  });

  it('keeps the top tier out of the first half hour', () => {
    const last = run.tierUnlockedAt[BUSINESSES.length - 1] as number;
    expect(last).toBeGreaterThan(0.5 * HOUR);
  });
});

describe('the upgrade track pulls its weight without taking over', () => {
  let withUpgrades: SimResult;
  let without: SimResult;

  beforeAll(() => {
    // Six hours, not a day: the ratio between the two is settled long before
    // then, and three day-long runs in one file is minutes of CPU for nothing.
    withUpgrades = simulate(6 * HOUR);
    without = simulate(6 * HOUR, { upgrades: false });
  });

  it('gets bought at all', () => {
    // A cash sink nobody uses is not a cash sink. This is the failure mode on
    // the other side of the runaway, and it is just as easy to tune into.
    expect(totalUpgradeLevels(withUpgrades.final)).toBeGreaterThan(4);
  });

  it('is worth having', () => {
    expect(perSecond(withUpgrades.final).gt(perSecond(without.final))).toBe(true);
  });

  /**
   * The bound that the original tuning blew through by sixty orders of
   * magnitude. Upgrades are a side dish: they should move the needle, not be
   * the needle. Anything past 1000x over a day means the track has escaped the
   * economy it is supposed to multiply.
   */
  it('does not dwarf the rest of the economy', () => {
    const ratio = perSecond(withUpgrades.final).div(perSecond(without.final)).toNumber();
    expect(ratio).toBeLessThan(1_000);
  });
});
