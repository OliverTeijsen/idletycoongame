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
import { mono, palette, spacing } from '../theme';

const GROUP_LABELS: Record<string, string> = {
  spark: 'SPARK',
  orbiters: 'ORBITERS',
  motes: 'MOTES',
  prestige: 'PRESTIGE',
  depths: 'THE DEPTHS',
  mastery: 'MASTERY',
};

export function StatsScreen() {
  const game = useGameStore((s) => s.game);
  const notation = game.options.notation;
  const [showAll, setShowAll] = useState(false);

  const breakdown = multBreakdown(game);
  const earned = achievementCount(game);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.section}>MULTIPLIER STACK</Text>
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

      <Text style={styles.section}>RATES</Text>
      <Stat label="Spark / second" value={`✦ ${format(sparkRate(game), { notation })}`} />
      <Stat label="Motes / second" value={`◦ ${format(moteRate(game), { notation, small: true })}`} />
      {game.converges > 0 && (
        <Stat label="Ore / second" value={`⛏ ${format(oreRate(game), { notation, small: true })}`} />
      )}

      <Text style={styles.section}>LIFETIME</Text>
      <Stat label="Total Spark earned" value={`✦ ${format(game.totalSpark, { notation })}`} />
      <Stat label="Best Spark this run" value={`✦ ${format(game.bestSparkRun, { notation })}`} />
      <Stat label="Motes ever" value={`◦ ${format(game.motesEver, { notation })}`} />
      <Stat label="Shards ever" value={`◆ ${formatWhole(game.shardsEver, notation)}`} />
      <Stat label="Prism ever" value={`▲ ${formatWhole(game.prismEver, notation)}`} />
      <Stat label="Aeon ever" value={`✧ ${formatWhole(game.aeonEver, notation)}`} />
      <Stat label="Singularity ever" value={`⦿ ${formatWhole(game.singularityEver, notation)}`} />

      <Text style={styles.section}>RESETS</Text>
      <Stat label="Dimension Boosts" value={String(game.dimBoosts)} />
      <Stat label="Collapses" value={String(game.collapses)} />
      <Stat label="Ascends" value={String(game.ascends)} />
      <Stat label="Converges" value={String(game.converges)} />
      <Stat label="Unifies" value={String(game.unifies)} />
      <Stat label="Core taps" value={String(game.totalTaps)} />
      <Stat label="Time played" value={formatTime(game.timePlayed)} />

      <Text style={styles.section}>
        ACHIEVEMENTS · {earned}/{ACHIEVEMENTS.length} · ×
        {format(breakdown[0].value, { notation })}
      </Text>
      <Pressable style={styles.toggle} onPress={() => setShowAll((v) => !v)}>
        <Text style={styles.toggleText}>{showAll ? 'show earned only' : 'show all'}</Text>
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
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  section: {
    color: palette.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  blurb: { color: palette.dim, fontSize: 11, lineHeight: 16, marginBottom: spacing.sm },
  multRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  multTotal: { borderBottomWidth: 0, marginTop: 4, borderTopWidth: 1, borderTopColor: palette.core },
  multLabel: { color: palette.ink, fontSize: 12 },
  multLabelTotal: { color: palette.core, fontWeight: '800' },
  multValue: { fontSize: 12, fontWeight: '700', ...mono },
  multActive: { color: palette.orbiter },
  multIdle: { color: palette.dim, opacity: 0.6 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statLabel: { color: palette.dim, fontSize: 12 },
  statValue: { color: palette.ink, fontSize: 12, fontWeight: '700', ...mono },
  toggle: {
    alignSelf: 'flex-start',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleText: { color: palette.dim, fontSize: 11 },
  groupLabel: {
    color: palette.dim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: 4,
    opacity: 0.7,
  },
  achRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
    gap: spacing.sm,
    opacity: 0.55,
  },
  achRowGot: { opacity: 1, borderColor: palette.core },
  achMark: { color: palette.dim, fontSize: 14, width: 16, textAlign: 'center' },
  achMarkGot: { color: palette.core },
  achBody: { flex: 1 },
  achName: { color: palette.dim, fontSize: 12, fontWeight: '700' },
  achNameGot: { color: palette.ink },
  achDesc: { color: palette.dim, fontSize: 10, marginTop: 1 },
});
