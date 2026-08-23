/** Auto tab (spec §8.7): autobuyer toggles. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BAL } from '../../game/balance';
import {
  AUTOMATION_IDS,
  AutomationId,
  autobuyerAvailable,
  autobuyerEnabled,
} from '../../game/systems/automation';
import { managerAssigned, managerSlots, managersUnlocked } from '../../game/systems/managers';
import { autobuyInterval } from '../../game/systems/shardperks';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

const LABELS: Record<AutomationId, { title: string; desc: string }> = {
  dim1: { title: 'Auto: Tier 1 Orbiters', desc: 'buys max each pass' },
  dim2: { title: 'Auto: Tier 2 Orbiters', desc: 'buys max each pass' },
  dim3: { title: 'Auto: Tier 3 Orbiters', desc: 'buys max each pass' },
  dim4: { title: 'Auto: Tier 4 Orbiters', desc: 'Fourth Servo star node, or Ascend' },
  dim5: { title: 'Auto: Tier 5 Orbiters', desc: 'unlocks at Ascend' },
  dim6: { title: 'Auto: Tier 6 Orbiters', desc: 'unlocks at Ascend' },
  dim7: { title: 'Auto: Tier 7 Orbiters', desc: 'unlocks at Ascend' },
  dim8: { title: 'Auto: Tier 8 Orbiters', desc: 'unlocks at Ascend' },
  sparkUpgrades: { title: 'Auto: Spark upgrades', desc: 'buys every affordable level' },
  moteUpgrades: { title: 'Auto: Mote upgrades', desc: 'buys every affordable level' },
  dimBoost: { title: 'Auto: Dimension Boost', desc: 'boosts the moment it can (Ascend)' },
  autoCollapse: { title: 'Auto: Collapse', desc: 'Standing Wave aeon node · collapses when worthwhile' },
};

export function AutoScreen() {
  const game = useGameStore((s) => s.game);
  const toggle = useGameStore((s) => s.toggleAutobuyer);
  const toggleMgr = useGameStore((s) => s.toggleManager);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {managersUnlocked(game) && (
        <>
          <Text style={styles.section}>
            BOOST MANAGERS · {game.boostSlots.length}/{managerSlots(game)} slots
          </Text>
          <Text style={styles.blurb}>
            Assign managers to your limited slots — Research adds more. Tap to swap.
          </Text>
          {BAL.managers.defs.map((def) => {
            const assigned = managerAssigned(game, def.id);
            const slotsFull = !assigned && game.boostSlots.length >= managerSlots(game);
            return (
              <Pressable
                key={def.id}
                onPress={() => toggleMgr(def.id)}
                style={[styles.row, assigned && styles.rowAssigned, slotsFull && styles.rowLocked]}
              >
                <View style={styles.body}>
                  <Text style={styles.title}>{def.name}</Text>
                  <Text style={styles.desc}>{def.desc}</Text>
                </View>
                <Text style={[styles.state, assigned && styles.stateOn]}>
                  {assigned ? 'ASSIGNED' : slotsFull ? 'FULL' : 'BENCH'}
                </Text>
              </Pressable>
            );
          })}
          <Text style={styles.section}>AUTOBUYERS</Text>
        </>
      )}
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
  section: {
    color: palette.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowAssigned: { borderColor: palette.aeon, backgroundColor: '#0d1a24' },
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
