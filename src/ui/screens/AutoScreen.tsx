/** Auto tab (spec §8.7): autobuyer toggles. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AUTOMATION_IDS,
  AutomationId,
  autobuyerAvailable,
  autobuyerEnabled,
} from '../../game/systems/automation';
import { autobuyInterval } from '../../game/systems/shardperks';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

const LABELS: Record<AutomationId, { title: string; desc: string }> = {
  dim1: { title: 'Auto: Tier 1 Orbiters', desc: 'buys max each pass' },
  dim2: { title: 'Auto: Tier 2 Orbiters', desc: 'buys max each pass' },
  dim3: { title: 'Auto: Tier 3 Orbiters', desc: 'buys max each pass' },
  dim4: { title: 'Auto: Tier 4 Orbiters', desc: 'needs the Fourth Servo star node' },
  sparkUpgrades: { title: 'Auto: Spark upgrades', desc: 'buys every affordable level' },
  moteUpgrades: { title: 'Auto: Mote upgrades', desc: 'buys every affordable level' },
};

export function AutoScreen() {
  const game = useGameStore((s) => s.game);
  const toggle = useGameStore((s) => s.toggleAutobuyer);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.blurb}>
        Autobuyers run every {autobuyInterval(game).toFixed(2)}s (Swift Servos in the Prestige tab
        makes them faster). Higher tiers buy first so Tier 1 cannot starve them.
      </Text>
      {AUTOMATION_IDS.map((id) => {
        const available = autobuyerAvailable(game, id);
        const enabled = autobuyerEnabled(game, id);
        return (
          <Pressable
            key={id}
            onPress={() => available && toggle(id)}
            style={[styles.row, !available && styles.rowLocked]}
          >
            <View style={styles.body}>
              <Text style={styles.title}>{LABELS[id].title}</Text>
              <Text style={styles.desc}>{available ? LABELS[id].desc : `🔒 ${LABELS[id].desc}`}</Text>
            </View>
            <Text style={[styles.state, available && enabled && styles.stateOn]}>
              {!available ? '—' : enabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  blurb: { color: palette.dim, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLocked: { opacity: 0.5 },
  body: { flex: 1 },
  title: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  desc: { color: palette.dim, fontSize: 11, marginTop: 2 },
  state: { color: palette.dim, fontSize: 12, fontWeight: '800', ...mono },
  stateOn: { color: palette.orbiter },
});
