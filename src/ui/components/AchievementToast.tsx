/**
 * Achievement toasts (spec §8.5 + §12): slide in from the top, hold, fade.
 * Reads the transient queue on GameState and drains it as each toast ends.
 * Under reduced motion the toast still appears — it just doesn't move.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { achievementDef } from '../../game/systems/achievements';
import { useGameStore } from '../../state/store';
import { palette, spacing } from '../theme';

const NATIVE = Platform.OS !== 'web';

function Toast({ id, reduced }: { id: string; reduced: boolean }) {
  const dismiss = useGameStore((s) => s.dismissAchievement);
  const anim = useRef(new Animated.Value(0)).current;
  const def = achievementDef(id);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => dismiss(id), 2600);
      return () => clearTimeout(t);
    }
    const seq = Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: NATIVE,
      }),
      Animated.delay(2000),
      Animated.timing(anim, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: NATIVE,
      }),
    ]);
    seq.start(({ finished }) => {
      if (finished) dismiss(id);
    });
    return () => seq.stop();
  }, [anim, dismiss, id, reduced]);

  if (!def) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        reduced
          ? null
          : {
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
              ],
            },
      ]}
    >
      <Text style={styles.label}>ACHIEVEMENT</Text>
      <Text style={styles.name}>{def.name}</Text>
      <Text style={styles.desc}>{def.desc}</Text>
    </Animated.View>
  );
}

export function AchievementToasts() {
  const pending = useGameStore((s) => s.game.pendingAchievements);
  const reduced = useGameStore((s) => s.game.options.reducedMotion);
  if (pending.length === 0) return null;
  return (
    <View style={styles.stack} pointerEvents="none">
      {pending.map((id) => (
        <Toast key={id} id={id} reduced={reduced} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: spacing.xl * 2,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.sm,
  },
  toast: {
    backgroundColor: palette.panel,
    borderColor: palette.core,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    maxWidth: 320,
  },
  label: { color: palette.core, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  name: { color: palette.ink, fontSize: 15, fontWeight: '800', marginTop: 2 },
  desc: { color: palette.dim, fontSize: 11, marginTop: 1, textAlign: 'center' },
});
