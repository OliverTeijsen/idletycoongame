import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { getDef } from '../../core/businesses';
import {
  canAfford,
  costForAmount,
  cycleRevenue,
  getBusiness,
  milestoneCount,
  resolveBuyCount,
  unitsToNextMilestone,
} from '../../core/economy';
import { formatTime, money } from '../../core/numbers';
import type { BusinessId } from '../../core/types';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { CoinBurst } from '../juice/CoinBurst';
import { buyFeedback, rewardFeedback, tapFeedback } from '../juice/haptics';
import { HIT_SIZE, colors, radius, spacing, tabular, type } from '../theme';

interface Props {
  id: BusinessId;
}

export function BusinessRow({ id }: Props): React.JSX.Element {
  const state = useGameStore((s) => s.state);
  const tapBusiness = useGameStore((s) => s.tapBusiness);
  const buyBusiness = useGameStore((s) => s.buyBusiness);
  const hireManagerFor = useGameStore((s) => s.hireManagerFor);

  const s = useStrings();
  const def = getDef(id);
  const bs = getBusiness(state, id);
  const name = s.businesses[id];

  const owned = bs.owned;
  const running = bs.managed || bs.active;
  const buyCount = resolveBuyCount(state, id);
  const cost = costForAmount(state, id);
  const affordable = canAfford(state, id);
  const canHire = !bs.managed && state.cash.gte(def.managerCost);
  const toNextMilestone = unitsToNextMilestone(owned);

  // A tier the player has never bought and cannot afford is dimmed, not hidden —
  // seeing the next tier is what makes the next goal legible.
  const dimmed = owned === 0 && !affordable;

  const [burst, setBurst] = useState(0);
  const iconScale = useSharedValue(1);
  const rowScale = useSharedValue(1);

  // A ×2 milestone is the strongest feedback moment in the loop, and it is easy
  // to miss when it lands mid-purchase. Compare milestone *count*, not owned:
  // a ×100 buy can vault several milestones in one press and still deserves one pop.
  const lastMilestones = useRef(milestoneCount(owned));
  useEffect(() => {
    const reached = milestoneCount(owned);
    if (reached > lastMilestones.current) {
      rowScale.value = withSequence(
        withTiming(1.04, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 220 }),
      );
      rewardFeedback();
    }
    lastMilestones.current = reached;
  }, [owned, rowScale]);

  const onTap = useCallback(() => {
    tapBusiness(id);
    setBurst((n) => n + 1);
    tapFeedback();
    iconScale.value = withSequence(
      withTiming(0.9, { duration: 70 }),
      withSpring(1, { damping: 7, stiffness: 320 }),
    );
  }, [tapBusiness, id, iconScale]);

  const onBuy = useCallback(() => {
    buyBusiness(id);
    buyFeedback();
  }, [buyBusiness, id]);

  const onHire = useCallback(() => {
    hireManagerFor(id);
    rewardFeedback();
  }, [hireManagerFor, id]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: rowScale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <Animated.View
      style={[styles.container, dimmed && styles.dimmed, rowStyle]}
      testID={`row-${id}`}
    >
      <View style={styles.main}>
        <View style={styles.iconWrap}>
          <Pressable
            testID={`tap-${id}`}
            accessibilityRole="button"
            accessibilityLabel={s.a11yRun(name)}
            accessibilityState={{ disabled: owned === 0 || bs.managed }}
            disabled={owned === 0 || bs.managed}
            onPress={onTap}
            style={({ pressed }) => [
              styles.icon,
              bs.managed && styles.iconManaged,
              bs.active && styles.iconActive,
              pressed && styles.iconPressed,
            ]}
          >
            <Animated.View style={iconStyle}>
              <Text style={styles.iconGlyph}>{def.icon}</Text>
            </Animated.View>
            {bs.managed ? <Text style={styles.autoBadge}>{s.autoBadge}</Text> : null}
          </Pressable>
          <CoinBurst trigger={burst} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={type.title} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.owned} testID={`owned-${id}`}>
              {owned}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              testID={`progress-${id}`}
              style={[
                styles.progressFill,
                { width: `${Math.min(100, bs.progress * 100)}%` },
                bs.managed ? styles.progressManaged : styles.progressTapped,
              ]}
            />
            <Text style={styles.progressLabel} numberOfLines={1}>
              {owned > 0 ? money(cycleRevenue(state, id)) : money(def.baseRevenue)}
              {'  ·  '}
              {formatTime(def.cycleTime)}
            </Text>
          </View>

          <Text style={type.small}>
            {toNextMilestone === null ? s.allMilestones : s.nextMilestone(toNextMilestone)}
            {running ? '' : owned > 0 ? ` · ${s.tapToRun}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          testID={`buy-${id}`}
          accessibilityRole="button"
          accessibilityLabel={s.a11yBuy(buyCount, name)}
          accessibilityState={{ disabled: !affordable }}
          disabled={!affordable}
          onPress={onBuy}
          style={({ pressed }) => [
            styles.buyButton,
            !affordable && styles.buttonDisabled,
            pressed && affordable && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buyLabel}>{s.buy(buyCount > 0 ? buyCount : 1)}</Text>
          <Text style={styles.buyCost} numberOfLines={1}>
            {money(buyCount > 0 ? cost : costForAmount(state, id, 1))}
          </Text>
        </Pressable>

        <Pressable
          testID={`manager-${id}`}
          accessibilityRole="button"
          accessibilityLabel={bs.managed ? s.a11yManagerHired(name) : s.a11yHireManager(name)}
          accessibilityState={{ disabled: !canHire }}
          disabled={!canHire}
          onPress={onHire}
          style={({ pressed }) => [
            styles.managerButton,
            bs.managed && styles.managerHired,
            !bs.managed && !canHire && styles.buttonDisabled,
            pressed && canHire && styles.buttonPressed,
          ]}
        >
          {bs.managed ? (
            <Text style={styles.managerHiredLabel}>{s.managerHired}</Text>
          ) : (
            <>
              <Text style={styles.managerLabel}>{s.manager}</Text>
              <Text style={styles.managerCost} numberOfLines={1}>
                {money(def.managerCost)}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  dimmed: {
    opacity: 0.45,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Wraps the icon so the coin burst can overflow it without being clipped by
  // the Pressable's own rounded background.
  iconWrap: {
    width: 56,
    height: 56,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    borderColor: colors.gold,
  },
  iconManaged: {
    borderColor: colors.greenDeep,
  },
  iconPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: colors.goldFaint,
  },
  iconGlyph: {
    fontSize: 28,
  },
  autoBadge: {
    ...type.small,
    fontSize: 9,
    color: colors.green,
    marginTop: 1,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  owned: {
    ...type.title,
    ...tabular,
    color: colors.gold,
  },
  progressTrack: {
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.locked,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  // Anchored left and stretched vertically; `width` is what animates.
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressTapped: {
    backgroundColor: colors.goldDeep,
  },
  progressManaged: {
    backgroundColor: colors.greenDeep,
  },
  progressLabel: {
    ...type.small,
    ...tabular,
    color: colors.cream,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buyButton: {
    flex: 2,
    minHeight: HIT_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  buyLabel: {
    ...type.button,
  },
  buyCost: {
    ...type.button,
    ...tabular,
    fontSize: 12,
    fontWeight: '600',
  },
  managerButton: {
    flex: 1,
    minHeight: HIT_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  managerHired: {
    backgroundColor: colors.greenDeep,
    borderColor: colors.green,
  },
  managerHiredLabel: {
    ...type.body,
    color: colors.cream,
    fontWeight: '800',
  },
  managerLabel: {
    ...type.body,
    color: colors.cream,
    fontWeight: '700',
  },
  managerCost: {
    ...type.small,
    ...tabular,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
