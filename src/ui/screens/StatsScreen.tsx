/**
 * Stats tab (spec §11): the multiplier-stack breakdown, lifetime totals,
 * per-second rates, achievement progress and time played. This is the screen
 * that makes §9's composition legible — to players and to whoever is
 * balancing the game.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { format, formatTime, formatWhole } from '../../game/numbers';
import {
  ACHIEVEMENTS,
  achievementCount,
  achievementUnlocked,
} from '../../game/systems/achievements';
import { sparkRate } from '../../game/systems/dimensions';
import { oreRate } from '../../game/systems/minerals';
import { moteRate } from '../../game/systems/motes';
import { multBreakdown } from '../../game/systems/multipliers';
import { useGameStore } from '../../state/store';
import { SectionHeader } from '../components/Panel';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';

const GROUP_LABELS: Record<string, string> = {
  spark: 'Spark',
  orbiters: 'Orbiters',
  motes: 'Motes',
  prestige: 'Prestige',
  depths: 'The depths',
  mastery: 'Mastery',
};

export function StatsScreen() {
  const game = useGameStore((s) => s.game);
  const notation = game.options.notation;
  const [showAll, setShowAll] = useState(false);

  const breakdown = multBreakdown(game);
  const earned = achievementCount(game);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <SectionHeader label="Multiplier stack" accent={palette.core} />
      <Text style={styles.blurb}>
        Every source that feeds production, composed in order. ×1.00 means that source is not
        contributing yet.
      </Text>
      {breakdown.map((entry) => {
        const isTotal = entry.label.includes('total');
        const active = entry.value.gt(1);
        return (
          <View key={entry.label} style={[styles.multRow, isTotal && styles.multTotal]}>
            <Text style={[styles.multLabel, isTotal && styles.multLabelTotal]}>{entry.label}</Text>
            <Text
              style={[
                styles.multValue,
                active ? styles.multActive : styles.multIdle,
                isTotal && styles.multLabelTotal,
              ]}
            >
              ×{format(entry.value, { notation })}
            </Text>
          </View>
        );
      })}

      <SectionHeader label="Rates" accent={palette.orbiter} />
      <Stat label="Spark / second" value={`${LAYERS.spark.glyph} ${format(sparkRate(game), { notation })}`} />
      <Stat label="Motes / second" value={`${LAYERS.mote.glyph} ${format(moteRate(game), { notation, small: true })}`} />
      {game.converges > 0 && (
        <Stat label="Ore / second" value={`${LAYERS.ore.glyph} ${format(oreRate(game), { notation, small: true })}`} />
      )}

      <SectionHeader label="Lifetime" accent={palette.dim} />
      <Stat label="Total Spark earned" value={`${LAYERS.spark.glyph} ${format(game.totalSpark, { notation })}`} />
      <Stat label="Best Spark this run" value={`${LAYERS.spark.glyph} ${format(game.bestSparkRun, { notation })}`} />
      <Stat label="Motes ever" value={`${LAYERS.mote.glyph} ${format(game.motesEver, { notation })}`} />
      <Stat label="Shards ever" value={`${LAYERS.shard.glyph} ${formatWhole(game.shardsEver, notation)}`} />
      <Stat label="Prism ever" value={`${LAYERS.prism.glyph} ${formatWhole(game.prismEver, notation)}`} />
      <Stat label="Aeon ever" value={`${LAYERS.aeon.glyph} ${formatWhole(game.aeonEver, notation)}`} />
      <Stat label="Singularity ever" value={`${LAYERS.singularity.glyph} ${formatWhole(game.singularityEver, notation)}`} />

      <SectionHeader label="Resets" accent={palette.shard} />
      <Stat label="Dimension Boosts" value={String(game.dimBoosts)} />
      <Stat label="Collapses" value={String(game.collapses)} />
      <Stat label="Ascends" value={String(game.ascends)} />
      <Stat label="Converges" value={String(game.converges)} />
      <Stat label="Unifies" value={String(game.unifies)} />
      <Stat label="Core taps" value={String(game.totalTaps)} />
      <Stat label="Time played" value={formatTime(game.timePlayed)} />

      <SectionHeader
        label="Achievements"
        accent={palette.core}
        trailing={
          <Text style={styles.statValue}>
            {earned}/{ACHIEVEMENTS.length} · ×{format(breakdown[0].value, { notation })}
          </Text>
        }
      />
      <Pressable style={styles.toggle} onPress={() => setShowAll((v) => !v)}>
        <Text style={styles.toggleText}>{showAll ? 'Show earned only' : 'Show all'}</Text>
      </Pressable>
      {Object.keys(GROUP_LABELS).map((group) => {
        const defs = ACHIEVEMENTS.filter((a) => a.group === group);
        const visible = showAll ? defs : defs.filter((a) => achievementUnlocked(game, a.id));
        if (visible.length === 0) return null;
        return (
          <View key={group}>
            <Text style={styles.groupLabel}>{GROUP_LABELS[group]}</Text>
            {visible.map((def) => {
              const got = achievementUnlocked(game, def.id);
              return (
                <View key={def.id} style={[styles.achRow, got && styles.achRowGot]}>
                  <Text style={[styles.achMark, got && styles.achMarkGot]}>{got ? '★' : '☆'}</Text>
                  <View style={styles.achBody}>
                    <Text style={[styles.achName, got && styles.achNameGot]}>{def.name}</Text>
                    <Text style={styles.achDesc}>{def.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { ...type.micro, color: palette.dim, marginBottom: spacing.sm },
  multRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  multTotal: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 1, borderTopColor: palette.core },
  multLabel: { ...type.body, color: palette.dim },
  multLabelTotal: { color: palette.core, fontWeight: '700' },
  multValue: { fontSize: 12, fontWeight: '700', ...mono },
  multActive: { color: palette.ink },
  /** A multiplier sitting at exactly x1 is noise — recede it, don't hide it. */
  multIdle: { color: palette.faint },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statLabel: { ...type.body, color: palette.dim },
  statValue: { color: palette.ink, fontSize: 12, fontWeight: '700', ...mono },
  toggle: {
    alignSelf: 'flex-start',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleText: { ...type.micro, color: palette.dim },
  groupLabel: { ...type.label, color: palette.faint, marginTop: spacing.md, marginBottom: 4 },
  achRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bg,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
    gap: spacing.sm,
  },
  achRowGot: { backgroundColor: palette.panel, borderColor: palette.core },
  achMark: { color: palette.faint, fontSize: 13, width: 16, textAlign: 'center' },
  achMarkGot: { color: palette.core },
  achBody: { flex: 1 },
  achName: { ...type.title, fontSize: 12, color: palette.faint },
  achNameGot: { color: palette.ink },
  achDesc: { ...type.micro, fontSize: 10, color: palette.faint, marginTop: 1 },
});
