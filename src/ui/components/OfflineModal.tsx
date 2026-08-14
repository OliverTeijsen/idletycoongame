import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime, money } from '../../core/numbers';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { rewardFeedback } from '../juice/haptics';
import { colors, radius, spacing, tabular, type } from '../theme';

/**
 * "Welcome back" — offline earnings, with a rewarded double.
 *
 * PHASE 4: the double must go through `ads.showRewarded()` and only call
 * claimOffline(2) when the reward event fires.
 */
export function OfflineModal(): React.JSX.Element | null {
  const offline = useGameStore((s) => s.offline);
  const claimOffline = useGameStore((s) => s.claimOffline);
  const strings = useStrings();

  if (!offline) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => claimOffline(1)}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="offline-modal">
          <Text style={styles.title}>{strings.welcomeBack}</Text>
          <Text style={type.body}>
            {strings.offlineRan(formatTime(offline.seconds), offline.capped)}
          </Text>

          <Text style={styles.amount} testID="offline-amount">
            {money(offline.amount)}
          </Text>

          <Pressable
            testID="offline-double"
            accessibilityRole="button"
            onPress={() => claimOffline(2)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <View style={styles.adPill}>
              <Text style={styles.adPillText}>AD</Text>
            </View>
            <Text style={styles.primaryLabel}>
              {strings.offlineDouble(money(offline.amount.mul(2)))}
            </Text>
          </Pressable>

          <Pressable
            testID="offline-collect"
            accessibilityRole="button"
            onPress={() => {
              claimOffline(1);
              rewardFeedback();
            }}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>{strings.offlineCollect}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    ...type.title,
    fontSize: 22,
  },
  amount: {
    ...type.cash,
    ...tabular,
    fontSize: 32,
    marginVertical: spacing.sm,
  },
  primary: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    ...type.button,
    fontSize: 15,
  },
  secondary: {
    width: '100%',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    ...type.body,
    fontWeight: '700',
  },
  adPill: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  adPillText: {
    ...type.small,
    fontSize: 9,
    color: colors.gold,
  },
  pressed: {
    opacity: 0.75,
  },
});
