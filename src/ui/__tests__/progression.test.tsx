/**
 * Streak modal, achievements list and the unlock toast.
 *
 * NOTE: @testing-library/react-native v14 made `render` and `fireEvent` async.
 * Every call must be awaited or `screen` stays empty.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ACHIEVEMENTS } from '../../core/achievements';
import { createInitialState } from '../../core/engine';
import { saveGame } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import App from '../App';
import { AchievementsModal } from '../components/AchievementsModal';
import { StreakModal } from '../components/StreakModal';
import { TopBar } from '../components/TopBar';
import { AchievementToast } from '../juice/AchievementToast';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

const state = (): ReturnType<typeof useGameStore.getState> => useGameStore.getState();

beforeEach(() => {
  useGameStore.setState({
    state: createInitialState(0),
    hydrated: true,
    offline: null,
    streak: null,
    prestigePending: false,
    achievementsOpen: false,
  });
});

describe('StreakModal', () => {
  it('stays out of the way when there is nothing to claim', async () => {
    await render(<StreakModal />);
    expect(screen.queryByTestId('streak-modal')).toBeNull();
  });

  // Both can be pending on the same launch. Two stacked modals is one too many,
  // and "welcome back" is the one that explains the cash that just appeared.
  it('waits its turn while the offline payout is still showing', async () => {
    useGameStore.setState({
      streak: { day: 3, restarted: false, reward: createReward() },
      offline: { seconds: 3600, rawSeconds: 3600, capped: false, amount: createReward() },
    });
    await render(<StreakModal />);
    expect(screen.queryByTestId('streak-modal')).toBeNull();
  });

  it('appears once the offline payout is collected', async () => {
    useGameStore.setState({
      streak: { day: 3, restarted: false, reward: createReward() },
      offline: null,
    });
    await render(<StreakModal />);
    expect(screen.getByTestId('streak-modal')).toBeTruthy();
  });

  it('shows the day and the reward', async () => {
    useGameStore.setState({ streak: { day: 3, restarted: false, reward: createReward() } });
    await render(<StreakModal />);

    expect(screen.getByTestId('streak-modal')).toBeTruthy();
    expect(screen.getByText(/Day 3/)).toBeTruthy();
    expect(screen.getByTestId('streak-reward')).toBeTruthy();
  });

  it('explains a broken run instead of silently restarting it', async () => {
    useGameStore.setState({ streak: { day: 1, restarted: true, reward: createReward() } });
    await render(<StreakModal />);
    expect(screen.getByText(/missed a day/i)).toBeTruthy();
  });

  it('closes on dismiss', async () => {
    useGameStore.setState({ streak: { day: 1, restarted: false, reward: createReward() } });
    await render(<StreakModal />);
    await fireEvent.press(screen.getByTestId('streak-dismiss'));
    expect(state().streak).toBeNull();
  });
});

describe('AchievementsModal', () => {
  it('is closed until asked for', async () => {
    await render(<AchievementsModal />);
    expect(screen.queryByTestId('achievements-modal')).toBeNull();
  });

  it('lists every achievement, locked ones included', async () => {
    useGameStore.setState({ achievementsOpen: true });
    await render(<AchievementsModal />);

    for (const def of ACHIEVEMENTS) {
      expect(screen.getByTestId(`achievement-${def.id}`)).toBeTruthy();
    }
  });

  it('shows how many are earned', async () => {
    useGameStore.setState({
      achievementsOpen: true,
      state: { ...createInitialState(0), unlocked: ['tap-100', 'own-50'] },
    });
    await render(<AchievementsModal />);
    expect(screen.getByText(`2 of ${ACHIEVEMENTS.length} earned`)).toBeTruthy();
  });

  it('closes again', async () => {
    useGameStore.setState({ achievementsOpen: true });
    await render(<AchievementsModal />);
    await fireEvent.press(screen.getByTestId('achievements-close'));
    expect(state().achievementsOpen).toBe(false);
  });
});

describe('TopBar achievements button', () => {
  it('opens the list', async () => {
    await render(<TopBar />);
    await fireEvent.press(screen.getByTestId('open-achievements'));
    expect(state().achievementsOpen).toBe(true);
  });

  it('shows the earned count', async () => {
    useGameStore.setState({
      state: { ...createInitialState(0), unlocked: ['tap-100', 'own-50', 'prestige-1'] },
    });
    await render(<TopBar />);
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('AchievementToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows nothing until something unlocks', async () => {
    await render(<AchievementToast />);
    expect(screen.queryByTestId('achievement-toast')).toBeNull();
  });

  // The toast only mounts once `hydrated` flips true, which is *after* the
  // hydrate effect has run. An unlock announced during hydrate would be shouted
  // into an empty room, so it has to reach the toast on the first tick instead.
  it('announces an unlock that was already earned at launch', async () => {
    saveGame({ ...createInitialState(0), totalTaps: 500, lastActiveAt: Date.now() });
    // A real launch starts un-hydrated, so App shows the loading screen first
    // and the toast is not yet in the tree when `hydrate` runs.
    useGameStore.setState({ hydrated: false });

    await render(<App />);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('achievement-toast')).toBeTruthy();
  });

  it('announces an unlock earned during play', async () => {
    await render(<AchievementToast />);

    // 100 taps' worth of state, settled by the store on the next action.
    await act(async () => {
      useGameStore.setState({ state: { ...createInitialState(0), totalTaps: 99 } });
      useGameStore.getState().tapBusiness('friet');
    });

    expect(screen.getByTestId('achievement-toast')).toBeTruthy();
    expect(screen.getByText('Warming Up')).toBeTruthy();
  });

  it('clears itself after its spell', async () => {
    {
      await render(<AchievementToast />);
      await act(async () => {
        useGameStore.setState({ state: { ...createInitialState(0), totalTaps: 99 } });
        useGameStore.getState().tapBusiness('friet');
      });
      expect(screen.getByTestId('achievement-toast')).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });
      expect(screen.queryByTestId('achievement-toast')).toBeNull();
    }
  });

  // Several thresholds can fall in one action; a stack of banners is unreadable.
  it('queues multiple unlocks rather than stacking them', async () => {
    {
      await render(<AchievementToast />);
      await act(async () => {
        useGameStore.setState({ state: { ...createInitialState(0), totalTaps: 9_999 } });
        useGameStore.getState().tapBusiness('friet');
      });

      // Crossing 10k taps clears three thresholds at once. One banner at a
      // time, in definition order.
      expect(screen.getAllByTestId('achievement-toast')).toHaveLength(1);
      expect(screen.getByText('Warming Up')).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });
      expect(screen.getAllByTestId('achievement-toast')).toHaveLength(1);
      expect(screen.getByText('Fryer Hands')).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });
      expect(screen.getByText('Repetitive Strain')).toBeTruthy();
    }
  });
});

function createReward(): ReturnType<typeof createInitialState>['cash'] {
  return createInitialState(0).cash.add(1234);
}
