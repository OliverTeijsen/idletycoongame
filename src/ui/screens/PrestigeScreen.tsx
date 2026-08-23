/** Prestige tab: the Collapse card + the Shard upgrade tree (spec §7, §11). */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { format, formatWhole } from '../../game/numbers';
import {
  ascendGain,
  ascendUnlocked,
  canAscend,
  canCollapse,
  collapseGain,
  prismUpgradeCost,
  prismUpgradeLevel,
  shardUpgradeCost,
} from '../../game/systems/prestige';
import { shardUpgradeLevel } from '../../game/systems/shardperks';
import { useGameStore } from '../../state/store';
import { Row } from '../components/Row';
import { mono, palette, spacing } from '../theme';

export function PrestigeScreen() {
  const game = useGameStore((s) => s.game);
  const collapse = useGameStore((s) => s.collapse);
  const ascend = useGameStore((s) => s.ascend);
  const buyShardUpgrade = useGameStore((s) => s.buyShardUpgrade);
  const buyPrismUpgrade = useGameStore((s) => s.buyPrismUpgrade);
  const [confirming, setConfirming] = useState(false);
  const [confirmingAscend, setConfirmingAscend] = useState(false);
  const notation = game.options.notation;

  const gain = collapseGain(game);
  const ready = canCollapse(game);
  const showAscend = ascendUnlocked(game);
  const aGain = ascendGain(game);
  const aReady = canAscend(game);

  const onCollapsePress = () => {
    if (!ready) return;
    if (game.options.confirmResets && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    collapse();
  };

  const onAscendPress = () => {
    if (!aReady) return;
    if (game.options.confirmResets && !confirmingAscend) {
      setConfirmingAscend(true);
      return;
    }
    setConfirmingAscend(false);
    ascend();
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>COLLAPSE</Text>
        <Text style={styles.gain}>
          ◆ +{formatWhole(gain, notation)} <Text style={styles.gainLabel}>Shards</Text>
        </Text>
        <Text style={styles.detail}>
          best this run: ✦ {format(game.bestSparkRun, { notation })} · gain rises with √spark
        </Text>
        <Text style={styles.resets}>
          Resets: Spark, Orbiters, Spark upgrades, Motes & upgrades, Dimension Boosts
        </Text>
        <Text style={styles.keeps}>Keeps: Shards, Star Chart, Shard upgrades, automation</Text>
        <Pressable
          onPress={onCollapsePress}
          disabled={!ready}
          style={[styles.button, !ready && styles.buttonLocked, confirming && styles.buttonConfirm]}
        >
          <Text style={[styles.buttonText, confirming && styles.buttonConfirmText]}>
            {!ready
              ? `reach ✦ ${format(BAL.collapse.unlockSpark, { notation })} first`
              : confirming
                ? 'TAP AGAIN TO CONFIRM'
                : 'COLLAPSE THE CORE'}
          </Text>
        </Pressable>
        {confirming && (
          <Pressable onPress={() => setConfirming(false)}>
            <Text style={styles.cancel}>cancel</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.section}>SHARD UPGRADES · ◆ {formatWhole(game.shards, notation)}</Text>
      {BAL.shardUpgrades.map((u) => {
        const level = shardUpgradeLevel(game, u.id);
        const maxed = u.maxLevel !== null && level >= u.maxLevel;
        const cost = shardUpgradeCost(u, level);
        return (
          <Row
            key={u.id}
            color={palette.shard}
            title={u.name}
            subtext={`${u.desc} · lvl ${level}${u.maxLevel !== null ? `/${u.maxLevel}` : ''}`}
            costText={`◆ ${formatWhole(cost, notation)}`}
            affordable={game.shards.gte(cost)}
            maxed={maxed}
            onBuy={() => buyShardUpgrade(u.id)}
          />
        );
      })}

      {showAscend ? (
        <>
          <View style={[styles.card, styles.ascendCard]}>
            <Text style={[styles.cardTitle, { color: palette.prism }]}>ASCEND</Text>
            <Text style={styles.gain}>
              ▲ +{formatWhole(aGain, notation)} <Text style={[styles.gainLabel, { color: palette.prism }]}>Prism</Text>
            </Text>
            <Text style={styles.detail}>
              best Shards this cycle: ◆ {formatWhole(game.bestShards, notation)} · needs ◆{' '}
              {formatWhole(BAL.ascend.unlockShards, notation)}
            </Text>
            <Text style={styles.resets}>
              Resets: everything Collapse does, PLUS Shards, the Shard tree and the Star Chart
            </Text>
            <Text style={styles.keeps}>Keeps: Prism & grid, Elements, challenge rewards</Text>
            <Pressable
              onPress={onAscendPress}
              disabled={!aReady}
              style={[
                styles.button,
                { backgroundColor: palette.prism },
                !aReady && styles.buttonLocked,
                confirmingAscend && styles.buttonConfirm,
              ]}
            >
              <Text style={[styles.buttonText, confirmingAscend && styles.buttonConfirmText]}>
                {!aReady
                  ? `reach ◆ ${formatWhole(BAL.ascend.unlockShards, notation)} Shards first`
                  : confirmingAscend
                    ? 'TAP AGAIN TO CONFIRM'
                    : 'ASCEND THE GYRE'}
              </Text>
            </Pressable>
            {confirmingAscend && (
              <Pressable onPress={() => setConfirmingAscend(false)}>
                <Text style={styles.cancel}>cancel</Text>
              </Pressable>
            )}
          </View>

          {game.ascends > 0 && (
            <>
              <Text style={styles.section}>PRISM GRID · ▲ {formatWhole(game.prism, notation)}</Text>
              {BAL.prismGrid.map((u) => {
                const level = prismUpgradeLevel(game, u.id);
                const maxed = u.maxLevel !== null && level >= u.maxLevel;
                const cost = prismUpgradeCost(u.id, level);
                return (
                  <Row
                    key={u.id}
                    color={palette.prism}
                    title={u.name}
                    subtext={`${u.desc} · lvl ${level}`}
                    costText={`▲ ${formatWhole(cost, notation)}`}
                    affordable={game.prism.gte(cost)}
                    maxed={maxed}
                    onBuy={() => buyPrismUpgrade(u.id)}
                  />
                );
              })}
            </>
          )}
        </>
      ) : (
        <View style={styles.teaser}>
          <Text style={styles.teaserTitle}>🔒 ASCEND</Text>
          <Text style={styles.teaserText}>
            A deeper reset awakens at ◆ {formatWhole(BAL.ascend.unlockShards, notation)} best
            Shards. It will trade everything below for Prism — and unlock Elements and
            Challenges.
          </Text>
        </View>
      )}

      {game.ascends > 0 && (
        <View style={styles.teaser}>
          <Text style={[styles.teaserTitle, { color: palette.aeon }]}>🔒 CONVERGE</Text>
          <Text style={styles.teaserText}>
            The third layer awakens at ▲ 30 Prism — Minerals, Research and Boost Managers await.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: '#161022',
    borderColor: palette.shard,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  ascendCard: { borderColor: palette.prism, backgroundColor: '#1c1020', marginTop: spacing.lg },
  cardTitle: { color: palette.shard, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  gain: { color: palette.ink, fontSize: 26, fontWeight: '800', marginTop: spacing.sm, ...mono },
  gainLabel: { color: palette.shard, fontSize: 14 },
  detail: { color: palette.dim, fontSize: 11, marginTop: 4, ...mono },
  resets: { color: palette.dim, fontSize: 11, marginTop: spacing.md, textAlign: 'center' },
  keeps: { color: palette.dim, fontSize: 11, marginTop: 2, textAlign: 'center' },
  button: {
    marginTop: spacing.lg,
    backgroundColor: palette.shard,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonLocked: { backgroundColor: palette.panel },
  buttonConfirm: { backgroundColor: palette.danger },
  buttonText: { color: palette.bgDeep, fontSize: 14, fontWeight: '800' },
  buttonConfirmText: { color: palette.ink },
  cancel: { color: palette.dim, fontSize: 12, marginTop: spacing.sm },
  section: {
    color: palette.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  teaser: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  teaserTitle: { color: palette.prism, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  teaserText: { color: palette.dim, fontSize: 11, marginTop: 4, lineHeight: 16 },
});
