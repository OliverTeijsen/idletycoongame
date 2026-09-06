/**
 * The purchase row (spec §11) — the single most repeated object in the app,
 * so it carries the plate language: a colour-coded edge rule instead of a
 * floating dot, a flat ground, and the cost right-aligned in monospace.
 *
 * The edge rule replaces the old 10px dot deliberately. The dot was
 * decoration sitting next to the content; the rule IS the content's left
 * boundary, so the taxonomy is carried by the structure. It also lets rows
 * from the same family stack into a continuous stripe down the page.
 *
 * States are carried by ground and cost colour, never by dimming the whole
 * row: the old `opacity: 0.45` on unaffordable rows made the thing you most
 * want to read — what it costs and what it does — the hardest to read.
 *
 * Long-press = buy max where the caller supports it.
 *
 * NOTHING IN THIS ROW MAY CHANGE SIZE WITH ITS CONTENT.
 * A row's cost is a live number an autobuyer rewrites several times a second,
 * and its length swings as the formatter moves between "4.21K" and "986.54Qa"
 * and "1.23e5000". If that column were auto-width, every re-render would
 * reflow the title beside it; if the subtext could wrap to a second line, the
 * row would change height and shove the whole list. So the cost column has a
 * fixed width and the subtext is pinned to one line. This is the same bug the
 * resource bar had — see the long note in ResourceBar.tsx.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mono, palette, radius, spacing, type } from '../theme';

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
        affordable && !maxed && styles.rowLive,
        maxed && styles.rowMaxed,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.edge, { backgroundColor: color }, disabled && styles.edgeDim]} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtext} numberOfLines={1}>
          {subtext}
        </Text>
      </View>
      <Text style={[styles.cost, maxed ? styles.costMaxed : affordable ? { color } : styles.costNo]}>
        {maxed ? 'MAX' : costText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bg,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    marginBottom: 6,
    gap: spacing.md,
    overflow: 'hidden',
    /** One line of title + one of subtext + padding. Never varies. */
    minHeight: 52,
  },
  /** Affordable rows lift off the ground — the only "come and get it" cue. */
  rowLive: { backgroundColor: palette.panel, borderColor: palette.lineHi },
  rowMaxed: { backgroundColor: palette.bg, borderColor: palette.line },
  pressed: { backgroundColor: palette.panelHi },
  /** Full-height edge rule: the row's family, drawn as its own boundary. */
  edge: { width: 3, alignSelf: 'stretch', marginVertical: -spacing.sm },
  edgeDim: { opacity: 0.35 },
  /** minWidth:0 lets the flex child actually shrink instead of pushing. */
  body: { flex: 1, minWidth: 0, paddingVertical: 1 },
  title: { ...type.title, color: palette.ink },
  subtext: { ...type.micro, color: palette.dim, marginTop: 3 },
  /**
   * Fixed width, right-aligned. 92px is a shade over eleven monospaced
   * characters at 13px, which is the widest string `format` can produce for
   * any value this game reaches ("999.99Dc" is eight, "1.23e5000" is nine).
   */
  cost: {
    fontSize: 13,
    fontWeight: '700',
    ...mono,
    width: 92,
    textAlign: 'right',
    flexShrink: 0,
  },
  costMaxed: { ...type.label, color: palette.faint, fontSize: 10 },
  costNo: { color: palette.faint },
});
