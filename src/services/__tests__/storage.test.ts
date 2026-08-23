import { D } from '../../game/numbers';
import { defaultState } from '../../game/state';
import {
  clearSave,
  exportSave,
  hasSave,
  importSave,
  loadGame,
  saveGame,
} from '../storage';

describe('persistence', () => {
  it('save → load roundtrips through MMKV', () => {
    const s = defaultState(1000);
    s.spark = D('4.2e33');
    s.dims[0] = { bought: 12, amount: D(500), unlocked: true };
    s.savedAt = 1000;
    saveGame(s);
    expect(hasSave()).toBe(true);

    const back = loadGame(2000)!;
    expect(back).not.toBeNull();
    expect(back.spark.eq(D('4.2e33'))).toBe(true);
    expect(back.dims[0].bought).toBe(12);
  });

  it('no save → null; clearSave removes it', () => {
    expect(loadGame()).toBeNull();
    saveGame(defaultState(0));
    expect(hasSave()).toBe(true);
    clearSave();
    expect(hasSave()).toBe(false);
    expect(loadGame()).toBeNull();
  });

  it('export → import roundtrips', () => {
    const s = defaultState(0);
    s.spark = D('1e100');
    s.moteUpgrades = { focus: 2 };
    const blob = exportSave(s);
    const back = importSave(blob, 0)!;
    expect(back).not.toBeNull();
    expect(back.spark.eq(D('1e100'))).toBe(true);
    expect(back.moteUpgrades.focus).toBe(2);
  });

  it('import rejects garbage', () => {
    expect(importSave('not base64 at all!!')).toBeNull();
    expect(importSave('aGVsbG8=')).toBeNull(); // "hello"
  });
});
