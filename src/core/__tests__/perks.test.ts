/**
 * The investor skill tree.
 *
 * The most important test in this file is `keeps every run stronger than the
 * last`: it pins the inequality that makes the game endless rather than a curve
 * that quietly converges on a ceiling. See the header of `perks.ts`.
 */
import { D } from '../numbers';
import {
  PERKS,
  PERK_PROFIT_STEP,
  availableInvestors,
  canBuyPerk,
  freshPerks,
  getPerk,
  isMaxed,
  nextPerkCost,
  perkEffectValue,
  perkLevel,
  perkOfflineCapSeconds,
  perkTapCycles,
  spentInvestors,
  totalPerkCost,
  totalPerkLevels,
} from '../perks';
import { OFFLINE_CAP_SECONDS } from '../businesses';
import { globalMultiplier, prestigeGain } from '../economy';
import { advance, buyPerk, createInitialState, offlineEarnings, prestige, tap } from '../engine';
import type { GameState, PerkId } from '../types';

function withInvestors(investors: number, levels: Partial<Record<PerkId, number>> = {}): GameState {
  const base = createInitialState(0);
  return { ...base, investors, perks: { ...base.perks, ...levels } };
}

describe('perk definitions', () => {
  it('gives every perk a positive price and a sane growth', () => {
    for (const def of PERKS) {
      expect(def.baseCost).toBeGreaterThan(0);
      expect(def.costGrowth).toBeGreaterThan(1);
      expect(def.maxLevel === null || def.maxLevel > 0).toBe(true);
    }
  });

  it('has at least one endless node', () => {
    expect(PERKS.some((def) => def.maxLevel === null)).toBe(true);
  });

  it('throws on an unknown id', () => {
    expect(() => getPerk('nope' as PerkId)).toThrow(/Unknown perk/);
  });

  it('starts every perk at zero', () => {
    const perks = freshPerks();
    for (const def of PERKS) expect(perks[def.id]).toBe(0);
    expect(totalPerkLevels(createInitialState(0))).toBe(0);
  });
});

describe('cost and balance', () => {
  it('charges more for each successive level', () => {
    let previous = 0;
    for (let level = 0; level < 40; level += 1) {
      const cost = nextPerkCost(withInvestors(0, { profit: level }), 'profit');
      expect(cost).not.toBeNull();
      expect(cost as number).toBeGreaterThanOrEqual(previous);
      previous = cost as number;
    }
    // Not merely non-decreasing — it genuinely climbs.
    expect(previous).toBeGreaterThan(1);
  });

  it('never prices a level below one investor', () => {
    for (const def of PERKS) {
      expect(nextPerkCost(withInvestors(0), def.id)).toBeGreaterThanOrEqual(1);
    }
  });

  it('totals the levels already bought', () => {
    const state = withInvestors(100, { profit: 5 });
    const expected = [0, 1, 2, 3, 4].reduce(
      (sum, level) => sum + (nextPerkCost(withInvestors(0, { profit: level }), 'profit') ?? 0),
      0,
    );
    expect(totalPerkCost('profit', 5)).toBe(expected);
    expect(spentInvestors(state)).toBe(expected);
    expect(availableInvestors(state)).toBe(100 - expected);
  });

  it('never reports a negative balance, even on a tampered save', () => {
    // Investors wound back to zero while the levels stay bought.
    expect(availableInvestors(withInvestors(0, { profit: 40 }))).toBe(0);
  });

  it('stops selling a capped perk at its maximum', () => {
    const capped = PERKS.find((def) => def.maxLevel !== null);
    if (!capped) throw new Error('expected at least one capped perk');

    const maxed = withInvestors(1e9, { [capped.id]: capped.maxLevel as number });
    expect(isMaxed(capped, capped.maxLevel as number)).toBe(true);
    expect(nextPerkCost(maxed, capped.id)).toBeNull();
    expect(canBuyPerk(maxed, capped.id)).toBe(false);
    expect(buyPerk(maxed, capped.id)).toBe(maxed);
  });

  it('never maxes out an endless perk', () => {
    const endless = PERKS.find((def) => def.maxLevel === null);
    if (!endless) throw new Error('expected an endless perk');
    // Level 2000 of `profit` is a multiplier around 1e158 — far past anything a
    // player reaches, and the ladder is still selling.
    expect(isMaxed(endless, 2_000)).toBe(false);
    expect(nextPerkCost(withInvestors(0, { [endless.id]: 2_000 }), endless.id)).not.toBeNull();
  });

  it('stops selling once a price outgrows a JS number', () => {
    // The honest limit of "endless": prices are numbers, so past ~1.8e308 there
    // is no price to quote and the perk goes quiet rather than quoting
    // Infinity. Investors are a `number` too, so the currency runs out first —
    // this is a floor under the arithmetic, not a wall the player can reach.
    expect(nextPerkCost(withInvestors(0, { profit: 100_000 }), 'profit')).toBeNull();
    expect(canBuyPerk(withInvestors(Infinity, { profit: 100_000 }), 'profit')).toBe(false);
  });
});

describe('buying', () => {
  it('spends investors and raises the level', () => {
    const before = withInvestors(50);
    const cost = nextPerkCost(before, 'profit') as number;

    const after = buyPerk(before, 'profit');
    expect(perkLevel(after, 'profit')).toBe(1);
    expect(availableInvestors(after)).toBe(50 - cost);
    // The banked total is a record of what was earned, not a wallet.
    expect(after.investors).toBe(50);
  });

  it('is a no-op when the player cannot afford it', () => {
    const broke = withInvestors(0);
    expect(canBuyPerk(broke, 'profit')).toBe(false);
    expect(buyPerk(broke, 'profit')).toBe(broke);
  });

  it('does not mutate the state it was given', () => {
    const before = withInvestors(50);
    buyPerk(before, 'profit');
    expect(perkLevel(before, 'profit')).toBe(0);
  });

  it('cannot be spent twice by buying different perks', () => {
    let state = withInvestors(6);
    const budget = availableInvestors(state);
    let spent = 0;

    for (const def of PERKS) {
      const cost = nextPerkCost(state, def.id) as number;
      if (cost > availableInvestors(state)) continue;
      state = buyPerk(state, def.id);
      spent += cost;
    }

    expect(spentInvestors(state)).toBe(spent);
    expect(availableInvestors(state)).toBe(budget - spent);
    expect(spent).toBeLessThanOrEqual(budget);
  });
});

describe('effects', () => {
  it('multiplies global profit per profit level', () => {
    expect(globalMultiplier(withInvestors(0))).toBeCloseTo(1, 12);
    expect(globalMultiplier(withInvestors(0, { profit: 5 }))).toBeCloseTo(
      Math.pow(PERK_PROFIT_STEP, 5),
      12,
    );
  });

  it('raises the investors a prestige pays out', () => {
    const plain = { ...withInvestors(0), lifetimeEarnings: D(1e9) };
    const boosted = { ...withInvestors(0, { payout: 5 }), lifetimeEarnings: D(1e9) };
    expect(prestigeGain(boosted)).toBeGreaterThan(prestigeGain(plain));
    // +10% a level, so five levels is half again as many.
    expect(prestigeGain(boosted)).toBe(Math.floor(prestigeGain(plain) * 1.5));
  });

  it('discounts units and managers', () => {
    expect(perkEffectValue(withInvestors(0, { cost: 10 }), 'cost')).toBeGreaterThan(0);
    expect(perkEffectValue(withInvestors(0, { manager: 10 }), 'manager')).toBeGreaterThan(0);
    // A discount can approach zero cost but must never reach or pass it.
    for (const id of ['cost', 'manager'] as const) {
      const max = getPerk(id).maxLevel as number;
      expect(perkEffectValue(withInvestors(0, { [id]: max }), id)).toBeLessThan(1);
    }
  });

  it('extends the offline cap', () => {
    expect(perkOfflineCapSeconds(withInvestors(0))).toBe(OFFLINE_CAP_SECONDS);

    const state = { ...withInvestors(0, { offline: 3 }) };
    state.businesses = state.businesses.map((bs) =>
      bs.id === 'friet' ? { ...bs, owned: 10, managed: true } : bs,
    );
    const cap = perkOfflineCapSeconds(state);
    expect(cap).toBe(OFFLINE_CAP_SECONDS + 3 * 2 * 3600);

    const away = offlineEarnings(state, cap + 5_000);
    expect(away.seconds).toBe(cap);
    expect(away.capped).toBe(true);
  });

  it('pays extra cycles per manual tap', () => {
    expect(perkTapCycles(withInvestors(0))).toBe(1);

    function payoutFor(tapLevel: number) {
      let state = withInvestors(0, { tap: tapLevel });
      state.businesses = state.businesses.map((bs) =>
        bs.id === 'friet' ? { ...bs, owned: 10 } : bs,
      );
      state = tap(state, 'friet');
      return advance(state, 5).earned;
    }

    expect(payoutFor(4).div(payoutFor(0)).toNumber()).toBeCloseTo(5, 9);
  });

  it('reports a neutral effect value at level zero', () => {
    const fresh = withInvestors(0);
    expect(perkEffectValue(fresh, 'profit')).toBe(1);
    expect(perkEffectValue(fresh, 'payout')).toBe(0);
    expect(perkEffectValue(fresh, 'cost')).toBe(0);
    expect(perkEffectValue(fresh, 'tap')).toBe(1);
  });
});

describe('endless progression', () => {
  /**
   * The balance guarantee, as an inequality rather than a vibe.
   *
   * Investors scale with sqrt(lifetime earnings) and lifetime earnings scale
   * with the profit multiplier, so a run buys levels up to cost^n ≈ sqrt(P) and
   * ends at P' = power^n = P^(ln power / 2 ln cost). That exponent has to be at
   * least 1 or every prestige returns less than the last and the curve settles
   * on a ceiling — the exact failure this whole system was built to remove.
   */
  it('keeps every run stronger than the last', () => {
    const profit = getPerk('profit');
    const exponent = Math.log(profit.step) / (2 * Math.log(profit.costGrowth));
    expect(exponent).toBeGreaterThanOrEqual(1);
  });

  it('lets a real prestige loop compound without stalling', () => {
    let state: GameState = createInitialState(0);
    const multipliers: number[] = [];

    // Eight rounds of: earn, sell, spend everything on profit.
    //
    // A round's takings are proportional to the profit multiplier, which is
    // what makes this a test of the system rather than of a schedule invented
    // here: nothing feeds growth in from outside, so if the curve converges the
    // loop below converges with it.
    for (let round = 0; round < 8; round += 1) {
      const earned = D(1e12).mul(globalMultiplier(state));
      state = { ...state, lifetimeEarnings: state.lifetimeEarnings.add(earned) };

      state = prestige(state);
      expect(state.prestigeCount).toBe(round + 1);

      let guard = 20_000;
      while (canBuyPerk(state, 'profit') && guard-- > 0) {
        state = buyPerk(state, 'profit');
      }
      multipliers.push(globalMultiplier(state));
    }

    for (let i = 1; i < multipliers.length; i += 1) {
      expect(multipliers[i]).toBeGreaterThan(multipliers[i - 1]);
    }

    // The *rate* of growth must not decay. Compare the log-jumps: a converging
    // curve shrinks them towards zero, and this is the shape that would put the
    // ceiling back without anyone noticing.
    const jumps = multipliers
      .slice(1)
      .map((m, i) => Math.log(m) - Math.log(multipliers[i]));
    for (let i = 1; i < jumps.length; i += 1) {
      expect(jumps[i]).toBeGreaterThanOrEqual(jumps[i - 1]);
    }
  });

  it('runs out of money before it runs out of ladder', () => {
    let state = withInvestors(1e12);
    let bought = 0;
    while (canBuyPerk(state, 'profit') && bought < 5_000) {
      state = buyPerk(state, 'profit');
      bought += 1;
    }

    // A trillion investors buys a few hundred levels and then stops — because
    // the budget is gone, not because the perk ended.
    expect(bought).toBeGreaterThan(100);
    expect(bought).toBeLessThan(5_000);
    expect(nextPerkCost(state, 'profit')).not.toBeNull();
    expect(availableInvestors(state)).toBeLessThan(nextPerkCost(state, 'profit') as number);
  });
});
