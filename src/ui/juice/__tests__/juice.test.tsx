/**
 * Juice-layer behaviour. Animation *timing* is Reanimated's problem; what is
 * tested here is the logic wrapped around it — throttling, aggregation, spawn
 * rules and the reward hand-off — because those are the parts that can silently
 * spam the screen or drop a payout.
 *
 * Payouts and the golden-bag timer both update state from outside React, so
 * every one of them is driven inside `act()`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Decimal from 'break_infinity.js';
import React from 'react';
import { Text } from 'react-native';

import { BOOST_MULTIPLIER, GOLDEN_MULTIPLIER } from '../../../core/businesses';
import { createInitialState } from '../../../core/engine';
import { useGameStore } from '../../../store/gameStore';
import { CoinBurst } from '../CoinBurst';
import { FloatingPayouts } from '../FloatingPayouts';
import { GoldenFries } from '../GoldenFries';
import { useEasedDecimal } from '../useEasedDecimal';

const D = (n: number): Decimal => new Decimal(n);

/** A state where one tier is automated, so `tick` produces payouts. */
function automated(): void {
  const base = createInitialState();
  useGameStore.setState({
    hydrated: true,
    state: {
      ...base,
      businesses: base.businesses.map((b) =>
        b.id === 'friet' ? { ...b, owned: 10, managed: true } : b,
      ),
    },
  });
}

async function tick(seconds: number): Promise<void> {
  await act(async () => {
    useGameStore.getState().tick(seconds);
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

function labelTexts(): string[] {
  return screen.queryAllByText(/^\+€/).map((node) => String(node.props.children));
}

describe('FloatingPayouts', () => {
  beforeEach(automated);

  it('shows nothing until something is actually paid', async () => {
    await render(<FloatingPayouts />);
    expect(labelTexts()).toHaveLength(0);
  });

  it('spawns a label when a payout lands', async () => {
    await render(<FloatingPayouts />);
    await tick(2);
    expect(labelTexts()).toHaveLength(1);
  });

  it('aggregates a burst into a single label', async () => {
    await render(<FloatingPayouts />);
    // Two tiers paying in the same step is one number to the player, not two.
    useGameStore.setState({
      state: {
        ...useGameStore.getState().state,
        businesses: useGameStore
          .getState()
          .state.businesses.map((b) =>
            b.id === 'friet' || b.id === 'wafel' ? { ...b, owned: 10, managed: true } : b,
          ),
      },
    });
    await tick(5);
    expect(labelTexts()).toHaveLength(1);
  });

  it('throttles a second payout inside the window', async () => {
    await render(<FloatingPayouts />);
    await tick(2);
    await tick(0.2);
    expect(labelTexts()).toHaveLength(1);
  });

  it('carries a throttled payout into the next label instead of dropping it', async () => {
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(start);

    await render(<FloatingPayouts />);
    await tick(2);
    const [first] = labelTexts();

    // Same instant: throttled away, so its amount must be carried, not lost.
    await tick(2);
    expect(labelTexts()).toHaveLength(1);

    // Past the throttle window: the carried amount rides along with the next one,
    // making this label strictly larger than a single cycle's worth.
    clock.mockReturnValue(start + 5_000);
    await tick(2);

    const texts = labelTexts();
    expect(texts.length).toBeGreaterThan(1);
    expect(texts[texts.length - 1]).not.toBe(first);

    clock.mockRestore();
  });
});

describe('CoinBurst', () => {
  it('does not spray coins merely for existing', async () => {
    await render(<CoinBurst trigger={0} />);
    expect(screen.queryAllByText('🪙')).toHaveLength(0);
  });

  it('fires a burst when the trigger changes', async () => {
    const view = await render(<CoinBurst trigger={0} />);
    await view.rerender(<CoinBurst trigger={1} />);
    expect(screen.queryAllByText('🪙').length).toBeGreaterThan(0);
  });
});

describe('GoldenFries', () => {
  // The gap is randomised between 90s and 210s so it never feels metronomic.
  // Pinning Math.random to 0 makes it exactly the 90s minimum, so the tests can
  // step to just after an appearance rather than overshooting into its expiry.
  const GAP = 90_000;
  const VISIBLE = 9_000;
  let random: jest.SpyInstance<number, []>;

  beforeEach(() => {
    automated();
    jest.useFakeTimers();
    random = jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    random.mockRestore();
  });

  it('stays hidden until its window comes round', async () => {
    await render(<GoldenFries />);
    await advance(GAP - 1_000);
    expect(screen.queryByTestId('golden-fries')).toBeNull();
  });

  it('appears once the gap has passed', async () => {
    await render(<GoldenFries />);
    await advance(GAP + 100);
    expect(screen.getByTestId('golden-fries')).toBeTruthy();
  });

  it('grants the golden boost when tapped, and leaves', async () => {
    await render(<GoldenFries />);
    await advance(GAP + 100);

    expect(useGameStore.getState().state.boostRemainingMs).toBe(0);
    await fireEvent.press(screen.getByTestId('golden-fries'));

    expect(useGameStore.getState().state.boostRemainingMs).toBeGreaterThan(0);
    // Finding one must beat watching an advert, so it is the golden multiplier
    // and not the ad boost's.
    expect(useGameStore.getState().state.boostMultiplier).toBe(GOLDEN_MULTIPLIER);
    expect(GOLDEN_MULTIPLIER).toBeGreaterThan(BOOST_MULTIPLIER);
    expect(screen.queryByTestId('golden-fries')).toBeNull();
  });

  it('drifts off on its own when ignored, and comes back later', async () => {
    await render(<GoldenFries />);
    await advance(GAP + 100);
    expect(screen.getByTestId('golden-fries')).toBeTruthy();

    await advance(VISIBLE);
    expect(screen.queryByTestId('golden-fries')).toBeNull();

    // An ignored bag must not end the cycle — it schedules the next one.
    await advance(GAP + 100);
    expect(screen.getByTestId('golden-fries')).toBeTruthy();
  });
});

describe('useEasedDecimal', () => {
  function Probe({ value }: { value: Decimal }): React.JSX.Element {
    return <Text testID="eased">{useEasedDecimal(value).toFixed(0)}</Text>;
  }

  it('starts at the target, so the counter never flashes zero on mount', async () => {
    await render(<Probe value={D(5000)} />);
    expect(screen.getByTestId('eased')).toHaveTextContent('5000');
  });

  it('does not jump straight to a new target', async () => {
    const view = await render(<Probe value={D(0)} />);
    await view.rerender(<Probe value={D(1_000_000)} />);
    // The new balance is real immediately; only the *display* lags behind it.
    expect(Number(screen.getByTestId('eased').props.children)).toBeLessThan(1_000_000);
  });
});
