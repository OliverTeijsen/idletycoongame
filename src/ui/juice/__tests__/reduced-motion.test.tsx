/**
 * The juice layer on a device with the "reduce motion" accessibility setting on.
 *
 * Reanimated then skips animations and fires the completion callback
 * *synchronously*, which the mock below reproduces. The policy under test:
 *
 *  - decoration (coin bursts, pops) is skipped, and must settle rather than
 *    re-arm itself when its callback lands during its own mount;
 *  - the floating "+€X" is the only confirmation a payout happened, so it is
 *    rendered *without animation at all* — a still label on a plain timer,
 *    which no accessibility setting can skip.
 */
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

/** Every `withTiming` config seen during a test, in call order. */
const timings: ({ reduceMotion?: string } | undefined)[] = [];

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    // `Animated` is the default export and must survive the spread, or every
    // Animated.View in the tree renders as undefined.
    default: actual.default,
    useReducedMotion: () => true,
    withTiming: (
      toValue: number,
      config?: { reduceMotion?: string },
      callback?: (finished: boolean) => void,
    ) => {
      timings.push(config);
      // Opted-out animations keep running; everything else jumps to the end.
      if (config?.reduceMotion !== 'never') callback?.(true);
      return toValue;
    },
  };
});

import { createInitialState } from '../../../core/engine';
import { useGameStore } from '../../../store/gameStore';
import { CoinBurst } from '../CoinBurst';
import { FloatingPayouts } from '../FloatingPayouts';

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

beforeEach(() => {
  timings.length = 0;
});

describe('decoration is skipped', () => {
  it('does not opt the coin burst out of the setting', async () => {
    const view = await render(<CoinBurst trigger={0} />);
    await view.rerender(<CoinBurst trigger={1} />);

    expect(timings.length).toBeGreaterThan(0);
    // Pure decoration carries no information, so it obeys the OS preference.
    expect(timings.every((c) => c?.reduceMotion !== 'never')).toBe(true);
  });

  it('settles a coin burst instead of re-arming it', async () => {
    const view = await render(<CoinBurst trigger={0} />);
    // A burst that restarted itself would exceed React's update depth and throw.
    await view.rerender(<CoinBurst trigger={1} />);
    expect(screen.queryAllByText('🪙')).toHaveLength(0);
  });

  it('survives repeated bursts', async () => {
    const view = await render(<CoinBurst trigger={0} />);
    for (let i = 1; i <= 5; i++) {
      await view.rerender(<CoinBurst trigger={i} />);
    }
    expect(screen.queryAllByText('🪙')).toHaveLength(0);
  });
});

describe('payout feedback survives', () => {
  beforeEach(automated);

  it('still shows the +€X label', async () => {
    await render(<FloatingPayouts />);
    await act(async () => {
      useGameStore.getState().tick(2);
    });
    // The whole point: reduced motion must not cost the player their only
    // confirmation that the payout landed.
    expect(screen.getAllByText(/^\+€/)).toHaveLength(1);
  });

  it('renders the label without any animation', async () => {
    await render(<FloatingPayouts />);
    await act(async () => {
      useGameStore.getState().tick(2);
    });

    // Nothing animated means nothing an accessibility setting can skip. If the
    // label went back to `withTiming`, it would be finished during its own mount
    // and the player would never see it.
    expect(timings).toHaveLength(0);
  });

  it('clears the label once its spell is up', async () => {
    jest.useFakeTimers();
    try {
      await render(<FloatingPayouts />);
      await act(async () => {
        useGameStore.getState().tick(2);
      });
      expect(screen.getAllByText(/^\+€/)).toHaveLength(1);

      await act(async () => {
        jest.advanceTimersByTime(1_400);
      });
      expect(screen.queryAllByText(/^\+€/)).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
