/**
 * UI smoke tests: the components render, read the right state, and their
 * presses reach the core. Visual polish is phase 3's problem — what matters
 * here is that no row can spend money the player does not have.
 *
 * NOTE: @testing-library/react-native v14 made `render` and `fireEvent` async.
 * Every call must be awaited or `screen` stays empty.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { getDef } from '../../core/businesses';
import { getBusiness } from '../../core/economy';
import { createInitialState } from '../../core/engine';
import { D, money } from '../../core/numbers';
import type { GameState } from '../../core/types';
import { clearSave } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import { BottomBar } from '../components/BottomBar';
import { BusinessRow } from '../components/BusinessRow';
import { BuyAmountToggle } from '../components/BuyAmountToggle';
import { OfflineModal } from '../components/OfflineModal';
import { PrestigeModal } from '../components/PrestigeModal';
import { TopBar } from '../components/TopBar';

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
    hydrated: true,
    offline: null,
    prestigePending: false,
  });
});

describe('TopBar', () => {
  it('shows cash and income', async () => {
    set({ cash: D(1234) });
    await render(<TopBar />);
    expect(screen.getByText('€1.23K')).toBeTruthy();
    // formatBig renders a whole number without decimals, so zero income is "€0/s".
    expect(screen.getByText('€0/s')).toBeTruthy();
  });

  it('shows the investor count and permanent bonus', async () => {
    set({ investors: 25 });
    await render(<TopBar />);
    expect(screen.getByText(/25/)).toBeTruthy();
    expect(screen.getByText('+50%')).toBeTruthy();
  });

  it('hides the boost badge when no boost is running', async () => {
    await render(<TopBar />);
    expect(screen.queryByText(/×2 ·/)).toBeNull();
  });

  it('shows the boost badge with its remaining time', async () => {
    set({ boostRemainingMs: 30_000, boostMultiplier: 2 });
    await render(<TopBar />);
    expect(screen.getByText('×2 · 30s')).toBeTruthy();
  });
});

describe('BusinessRow', () => {
  it('renders the tier and its owned count', async () => {
    await render(<BusinessRow id="friet" />);
    expect(screen.getByText('Fry Shack')).toBeTruthy();
    expect(screen.getByTestId('owned-friet')).toHaveTextContent('1');
  });

  it('runs a cycle when the icon is tapped', async () => {
    await render(<BusinessRow id="friet" />);
    await fireEvent.press(screen.getByTestId('tap-friet'));
    expect(getBusiness(state(), 'friet').active).toBe(true);
  });

  it('does not let an unaffordable buy button spend money', async () => {
    await render(<BusinessRow id="empire" />);
    await fireEvent.press(screen.getByTestId('buy-empire'));
    expect(getBusiness(state(), 'empire').owned).toBe(0);
    expect(state().cash.eq(D(0))).toBe(true);
  });

  it('buys when affordable and charges the right amount', async () => {
    set({ cash: D(100) });
    await render(<BusinessRow id="friet" />);

    await fireEvent.press(screen.getByTestId('buy-friet'));
    expect(getBusiness(state(), 'friet').owned).toBe(2);
    expect(state().cash.lt(D(100))).toBe(true);
  });

  it('shows the manager cost and hires on press', async () => {
    const def = getDef('friet');
    set({ cash: def.managerCost });
    await render(<BusinessRow id="friet" />);
    expect(screen.getByText(money(def.managerCost))).toBeTruthy();

    await fireEvent.press(screen.getByTestId('manager-friet'));
    expect(getBusiness(state(), 'friet').managed).toBe(true);
  });

  it('shows the AUTO state once a manager is hired', async () => {
    set({
      businesses: state().businesses.map((b) => (b.id === 'friet' ? { ...b, managed: true } : b)),
    });
    await render(<BusinessRow id="friet" />);
    expect(screen.getByText('✓ Auto')).toBeTruthy();
    expect(screen.getByText('AUTO')).toBeTruthy();
  });

  it('hints at the next milestone', async () => {
    await render(<BusinessRow id="friet" />);
    expect(screen.getByText(/Next ×2 in 24 units/)).toBeTruthy();
  });
});

describe('BuyAmountToggle', () => {
  it('switches the buy amount for every row at once', async () => {
    await render(<BuyAmountToggle />);
    await fireEvent.press(screen.getByTestId('buy-amount-100'));
    expect(state().buyAmount).toBe(100);

    await fireEvent.press(screen.getByTestId('buy-amount-MAX'));
    expect(state().buyAmount).toBe('MAX');
  });
});

describe('BottomBar', () => {
  it('starts a boost', async () => {
    await render(<BottomBar />);
    await fireEvent.press(screen.getByTestId('boost-button'));
    expect(state().boostRemainingMs).toBeGreaterThan(0);
  });

  it('keeps prestige disabled until it would pay an investor', async () => {
    await render(<BottomBar />);
    await fireEvent.press(screen.getByTestId('prestige-button'));
    expect(useGameStore.getState().prestigePending).toBe(false);
  });

  it('opens the prestige modal once an investor is available', async () => {
    set({ lifetimeEarnings: D(1e9) });
    await render(<BottomBar />);
    await fireEvent.press(screen.getByTestId('prestige-button'));
    expect(useGameStore.getState().prestigePending).toBe(true);
  });
});

describe('OfflineModal', () => {
  it('renders nothing without a pending payout', async () => {
    await render(<OfflineModal />);
    expect(screen.queryByTestId('offline-modal')).toBeNull();
  });

  it('shows the amount and collects it', async () => {
    useGameStore.setState({
      offline: { seconds: 3600, rawSeconds: 3600, capped: false, amount: D(5000) },
    });
    await render(<OfflineModal />);
    expect(screen.getByTestId('offline-amount')).toHaveTextContent('€5.00K');

    await fireEvent.press(screen.getByTestId('offline-collect'));
    expect(state().cash.eq(D(5000))).toBe(true);
    expect(useGameStore.getState().offline).toBeNull();
  });

  it('doubles through the rewarded button', async () => {
    useGameStore.setState({
      offline: { seconds: 3600, rawSeconds: 3600, capped: false, amount: D(5000) },
    });
    await render(<OfflineModal />);
    await fireEvent.press(screen.getByTestId('offline-double'));
    expect(state().cash.eq(D(10_000))).toBe(true);
  });

  it('says so when the 12h cap trimmed the window', async () => {
    useGameStore.setState({
      offline: { seconds: 43_200, rawSeconds: 86_400, capped: true, amount: D(1) },
    });
    await render(<OfflineModal />);
    expect(screen.getByText(/max 12 h/)).toBeTruthy();
  });
});

describe('PrestigeModal', () => {
  it('renders nothing until it is opened', async () => {
    await render(<PrestigeModal />);
    expect(screen.queryByTestId('prestige-modal')).toBeNull();
  });

  it('shows the investors gained and confirms', async () => {
    set({ cash: D(1e6), lifetimeEarnings: D(1e9) });
    useGameStore.setState({ prestigePending: true });

    await render(<PrestigeModal />);
    // toHaveTextContent matches the full string in RNTL v14.
    expect(screen.getByTestId('prestige-gain')).toHaveTextContent('+150 💼');

    await fireEvent.press(screen.getByTestId('prestige-confirm'));
    expect(state().investors).toBe(150);
    expect(state().cash.eq(D(0))).toBe(true);
  });

  it('cancels without touching the empire', async () => {
    set({ cash: D(1e6), lifetimeEarnings: D(1e9) });
    useGameStore.setState({ prestigePending: true });

    await render(<PrestigeModal />);
    await fireEvent.press(screen.getByTestId('prestige-cancel'));
    expect(state().investors).toBe(0);
    expect(state().cash.eq(D(1e6))).toBe(true);
  });
});
