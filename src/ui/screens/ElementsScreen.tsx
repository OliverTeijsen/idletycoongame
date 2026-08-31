/** Elements tab (spec §8.2): point pool, per-element allocation, capstones. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { formatTime } from '../../game/numbers';
import { elementAlloc, elementAllocatable } from '../../game/systems/elements';
import { useGameStore } from '../../state/store';
import { SectionHeader } from '../components/Panel';
import { mono, palette, radius, spacing, type } from '../theme';

const ELEMENT_COLORS: Record<string, string> = {
  ignis: palette.core,
  aqua: palette.orbiterCyan,
  terra: palette.ore,
  aer: palette.orbiter,
  lux: palette.singularity,
};

export function ElementsScreen() {
  const game = useGameStore((s) => s.game);
  const allocate = useGameStore((s) => s.allocateElement);
  const respec = useGameStore((s) => s.respecElements);

  const spent = Object.values(game.elements.alloc).reduce((a, b) => a + b, 0);
  const toNext = BAL.elements.passiveSeconds - game.elements.progress;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View>
          <Text style={styles.poolLabel}>Unspent points</Text>
          <Text style={styles.pool}>{game.elements.points}</Text>
        </View>
        {spent > 0 && (
          <Pressable style={styles.respec} onPress={respec}>
            <Text style={styles.respecText}>Take back all {spent}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.blurb}>
        Points come from Ascends (+{BAL.elements.pointsPerAscend}), completed trials (+
        {BAL.elements.pointsPerChallenge}) and time — the next one lands in{' '}
        {formatTime(toNext)}. Tap an element to invest. Reach {BAL.elements.capstoneAt} points in
        one element for a ×{BAL.elements.capstoneMult.toString()} capstone on everything.
      </Text>

      <SectionHeader label="Affinities" accent={palette.prism} />

      {BAL.elements.defs.map((def) => {
        const alloc = elementAlloc(game, def.id);
        const can = elementAllocatable(game, def.id);
        const capstone = alloc >= BAL.elements.capstoneAt;
        return (
          <Pressable
            key={def.id}
            onPress={() => allocate(def.id)}
            disabled={!can}
            style={[styles.row, def.locked && styles.rowLocked, capstone && styles.rowCapstone]}
          >
            <Text style={[styles.symbol, { color: ELEMENT_COLORS[def.id] }]}>{def.symbol}</Text>
            <View style={styles.body}>
              <Text style={styles.name}>
                {def.name}
                {capstone ? '  · capstone active' : ''}
              </Text>
              <Text style={styles.desc}>
                {def.desc}
                {def.locked ? ' · opens with Minerals' : ''}
              </Text>
            </View>
            <Text style={[styles.alloc, alloc > 0 && { color: ELEMENT_COLORS[def.id] }]}>
              {alloc}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pool: { ...type.display, color: palette.ink },
  poolLabel: { ...type.label, color: palette.faint },
  respec: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  respecText: { ...type.micro, color: palette.dim },
  blurb: { ...type.body, color: palette.dim, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bg,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 6,
    gap: spacing.md,
  },
  rowLocked: { opacity: 0.45 },
  /** A capstone is the only thing on this screen worth a lit border. */
  rowCapstone: { borderColor: palette.singularity, backgroundColor: palette.panel },
  symbol: { fontSize: 20, width: 26, textAlign: 'center' },
  body: { flex: 1 },
  name: { ...type.title, color: palette.ink },
  desc: { ...type.micro, color: palette.dim, marginTop: 3 },
  alloc: { ...type.figure, color: palette.faint, minWidth: 28, textAlign: 'right' },
});
