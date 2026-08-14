import Decimal from 'break_infinity.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { money } from '../../core/numbers';
import { subscribeToPayouts } from '../../store/gameStore';
import { colors, tabular, type } from '../theme';

/** How long one label lives, in ms. */
const LIFETIME = 900;

/**
 * Longer when it cannot move: with no motion to catch the eye, a still label
 * needs more time on screen to be read.
 */
const STILL_LIFETIME = 1_300;

/** How far it drifts upward, in px. */
const RISE = 64;

/**
 * Minimum gap between labels. A fully automated empire pays out many times a
 * second; without this the screen becomes unreadable static. Payouts that land
 * inside the gap are not dropped — they are added to the next label.
 */
const THROTTLE_MS = 180;

/** More than this on screen at once reads as noise, not reward. */
const MAX_VISIBLE = 5;

interface Label {
  key: number;
  text: string;
  /** Horizontal offset from centre, so stacked labels do not overlap exactly. */
  drift: number;
}

/**
 * The floating "+€X" that rises toward the cash counter.
 *
 * Payout events deliberately bypass React (see `subscribeToPayouts`), so the
 * only state here is the short list of *visible* labels: one `setState` when a
 * label spawns and one when it retires, never one per frame. The motion itself
 * runs on the UI thread through Reanimated.
 */
export function FloatingPayouts(): React.JSX.Element {
  const [labels, setLabels] = useState<Label[]>([]);

  // Reduced motion should cost the player movement, not feedback: this label is
  // the only confirmation a payout happened. So it still appears — as a still
  // label on a plain timer, with no animation involved at all. Opting the
  // animation out of the setting was tried first and is not dependable: on web
  // the value still lands on its end state, leaving the label at zero opacity.
  const reduced = useReducedMotion();

  // Refs, not state: these change on every payout and must never re-render.
  const nextKey = useRef(0);
  const lastSpawn = useRef(0);
  const carried = useRef(new Decimal(0));

  const retire = useCallback((key: number) => {
    setLabels((current) => current.filter((l) => l.key !== key));
  }, []);

  useEffect(() => {
    return subscribeToPayouts((payouts) => {
      // Sum the burst: ten tiers paying at once is one number to the player.
      let total = carried.current;
      for (const payout of payouts) total = total.add(payout.amount);

      carried.current = total;

      const now = Date.now();
      if (now - lastSpawn.current < THROTTLE_MS) return;
      if (total.lte(0)) return;

      lastSpawn.current = now;
      carried.current = new Decimal(0);

      const key = nextKey.current++;
      const label: Label = {
        key,
        text: `+${money(total)}`,
        // Deterministic spread rather than random, so consecutive labels always
        // separate instead of occasionally landing on top of each other.
        drift: ((key % 3) - 1) * 28,
      };

      setLabels((current) => [...current.slice(-(MAX_VISIBLE - 1)), label]);
    });
  }, []);

  return (
    <View style={styles.layer} pointerEvents="none" testID="floating-payouts">
      {labels.map((label) =>
        reduced ? (
          <StillLabel key={label.key} label={label} onDone={retire} />
        ) : (
          <RisingLabel key={label.key} label={label} onDone={retire} />
        ),
      )}
    </View>
  );
}

interface RisingLabelProps {
  label: Label;
  onDone: (key: number) => void;
}

/**
 * The still version, used when the player asked for reduced motion. No
 * Reanimated at all: a plain Text and a plain timer, so it is visible for a
 * fixed spell and then gone. Nothing here can be skipped or optimised away by
 * an accessibility setting.
 */
function StillLabel({ label, onDone }: RisingLabelProps): React.JSX.Element {
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const timer = setTimeout(() => done.current(label.key), STILL_LIFETIME);
    return () => clearTimeout(timer);
  }, [label.key]);

  return (
    <Text
      style={[styles.label, { transform: [{ translateX: label.drift }] }]}
      numberOfLines={1}
    >
      {label.text}
    </Text>
  );
}

function RisingLabel({ label, onDone }: RisingLabelProps): React.JSX.Element {
  const progress = useSharedValue(0);

  // Callback behind a ref so this animation starts exactly once, whatever the
  // parent re-renders. See the note in CoinBurst: with "reduce motion" enabled
  // the timing callback fires synchronously, which makes callback identity in
  // the deps a hazard rather than a detail.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    progress.value = withTiming(1, { duration: LIFETIME }, (finished) => {
      // Only the natural end retires the label; an interrupted animation means
      // the component is already going away.
      if (finished === true) runOnJS(done.current)(label.key);
    });
  }, [progress, label.key]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75,
      transform: [
        { translateX: label.drift },
        { translateY: -RISE * p },
        { scale: 0.85 + 0.15 * Math.min(1, p * 4) },
      ],
    };
  });

  return (
    <Animated.Text style={[styles.label, style]} numberOfLines={1}>
      {label.text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  // Pinned just under the cash readout and ignored by touches, so the list
  // underneath stays fully interactive.
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  label: {
    ...type.title,
    ...tabular,
    position: 'absolute',
    top: 56,
    color: colors.green,
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
