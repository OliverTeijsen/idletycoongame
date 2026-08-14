import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BOOST_DURATION_MS, BOOST_MULTIPLIER } from '../../core/businesses';
import { canPrestige, isBoostActive, prestigeGain } from '../../core/economy';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { rewardFeedback } from '../juice/haptics';
import { colors, radius, spacing, type } from '../theme';

const BOOST_SECONDS = Math.round(BOOST_DURATION_MS / 1000);

/**
 * Rewarded boost + prestige.
 *
 * PHASE 4: the boost button grants its reward directly. It must be gated behind
 * `ads.showRewarded()` — reward only on ad completion — once services/ads.ts
 * lands. The AD pill is already here so the placement reads correctly.
 */
export function BottomBar(): React.JSX.Element {
  const state = useGameStore((s) => s.state);
  const startBoost = useGameStore((s) => s.startBoost);
  const openPrestige = useGameStore((s) => s.openPrestige);
  const strings = useStrings();

  const boosted = isBoostActive(state);
  const gain = prestigeGain(state);
  const prestigeReady = canPrestige(state);

  return (
    <View style={styles.container}>
      <Pressable
        testID="boost-button"
        accessibilityRole="button"
        accessibilityLabel={strings.a11yBoost(BOOST_MULTIPLIER, BOOST_SECONDS)}
        accessibilityState={{ disabled: boosted }}
        disabled={boosted}
        onPress={() => {
          startBoost();
          rewardFeedback();
        }}
        style={({ pressed }) => [
          styles.button,
          styles.boostButton,
          boosted && styles.buttonDisabled,
          pressed && !boosted && styles.buttonPressed,
        ]}
      >
        <View style={styles.adPill}>
          <Text style={styles.adPillText}>AD</Text>
        </View>
        <Text style={styles.boostLabel}>
          {boosted
            ? strings.boostActive(state.boostMultiplier)
            : strings.boostOffer(BOOST_MULTIPLIER, BOOST_SECONDS)}
        </Text>
      </Pressable>

      <Pressable
        testID="prestige-button"
        accessibilityRole="button"
        accessibilityLabel={strings.a11ySellEmpire(gain)}
        accessibilityState={{ disabled: !prestigeReady }}
        disabled={!prestigeReady}
        onPress={openPrestige}
        style={({ pressed }) => [
          styles.button,
          styles.prestigeButton,
          !prestigeReady && styles.buttonDisabled,
          pressed && prestigeReady && styles.buttonPressed,
        ]}
      >
        <Text style={styles.prestigeLabel}>{strings.sellEmpire}</Text>
        <Text style={styles.prestigeGain}>+{gain} 💼</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  boostButton: {
    backgroundColor: colors.gold,
  },
  boostLabel: {
    ...type.button,
    fontSize: 13,
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
  prestigeButton: {
    backgroundColor: colors.ketchupDeep,
    borderWidth: 1,
    borderColor: colors.ketchup,
  },
  prestigeLabel: {
    ...type.body,
    color: colors.cream,
    fontWeight: '800',
    fontSize: 13,
  },
  prestigeGain: {
    ...type.body,
    color: colors.gold,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
