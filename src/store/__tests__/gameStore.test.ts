/**
 * Store tests: hydration, autosave, the offline hand-off and action delegation.
 *
 * The economy itself is covered by the core suite — what is checked here is the
 * wiring, especially the places where time is involved and a bug would either
 * lose a player's progress or pay them twice.
 */
import { getDef } from '../../core/businesses';
import { getBusiness, perSecond } from '../../core/economy';
import { createInitialState } from '../../core/engine';
import { D } from '../../core/numbers';
import type { GameState, Payout } from '../../core/types';
import { clearSave, loadGame, saveGame } from '../../services/storage';
import { AUTOSAVE_SECONDS, MAX_TICK_SECONDS, subscribeToPayouts, useGameStore } from '../gameStore';

const FRIET = getDef('friet');

function set(partial: Partial<GameState>): void {
  useGameStore.setState({ state: { ...useGameStore.getState().state, ...partial } });
}

function state(): GameState {
  return useGameStore.getState().state;
}

beforeEach(() => {
  clearSave();
  useGameStore.setState({
    state: createInitialState(0),
    hydrated: false,
    offline: null,
    prestigePending: false,
  });
});

describe('hydration', () => {
  it('starts a new game when there is no save', () => {
    useGameStore.getState().hydrate(1_000);
    expect(useGameStore.getState().hydrated).toBe(true);
    expect(getBusiness(state(), 'friet').owned).toBe(1);
    expect(state().cash.eq(D(0))).toBe(true);
    expect(useGameStore.getState().offline).toBeNull();
  });

  it('restores a previous save', () => {
    saveGame({ ...createInitialState(0), cash: D('1e30'), investors: 12, lastActiveAt: 1_000 });
    useGameStore.getState().hydrate(1_000);
    expect(state().cash.eq(D('1e30'))).toBe(true);
    expect(state().investors).toBe(12);
  });

  it('offers offline earnings after a long absence', () => {
    let saved = createInitialState(0);
    saved = {
      ...saved,
      businesses: saved.businesses.map((b) => (b.id === 'friet' ? { ...b, owned: 10, managed: true } : b)),
      lastActiveAt: 0,
    };
    saveGame(saved);

    useGameStore.getState().hydrate(3600 * 1000); // one hour later
    const offline = useGameStore.getState().offline!;
    expect(offline).not.toBeNull();
    expect(offline.seconds).toBe(3600);
    expect(offline.amount.eq(perSecond(saved).mul(3600))).toBe(true);
  });

  it('does not interrupt for a blink of absence', () => {
    let saved = createInitialState(0);
    saved = {
      ...saved,
      businesses: saved.businesses.map((b) => (b.id === 'friet' ? { ...b, owned: 10, managed: true } : b)),
      lastActiveAt: 0,
    };
    saveGame(saved);

    useGameStore.getState().hydrate(2_000); // 2s
    expect(useGameStore.getState().offline).toBeNull();
  });

  it('offers nothing when no business is automated', () => {
    saveGame({ ...createInitialState(0), lastActiveAt: 0 });
    useGameStore.getState().hydrate(3600 * 1000);
    expect(useGameStore.getState().offline).toBeNull();
  });

  it('re-anchors the clock immediately so the same seconds are never paid twice', () => {
    let saved = createInitialState(0);
    saved = {
      ...saved,
      businesses: saved.businesses.map((b) => (b.id === 'friet' ? { ...b, owned: 10, managed: true } : b)),
      lastActiveAt: 0,
    };
    saveGame(saved);

    const now = 3600 * 1000;
    useGameStore.getState().hydrate(now);
    expect(state().lastActiveAt).toBe(now);

    // A second hydrate at the same instant must not find another hour.
    useGameStore.getState().save(now);
    useGameStore.getState().hydrate(now);
    expect(useGameStore.getState().offline).toBeNull();
  });
});

describe('offline claim', () => {
  function withPendingOffline(): void {
    let saved = createInitialState(0);
    saved = {
      ...saved,
      businesses: saved.businesses.map((b) => (b.id === 'friet' ? { ...b, owned: 10, managed: true } : b)),
      lastActiveAt: 0,
    };
    saveGame(saved);
    useGameStore.getState().hydrate(3600 * 1000);
  }

  it('banks the amount and dismisses the modal', () => {
    withPendingOffline();
    const expected = useGameStore.getState().offline!.amount;

    useGameStore.getState().claimOffline(1, 3600 * 1000);
    expect(state().cash.eq(expected)).toBe(true);
    expect(useGameStore.getState().offline).toBeNull();
  });

  it('doubles for the rewarded ad', () => {
    withPendingOffline();
    const expected = useGameStore.getState().offline!.amount.mul(2);

    useGameStore.getState().claimOffline(2, 3600 * 1000);
    expect(state().cash.eq(expected)).toBe(true);
  });

  it('persists the claim immediately, so a crash cannot lose it', () => {
    withPendingOffline();
    useGameStore.getState().claimOffline(1, 3600 * 1000);
    expect(loadGame(3600 * 1000)!.cash.eq(state().cash)).toBe(true);
  });

  it('is a no-op with nothing pending', () => {
    useGameStore.getState().hydrate(0);
    const before = state();
    useGameStore.getState().claimOffline(2, 0);
    expect(state()).toBe(before);
  });
});

describe('tick', () => {
  beforeEach(() => {
    useGameStore.getState().hydrate(0);
    set({
      businesses: state().businesses.map((b) => (b.id === 'friet' ? { ...b, owned: 1, managed: true } : b)),
    });
  });

  it('advances the economy', () => {
    useGameStore.getState().tick(FRIET.cycleTime);
    expect(state().cash.eq(D(3))).toBe(true);
  });

  it('ignores a zero, negative or non-finite dt', () => {
    const before = state();
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      useGameStore.getState().tick(dt);
    }
    expect(state()).toBe(before);
  });

  it('clamps an absurd dt, leaving long gaps to the offline path', () => {
    useGameStore.getState().tick(48 * 3600);
    const cappedCycles = Math.floor(MAX_TICK_SECONDS / FRIET.cycleTime);
    expect(state().cash.eq(D(3 * cappedCycles))).toBe(true);
  });

  it('autosaves after the interval, not on every tick', () => {
    useGameStore.getState().tick(1);
    expect(loadGame(0)).toBeNull();

    useGameStore.getState().tick(AUTOSAVE_SECONDS);
    const saved = loadGame(0);
    expect(saved).not.toBeNull();
    expect(saved!.cash.eq(state().cash)).toBe(true);
  });

  it('stamps lastActiveAt on autosave so offline starts from the last write', () => {
    const before = state().lastActiveAt;
    useGameStore.getState().tick(AUTOSAVE_SECONDS + 1);
    expect(state().lastActiveAt).toBeGreaterThan(before);
  });

  it('emits payouts to subscribers without storing them', () => {
    const seen: Payout[][] = [];
    const unsubscribe = subscribeToPayouts((p) => seen.push(p));

    useGameStore.getState().tick(FRIET.cycleTime);
    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toMatchObject({ id: 'friet', cycles: 1 });

    useGameStore.getState().tick(0.1); // no cycle completes -> no event
    expect(seen).toHaveLength(1);

    unsubscribe();
    useGameStore.getState().tick(FRIET.cycleTime);
    expect(seen).toHaveLength(1);
    expect(useGameStore.getState()).not.toHaveProperty('lastPayouts');
  });
});

describe('actions delegate to the core', () => {
  beforeEach(() => {
    useGameStore.getState().hydrate(0);
  });

  it('taps, buys, hires and switches the buy amount', () => {
    useGameStore.getState().tapBusiness('friet');
    expect(getBusiness(state(), 'friet').active).toBe(true);

    set({ cash: D(1e6) });
    useGameStore.getState().chooseBuyAmount(10);
    expect(state().buyAmount).toBe(10);

    useGameStore.getState().buyBusiness('friet');
    expect(getBusiness(state(), 'friet').owned).toBe(11);

    useGameStore.getState().hireManagerFor('friet');
    expect(getBusiness(state(), 'friet').managed).toBe(true);
  });

  it('refuses unaffordable purchases', () => {
    const before = state();
    useGameStore.getState().buyBusiness('empire');
    expect(state()).toBe(before);
  });

  it('starts a boost', () => {
    useGameStore.getState().startBoost();
    expect(state().boostRemainingMs).toBe(30_000);
    expect(state().boostMultiplier).toBe(2);
  });

  it('runs the prestige flow and persists the result', () => {
    set({ cash: D(1e6), lifetimeEarnings: D(1e9) });

    useGameStore.getState().openPrestige();
    expect(useGameStore.getState().prestigePending).toBe(true);

    useGameStore.getState().closePrestige();
    expect(useGameStore.getState().prestigePending).toBe(false);

    useGameStore.getState().openPrestige();
    useGameStore.getState().confirmPrestige();

    expect(state().investors).toBe(150);
    expect(state().cash.eq(D(0))).toBe(true);
    expect(useGameStore.getState().prestigePending).toBe(false);
    expect(loadGame(0)!.investors).toBe(150);
  });

  it('resets the game', () => {
    set({ cash: D(1e12), investors: 99 });
    useGameStore.getState().resetGame(500);
    expect(state().cash.eq(D(0))).toBe(true);
    expect(state().investors).toBe(0);
    expect(loadGame(500)!.investors).toBe(0);
  });
});

describe('app lifecycle', () => {
  it('saves on background', () => {
    useGameStore.getState().hydrate(0);
    set({ cash: D(4_242) });

    useGameStore.getState().onBackground(9_000);
    const saved = loadGame(9_000)!;
    expect(saved.cash.eq(D(4_242))).toBe(true);
    expect(state().lastActiveAt).toBe(9_000);
  });

  it('pays offline earnings on foreground', () => {
    useGameStore.getState().hydrate(0);
    set({
      businesses: state().businesses.map((b) => (b.id === 'friet' ? { ...b, owned: 10, managed: true } : b)),
    });
    useGameStore.getState().onBackground(0);

    useGameStore.getState().onForeground(600 * 1000); // 10 minutes
    const offline = useGameStore.getState().offline!;
    expect(offline).not.toBeNull();
    expect(offline.seconds).toBe(600);
    expect(state().lastActiveAt).toBe(600 * 1000);
  });

  it('does not clobber a pending offline payout on a second foreground', () => {
    useGameStore.getState().hydrate(0);
    set({
      businesses: state().businesses.map((b) => (b.id === 'friet' ? { ...b, owned: 10, managed: true } : b)),
    });
    useGameStore.getState().onBackground(0);
    useGameStore.getState().onForeground(600 * 1000);
    const first = useGameStore.getState().offline;

    useGameStore.getState().onForeground(600 * 1000 + 100);
    expect(useGameStore.getState().offline).toBe(first);
  });

  // A phone in a pocket overnight never relaunches the app, so claiming the
  // streak only on hydrate would skip a day for anyone who leaves it running.
  it('claims the new day when resumed across midnight', () => {
    const monday = new Date(2026, 2, 16, 22, 0, 0).getTime();
    const tuesday = new Date(2026, 2, 17, 8, 0, 0).getTime();

    useGameStore.getState().hydrate(monday);
    expect(useGameStore.getState().streak?.day).toBe(1);
    useGameStore.getState().dismissStreak();

    useGameStore.getState().onBackground(monday);
    useGameStore.getState().onForeground(tuesday);

    expect(useGameStore.getState().streak?.day).toBe(2);
    expect(state().streakDays).toBe(2);
  });

  it('does not re-claim when resumed on the same day', () => {
    const morning = new Date(2026, 2, 16, 9, 0, 0).getTime();
    const evening = new Date(2026, 2, 16, 21, 0, 0).getTime();

    useGameStore.getState().hydrate(morning);
    useGameStore.getState().dismissStreak();

    useGameStore.getState().onForeground(evening);
    expect(useGameStore.getState().streak).toBeNull();
    expect(state().streakDays).toBe(1);
  });
});
