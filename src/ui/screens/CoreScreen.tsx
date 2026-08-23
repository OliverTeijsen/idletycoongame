/** Core tab: stage, buy-amount toggle, dimension chain, spark upgrades, boost. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { format, formatWhole } from '../../game/numbers';
import {
  canDimBoost,
  dimBoostRequirementText,
  dimCost,
  dimCostFor,
  dimMaxAffordable,
} from '../../game/systems/dimensions';
import { upgradeCost, upgradeMaxed } from '../../game/systems/upgrades';
import { Stage } from '../../render/Stage';
import { useGameStore } from '../../state/store';
import { Row } from '../components/Row';
import { mono, palette, spacing } from '../theme';
import { BuyAmount } from '../../game/types';

const AMOUNTS: BuyAmount[] = [1, 10, 'MAX'];

export function CoreScreen() {
  const game = useGameStore((s) => s.game);
  const buyAmount = useGameStore((s) => s.buyAmount);
  const setBuyAmount = useGameStore((s) => s.setBuyAmount);
  const buyDimension = useGameStore((s) => s.buyDimension);
  const buySparkUpgrade = useGameStore((s) => s.buySparkUpgrade);
  const dimBoost = useGameStore((s) => s.dimBoost);
  const notation = game.options.notation;

  const boostReq = dimBoostRequirementText(game);
  const boostReady = canDimBoost(game);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Stage />

      <View style={styles.toggleRow}>
        {AMOUNTS.map((a) => (
          <Pressable
            key={String(a)}
            onPress={() => setBuyAmount(a)}
            style={[styles.toggle, buyAmount === a && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, buyAmount === a && styles.toggleTextActive]}>
              {a === 'MAX' ? 'MAX' : `×${a}`}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>ORBITERS</Text>
      {game.dims.map((d, i) => {
        if (!d.unlocked) return null;
        const tier = i + 1;
        const n = buyAmount === 'MAX' ? dimMaxAffordable(game, tier) : buyAmount;
        const cost = n > 0 ? dimCostFor(game, tier, n) : dimCost(game, tier);
        const affordable = dimMaxAffordable(game, tier) >= (buyAmount === 'MAX' ? 1 : buyAmount);
        return (
          <Row
            key={tier}
            color={tier === 1 ? palette.orbiter : palette.orbiterCyan}
            title={`Tier ${tier} Orbiter`}
            subtext={
              tier === 1
                ? `makes Spark · owned ${formatWhole(d.amount, notation)} (${d.bought} bought)`
                : `makes Tier ${tier - 1} · owned ${formatWhole(d.amount, notation)} (${d.bought} bought)`
            }
            costText={`✦ ${format(cost, { notation })}${buyAmount === 'MAX' && n > 0 ? ` ×${n}` : ''}`}
            affordable={affordable}
            onBuy={() => buyDimension(tier)}
          />
        );
      })}

      <Pressable
        onPress={dimBoost}
        disabled={!boostReady}
        style={[styles.boost, !boostReady && styles.boostLocked]}
      >
        <Text style={styles.boostTitle}>DIMENSION BOOST · ×2 all tiers</Text>
        <Text style={styles.boostSub}>
          {boostReady
            ? 'resets Spark & orbiters — permanent ×2 and a new tier'
            : `needs ${boostReq.need} Tier-${boostReq.tier} purchases (${game.dims[boostReq.tier - 1].bought}/${boostReq.need})`}
        </Text>
      </Pressable>

      <Text style={styles.section}>SPARK UPGRADES</Text>
      {BAL.sparkUpgrades.map((u) => {
        const level = game.sparkUpgrades[u.id] ?? 0;
        const maxed = upgradeMaxed(u, level);
        const cost = upgradeCost(u, level);
        return (
          <Row
            key={u.id}
            color={palette.core}
            title={u.name}
            subtext={`${u.desc} · lvl ${level}${u.maxLevel !== null ? `/${u.maxLevel}` : ''}`}
            costText={`✦ ${format(cost, { notation })}`}
            affordable={game.spark.gte(cost)}
            maxed={maxed}
            onBuy={() => buySparkUpgrade(u.id)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  section: {
    color: palette.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  toggle: {
    paddingVertical: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  toggleActive: { borderColor: palette.core, backgroundColor: '#241a0d' },
  toggleText: { color: palette.dim, fontSize: 12, fontWeight: '700', ...mono },
  toggleTextActive: { color: palette.core },
  boost: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.orbiterCyan,
    backgroundColor: '#0c2226',
    padding: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  boostLocked: { opacity: 0.5, borderColor: palette.line },
  boostTitle: { color: palette.orbiterCyan, fontSize: 13, fontWeight: '800' },
  boostSub: { color: palette.dim, fontSize: 11, marginTop: 2, textAlign: 'center' },
});
