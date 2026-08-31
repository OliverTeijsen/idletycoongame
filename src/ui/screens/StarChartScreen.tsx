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
import { SectionHeader } from '../components/Panel';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';

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
      <SectionHeader
        label="Inner ring"
        accent={palette.shard}
        trailing={
          <Text style={styles.shards}>
            {LAYERS.shard.glyph} {formatWhole(game.shards, notation)}
          </Text>
        }
      />
      {ring1.map((node) => (
        <NodeRow key={node.id} node={node} onBuy={() => buyStarNode(node.id)} />
      ))}

      <SectionHeader
        label={ringUnlocked(game, 2) ? 'Outer ring' : 'Outer ring · opens at Ascend'}
        accent={ringUnlocked(game, 2) ? palette.shard : palette.faint}
      />
      {ring2.map((node) => (
        <NodeRow key={node.id} node={node} onBuy={() => buyStarNode(node.id)} />
      ))}

      {spent.gt(0) && (
        <Pressable style={styles.respec} onPress={respec}>
          <Text style={styles.respecText}>
            Refund every node · {LAYERS.shard.glyph} {formatWhole(spent, notation)} back
          </Text>
        </Pressable>
      )}
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
      <View style={[styles.edge, { backgroundColor: active ? palette.shard : palette.line }]} />
      <View style={styles.body}>
        <Text style={[styles.name, active && { color: palette.shard }]}>{node.name}</Text>
        <Text style={styles.desc}>
          {node.desc}
          {prereqMissing && !active
            ? ` · needs ${node.requires.map((r) => BAL.starChart.find((n) => n.id === r)?.name ?? r).join(', ')}`
            : ''}
          {ringLocked && !active ? ' · opens at Ascend' : ''}
        </Text>
      </View>
      <Text style={[styles.cost, buyable ? styles.costOk : styles.costNo]}>
        {active ? 'ON' : `${LAYERS.shard.glyph} ${formatWhole(node.cost, notation)}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  shards: { ...type.figure, fontSize: 14, color: palette.shard },
  respec: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  respecText: { ...type.micro, color: palette.dim },
  node: {
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
  },
  /** An owned node is lit from its edge, like every other live object. */
  nodeActive: { backgroundColor: palette.panel, borderColor: palette.shard },
  nodeDim: { opacity: 0.45 },
  edge: { width: 3, alignSelf: 'stretch', marginVertical: -spacing.sm },
  body: { flex: 1, paddingVertical: 1 },
  name: { ...type.title, color: palette.ink },
  desc: { ...type.micro, color: palette.dim, marginTop: 3 },
  cost: { ...type.label, fontSize: 11, ...mono },
  costOk: { color: palette.shard },
  costNo: { color: palette.faint },
});
