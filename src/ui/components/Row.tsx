/**
 * The consistent purchase row (spec §11): color-coded icon dot, title +
 * subtext, cost, disabled state. Long-press = buy max where the caller
 * supports it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mono, palette, spacing } from '../theme';

interface RowProps {
  color: string;
  title: string;
  subtext: string;
  costText: string;
  affordable: boolean;
  maxed?: boolean;
  onBuy(): void;
  onBuyMax?(): void;
}

export function Row({ color, title, subtext, costText, affordable, maxed, onBuy, onBuyMax }: RowProps) {
  const disabled = maxed || !affordable;
  return (
    <Pressable
      onPress={onBuy}
      onLongPress={onBuyMax}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtext}>{subtext}</Text>
      </View>
      <Text style={[styles.cost, affordable && !maxed ? styles.costOk : styles.costNo]}>
        {maxed ? 'MAX' : costText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  dot: { width: 10, height: 10, borderRadius: 2 },
  body: { flex: 1 },
  title: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  subtext: { color: palette.dim, fontSize: 11, marginTop: 2 },
  cost: { fontSize: 13, fontWeight: '700', ...mono },
  costOk: { color: palette.core },
  costNo: { color: palette.dim },
});
