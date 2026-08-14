import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useGameStore } from '../../store/gameStore';
import { colors, radius } from '../theme';
import { rewardFeedback } from './haptics';

/** Window between appearances, in ms. Randomised so it never feels metronomic. */
const MIN_GAP_MS = 90_000;
const MAX_GAP_MS = 210_000;

/** How long it waits to be tapped before drifting off. */
const VISIBLE_MS = 9_000;

/** Kept away from the screen edges, the top bar and the bottom bar. */
const MIN_X = 8;
const MAX_X = 78;
const MIN_Y = 22;
const MAX_Y = 68;

interface Spot {
  key: number;
  x: number;
  y: number;
}

function randomSpot(key: number): Spot {
  return {
    key,
    x: MIN_X + Math.random() * (MAX_X - MIN_X),
    y: MIN_Y + Math.random() * (MAX_Y - MIN_Y),
  };
}

function nextGap(): number {
  return MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
}

/**
 * The golden frietzak: a rare tappable granting a bigger multiplier than the
 * rewarded ad (`GOLDEN_MULTIPLIER`, not `BOOST_MULTIPLIER`) — finding one should
 * beat watching an advert.
 *
 * Spawn timing lives here rather than in the core because it is pacing, not
 * economy: the *reward* is `activateGoldenBoost()`, which is already an engine
 * rule. The core stays free of timers and randomness, and stays unit-testable.
 */
export function GoldenFries(): React.JSX.Element | null {
  const startGoldenBoost = useGameStore((s) => s.startGoldenBoost);
  const [spot, setSpot] = useState<Spot | null>(null);
  const nextKey = useRef(0);

  // One timer at a time: either waiting to appear, or waiting to expire.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleAppearance = (): void => {
      timer = setTimeout(() => {
        setSpot(randomSpot(nextKey.current++));
        timer = setTimeout(() => {
          setSpot(null);
          scheduleAppearance();
        }, VISIBLE_MS);
      }, nextGap());
    };

    scheduleAppearance();
    return () => clearTimeout(timer);
  }, []);

  const claim = useCallback(() => {
    setSpot(null);
    rewardFeedback();
    startGoldenBoost();
  }, [startGoldenBoost]);

  if (spot === null) return null;
  return <Bag key={spot.key} spot={spot} onClaim={claim} />;
}

function Bag({ spot, onClaim }: { spot: Spot; onClaim: () => void }): React.JSX.Element {
  const bob = useSharedValue(0);
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = withTiming(1, { duration: 260 });
    bob.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      false,
    );
    return () => {
      // Repeating animations outlive their component unless stopped explicitly.
      cancelAnimation(bob);
      cancelAnimation(pop);
    };
  }, [bob, pop]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ translateY: -6 * bob.value }, { scale: 0.4 + 0.6 * pop.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, { left: `${spot.x}%`, top: `${spot.y}%` }, style]}>
      <Pressable
        testID="golden-fries"
        accessibilityRole="button"
        accessibilityLabel="Golden fries"
        onPress={onClaim}
        style={({ pressed }) => [styles.bag, pressed && styles.pressed]}
      >
        <Animated.Text style={styles.glyph}>🍟</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 20,
  },
  bag: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.cream,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  pressed: {
    opacity: 0.8,
  },
  glyph: {
    fontSize: 30,
  },
});
