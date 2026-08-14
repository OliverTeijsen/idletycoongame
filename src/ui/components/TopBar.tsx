import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS } from '../../core/achievements';
import { INVESTOR_BONUS } from '../../core/businesses';
import { globalMultiplier, isBoostActive, perSecond } from '../../core/economy';
import { formatPercent, money, moneyPerSecond } from '../../core/numbers';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { useEasedDecimal } from '../juice/useEasedDecimal';
import { HIT_SIZE, colors, radius, spacing, tabular, type } from '../theme';

export function TopBar(): React.JSX.Element {
  const state = useGameStore((s) => s.state);
  const openAchievements = useGameStore((s) => s.openAchievements);
  const strings = useStrings();
  const boosted = isBoostActive(state);
  const earned = state.unlocked.length;

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
        <Text style={styles.investors}>
          💼 {state.investors}{' '}
          <Text style={styles.investorBonus}>
            {formatPercent(state.investors * INVESTOR_BONUS)}
          </Text>
        </Text>
      </View>

      {state.investors > 0 ? (
        <Text style={type.small}>
          {strings.globalMultiplier(globalMultiplier(state).toFixed(2))}
        </Text>
      ) : null}
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
  investors: {
    ...type.rate,
    color: colors.cream,
  },
  investorBonus: {
    color: colors.green,
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
