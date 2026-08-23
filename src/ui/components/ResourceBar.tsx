/**
 * Top resource bar (spec §11): only resources the player has unlocked, each
 * with icon, value and rate. Fixed-width numerics prevent layout shift.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { format } from '../../game/numbers';
import { sparkRate } from '../../game/systems/dimensions';
import { moteRate, motesUnlocked } from '../../game/systems/motes';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

export function ResourceBar() {
  const game = useGameStore((s) => s.game);
  const notation = game.options.notation;
  return (
    <View style={styles.bar}>
      <View style={styles.entry}>
        <Text style={[styles.value, { color: palette.core }]}>
          ✦ {format(game.spark, { notation })}
        </Text>
        <Text style={styles.rate}>+{format(sparkRate(game), { notation, small: true })}/s</Text>
      </View>
      {motesUnlocked(game) && (
        <View style={styles.entry}>
          <Text style={[styles.value, { color: palette.mote }]}>
            ◦ {format(game.motes, { notation })}
          </Text>
          <Text style={styles.rate}>+{format(moteRate(game), { notation, small: true })}/s</Text>
        </View>
      )}
      {game.shardsEver.gt(0) && (
        <View style={styles.entry}>
          <Text style={[styles.value, { color: palette.shard }]}>
            ◆ {format(game.shards, { notation })}
          </Text>
          <Text style={styles.rate}>on Collapse</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: palette.bgDeep,
  },
  entry: { alignItems: 'center' },
  value: { fontSize: 16, fontWeight: '800', ...mono },
  rate: { color: palette.dim, fontSize: 11, marginTop: 1, ...mono },
});
