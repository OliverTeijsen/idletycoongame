/** Core tab: stage, buy-amount toggle, dimension chain, spark upgrades, boost. */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { format, formatTime, formatWhole } from '../../game/numbers';
import { adService } from '../../services/ads';
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
import { Card, Meter, SectionHeader } from '../components/Panel';
import { Row } from '../components/Row';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';
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
  const boughtOfTop = game.dims[boostReq.tier - 1].bought;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Stage />

      <RewardedBoostCard />

      <SectionHeader
        label="Orbiters"
        accent={palette.orbiter}
        trailing={
          <View style={styles.toggleRow}>
            {AMOUNTS.map((a) => (
              <Pressable
                key={String(a)}
                onPress={() => setBuyAmount(a)}
                style={[styles.toggle, buyAmount === a && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, buyAmount === a && styles.toggleTextActive]}>
                  {a === 'MAX' ? 'Max' : `×${a}`}
                </Text>
              </Pressable>
            ))}
          </View>
        }
      />
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
                ? `Makes Spark · ${formatWhole(d.amount, notation)} spinning, ${d.bought} bought`
                : `Makes Tier ${tier - 1} · ${formatWhole(d.amount, notation)} spinning, ${d.bought} bought`
            }
            costText={`${LAYERS.spark.glyph} ${format(cost, { notation })}${
              buyAmount === 'MAX' && n > 0 ? ` ×${n}` : ''
            }`}
            affordable={affordable}
            onBuy={() => buyDimension(tier)}
          />
        );
      })}

      {/*
        The boost is a requirement you work toward, so it is drawn as a meter
        rather than a sentence: "9 of 16" reads at a glance, and the bar makes
        the last few purchases feel like the last few.
      */}
      <Pressable onPress={dimBoost} disabled={!boostReady}>
        {({ pressed }) => (
          <Card accent={palette.orbiterCyan} active={boostReady} muted={!boostReady}>
            <View style={styles.boostHead}>
              <Text style={[styles.boostTitle, !boostReady && { color: palette.dim }]}>
                Dimension boost
              </Text>
              <Text style={[styles.boostGain, pressed && boostReady && { opacity: 0.6 }]}>
                ×2 all tiers
              </Text>
            </View>
            <Text style={styles.boostSub}>
              {boostReady
                ? 'Resets Spark and orbiters. Keeps the ×2, and opens the next tier.'
                : `Buy ${boostReq.need - boughtOfTop} more Tier-${boostReq.tier} orbiters.`}
            </Text>
            <Meter
              value={boughtOfTop}
              max={boostReq.need}
              color={boostReady ? palette.orbiterCyan : palette.lineHi}
            />
            <Text style={styles.boostCount}>
              {boughtOfTop} / {boostReq.need} Tier-{boostReq.tier}
            </Text>
          </Card>
        )}
      </Pressable>

      <SectionHeader label="Spark upgrades" accent={palette.core} />
      {BAL.sparkUpgrades.map((u) => {
        const level = game.sparkUpgrades[u.id] ?? 0;
        const maxed = upgradeMaxed(u, level);
        const cost = upgradeCost(u, level);
        return (
          <Row
            key={u.id}
            color={palette.core}
            title={u.name}
            subtext={`${u.desc} · level ${level}${
              u.maxLevel !== null ? ` of ${u.maxLevel}` : ''
            }`}
            costText={`${LAYERS.spark.glyph} ${format(cost, { notation })}`}
            affordable={game.spark.gte(cost)}
            maxed={maxed}
            onBuy={() => buySparkUpgrade(u.id)}
          />
        );
      })}
    </ScrollView>
  );
}

/**
 * MONETIZATION CALL SITE (spec §15): rewarded "×2 production for 15 min".
 * Renders only while an ad is actually available, or while the boost it
 * granted is still running — never as a dead button.
 */
function RewardedBoostCard() {
  const remaining = useGameStore((s) => s.game.rewardBoostRemaining);
  const watchRewarded = useGameStore((s) => s.watchRewarded);
  const [busy, setBusy] = useState(false);

  const active = remaining > 0;
  const offered = adService.isAvailable('production');
  if (!active && !offered) return null;

  const mult = BAL.rewards.production.mult.toString();
  return (
    <Pressable
      disabled={busy || active}
      onPress={async () => {
        setBusy(true);
        await watchRewarded('production');
        setBusy(false);
      }}
    >
      <Card accent={active ? palette.core : palette.orbiter} active>
        <View style={styles.rewardRow}>
          <View style={styles.rewardBody}>
            <Text style={styles.rewardTitle}>
              {active ? `Production ×${mult} is running` : `Watch an ad for ×${mult} production`}
            </Text>
            <Text style={styles.rewardSub}>
              {active
                ? `${formatTime(remaining)} left`
                : busy
                  ? 'Loading…'
                  : `Lasts ${formatTime(BAL.rewards.production.seconds)}`}
            </Text>
          </View>
          {!active && !busy && <Text style={styles.rewardCue}>▶</Text>}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },

  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rewardBody: { flex: 1 },
  rewardTitle: { ...type.title, color: palette.ink },
  rewardSub: { ...type.micro, color: palette.dim, marginTop: 3 },
  rewardCue: { color: palette.orbiter, fontSize: 16 },

  /** Sits inside the Orbiters section rule — it only governs orbiter buys. */
  toggleRow: { flexDirection: 'row', gap: spacing.xs },
  toggle: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
  },
  toggleActive: { borderColor: palette.core, backgroundColor: palette.panelWarm },
  toggleText: { ...type.label, fontSize: 10, letterSpacing: 0.8, color: palette.faint },
  toggleTextActive: { color: palette.core },

  boostHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  boostTitle: { ...type.title, color: palette.orbiterCyan },
  boostGain: { ...type.figure, fontSize: 15, color: palette.orbiterCyan },
  boostSub: { ...type.micro, color: palette.dim, marginTop: 3 },
  boostCount: { ...type.micro, ...mono, color: palette.faint, marginTop: 5 },
});
