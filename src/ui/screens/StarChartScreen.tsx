/**
 * Star Chart tab (spec §8.1): ranked nodes by ring, with prereq gating and a
 * free respec.
 *
 * Nodes are RANKED now, so a node row is a purchase you come back to rather
 * than a switch you flip once — which means it wears the same shape as every
 * other repeatable in the app: name, effect and current rank on the left, the
 * next rank's price on the right. The one thing it adds is the ring's own
 * gate line, because a locked ring is the only reason a row here can be
 * unbuyable while you can plainly afford it.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL, StarNodeDef } from '../../game/balance';
import { formatWhole } from '../../game/numbers';
import {
  canBuyNode,
  nodeActive,
  nodeCost,
  nodeMaxed,
  nodeRank,
  ringUnlocked,
  starChartSpent,
} from '../../game/systems/starchart';
import { useGameStore } from '../../state/store';
import { SectionHeader } from '../components/Panel';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';

const RINGS: { ring: 1 | 2 | 3; label: string; locked: string }[] = [
  { ring: 1, label: 'Inner ring', locked: '' },
  { ring: 2, label: 'Outer ring', locked: 'opens at Ascend' },
  { ring: 3, label: 'Deep ring', locked: 'opens at Converge' },
];

export function StarChartScreen() {
  const game = useGameStore((s) => s.game);
  const buyStarNode = useGameStore((s) => s.buyStarNode);
  const buyStarNodeMany = useGameStore((s) => s.buyStarNodeMany);
  const respec = useGameStore((s) => s.respecStarChart);
  const notation = game.options.notation;

  const spent = starChartSpent(game);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        Every node takes ranks, and the price of the next one climbs. This is what Shards are
        for — the chart never runs out of things to buy.
      </Text>

      {RINGS.map(({ ring, label, locked }) => {
        const open = ringUnlocked(game, ring);
        return (
          <React.Fragment key={ring}>
            <SectionHeader
              label={open ? label : `${label} · ${locked}`}
              accent={open ? palette.shard : palette.faint}
              trailing={
                ring === 1 ? (
                  <Text style={styles.shards}>
                    {LAYERS.shard.glyph} {formatWhole(game.shards, notation)}
                  </Text>
                ) : undefined
              }
            />
            {BAL.starChart
              .filter((n) => n.ring === ring)
              .map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  onBuy={() => buyStarNode(node.id)}
                  onBuyMany={() => buyStarNodeMany(node.id)}
                />
              ))}
          </React.Fragment>
        );
      })}

      {spent.gt(0) && (
        <Pressable style={styles.respec} onPress={respec}>
          <Text style={styles.respecText}>
            Refund every rank · {LAYERS.shard.glyph} {formatWhole(spent, notation)} back
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function NodeRow({
  node,
  onBuy,
  onBuyMany,
}: {
  node: StarNodeDef;
  onBuy(): void;
  onBuyMany(): void;
}) {
  const game = useGameStore((s) => s.game);
  const notation = game.options.notation;
  const rank = nodeRank(game, node.id);
  const owned = rank > 0;
  const maxed = nodeMaxed(game, node.id);
  const buyable = canBuyNode(game, node.id);
  const ringLocked = !ringUnlocked(game, node.ring);
  const prereqMissing = !node.requires.every((r) => nodeActive(game, r));

  const rankLabel = node.maxRank === null ? `rank ${rank}` : `rank ${rank} of ${node.maxRank}`;

  return (
    <Pressable
      onPress={onBuy}
      // Long-press = spend down. The chart is where a thousand Shards go, and
      // the loop has to run over live state, so it lives in the store.
      onLongPress={onBuyMany}
      disabled={!buyable}
      style={[
        styles.node,
        owned && styles.nodeActive,
        (ringLocked || prereqMissing) && styles.nodeDim,
      ]}
    >
      <View style={[styles.edge, { backgroundColor: owned ? palette.shard : palette.line }]} />
      <View style={styles.body}>
        <Text style={[styles.name, owned && { color: palette.shard }]} numberOfLines={1}>
          {node.name}
        </Text>
        <Text style={styles.desc} numberOfLines={1}>
          {node.desc} · {rankLabel}
          {prereqMissing && !owned
            ? ` · needs ${node.requires.map((r) => BAL.starChart.find((n) => n.id === r)?.name ?? r).join(', ')}`
            : ''}
          {ringLocked && !owned ? ' · ring locked' : ''}
        </Text>
      </View>
      <Text style={[styles.cost, maxed ? styles.costNo : buyable ? styles.costOk : styles.costNo]}>
        {maxed
          ? 'MAX'
          : `${LAYERS.shard.glyph} ${formatWhole(nodeCost(game, node.id), notation)}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { ...type.body, color: palette.dim, marginTop: spacing.md },
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
    /** Fixed height, like every other row that holds a live number. */
    minHeight: 52,
  },
  /** An owned node is lit from its edge, like every other live object. */
  nodeActive: { backgroundColor: palette.panel, borderColor: palette.shard },
  nodeDim: { opacity: 0.45 },
  edge: { width: 3, alignSelf: 'stretch', marginVertical: -spacing.sm },
  body: { flex: 1, minWidth: 0, paddingVertical: 1 },
  name: { ...type.title, color: palette.ink },
  desc: { ...type.micro, color: palette.dim, marginTop: 3 },
  /**
   * Fixed width and right-aligned: this column redraws every time an
   * autobuyer spends, and a cost that changes the row's internal geometry is
   * the same layout-shift bug the resource bar had.
   */
  cost: { ...type.label, fontSize: 11, ...mono, width: 84, textAlign: 'right', flexShrink: 0 },
  costOk: { color: palette.shard },
  costNo: { color: palette.faint },
});
