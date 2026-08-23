/** Star Chart tab (spec §8.1): node list by ring with prereq gating + respec. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL, StarNodeDef } from '../../game/balance';
import { formatWhole } from '../../game/numbers';
import {
  canBuyNode,
  nodeActive,
  ringUnlocked,
  starChartSpent,
} from '../../game/systems/starchart';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

export function StarChartScreen() {
  const game = useGameStore((s) => s.game);
  const buyStarNode = useGameStore((s) => s.buyStarNode);
  const respec = useGameStore((s) => s.respecStarChart);
  const notation = game.options.notation;

  const ring1 = BAL.starChart.filter((n) => n.ring === 1);
  const ring2 = BAL.starChart.filter((n) => n.ring === 2);
  const spent = starChartSpent(game);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.shards}>◆ {formatWhole(game.shards, notation)}</Text>
        {spent.gt(0) && (
          <Pressable style={styles.respec} onPress={respec}>
            <Text style={styles.respecText}>respec (refund ◆ {formatWhole(spent, notation)})</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.section}>INNER RING</Text>
      {ring1.map((node) => (
        <NodeRow key={node.id} node={node} onBuy={() => buyStarNode(node.id)} />
      ))}

      <Text style={styles.section}>OUTER RING · 🔒 unlocks at Ascend</Text>
      {ring2.map((node) => (
        <NodeRow key={node.id} node={node} onBuy={() => buyStarNode(node.id)} />
      ))}
    </ScrollView>
  );
}

function NodeRow({ node, onBuy }: { node: StarNodeDef; onBuy(): void }) {
  const game = useGameStore((s) => s.game);
  const notation = game.options.notation;
  const active = nodeActive(game, node.id);
  const buyable = canBuyNode(game, node.id);
  const ringLocked = !ringUnlocked(game, node.ring);
  const prereqMissing = !node.requires.every((r) => nodeActive(game, r));

  return (
    <Pressable
      onPress={onBuy}
      disabled={!buyable}
      style={[styles.node, active && styles.nodeActive, (ringLocked || prereqMissing) && styles.nodeDim]}
    >
      <View style={[styles.dot, { backgroundColor: active ? palette.shard : palette.line }]} />
      <View style={styles.body}>
        <Text style={[styles.name, active && { color: palette.shard }]}>{node.name}</Text>
        <Text style={styles.desc}>
          {node.desc}
          {prereqMissing && !active
            ? ` · needs ${node.requires.map((r) => BAL.starChart.find((n) => n.id === r)?.name ?? r).join(', ')}`
            : ''}
        </Text>
      </View>
      <Text style={[styles.cost, buyable ? styles.costOk : styles.costNo]}>
        {active ? '●' : `◆ ${formatWhole(node.cost, notation)}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shards: { color: palette.shard, fontSize: 16, fontWeight: '800', ...mono },
  respec: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  respecText: { color: palette.dim, fontSize: 11 },
  section: {
    color: palette.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  node: {
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
  nodeActive: { borderColor: palette.shard, backgroundColor: '#161022' },
  nodeDim: { opacity: 0.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1 },
  name: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  desc: { color: palette.dim, fontSize: 11, marginTop: 2 },
  cost: { fontSize: 13, fontWeight: '700', ...mono },
  costOk: { color: palette.shard },
  costNo: { color: palette.dim },
});
