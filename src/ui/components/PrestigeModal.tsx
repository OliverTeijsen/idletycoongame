import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { INVESTOR_BONUS } from '../../core/businesses';
import { prestigeGain } from '../../core/economy';
import { formatPercent } from '../../core/numbers';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { prestigeFeedback } from '../juice/haptics';
import { colors, radius, spacing, tabular, type } from '../theme';

/**
 * "Sell your empire" confirmation.
 *
 * PHASE 4: an interstitial fires on confirm (prestige only, never mid-session,
 * frequency-capped, and skipped entirely for remove-ads buyers).
 */
export function PrestigeModal(): React.JSX.Element | null {
  const visible = useGameStore((s) => s.prestigePending);
  const state = useGameStore((s) => s.state);
  const closePrestige = useGameStore((s) => s.closePrestige);
  const confirmPrestige = useGameStore((s) => s.confirmPrestige);
  const strings = useStrings();

  if (!visible) return null;

  const gain = prestigeGain(state);
  const total = state.investors + gain;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={closePrestige}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="prestige-modal">
          <Text style={styles.title}>{strings.prestigeTitle}</Text>
          <Text style={styles.body}>{strings.prestigeBody}</Text>

          <Text style={styles.gain} testID="prestige-gain">
            +{gain} 💼
          </Text>
          <Text style={styles.body}>
            {strings.prestigeSummary(total, formatPercent(total * INVESTOR_BONUS))}
          </Text>

          <Pressable
            testID="prestige-confirm"
            accessibilityRole="button"
            onPress={() => {
              confirmPrestige();
              prestigeFeedback();
            }}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{strings.prestigeConfirm}</Text>
          </Pressable>

          <Pressable
            testID="prestige-cancel"
            accessibilityRole="button"
            onPress={closePrestige}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>{strings.prestigeCancel}</Text>
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
    borderColor: colors.ketchupDeep,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    ...type.title,
    fontSize: 22,
  },
  body: {
    ...type.body,
    textAlign: 'center',
  },
  gain: {
    ...type.cash,
    ...tabular,
    fontSize: 32,
    marginTop: spacing.sm,
  },
  primary: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.ketchup,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    ...type.button,
    color: colors.cream,
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
  pressed: {
    opacity: 0.75,
  },
});
