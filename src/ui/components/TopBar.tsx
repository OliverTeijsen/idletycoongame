import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS } from '../../core/achievements';
import { globalMultiplier, isBoostActive, perSecond } from '../../core/economy';
import { money, moneyPerSecond } from '../../core/numbers';
import { availableInvestors } from '../../core/perks';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { useEasedDecimal } from '../juice/useEasedDecimal';
import { HIT_SIZE, colors, radius, spacing, tabular, type } from '../theme';

export function TopBar(): React.JSX.Element {
  const state = useGameStore((s) => s.state);
  const openAchievements = useGameStore((s) => s.openAchievements);
  const openPerks = useGameStore((s) => s.openPerks);
  const strings = useStrings();
  const boosted = isBoostActive(state);
  const earned = state.unlocked.length;
  const available = availableInvestors(state);

  // The counter eases toward the real balance, so a big payout rolls up instead
  // of teleporting. The *real* cash is what every affordability check uses —
  // this is display only, and it always converges on the truth.
  const displayCash = useEasedDecimal(state.cash);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={type.cash} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="text">
          {money(displayCash)}
        </Text>
        <View style={styles.topRight}>
          {boosted ? (
            <View style={styles.boostBadge}>
              <Text style={styles.boostText}>
                ×{state.boostMultiplier} · {Math.ceil(state.boostRemainingMs / 1000)}s
              </Text>
            </View>
          ) : null}

          <Pressable
            testID="open-achievements"
            accessibilityRole="button"
            accessibilityLabel={strings.a11yOpenAchievements(earned, ACHIEVEMENTS.length)}
            onPress={openAchievements}
            style={({ pressed }) => [styles.trophy, pressed && styles.trophyPressed]}
          >
            <Text style={styles.trophyGlyph}>🏆</Text>
            <Text style={styles.trophyCount}>{earned}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={type.rate}>{moneyPerSecond(perSecond(state))}</Text>

        {/* The investor chip is the door to the skill tree, and it nags in the
            money colour while anything is unspent. An idle player who never
            finds this screen is a player for whom prestige still does nothing. */}
        <Pressable
          testID="open-perks"
          accessibilityRole="button"
          accessibilityLabel={strings.a11yOpenPerks(available)}
          onPress={openPerks}
          style={({ pressed }) => [
            styles.investorChip,
            available > 0 && styles.investorChipReady,
            pressed && styles.trophyPressed,
          ]}
        >
          <Text style={styles.investors}>💼 {state.investors}</Text>
          {available > 0 ? (
            <Text style={styles.investorFree} testID="investors-free">
              +{available}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {globalMultiplier(state) > 1 ? (
        <Text style={type.small}>
          {strings.globalMultiplier(globalMultiplier(state).toFixed(2))}
        </Text>
      ) : null}

      {/* A warm line of hatch light under the counter, brightening while a boost
          runs. It is the only place the header borrows the frituur directly. */}
      <View style={[styles.glow, boosted && styles.glowBoosted]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  investorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: HIT_SIZE,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  investorChipReady: {
    backgroundColor: colors.goldFaint,
    borderColor: colors.goldDeep,
  },
  investors: {
    ...type.rate,
    ...tabular,
    color: colors.cream,
  },
  investorFree: {
    ...type.rate,
    ...tabular,
    color: colors.gold,
    fontWeight: '800',
  },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.goldFaint,
  },
  glowBoosted: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trophy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    minHeight: HIT_SIZE,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trophyPressed: {
    opacity: 0.7,
  },
  trophyGlyph: {
    fontSize: 15,
  },
  trophyCount: {
    ...type.small,
    ...tabular,
    color: colors.cream,
  },
  boostBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.pill,
  },
  boostText: {
    ...type.small,
    color: colors.bg,
    fontWeight: '800',
  },
});
