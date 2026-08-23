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
