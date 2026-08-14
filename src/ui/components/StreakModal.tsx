import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { STREAK_MAX_DAYS } from '../../core/businesses';
import { money } from '../../core/numbers';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { rewardFeedback } from '../juice/haptics';
import { colors, radius, spacing, tabular, type } from '../theme';

/**
 * "Day N" — the daily streak reward.
 *
 * The reward is already banked by the time this renders (see `hydrate`), so
 * dismissing it is the only thing this can do. That ordering is deliberate: a
 * player who kills the app mid-modal keeps the money.
 */
export function StreakModal(): React.JSX.Element | null {
  const streak = useGameStore((s) => s.streak);
  const offlinePending = useGameStore((s) => s.offline !== null);
  const dismissStreak = useGameStore((s) => s.dismissStreak);
  const strings = useStrings();

  // Returning after a long absence makes both of these pending at once. Queue
  // behind the offline payout rather than stacking on top of it: "welcome back"
  // is what explains the cash that just appeared, so it reads first.
  if (!streak || offlinePending) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismissStreak}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="streak-modal">
          <Text style={styles.title}>{strings.streakTitle(streak.day)}</Text>

          <View style={styles.pips}>
            {Array.from({ length: STREAK_MAX_DAYS }, (_, i) => (
              <View
                key={i}
                style={[styles.pip, i < Math.min(streak.day, STREAK_MAX_DAYS) && styles.pipOn]}
              />
            ))}
          </View>

          <Text style={styles.amount} testID="streak-reward">
            {money(streak.reward)}
          </Text>

          <Text style={styles.body}>
            {streak.restarted ? strings.streakRestarted : strings.streakBody}
          </Text>

          <Pressable
            testID="streak-dismiss"
            accessibilityRole="button"
            onPress={() => {
              dismissStreak();
              rewardFeedback();
            }}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{strings.streakClaim}</Text>
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
    borderColor: colors.gold,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    ...type.title,
    fontSize: 22,
  },
  pips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pip: {
    width: 22,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.locked,
  },
  pipOn: {
    backgroundColor: colors.gold,
  },
  amount: {
    ...type.cash,
    ...tabular,
    fontSize: 32,
  },
  body: {
    ...type.body,
    textAlign: 'center',
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
  pressed: {
    opacity: 0.75,
  },
});
