import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Coins per burst. Enough to read as a spray, few enough to stay cheap. */
const COINS = 5;

const DURATION = 620;

/** How far a coin travels from the origin, in px. */
const DISTANCE = 46;

/**
 * Fixed launch angles rather than random ones: a spray that is the same shape
 * every time still reads as an explosion, and it cannot accidentally send all
 * five coins the same way. Degrees, clockwise from straight up.
 */
const ANGLES = [-52, -26, 0, 26, 52];

interface Props {
  /** Bump this to fire a burst. Any change fires one; the value is not read. */
  trigger: number;
}

/**
 * A small spray of coins, fired from the centre of whatever contains it.
 *
 * Purely decorative and never interactive, so the whole layer is
 * `pointerEvents="none"` — a burst must never eat the next tap, which in an idle
 * game arrives within a few hundred milliseconds.
 */
export function CoinBurst({ trigger }: Props): React.JSX.Element {
  const [bursts, setBursts] = useState<number[]>([]);
  const seen = useRef(trigger);

  useEffect(() => {
    // Skip the mount value: the row should not spray coins just for existing.
    if (trigger === seen.current) return;
    seen.current = trigger;
    setBursts((current) => [...current.slice(-2), trigger]);
  }, [trigger]);

  const retire = useCallback((id: number) => {
    setBursts((current) => current.filter((b) => b !== id));
  }, []);

  return (
    <View style={styles.layer} pointerEvents="none">
      {bursts.map((id) => (
        <Burst key={id} id={id} onDone={retire} />
      ))}
    </View>
  );
}

function Burst({ id, onDone }: { id: number; onDone: (id: number) => void }): React.JSX.Element {
  const handleDone = useCallback(() => onDone(id), [onDone, id]);

  return (
    <>
      {ANGLES.map((angle, index) => (
        <Coin
          key={angle}
          angle={angle}
          // One coin per burst reports completion, not all five.
          onDone={index === 0 ? handleDone : undefined}
        />
      ))}
    </>
  );
}

function Coin({ angle, onDone }: { angle: number; onDone?: () => void }): React.JSX.Element {
  const progress = useSharedValue(0);

  // Read the callback through a ref so the animation starts exactly once.
  // Listing `onDone` in the deps would be fragile: with "reduce motion" enabled
  // Reanimated fires the completion callback synchronously, so any change of
  // callback identity would restart the animation the moment it finished.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION }, (finished) => {
      if (finished === true && done.current !== undefined) runOnJS(done.current)();
    });
  }, [progress]);

  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians) * DISTANCE;
  const dy = -Math.cos(radians) * DISTANCE;

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p * p,
      transform: [
        { translateX: dx * p },
        // Ease out horizontally but let gravity pull the tail of the arc back down.
        { translateY: dy * p + 26 * p * p },
        { scale: 0.6 + 0.5 * (1 - p) },
      ],
    };
  });

  return <Animated.Text style={[styles.coin, style]}>🪙</Animated.Text>;
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coin: {
    position: 'absolute',
    fontSize: 15,
  },
});
