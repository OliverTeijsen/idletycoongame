/** Elements tab (spec §8.2): point pool, per-element allocation, capstones. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { formatTime } from '../../game/numbers';
import { elementAlloc, elementAllocatable } from '../../game/systems/elements';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

const ELEMENT_COLORS: Record<string, string> = {
  ignis: palette.core,
  aqua: palette.orbiterCyan,
  terra: '#a3e635',
  aer: palette.ink,
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
        <Text style={styles.pool}>
          {game.elements.points} <Text style={styles.poolLabel}>points</Text>
        </Text>
        {spent > 0 && (
          <Pressable style={styles.respec} onPress={respec}>
            <Text style={styles.respecText}>respec all ({spent})</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.blurb}>
        Points come from Ascends (+{BAL.elements.pointsPerAscend}), challenge completions (+
        {BAL.elements.pointsPerChallenge}) and time (next in {formatTime(toNext)}). Tap an
        element to invest. {BAL.elements.capstoneAt}+ points in one element adds a ×
        {BAL.elements.capstoneMult.toString()} global capstone.
      </Text>

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
                {capstone ? '  ✧ capstone' : ''}
              </Text>
              <Text style={styles.desc}>{def.locked ? `🔒 ${def.desc}` : def.desc}</Text>
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
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pool: { color: palette.ink, fontSize: 20, fontWeight: '800', ...mono },
  poolLabel: { color: palette.dim, fontSize: 12, fontWeight: '600' },
  respec: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  respecText: { color: palette.dim, fontSize: 11 },
  blurb: { color: palette.dim, fontSize: 11, lineHeight: 17, marginVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowLocked: { opacity: 0.45 },
  rowCapstone: { borderColor: palette.singularity },
  symbol: { fontSize: 20, width: 26, textAlign: 'center' },
  body: { flex: 1 },
  name: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  desc: { color: palette.dim, fontSize: 11, marginTop: 2 },
  alloc: { color: palette.dim, fontSize: 16, fontWeight: '800', minWidth: 28, textAlign: 'right', ...mono },
});
