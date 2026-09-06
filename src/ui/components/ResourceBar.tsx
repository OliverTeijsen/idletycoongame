/**
 * Top resource bar (spec §11): only resources the player has unlocked.
 *
 * Spark is the headline and everything else is a chip, because that is what
 * is true — Spark is the live resource that moves every tick, and the rest
 * are banked totals you read between resets.
 *
 * THE SPECTRUM RULE beneath it is the signature of the whole app: one segment
 * per prestige layer, in that layer's hue, lit as you unlock it. It is a
 * progress bar for the entire game that costs three pixels of height, and it
 * is the reason the layer hues are held at a matched chroma in the theme.
 *
 * ===========================================================================
 * WHY THE HEADLINE AND THE CHIPS ARE ON SEPARATE ROWS
 * ===========================================================================
 * They used to share one `flexWrap: 'wrap'` row, and that is the bug that made
 * "the whole design start shifting" the moment an autobuyer was switched on.
 *
 * The mechanism: an autobuyer buys MAX every pass, so Spark is drained to
 * almost nothing and climbs back, over and over, once a second or faster. The
 * headline is a formatted number, so its rendered STRING LENGTH swings with it
 * — "✦ 4.21K" is seven characters and "✦ 986.54Qa" is ten. Tabular figures
 * (which the theme does set) fix the width of each DIGIT; they cannot fix the
 * width of a string that gains and loses characters. So the row's intrinsic
 * width crossed the container width and went back, the chips wrapped onto a
 * second line and unwrapped, the bar's height changed by a whole line — and
 * because the bar sits above the tab content, every screen below it jumped by
 * that much, several times a second.
 *
 * The fix is structural rather than cosmetic: the two blocks no longer share a
 * line, so nothing either of them does can reflow the other. The headline row
 * has a fixed height and clips; the chips have their own fixed-height row and
 * scroll sideways when there are more than fit. Nothing in this component can
 * change height any more, whatever the numbers do.
 *
 * The same rule is applied wherever a live number sits next to other content:
 * `Row`'s cost column is a fixed width and its subtext is pinned to one line.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { format } from '../../game/numbers';
import { sparkRate } from '../../game/systems/dimensions';
import { oreRate } from '../../game/systems/minerals';
import { moteRate, motesUnlocked } from '../../game/systems/motes';
import { useGameStore } from '../../state/store';
import { LAYERS, mono, palette, spacing, type } from '../theme';
import { Chip } from './Panel';

export function ResourceBar() {
  const game = useGameStore((s) => s.game);
  const notation = game.options.notation;

  const showMotes = motesUnlocked(game);
  const showShards = game.shardsEver.gt(0) || game.ascends > 0;
  const showPrism = game.ascends > 0;
  const showAeon = game.converges > 0;
  const showOre = game.converges > 0;
  const showSing = game.unifies > 0;

  // The rule's segments, in ladder order. Unlocked ones are lit.
  const ladder = [
    { color: LAYERS.spark.color, lit: true },
    { color: LAYERS.mote.color, lit: showMotes },
    { color: LAYERS.shard.color, lit: showShards },
    { color: LAYERS.prism.color, lit: showPrism },
    { color: LAYERS.ore.color, lit: showOre },
    { color: LAYERS.singularity.color, lit: showSing },
  ];

  const anyChip = showMotes || showShards || showPrism || showOre || showAeon || showSing;

  return (
    <View style={styles.bar}>
      <View style={styles.headline}>
        <Text style={styles.spark} numberOfLines={1}>
          {LAYERS.spark.glyph} {format(game.spark, { notation })}
        </Text>
        <Text style={styles.rate} numberOfLines={1}>
          +{format(sparkRate(game), { notation, small: true })}/s
        </Text>
      </View>

      {anyChip && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chips}
        >
          {showMotes && (
            <Chip
              glyph={LAYERS.mote.glyph}
              value={format(game.motes, { notation })}
              color={LAYERS.mote.color}
              caption={`+${format(moteRate(game), { notation, small: true })}/s`}
            />
          )}
          {showShards && (
            <Chip
              glyph={LAYERS.shard.glyph}
              value={format(game.shards, { notation })}
              color={LAYERS.shard.color}
              caption="shards"
            />
          )}
          {showPrism && (
            <Chip
              glyph={LAYERS.prism.glyph}
              value={format(game.prism, { notation })}
              color={LAYERS.prism.color}
              caption="prism"
            />
          )}
          {showAeon && (
            <Chip
              glyph={LAYERS.aeon.glyph}
              value={format(game.aeon, { notation })}
              color={LAYERS.aeon.color}
              caption="aeon"
            />
          )}
          {showOre && (
            <Chip
              glyph={LAYERS.ore.glyph}
              value={format(game.ore, { notation })}
              color={LAYERS.ore.color}
              caption={`+${format(oreRate(game), { notation, small: true })}/s`}
            />
          )}
          {showSing && (
            <Chip
              glyph={LAYERS.singularity.glyph}
              value={format(game.singularity, { notation })}
              color={LAYERS.singularity.color}
              caption="singularity"
            />
          )}
        </ScrollView>
      )}

      <View style={styles.spectrum}>
        {ladder.map((seg, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: seg.color, opacity: seg.lit ? 0.85 : 0.12 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Every height here is FIXED and every row clips. That is the whole contract
 * of this component: the tab content below it must never move because a
 * number above it got longer.
 */
const HEADLINE_H = 40;
const CHIPS_H = 34;

const styles = StyleSheet.create({
  bar: { backgroundColor: palette.bgDeep },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    height: HEADLINE_H,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  /** flexShrink + minWidth:0 so a 1e5000 headline truncates instead of pushing. */
  spark: { ...type.display, color: palette.core, flexShrink: 1, minWidth: 0 },
  rate: { ...type.micro, color: palette.faint, ...mono, flexShrink: 0, marginLeft: spacing.sm },
  chipScroll: { height: CHIPS_H, flexGrow: 0 },
  chips: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  spectrum: { flexDirection: 'row', height: 2, gap: 1 },
  segment: { flex: 1, height: 2 },
});
