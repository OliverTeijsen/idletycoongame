import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  PERKS,
  availableInvestors,
  isMaxed,
  nextPerkCost,
  perkEffectValue,
  perkLevel,
} from '../../core/perks';
import type { GameState, PerkDef } from '../../core/types';
import { useGameStore } from '../../store/gameStore';
import { useStrings } from '../i18n';
import { rewardFeedback } from '../juice/haptics';
import { colors, radius, spacing, tabular, type } from '../theme';

/**
 * The investor skill tree — where prestige currency actually goes.
 *
 * Ordering follows `PERKS`, which puts the two endless nodes first. That is
 * deliberate: the thing a player should see at the top of this screen is the
 * one they can keep buying forever.
 */
export function PerksModal(): React.JSX.Element | null {
  const open = useGameStore((s) => s.perksOpen);
  const close = useGameStore((s) => s.closePerks);
  const state = useGameStore((s) => s.state);
  const strings = useStrings();

  if (!open) return null;

  const available = availableInvestors(state);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="perks-modal">
          <Text style={styles.title}>{strings.perksTitle}</Text>
          <Text style={styles.balance} testID="perks-available">
            {available}
          </Text>
          <Text style={type.body}>{strings.perksAvailable(available, state.investors)}</Text>

          {available > 0 ? (
            <Text style={styles.hint}>{strings.perksSpendHint}</Text>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {PERKS.map((def) => (
              <PerkRow key={def.id} def={def} state={state} available={available} />
            ))}
          </ScrollView>

          <Pressable
            testID="perks-close"
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>{strings.perksClose}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PerkRow({
  def,
  state,
  available,
}: {
  def: PerkDef;
  state: GameState;
  available: number;
}): React.JSX.Element {
  const buyPerkLevel = useGameStore((s) => s.buyPerkLevel);
  const strings = useStrings();

  const level = perkLevel(state, def.id);
  const cost = nextPerkCost(state, def.id);
  const maxed = isMaxed(def, level);
  const affordable = cost !== null && available >= cost;
  const name = strings.perks[def.id];

  return (
    <View style={styles.row} testID={`perk-${def.id}`}>
      <Text style={styles.icon}>{def.icon}</Text>

      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text style={type.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.level, def.maxLevel === null && styles.levelEndless]}>
            {strings.perkLevelLabel(level, def.maxLevel)}
            {def.maxLevel === null ? ` ${strings.perkEndless}` : ''}
          </Text>
        </View>

        <Text style={type.small} numberOfLines={2}>
          {strings.perkDesc[def.id]}
        </Text>

        {level > 0 ? (
          <Text style={styles.current} testID={`perk-effect-${def.id}`}>
            {strings.perkEffect[def.id](perkEffectValue(state, def.id))}
          </Text>
        ) : null}
      </View>

      <Pressable
        testID={`perk-buy-${def.id}`}
        accessibilityRole="button"
        accessibilityLabel={strings.a11yBuyPerk(name, cost ?? 0)}
        accessibilityState={{ disabled: !affordable }}
        disabled={!affordable}
        onPress={() => {
          buyPerkLevel(def.id);
          rewardFeedback();
        }}
        style={({ pressed }) => [
          styles.buy,
          !affordable && styles.buyDisabled,
          pressed && affordable && styles.pressed,
        ]}
      >
        {maxed ? (
          <Text style={styles.buyMaxed}>{strings.perkMaxed}</Text>
        ) : (
          <Text style={styles.buyLabel} numberOfLines={1}>
            {cost} 💼
          </Text>
        )}
      </Pressable>
    </View>
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
    maxWidth: 460,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.xs,
    alignItems: 'center',
  },
  title: {
    ...type.title,
    fontSize: 22,
  },
  // The unspent balance is the hero of this screen, the way cash is the hero of
  // the main one — it is the number the player came here to get rid of.
  balance: {
    ...type.cash,
    ...tabular,
    fontSize: 40,
    lineHeight: 46,
  },
  hint: {
    ...type.small,
    color: colors.creamDim,
    textAlign: 'center',
  },
  list: {
    width: '100%',
  },
  listContent: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  icon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  level: {
    ...type.small,
    ...tabular,
    color: colors.creamDim,
  },
  // The endless nodes are marked in the money colour: they are the ones worth
  // coming back to forever.
  levelEndless: {
    color: colors.gold,
  },
  current: {
    ...type.small,
    ...tabular,
    color: colors.green,
    fontWeight: '700',
  },
  buy: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyLabel: {
    ...type.button,
    ...tabular,
    fontSize: 13,
  },
  buyDisabled: {
    opacity: 0.35,
  },
  buyMaxed: {
    ...type.button,
    fontSize: 11,
  },
  close: {
    width: '100%',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    ...type.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
