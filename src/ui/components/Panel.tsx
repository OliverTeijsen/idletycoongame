/**
 * The shared plate furniture: section rules, cards, meters, chips.
 *
 * Every screen used to carry its own copy of the same `{ backgroundColor:
 * panel, borderColor: line, borderWidth: 1, borderRadius: 8 }` block and its
 * own copy of the same uppercase section header — ten screens, ten identical
 * definitions, which is exactly why they all looked like the same screen.
 * They live here now, with the layer accent as a parameter.
 */
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { palette, radius, spacing, type } from '../theme';

/**
 * A section rule: the label sits on the left, and a hairline runs from it to
 * the edge of the plate. Structure that says "a new instrument begins here"
 * without spending a whole heading's worth of vertical space.
 */
export function SectionHeader({
  label,
  accent = palette.faint,
  trailing,
}: {
  label: string;
  /** Tint for the label and the rule — pass the layer's hue. */
  accent?: string;
  /** Right-aligned value, e.g. the balance this section spends. */
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[type.label, { color: accent }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: accent, opacity: 0.28 }]} />
      {trailing}
    </View>
  );
}

/**
 * A card. `accent` lights its top edge and tints the ground beneath it, which
 * is how a prestige layer takes over its own screen.
 */
export function Card({
  accent,
  active,
  muted,
  style,
  children,
}: {
  accent?: string;
  /** Live: brighten the edge. */
  active?: boolean;
  /** Out of reach: recede, but stay legible. */
  muted?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        accent ? { borderTopColor: accent, borderTopWidth: 2 } : null,
        active && { borderColor: accent ?? palette.lineHi },
        muted && styles.cardMuted,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A progress meter. Used wherever a requirement is a count the player is
 * working toward — "12 of 16 purchases" is a bar, not a sentence, and the bar
 * tells them how close they are at a glance.
 */
export function Meter({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/**
 * A small keyed value: glyph + number, in the layer's hue.
 *
 * FIXED width, one line. A chip holds a live number, and an auto-sizing chip
 * resizes its neighbours every time that number gains a digit — see the note
 * in ResourceBar.tsx for what that did to the whole app.
 */
export function Chip({
  glyph,
  value,
  color,
  caption,
}: {
  glyph: string;
  value: string;
  color: string;
  caption?: string;
}) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipValue, { color }]} numberOfLines={1}>
        {glyph} {value}
      </Text>
      {caption ? <Text style={styles.chipCaption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  rule: { flex: 1, height: 1 },
  card: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  cardMuted: { backgroundColor: palette.bg, borderColor: palette.line },
  meterTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.bgDeep,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  meterFill: { height: 3, borderRadius: 2 },
  chip: { alignItems: 'center', width: 76 },
  chipValue: { ...type.figure, fontSize: 14 },
  chipCaption: { ...type.micro, color: palette.faint, marginTop: 1 },
});
