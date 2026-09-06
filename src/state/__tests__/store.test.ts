import { BAL } from '../../game/balance';
import { D, ZERO } from '../../game/numbers';
import { defaultState } from '../../game/state';
import { saveGame } from '../../services/storage';
import { useGameStore } from '../store';

beforeEach(() => {
  useGameStore.getState().hardReset();
});

describe('store actions', () => {
  it('tap grants tap power and counts', () => {
    useGameStore.getState().tap();
    const g = useGameStore.getState().game;
    expect(g.spark.eq(BAL.tapBase)).toBe(true);
    expect(g.totalTaps).toBe(1);
  });

  /**
   * The store must call `tapGain`, not `tapPower`: a tap is worth the larger
   * of its flat power and a slice of current production, and the production
   * half is what keeps the button alive after the opening minutes and gives
   * every post-reset run something to do.
   */
  it('tap scales with production once you have any', () => {
    const store = useGameStore.getState();
    store.game.dims[0].amount = D(1e6);
    const before = useGameStore.getState().game.spark;
    useGameStore.getState().tap();
    const gained = useGameStore.getState().game.spark.sub(before);
    expect(gained.gt(BAL.tapBase.mul(100))).toBe(true);
  });

  /**
   * The endless lanes are wired to the store. Each is a different currency's
   * only uncapped sink (balance.ts rule 2), so a missing action here is a
   * currency that silently stops mattering.
   */
  it('every endless grid can be bought through the store', () => {
    const store = useGameStore.getState();
    store.game.converges = 1;
    store.game.ore = D('1e12');
    store.game.aeon = D(1e6);
    store.game.singularity = D(1e6);
    store.game.shards = D(1e6);
    store.game.prism = D(1e6);
    store.game.collapses = 1;

    useGameStore.getState().buyResearchGrid('deepRefine');
    useGameStore.getState().buyAeonGrid('aeonWell');
    useGameStore.getState().buyMetaGrid('eternalFlame');
    useGameStore.getState().buyShardUpgrade('shardLens');
    useGameStore.getState().buyPrismUpgrade('resolve');
    useGameStore.getState().buyStarNode('ignite');

    const g = useGameStore.getState().game;
    expect(g.researchGrid.deepRefine).toBe(1);
    expect(g.aeonGrid.aeonWell).toBe(1);
    expect(g.metaGrid.eternalFlame).toBe(1);
    expect(g.shardUpgrades.shardLens).toBe(1);
    expect(g.prismGrid.resolve).toBe(1);
    // The chart is RANKED — a second buy is a second rank, not a no-op.
    useGameStore.getState().buyStarNode('ignite');
    expect(useGameStore.getState().game.starChart.ignite).toBe(2);
  });

  it('buyDimension respects the buy amount', () => {
    const store = useGameStore.getState();
    store.game.spark = D('1e6');
    store.setBuyAmount(10);
    useGameStore.getState().buyDimension(1);
    expect(useGameStore.getState().game.dims[0].bought).toBe(10);
  });

  it('tick produces spark from owned orbiters', () => {
    const store = useGameStore.getState();
    store.game.dims[0].amount = D(100);
    store.tick(1);
    expect(useGameStore.getState().game.spark.gt(ZERO)).toBe(true);
  });

  it('init loads a save and applies offline progress', () => {
    const s = defaultState(0);
    s.dims[0] = { bought: 1, amount: D(100), unlocked: true };
    s.savedAt = 0;
    saveGame(s);

    useGameStore.getState().init(600_000); // 10 minutes later
    const store = useGameStore.getState();
    expect(store.game.spark.gt(ZERO)).toBe(true);
    expect(store.offlineSummary).not.toBeNull();
    expect(store.offlineSummary!.seconds).toBe(600);

    store.dismissOffline();
    expect(useGameStore.getState().offlineSummary).toBeNull();
  });

  it('init with no save starts fresh without an offline modal', () => {
    useGameStore.getState().init();
    expect(useGameStore.getState().game.spark.eq(ZERO)).toBe(true);
    expect(useGameStore.getState().offlineSummary).toBeNull();
  });

  it('save → init roundtrips current progress', () => {
    const store = useGameStore.getState();
    store.game.spark = D(12345);
    store.save(1000);
    useGameStore.getState().init(1000);
    expect(useGameStore.getState().game.spark.eq(D(12345))).toBe(true);
  });

  it('hardReset wipes state and storage', () => {
    const store = useGameStore.getState();
    store.game.spark = D(999);
    store.save();
    store.hardReset();
    expect(useGameStore.getState().game.spark.eq(ZERO)).toBe(true);
    useGameStore.getState().init();
    expect(useGameStore.getState().game.spark.eq(ZERO)).toBe(true);
  });
});
