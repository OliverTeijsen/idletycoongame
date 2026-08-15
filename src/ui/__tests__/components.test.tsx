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
import { StyleSheet } from 'react-native';

import { getDef } from '../../core/businesses';
import { getBusiness, upgradeCost, upgradeLevel } from '../../core/economy';
import { createInitialState } from '../../core/engine';
import { D, money } from '../../core/numbers';
import { PERKS, getPerk, nextPerkCost, perkLevel } from '../../core/perks';
import type { GameState } from '../../core/types';
import { clearSave } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import { BottomBar } from '../components/BottomBar';
import { BusinessRow } from '../components/BusinessRow';
import { BuyAmountToggle } from '../components/BuyAmountToggle';
import { OfflineModal } from '../components/OfflineModal';
import { PerksModal } from '../components/PerksModal';
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
    perksOpen: false,
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

  it('shows the investor count and flags what is unspent', async () => {
    set({ investors: 25 });
    await render(<TopBar />);
    expect(screen.getByText('💼 25')).toBeTruthy();
    // Nothing bought yet, so all 25 are begging to be spent.
    expect(screen.getByTestId('investors-free')).toHaveTextContent('+25');
  });

  it('drops the unspent flag once the investors are committed', async () => {
    const base = state();
    set({ investors: 25, perks: { ...base.perks, cost: 6 } });
    await render(<TopBar />);
    expect(screen.queryByTestId('investors-free')).toBeNull();
  });

  it('opens the skill tree from the investor chip', async () => {
    await render(<TopBar />);
    await fireEvent.press(screen.getByTestId('open-perks'));
    expect(useGameStore.getState().perksOpen).toBe(true);
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

  it('buys a cash upgrade and shows the level on the button', async () => {
    set({ cash: D(1e6) });
    await render(<BusinessRow id="friet" />);

    const cost = upgradeCost(state(), 'friet');
    await fireEvent.press(screen.getByTestId('upgrade-friet'));

    expect(upgradeLevel(state(), 'friet')).toBe(1);
    expect(state().cash.eq(D(1e6).sub(cost))).toBe(true);
    // toHaveTextContent matches the full string in RNTL v14: the label carries
    // the level bought, and the price shown is now the one for the *next* one.
    expect(screen.getByTestId('upgrade-friet')).toHaveTextContent(
      `↑ ×2 · 1${money(upgradeCost(state(), 'friet'))}`,
    );
  });

  it('does not let an unaffordable upgrade spend money', async () => {
    set({ cash: D(0) });
    await render(<BusinessRow id="friet" />);
    await fireEvent.press(screen.getByTestId('upgrade-friet'));
    expect(upgradeLevel(state(), 'friet')).toBe(0);
  });

  it('refuses to upgrade a tier the player does not own yet', async () => {
    set({ cash: D('1e40') });
    await render(<BusinessRow id="empire" />);
    await fireEvent.press(screen.getByTestId('upgrade-empire'));
    expect(upgradeLevel(state(), 'empire')).toBe(0);
    expect(state().cash.eq(D('1e40'))).toBe(true);
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

  it('hints at the next speed-up', async () => {
    await render(<BusinessRow id="friet" />);
    expect(screen.getByText(/2× faster in 24/)).toBeTruthy();
  });
});

describe('BusinessRow — speed and continuous production', () => {
  function own(owned: number, managed = true): void {
    set({
      businesses: state().businesses.map((b) =>
        b.id === 'friet' ? { ...b, owned, managed } : b,
      ),
    });
  }

  it('shows the shortened cycle time once a speed milestone is passed', async () => {
    own(1);
    await render(<BusinessRow id="friet" />);
    expect(screen.getByText(/1\.5s/)).toBeTruthy();

    // 25 owned halves a 1.5s cycle.
    own(25);
    await render(<BusinessRow id="friet" />);
    expect(screen.getAllByText(/0\.8s|0\.75s/).length).toBeGreaterThan(0);
  });

  it('replaces the cycle time with "non-stop" once it outruns the tick', async () => {
    own(400);
    await render(<BusinessRow id="friet" />);
    expect(screen.getByText(/non-stop/)).toBeTruthy();
  });

  it('stops promising a speed-up once the tier already runs non-stop', async () => {
    own(400);
    await render(<BusinessRow id="friet" />);
    expect(screen.queryByText(/faster in/)).toBeNull();
  });

  // A tier nobody owns must not animate — there is no cycle to draw.
  it('renders an empty bar for an unowned tier', async () => {
    await render(<BusinessRow id="empire" />);
    expect(screen.getByTestId('progress-empire')).toBeTruthy();
  });

  it('fills the bar completely while production is continuous', async () => {
    own(400);
    await render(<BusinessRow id="friet" />);

    const bar = screen.getByTestId('progress-friet');
    const flat = StyleSheet.flatten(bar.props.style) as { width?: string };
    expect(flat.width).toBe('100%');
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

describe('PerksModal', () => {
  it('renders nothing until it is opened', async () => {
    await render(<PerksModal />);
    expect(screen.queryByTestId('perks-modal')).toBeNull();
  });

  it('lists every perk with the unspent balance on top', async () => {
    set({ investors: 30 });
    useGameStore.setState({ perksOpen: true });

    await render(<PerksModal />);
    expect(screen.getByTestId('perks-available')).toHaveTextContent('30');
    for (const def of PERKS) {
      expect(screen.getByTestId(`perk-${def.id}`)).toBeTruthy();
    }
  });

  it('buys a level and updates the balance in place', async () => {
    set({ investors: 30 });
    useGameStore.setState({ perksOpen: true });
    await render(<PerksModal />);

    const cost = nextPerkCost(state(), 'profit')!;
    await fireEvent.press(screen.getByTestId('perk-buy-profit'));

    expect(perkLevel(state(), 'profit')).toBe(1);
    expect(screen.getByTestId('perks-available')).toHaveTextContent(String(30 - cost));
    // The effect line only appears once there is an effect to report.
    expect(screen.getByTestId('perk-effect-profit')).toBeTruthy();
  });

  it('disables a perk the player cannot afford', async () => {
    set({ investors: 0 });
    useGameStore.setState({ perksOpen: true });
    await render(<PerksModal />);

    await fireEvent.press(screen.getByTestId('perk-buy-profit'));
    expect(perkLevel(state(), 'profit')).toBe(0);
    expect(screen.queryByTestId('perk-effect-profit')).toBeNull();
  });

  it('shows MAX instead of a price on a maxed perk', async () => {
    const base = state();
    set({ investors: 1e9, perks: { ...base.perks, tap: getPerk('tap').maxLevel as number } });
    useGameStore.setState({ perksOpen: true });
    await render(<PerksModal />);

    expect(screen.getByTestId('perk-buy-tap')).toHaveTextContent('MAX');
  });

  it('closes', async () => {
    useGameStore.setState({ perksOpen: true });
    await render(<PerksModal />);
    await fireEvent.press(screen.getByTestId('perks-close'));
    expect(useGameStore.getState().perksOpen).toBe(false);
  });
});
