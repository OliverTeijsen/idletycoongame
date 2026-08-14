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
  cycleTimeFor,
  getBusiness,
  isContinuous,
  milestoneCount,
  resolveBuyCount,
  unitsToNextMilestone,
  unitsToNextSpeed,
} from '../../core/economy';
import { formatTime, money } from '../../core/numbers';
import type { BusinessId } from '../../core/types';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { CoinBurst } from '../juice/CoinBurst';
import { buyFeedback, rewardFeedback, tapFeedback } from '../juice/haptics';
import { HIT_SIZE, colors, fonts, radius, sauces, spacing, tabular, type } from '../theme';
import { CycleBar, IdleBar } from './CycleBar';

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
  const sauce = sauces[id];

  const owned = bs.owned;
  const running = bs.managed || bs.active;
  const buyCount = resolveBuyCount(state, id);
  const cost = costForAmount(state, id);
  const affordable = canAfford(state, id);
  const canHire = !bs.managed && state.cash.gte(def.managerCost);
  const toNextMilestone = unitsToNextMilestone(owned);
  const cycleSeconds = cycleTimeFor(def, owned);
  const continuous = isContinuous(def, owned) && running;
  // Hidden once the tier already runs without pausing — there is nothing left
  // to promise, and the row is narrow.
  const toNextSpeed = continuous ? null : unitsToNextSpeed(owned);

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
      {/* The tier's sauce, running the full height of the row. This edge is what
          makes ten rows scannable without reading a single word — so it stays
          coloured on locked tiers too. The row's own opacity does the dimming;
          swapping the colour out would throw the identity away on the nine rows
          that need it most. */}
      <View style={[styles.stripe, { backgroundColor: sauce }]} />

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
              // `${sauce}22` is the sauce at ~13% — enough to tint the tile
              // without competing with the glyph sitting on it.
              { borderColor: sauce, backgroundColor: `${sauce}22` },
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
            <Text
              style={[styles.owned, { color: owned > 0 ? sauce : colors.muted }]}
              testID={`owned-${id}`}
            >
              {owned}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            {owned > 0 ? (
              <CycleBar
                testID={`progress-${id}`}
                progress={bs.progress}
                cycleSeconds={cycleSeconds}
                running={running}
                continuous={continuous}
                colour={sauce}
              />
            ) : (
              <IdleBar testID={`progress-${id}`} />
            )}
            <Text style={styles.progressLabel} numberOfLines={1}>
              {owned > 0 ? money(cycleRevenue(state, id)) : money(def.baseRevenue)}
              {'  ·  '}
              {continuous ? s.continuous : formatTime(cycleSeconds)}
            </Text>
          </View>

          <Text style={type.small} numberOfLines={1}>
            {toNextMilestone === null ? s.allMilestones : s.nextMilestone(toNextMilestone)}
            {toNextSpeed === null ? '' : ` · ${s.nextSpeed(toNextSpeed)}`}
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
    // Room on the left for the sauce stripe.
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  // Never fully faded: a tier you cannot afford yet is the next thing to want,
  // so it has to stay legible enough to read as a goal.
  dimmed: {
    opacity: 0.6,
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
  // The owned count is the tier's score. Big, in its own sauce, tabular so it
  // does not jump width as it climbs.
  owned: {
    fontFamily: fonts.displayHeavy,
    fontSize: 22,
    fontWeight: '900',
    ...tabular,
  },
  // The fill itself lives in CycleBar, which animates on the UI thread.
  progressTrack: {
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.locked,
    overflow: 'hidden',
    justifyContent: 'center',
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
