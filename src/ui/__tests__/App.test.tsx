/**
 * App integration test.
 *
 * The components are covered individually; what this pins down is the wiring
 * that only exists in App.tsx — hydration on mount, the 100ms tick loop
 * actually driving the economy, and the AppState handlers saving on background
 * and paying offline earnings on return.
 */
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';

import { getDef } from '../../core/businesses';
import { createInitialState } from '../../core/engine';
import { D } from '../../core/numbers';
import { clearSave, loadGame, saveGame } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import App from '../App';

// SafeAreaProvider measures real insets via onLayout and renders nothing until
// it has them. The library's own mock supplies static frames instead — it is a
// default export, so it has to be unwrapped or every named import is undefined.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

const FRIET = getDef('friet');

/** Drive the interval loop by `ms` of wall clock. */
async function advanceTimers(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** Fire an AppState transition the way the OS would. */
async function emitAppState(status: 'active' | 'background'): Promise<void> {
  const calls = (AppState.addEventListener as unknown as jest.Mock).mock.calls;
  const handlers = calls.filter(([event]) => event === 'change').map(([, handler]) => handler);
  await act(async () => {
    handlers.forEach((handler) => handler(status));
  });
}

beforeEach(() => {
  clearSave();
  useGameStore.setState({
    state: createInitialState(0),
    hydrated: false,
    offline: null,
    prestigePending: false,
  });
  jest.useFakeTimers();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('App', () => {
  it('hydrates on mount and renders all ten tiers', async () => {
    await render(<App />);

    expect(useGameStore.getState().hydrated).toBe(true);
    expect(screen.getByText('Fry Shack')).toBeTruthy();
    expect(screen.getByText('Global F&B Empire')).toBeTruthy();
    expect(screen.getByTestId('row-empire')).toBeTruthy();
  });

  it('runs the tick loop, so an automated business earns over time', async () => {
    saveGame({
      ...createInitialState(0),
      businesses: createInitialState(0).businesses.map((b) =>
        b.id === 'friet' ? { ...b, owned: 1, managed: true } : b,
      ),
      lastActiveAt: Date.now(),
    });

    await render(<App />);
    // Measure the delta, not the balance: hydrating also claims the daily
    // streak, so the starting cash is deliberately not zero.
    const before = useGameStore.getState().state.cash;

    await advanceTimers(FRIET.cycleTime * 1000);
    const earned = useGameStore.getState().state.cash.sub(before);
    expect(earned.gte(D(3))).toBe(true);
  });

  it('shows the offline modal when returning after an absence', async () => {
    const now = Date.now();
    saveGame({
      ...createInitialState(0),
      businesses: createInitialState(0).businesses.map((b) =>
        b.id === 'friet' ? { ...b, owned: 10, managed: true } : b,
      ),
      lastActiveAt: now - 3600 * 1000,
    });

    await render(<App />);
    expect(screen.getByTestId('offline-modal')).toBeTruthy();
    expect(useGameStore.getState().offline!.seconds).toBeCloseTo(3600, 0);
  });

  it('saves when the app goes to the background', async () => {
    await render(<App />);
    // Mounted components subscribe to the store, so a write re-renders them.
    await act(async () => {
      useGameStore.setState({
        state: { ...useGameStore.getState().state, cash: D(7_777) },
      });
    });

    await emitAppState('background');
    expect(loadGame(Date.now())!.cash.eq(D(7_777))).toBe(true);
  });

  it('does not double-pay the gap when returning to the foreground', async () => {
    saveGame({
      ...createInitialState(0),
      businesses: createInitialState(0).businesses.map((b) =>
        b.id === 'friet' ? { ...b, owned: 10, managed: true } : b,
      ),
      lastActiveAt: Date.now(),
    });
    await render(<App />);

    await emitAppState('background');
    await emitAppState('active');

    // Nothing meaningful elapsed, so there is no "welcome back" payout to make.
    expect(useGameStore.getState().offline).toBeNull();
  });

  it('stops ticking once unmounted', async () => {
    saveGame({
      ...createInitialState(0),
      businesses: createInitialState(0).businesses.map((b) =>
        b.id === 'friet' ? { ...b, owned: 1, managed: true } : b,
      ),
      lastActiveAt: Date.now(),
    });
    const view = await render(<App />);

    await act(async () => {
      await view.unmount();
    });
    const cash = useGameStore.getState().state.cash;

    await advanceTimers(10_000);
    expect(useGameStore.getState().state.cash.eq(cash)).toBe(true);
  });
});
