/**
 * Achievement toasts (spec §8.5 + §12): slide in from the top, hold, fade.
 * Reads the transient queue on GameState and drains it as each toast ends.
 * Under reduced motion the toast still appears — it just doesn't move.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { playCue } from '../../audio';
import { achievementDef } from '../../game/systems/achievements';
import { useGameStore } from '../../state/store';
import { palette, radius, spacing, type } from '../theme';

const NATIVE = Platform.OS !== 'web';

function Toast({ id, reduced }: { id: string; reduced: boolean }) {
  const dismiss = useGameStore((s) => s.dismissAchievement);
  const anim = useRef(new Animated.Value(0)).current;
  const def = achievementDef(id);

  useEffect(() => {
    playCue('achievement');
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
      <Text style={styles.label}>Achievement</Text>
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
    borderColor: palette.line,
    borderWidth: 1,
    borderTopColor: palette.core,
    borderTopWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    maxWidth: 320,
    // The core's light reaches the toast too — same one source, everywhere.
    shadowColor: palette.core,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { ...type.label, fontSize: 9, color: palette.core },
  name: { ...type.title, fontSize: 15, color: palette.ink, marginTop: 3 },
  desc: { ...type.micro, color: palette.dim, marginTop: 2, textAlign: 'center' },
});
