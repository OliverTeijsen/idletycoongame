import { BAL } from '../balance';
import { D, ONE, ZERO } from '../numbers';
import { defaultState } from '../state';
import {
  canEnterChallenge,
  challengeGoal,
  checkChallengeCompletion,
  enterChallenge,
  exitChallenge,
} from '../systems/challenges';
import { costGrowthFor } from '../systems/challengeperks';
import { buyDim, dimCost } from '../systems/dimensions';
import { moteRate } from '../systems/motes';
import { globalMult, speedMult, tierMult } from '../systems/multipliers';

function p2() {
  const s = defaultState(0);
  s.ascends = 1;
  return s;
}

describe('run flow', () => {
  it('locked before Ascend, one at a time, capped at maxTier', () => {
    const s = defaultState(0);
    expect(canEnterChallenge(s, 'famine')).toBe(false);

    const t = p2();
    expect(enterChallenge(t, 'famine')).toBe(true);
    expect(t.activeChallenge).toBe('famine');
    expect(canEnterChallenge(t, 'stillRing')).toBe(false); // one at a time

    const done = p2();
    done.challenges = { famine: BAL.challenges.defs.find((c) => c.id === 'famine')!.maxTier };
    expect(canEnterChallenge(done, 'famine')).toBe(false);
  });

  it('entering resets layer 0', () => {
    const s = p2();
    s.spark = D(1e9);
    s.dims[0].amount = D(1000);
    enterChallenge(s, 'famine');
    expect(s.spark.eq(BAL.dimBoost.startingSpark)).toBe(true);
    expect(s.dims[0].amount.eq(ZERO)).toBe(true);
  });

  it('abandoning resets and grants nothing', () => {
    const s = p2();
    enterChallenge(s, 'famine');
    s.spark = D(1e9);
    expect(exitChallenge(s)).toBe(true);
    expect(s.activeChallenge).toBeNull();
    expect(s.challenges['famine'] ?? 0).toBe(0);
    expect(s.spark.eq(BAL.dimBoost.startingSpark)).toBe(true);
  });

  it('reaching the goal completes the tier, grants an element point, resets', () => {
    const s = p2();
    enterChallenge(s, 'famine');
    s.bestSparkRun = challengeGoal(s, 'famine');
    const completed = checkChallengeCompletion(s);
    expect(completed).toBe('famine');
    expect(s.challenges.famine).toBe(1);
    expect(s.activeChallenge).toBeNull();
    expect(s.elements.points).toBe(BAL.elements.pointsPerChallenge);
    // next tier's goal is higher
    expect(challengeGoal(s, 'famine').gt(BAL.challenges.defs.find((c) => c.id === 'famine')!.goalBase)).toBe(true);
  });
});

describe('restrictions bite during the run', () => {
  it('stillRing locks speed to 1', () => {
    const s = p2();
    s.moteUpgrades = { focus: 5 };
    expect(speedMult(s).gt(ONE)).toBe(true);
    enterChallenge(s, 'stillRing');
    s.moteUpgrades = { focus: 5 };
    expect(speedMult(s).eq(ONE)).toBe(true);
  });

  it('famine zeroes mote gain', () => {
    const s = p2();
    enterChallenge(s, 'famine');
    s.dims[0].amount = D(100);
    expect(moteRate(s).eq(ZERO)).toBe(true);
  });

  it('solitary blocks buying tiers above 1', () => {
    const s = p2();
    enterChallenge(s, 'solitary');
    s.spark = D('1e10');
    expect(buyDim(s, 2, 1)).toBe(0);
    expect(buyDim(s, 1, 1)).toBe(1);
  });

  it('brittle steepens cost growth during the run', () => {
    const s = p2();
    const before = dimCost(s, 1);
    enterChallenge(s, 'brittle');
    s.dims[0].bought = 10;
    const steep = dimCost(s, 1);
    const normal = defaultState(0);
    normal.dims[0].bought = 10;
    expect(steep.gt(dimCost(normal, 1))).toBe(true);
    expect(before.eq(BAL.dimensions[0].baseCost)).toBe(true);
  });

  it('dim forces the global multiplier to 1', () => {
    const s = p2();
    s.shardsEver = D(100);
    expect(globalMult(s).gt(ONE)).toBe(true);
    enterChallenge(s, 'dim');
    expect(globalMult(s).eq(ONE)).toBe(true);
  });
});

describe('rewards persist after the run', () => {
  it('speed, mote, tier and cost-growth rewards apply', () => {
    const s = p2();
    s.challenges = { stillRing: 1, famine: 1, solitary: 1, brittle: 1 };
    expect(speedMult(s).sub(BAL.challenges.stillRingReward).abs().lt(D(1e-9))).toBe(true);
    expect(tierMult(s, 3).sub(BAL.challenges.solitaryReward).abs().lt(D(1e-9))).toBe(true);

    const noReward = p2();
    noReward.dims[0].amount = D(100);
    const withReward = p2();
    withReward.challenges = { famine: 1 };
    withReward.dims[0].amount = D(100);
    expect(
      moteRate(withReward)
        .div(moteRate(noReward))
        .sub(BAL.challenges.famineReward)
        .abs()
        .lt(D(1e-6)),
    ).toBe(true);

    const g = BAL.dimensions[0].costGrowth;
    expect(costGrowthFor(s, g).lt(g)).toBe(true);
  });

  it('cost growth can never fall below the clamp', () => {
    const s = p2();
    s.challenges = { brittle: 99 };
    expect(costGrowthFor(s, D(1.15)).gte(D(1.05))).toBe(true);
  });
});
