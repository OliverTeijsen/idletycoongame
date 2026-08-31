/**
 * Top resource bar (spec §11): only resources the player has unlocked.
 *
 * Spark is the headline and everything else is a chip, because that is what
 * is true — Spark is the live resource that moves every tick, and the rest
 * are banked totals you read between resets. The old bar gave all six the
 * same size and weight, so a screen full of numbers had no entry point.
 *
 * THE SPECTRUM RULE beneath it is the signature of the whole app: one segment
 * per prestige layer, in that layer's hue, lit as you unlock it. It is a
 * progress bar for the entire game that costs three pixels of height, and it
 * is the reason the layer hues are held at a matched chroma in the theme —
 * side by side in one rule, they have to read as an ordered spectrum.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

  return (
    <View style={styles.bar}>
      <View style={styles.headline}>
        <View>
          <Text style={styles.spark}>
            {LAYERS.spark.glyph} {format(game.spark, { notation })}
          </Text>
          <Text style={styles.rate}>
            +{format(sparkRate(game), { notation, small: true })} per second
          </Text>
        </View>

        <View style={styles.chips}>
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
        </View>
      </View>

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

const styles = StyleSheet.create({
  bar: { backgroundColor: palette.bgDeep },
  headline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    columnGap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  spark: { ...type.display, color: palette.core },
  rate: { ...type.micro, color: palette.faint, marginTop: 1, ...mono },
  chips: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, flexShrink: 1 },
  spectrum: { flexDirection: 'row', height: 2, gap: 1 },
  segment: { flex: 1, height: 2 },
});
