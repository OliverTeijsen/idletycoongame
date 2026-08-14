import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '../theme';

interface Props {
  testID: string;
  /** Cycle progress from the store, in [0, 1). */
  progress: number;
  /** Effective seconds per cycle, after speed milestones. */
  cycleSeconds: number;
  /** Managed, or a tapped cycle currently running. */
  running: boolean;
  /** Too fast to draw as a filling bar — show a steady stream instead. */
  continuous: boolean;
  /**
   * The tier's sauce colour. The bar carries tier identity rather than the
   * managed state, which the green AUTO badge and icon ring already say.
   */
  colour: string;
}

/**
 * The production bar.
 *
 * The store ticks ten times a second, which is far too coarse to draw a 1.5s
 * cycle: fifteen visible steps reads as stutter. So the fill is animated on the
 * **UI thread** at the true linear rate, and each tick re-seeds it from the real
 * progress. The animation supplies the smoothness, the store supplies the truth,
 * and they can never drift apart by more than one tick's worth.
 *
 * Past a certain speed the cycle is shorter than the tick itself. Drawing a
 * filling bar there would be a lie — the business completes several cycles
 * between frames — so it becomes a solid bar instead.
 */
export function CycleBar({
  testID,
  progress,
  cycleSeconds,
  running,
  continuous,
  colour,
}: Props): React.JSX.Element {
  // Seeded for the first frame too: a continuous tier that started at 0 and
  // only jumped to full in the effect would flash an empty bar on mount.
  const fill = useSharedValue(continuous ? 1 : progress);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (continuous) {
      cancelAnimation(fill);
      fill.value = 1;
      return;
    }

    // With reduce-motion on, `withTiming` completes on the spot — animating
    // would peg the bar at 100%. Track the store directly instead: coarser, but
    // it shows the truth.
    if (!running || reduced) {
      cancelAnimation(fill);
      fill.value = progress;
      return;
    }

    fill.value = progress;
    const remainingMs = Math.max(0, (1 - progress) * cycleSeconds * 1000);
    fill.value = withTiming(1, { duration: remainingMs, easing: Easing.linear });
  }, [fill, progress, cycleSeconds, running, continuous, reduced]);

  const style = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, fill.value * 100))}%`,
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.fill,
        { backgroundColor: colour },
        // A tier that never pauses earns a brighter edge, so "non-stop" is
        // visible at a glance and not only in the label.
        continuous && styles.continuous,
        style,
      ]}
    />
  );
}

/** Static bar for a tier that cannot run at all, so it never animates. */
export function IdleBar({ testID }: { testID: string }): React.JSX.Element {
  return <View testID={testID} style={[styles.fill, styles.idle]} />;
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.sm,
  },
  continuous: {
    borderRightWidth: 0,
    opacity: 1,
    shadowColor: colors.cream,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  idle: {
    width: '0%',
  },
});
