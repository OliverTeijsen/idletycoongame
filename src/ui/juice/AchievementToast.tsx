import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getAchievement } from '../../core/achievements';
import type { AchievementId } from '../../core/types';
import { subscribeToUnlocks } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { colors, radius, spacing, type } from '../theme';
import { rewardFeedback } from './haptics';

/** How long one toast sits on screen, in ms. */
const LIFETIME = 2_600;

/**
 * "Achievement unlocked" banner.
 *
 * Deliberately **not** animated. A toast is information, not decoration, so it
 * must survive the reduce-motion setting — and rendering it as a plain View on a
 * plain timer sidesteps that whole question. See the reduced-motion notes in
 * the README.
 *
 * Unlocks arrive one at a time here even when several land together, because a
 * stack of banners is unreadable; the queue drains one per lifetime.
 */
export function AchievementToast(): React.JSX.Element | null {
  const [queue, setQueue] = useState<AchievementId[]>([]);
  const strings = useStrings();

  useEffect(() => {
    return subscribeToUnlocks((ids) => {
      setQueue((current) => [...current, ...ids]);
      rewardFeedback();
    });
  }, []);

  const current = queue[0];

  useEffect(() => {
    if (current === undefined) return;
    const timer = setTimeout(() => setQueue((rest) => rest.slice(1)), LIFETIME);
    return () => clearTimeout(timer);
  }, [current]);

  if (current === undefined) return null;

  return (
    <View style={styles.wrapper} pointerEvents="none" testID="achievement-toast">
      <View style={styles.toast}>
        <Text style={styles.icon}>{getAchievement(current).icon}</Text>
        <View style={styles.body}>
          <Text style={styles.kicker}>{strings.achievementUnlocked}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {strings.achievements[current]}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 30,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 380,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  body: {
    flexShrink: 1,
  },
  kicker: {
    ...type.small,
    color: colors.gold,
  },
  name: {
    ...type.title,
  },
});
