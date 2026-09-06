/**
 * The UI smoke test: every screen must MOUNT, at every stage of the game.
 *
 * Nothing here asserts a layout or a wording for its own sake — those change
 * every time the design does, and a test that pins them is a test people
 * delete. What it pins is the thing that must never break and is otherwise
 * unguarded: a screen reads game state through a dozen system functions, and a
 * rename, a shape change (the Star Chart's booleans becoming ranks) or a field
 * the defaults forgot turns into a white screen no core test can see.
 *
 * Each screen renders TWICE — on a fresh save and on a deep one — because most
 * of this UI does not exist until something is unlocked, and the deep pass is
 * the only place the Mine, Trials, Elements and Meta Shop paths run at all.
 *
 * ── WHY react-test-renderer AND NOT @testing-library/react-native ───────────
 * On this stack (RNTL 14, React 19, jest-expo) RNTL's `render` neither renders
 * nor reports: it returns an object with no query methods and no `toJSON`, it
 * throws nothing when a component throws, and it logs nothing either —
 * measured with a component whose entire body is `throw new Error()`. A smoke
 * test written on it passes no matter what happens, which is worse than having
 * none at all. `react-test-renderer` on the same stack renders correctly and
 * propagates the throw, so the assertions below are real. If RNTL is ever
 * fixed or replaced, check that a deliberately broken component still fails
 * this file BEFORE migrating it.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { BAL } from '../../game/balance';
import { D } from '../../game/numbers';
import { defaultState } from '../../game/state';
import { GameState } from '../../game/types';
import { useGameStore } from '../../state/store';
import { AutoScreen } from '../screens/AutoScreen';
import { ChallengesScreen } from '../screens/ChallengesScreen';
import { CoreScreen } from '../screens/CoreScreen';
import { ElementsScreen } from '../screens/ElementsScreen';
import { MineScreen } from '../screens/MineScreen';
import { MotesScreen } from '../screens/MotesScreen';
import { OptionsScreen } from '../screens/OptionsScreen';
import { PrestigeScreen } from '../screens/PrestigeScreen';
import { StarChartScreen } from '../screens/StarChartScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ResourceBar } from '../components/ResourceBar';

const SCREENS: [string, React.ComponentType][] = [
  ['ResourceBar', ResourceBar],
  ['Core', CoreScreen],
  ['Motes', MotesScreen],
  ['Prestige', PrestigeScreen],
  ['StarChart', StarChartScreen],
  ['Elements', ElementsScreen],
  ['Challenges', ChallengesScreen],
  ['Mine', MineScreen],
  ['Auto', AutoScreen],
  ['Stats', StatsScreen],
  ['Options', OptionsScreen],
];

/** A save with every layer opened and something bought in every lane. */
function deepSave(): GameState {
  const s = defaultState(0);
  s.spark = D('1e120');
  s.bestSparkRun = D('1e120');
  s.totalSpark = D('1e400');
  s.timePlayed = 400 * 3600;
  s.runSeconds = 900;
  s.dims = s.dims.map(() => ({ bought: 40, amount: D('1e30'), unlocked: true }));
  s.dimBoosts = 30;
  s.sparkUpgrades = { fluxLattice: 12, cascade: 6, overdrive: 3, chainReaction: 2 };
  s.motes = D('1e18');
  s.motesEver = D('1e20');
  s.moteUpgrades = { focus: 8, density: 6, resonance: 5, crystallize: 3 };

  s.collapses = 400;
  s.shards = D(5e4);
  s.shardsEver = D(2e5);
  s.bestCollapseGain = D(900);
  s.shardUpgrades = { swiftServos: 4, emberBank: 6, shardLens: 5 };
  // Ranked chart, including the deep ring.
  s.starChart = { ignite: 6, kindling: 4, lattice: 3, corona: 2, outerIgnite: 2, deepCore: 1 };

  s.ascends = 40;
  s.prism = D(300);
  s.prismEver = D(900);
  s.prismGrid = { amplify: 5, momentum: 3, resolve: 4, refine: 2 };
  s.elements = { points: 4, alloc: { lux: 30, ignis: 12, terra: 5 }, progress: 100 };
  s.challenges = { solitary: 8, famine: 4, dim: 3, stillRing: 2 };

  s.converges = 12;
  s.aeon = D(40);
  s.aeonEver = D(120);
  s.aeonTree = { autoCollapse: true, keepMotes: true, dimPower: true };
  s.aeonGrid = { aeonWell: 3, aeonReach: 2 };

  s.ore = D('1e9');
  s.oreEver = D('1e12');
  s.miners = { drill: 60, auger: 30, rig: 12, bore: 4 };
  s.research = { oreSluice: true, fastServos: true, slotA: true, singularitySeed: true };
  s.researchGrid = { deepRefine: 4, oreEngine: 6 };
  s.boostSlots = ['kindler', 'weaver'];
  s.flux = D(400);

  s.unifies = 2;
  s.singularity = D(6);
  s.singularityEver = D(9);
  s.metaShop = { keepResearch: true, autoAscend: true, keepMiners: true };
  s.metaGrid = { eternalFlame: 1 };

  s.milestones = { firstOrbiter: 4, collapse: 600, ascend: 2200, converge: 68000 };
  return s;
}

/** Render one screen against one save; returns the serialized tree. */
function mount(state: GameState, Screen: React.ComponentType): string {
  useGameStore.setState({ game: state, offlineSummary: null });
  let tree: ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(<Screen />);
  });
  const json = JSON.stringify(tree!.toJSON());
  act(() => {
    tree!.unmount();
  });
  return json;
}

describe('every screen mounts', () => {
  // A non-trivial tree, not merely "did not throw": an empty render would
  // otherwise pass silently, which is the failure mode this file exists to
  // avoid having.
  it.each(SCREENS)('%s renders on a fresh save', (_name, Screen) => {
    expect(mount(defaultState(0), Screen).length).toBeGreaterThan(100);
  });

  it.each(SCREENS)('%s renders on a deep save', (_name, Screen) => {
    expect(mount(deepSave(), Screen).length).toBeGreaterThan(100);
  });

  /**
   * The Trials screen has a second state worth mounting: mid-run. That branch
   * draws the log-scale progress meter and the run clock, and nothing else in
   * the app touches either.
   */
  it('the Trials screen renders mid-run', () => {
    const s = deepSave();
    s.activeChallenge = 'famine';
    s.challengeElapsed = 240;
    expect(mount(s, ChallengesScreen)).toContain('Abandon run');
  });

  /**
   * And the Prestige screen has one: standing at the Unify gate with some of
   * the four conditions unmet, which is the only way the gate checklist gets
   * drawn. That checklist is the endgame's map — if it stops rendering, "why
   * can't I Unify?" becomes unanswerable inside the game.
   */
  it('the Prestige screen draws the Unify gate checklist', () => {
    const s = deepSave();
    s.unifies = 0;
    s.researchGrid = {};
    s.challenges = {};
    const tree = mount(s, PrestigeScreen);
    expect(tree).toContain(`Clear ${BAL.gates.unifyTrialTiers} Trial tiers`);
    expect(tree).toContain('Deep Refinement level');
  });

  /**
   * The Mine tab has to SAY what mining is for. The lifetime-Ore multiplier is
   * the answer, and a player who cannot see it will (rightly) conclude the
   * lane is decoration — which is exactly what was reported about it.
   */
  it('the Mine screen shows what Ore is buying', () => {
    const tree = mount(deepSave(), MineScreen);
    expect(tree).toContain('All production, from Ore mined');
    expect(tree).toContain('Deep Refinement');
  });
});
