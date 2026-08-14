import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BuyAmount } from '../../core/types';
import { useGameStore } from '../../store/gameStore';
import { colors, radius, spacing, type } from '../theme';

const OPTIONS: BuyAmount[] = [1, 10, 100, 'MAX'];

/** ×1 / ×10 / ×100 / MAX — applies to every buy button at once. */
export function BuyAmountToggle(): React.JSX.Element {
  const buyAmount = useGameStore((s) => s.state.buyAmount);
  const chooseBuyAmount = useGameStore((s) => s.chooseBuyAmount);

  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const selected = option === buyAmount;
        return (
          <Pressable
            key={String(option)}
            testID={`buy-amount-${option}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => chooseBuyAmount(option)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {option === 'MAX' ? 'MAX' : `×${option}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: colors.goldFaint,
    borderColor: colors.gold,
  },
  label: {
    ...type.body,
    fontWeight: '800',
  },
  labelSelected: {
    color: colors.gold,
  },
});
