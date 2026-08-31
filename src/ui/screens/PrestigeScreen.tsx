/**
 * Prestige tab: the four reset layers and their trees (spec §7, §11).
 *
 * All four layers are ONE card component wearing four hues. They were four
 * hand-built copies of the same JSX before, which is both why they drifted
 * (each had its own gain wording, its own button copy, its own padding) and
 * why the screen read as a wall — nothing distinguished a Collapse from a
 * Unify except the border colour. Now the layer's hue is the only thing that
 * varies, so the depth of the reset is what the eye picks up.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import { formatWhole, format } from '../../game/numbers';
import {
  aeonNodeOwned,
  ascendGain,
  ascendUnlocked,
  canAscend,
  canCollapse,
  canConverge,
  canUnify,
  collapseGain,
  convergeGain,
  convergeUnlocked,
  metaOwned,
  prismUpgradeCost,
  prismUpgradeLevel,
  shardUpgradeCost,
  unifyGain,
  unifyUnlocked,
} from '../../game/systems/prestige';
import { shardUpgradeLevel } from '../../game/systems/shardperks';
import { useGameStore } from '../../state/store';
import { Card, SectionHeader } from '../components/Panel';
import { Row } from '../components/Row';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';

export function PrestigeScreen() {
  const game = useGameStore((s) => s.game);
  const collapse = useGameStore((s) => s.collapse);
  const ascend = useGameStore((s) => s.ascend);
  const buyShardUpgrade = useGameStore((s) => s.buyShardUpgrade);
  const buyPrismUpgrade = useGameStore((s) => s.buyPrismUpgrade);
  const converge = useGameStore((s) => s.converge);
  const buyAeonNode = useGameStore((s) => s.buyAeonNode);
  const unify = useGameStore((s) => s.unify);
  const buyMetaUpgrade = useGameStore((s) => s.buyMetaUpgrade);
  const notation = game.options.notation;

  const showAscend = ascendUnlocked(game);
  const showConverge = convergeUnlocked(game);
  const showUnify = unifyUnlocked(game);
  const needsSeed = !game.research['singularitySeed'] && game.bestAeon.gte(BAL.unify.unlockAeon);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <PrestigeCard
        layer={LAYERS.shard}
        name="Collapse"
        gain={formatWhole(collapseGain(game), notation)}
        ready={canCollapse(game)}
        confirmNeeded={game.options.confirmResets}
        measure={{ label: 'Best Spark this run', value: `${LAYERS.spark.glyph} ${format(game.bestSparkRun, { notation })}` }}
        note={`One Shard per ${(1 / BAL.collapse.perDecade).toFixed(1)} decades of Spark.`}
        resets="Spark, orbiters, Spark upgrades, Motes and upgrades, Dimension Boosts"
        keeps="Shards, Star Chart, Shard upgrades, automation"
        action="Collapse the core"
        locked={`Reach ${LAYERS.spark.glyph} ${format(BAL.collapse.unlockSpark, { notation })} first`}
        onConfirm={collapse}
      />

      <SectionHeader
        label="Shard upgrades"
        accent={palette.shard}
        trailing={
          <Text style={[styles.balance, { color: palette.shard }]}>
            {LAYERS.shard.glyph} {formatWhole(game.shards, notation)}
          </Text>
        }
      />
      {BAL.shardUpgrades.map((u) => {
        const level = shardUpgradeLevel(game, u.id);
        const cost = shardUpgradeCost(u, level);
        return (
          <Row
            key={u.id}
            color={palette.shard}
            title={u.name}
            subtext={`${u.desc} · level ${level}${u.maxLevel !== null ? ` of ${u.maxLevel}` : ''}`}
            costText={`${LAYERS.shard.glyph} ${formatWhole(cost, notation)}`}
            affordable={game.shards.gte(cost)}
            maxed={u.maxLevel !== null && level >= u.maxLevel}
            onBuy={() => buyShardUpgrade(u.id)}
          />
        );
      })}

      {showAscend ? (
        <>
          <PrestigeCard
            layer={LAYERS.prism}
            name="Ascend"
            gain={formatWhole(ascendGain(game), notation)}
            ready={canAscend(game)}
            confirmNeeded={game.options.confirmResets}
            measure={{
              label: 'Shards earned this cycle',
              value: `${LAYERS.shard.glyph} ${formatWhole(game.shardsEver, notation)}`,
            }}
            note={`Opens at ${LAYERS.shard.glyph} ${formatWhole(BAL.ascend.unlockShards, notation)}. Gain grows with the square root.`}
            resets="Everything Collapse does, plus Shards, the Shard tree and the Star Chart"
            keeps="Prism and grid, Elements, trial rewards"
            action="Ascend the gyre"
            locked={`Reach ${LAYERS.shard.glyph} ${formatWhole(BAL.ascend.unlockShards, notation)} Shards first`}
            onConfirm={ascend}
          />

          {game.ascends > 0 && (
            <>
              <SectionHeader
                label="Prism grid"
                accent={palette.prism}
                trailing={
                  <Text style={[styles.balance, { color: palette.prism }]}>
                    {LAYERS.prism.glyph} {formatWhole(game.prism, notation)}
                  </Text>
                }
              />
              {BAL.prismGrid.map((u) => {
                const level = prismUpgradeLevel(game, u.id);
                const cost = prismUpgradeCost(u.id, level);
                return (
                  <Row
                    key={u.id}
                    color={palette.prism}
                    title={u.name}
                    subtext={`${u.desc} · level ${level}`}
                    costText={`${LAYERS.prism.glyph} ${formatWhole(cost, notation)}`}
                    affordable={game.prism.gte(cost)}
                    maxed={u.maxLevel !== null && level >= u.maxLevel}
                    onBuy={() => buyPrismUpgrade(u.id)}
                  />
                );
              })}
            </>
          )}
        </>
      ) : (
        <Teaser
          layer={LAYERS.prism}
          name="Ascend"
          text={`A deeper reset opens at ${LAYERS.shard.glyph} ${formatWhole(BAL.ascend.unlockShards, notation)} Shards. It trades everything below for Prism, and opens Elements and Trials.`}
        />
      )}

      {game.ascends > 0 &&
        (showConverge ? (
          <>
            <PrestigeCard
              layer={LAYERS.aeon}
              name="Converge"
              gain={formatWhole(convergeGain(game), notation)}
              ready={canConverge(game)}
              confirmNeeded={game.options.confirmResets}
              measure={{
                label: 'Prism earned this cycle',
                value: `${LAYERS.prism.glyph} ${formatWhole(game.prismEver, notation)}`,
              }}
              note={`Opens at ${LAYERS.prism.glyph} ${formatWhole(BAL.converge.unlockPrism, notation)}. Every Aeon multiplies all tiers by ${BAL.converge.tierMultPer.toString()}.`}
              resets="Everything Ascend does, plus Prism and grid, Element allocation, Ore and Miners"
              keeps="Aeon and tree, Research, element points, trial rewards"
              action="Converge the rings"
              locked={`Reach ${LAYERS.prism.glyph} ${formatWhole(BAL.converge.unlockPrism, notation)} Prism first`}
              onConfirm={converge}
            />

            {game.converges > 0 && (
              <>
                <SectionHeader
                  label="Aeon tree"
                  accent={palette.aeon}
                  trailing={
                    <Text style={[styles.balance, { color: palette.aeon }]}>
                      {LAYERS.aeon.glyph} {formatWhole(game.aeon, notation)}
                    </Text>
                  }
                />
                {BAL.aeonTree.map((node) => (
                  <Row
                    key={node.id}
                    color={palette.aeon}
                    title={node.name}
                    subtext={node.desc}
                    costText={`${LAYERS.aeon.glyph} ${formatWhole(node.cost, notation)}`}
                    affordable={game.aeon.gte(node.cost)}
                    maxed={aeonNodeOwned(game, node.id)}
                    onBuy={() => buyAeonNode(node.id)}
                  />
                ))}
              </>
            )}

            {showUnify ? (
              <>
                <PrestigeCard
                  layer={LAYERS.singularity}
                  name="Unify"
                  gain={formatWhole(unifyGain(game), notation)}
                  ready={canUnify(game)}
                  confirmNeeded={game.options.confirmResets}
                  measure={{
                    label: 'Aeon earned this cycle',
                    value: `${LAYERS.aeon.glyph} ${formatWhole(game.aeonEver, notation)}`,
                  }}
                  note={`Every Singularity multiplies all production by ${BAL.unify.multPer.toString()} — and never resets again.`}
                  resets="Everything. Aeon and tree, Research, Miners, Flux, and every layer below"
                  keeps="Singularity and Meta Shop, element points, trial rewards"
                  action="Unify the gyre"
                  locked={
                    needsSeed
                      ? 'Research the Singularity Seed first'
                      : `Reach ${LAYERS.aeon.glyph} ${formatWhole(BAL.unify.unlockAeon, notation)} Aeon first`
                  }
                  onConfirm={unify}
                />

                {game.unifies > 0 && (
                  <>
                    <SectionHeader
                      label="Meta shop"
                      accent={palette.singularity}
                      trailing={
                        <Text style={[styles.balance, { color: palette.singularity }]}>
                          {LAYERS.singularity.glyph} {formatWhole(game.singularity, notation)}
                        </Text>
                      }
                    />
                    {BAL.metaShop.map((def) => (
                      <Row
                        key={def.id}
                        color={palette.singularity}
                        title={def.name}
                        subtext={def.desc}
                        costText={`${LAYERS.singularity.glyph} ${formatWhole(def.cost, notation)}`}
                        affordable={game.singularity.gte(def.cost)}
                        maxed={metaOwned(game, def.id)}
                        onBuy={() => buyMetaUpgrade(def.id)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              game.converges > 0 && (
                <Teaser
                  layer={LAYERS.singularity}
                  name="Unify"
                  text={`The last layer opens at ${LAYERS.aeon.glyph} ${formatWhole(BAL.unify.unlockAeon, notation)} Aeon, once the Singularity Seed is researched. It resets everything, for a multiplier that never resets again.`}
                />
              )
            )}
          </>
        ) : (
          <Teaser
            layer={LAYERS.aeon}
            name="Converge"
            text={`The third layer opens at ${LAYERS.prism.glyph} ${formatWhole(BAL.converge.unlockPrism, notation)} Prism. Minerals, Research and Boost Managers come with it.`}
          />
        ))}
    </ScrollView>
  );
}

/**
 * One reset layer.
 *
 * The gain is the loudest thing on the card, because it is the only number
 * the decision turns on. Underneath, what the reset costs and what it spares
 * are a two-column definition list rather than two centred sentences — the
 * player is comparing them, so they have to line up.
 *
 * Confirmation is a state of the same button (spec §14), never a dialog: the
 * button becomes the warning, so the thing you are about to do and the
 * warning about it are in the same place.
 */
function PrestigeCard({
  layer,
  name,
  gain,
  ready,
  confirmNeeded,
  measure,
  note,
  resets,
  keeps,
  action,
  locked,
  onConfirm,
}: {
  layer: { glyph: string; color: string; name: string };
  name: string;
  gain: string;
  ready: boolean;
  confirmNeeded: boolean;
  measure: { label: string; value: string };
  note: string;
  resets: string;
  keeps: string;
  action: string;
  locked: string;
  onConfirm(): void;
}) {
  const [confirming, setConfirming] = useState(false);

  const press = () => {
    if (!ready) return;
    if (confirmNeeded && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onConfirm();
  };

  return (
    <Card accent={layer.color} active={ready} muted={!ready} style={styles.layerCard}>
      <View style={styles.layerHead}>
        <View>
          <Text style={[styles.layerName, { color: layer.color }]}>{name}</Text>
          <Text style={styles.layerNote}>{note}</Text>
        </View>
        <View style={styles.gainBox}>
          <Text style={[styles.gain, { color: ready ? layer.color : palette.faint }]}>
            +{gain}
          </Text>
          <Text style={[styles.gainLabel, { color: ready ? layer.color : palette.faint }]}>
            {layer.glyph} {layer.name}
          </Text>
        </View>
      </View>

      <View style={styles.measure}>
        <Text style={styles.defLabel}>{measure.label}</Text>
        <Text style={styles.measureValue}>{measure.value}</Text>
      </View>

      <View style={styles.def}>
        <Text style={styles.defLabel}>Resets</Text>
        <Text style={styles.defValue}>{resets}</Text>
      </View>
      <View style={styles.def}>
        <Text style={styles.defLabel}>Keeps</Text>
        <Text style={styles.defValue}>{keeps}</Text>
      </View>

      <Pressable
        onPress={press}
        disabled={!ready}
        style={[
          styles.button,
          ready && { backgroundColor: layer.color },
          confirming && styles.buttonConfirm,
        ]}
      >
        <Text style={[styles.buttonText, !ready && styles.buttonTextLocked, confirming && styles.buttonTextConfirm]}>
          {!ready ? locked : confirming ? 'Tap again to confirm' : action}
        </Text>
      </Pressable>
      {confirming && (
        <Pressable onPress={() => setConfirming(false)} style={styles.cancelHit}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      )}
    </Card>
  );
}

/** A layer you can see but not reach yet: outlined, never filled. */
function Teaser({
  layer,
  name,
  text,
}: {
  layer: { glyph: string; color: string };
  name: string;
  text: string;
}) {
  return (
    <View style={[styles.teaser, { borderColor: layer.color }]}>
      <Text style={[styles.teaserTitle, { color: layer.color }]}>
        {layer.glyph} {name} · locked
      </Text>
      <Text style={styles.teaserText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  balance: { ...type.figure, fontSize: 14 },

  layerCard: { marginTop: spacing.lg, padding: spacing.lg },
  layerHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  layerName: { ...type.label, fontSize: 13, letterSpacing: 2.4 },
  layerNote: { ...type.micro, color: palette.dim, marginTop: 4, maxWidth: 200 },
  gainBox: { alignItems: 'flex-end' },
  gain: { ...type.display, fontSize: 28 },
  gainLabel: { ...type.label, fontSize: 9, opacity: 0.8, marginTop: 1 },

  measure: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  measureValue: { ...mono, color: palette.ink, fontSize: 12, fontWeight: '700', flexShrink: 1 },

  /** Resets vs Keeps line up so the trade is readable at a glance. */
  def: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  defLabel: { ...type.label, color: palette.faint, width: 62, paddingTop: 2 },
  defValue: { ...type.micro, color: palette.dim, flex: 1 },

  button: {
    marginTop: spacing.lg,
    backgroundColor: palette.panelHi,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonConfirm: { backgroundColor: palette.danger },
  buttonText: { ...type.label, fontSize: 12, color: palette.bgDeep },
  buttonTextLocked: { color: palette.faint },
  buttonTextConfirm: { color: palette.ink },
  cancelHit: { alignSelf: 'center', padding: spacing.sm },
  cancel: { ...type.micro, color: palette.dim },

  teaser: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    opacity: 0.7,
  },
  teaserTitle: { ...type.label, fontSize: 11 },
  teaserText: { ...type.micro, color: palette.dim, marginTop: 5 },
});
