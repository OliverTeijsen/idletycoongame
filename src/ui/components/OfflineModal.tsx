/** "While you were away" summary (spec §5, §14). */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { format, formatTime } from '../../game/numbers';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

export function OfflineModal() {
  const summary = useGameStore((s) => s.offlineSummary);
  const dismiss = useGameStore((s) => s.dismissOffline);
  const notation = useGameStore((s) => s.game.options.notation);
  if (!summary) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>WHILE YOU WERE AWAY</Text>
          <Text style={styles.time}>{formatTime(summary.seconds)}</Text>
          {summary.sparkGained.gt(0) && (
            <Text style={[styles.gain, { color: palette.core }]}>
              ✦ +{format(summary.sparkGained, { notation })} Spark
            </Text>
          )}
          {summary.motesGained.gt(0) && (
            <Text style={[styles.gain, { color: palette.mote }]}>
              ◦ +{format(summary.motesGained, { notation })} Motes
            </Text>
          )}
          {summary.oreGained.gt(0) && (
            <Text style={[styles.gain, { color: '#a3e635' }]}>
              ⛏ +{format(summary.oreGained, { notation })} Ore
            </Text>
          )}
          {summary.fluxGained.gt(0) && (
            <Text style={[styles.gain, { color: palette.aeon }]}>
              ⧗ +{format(summary.fluxGained, { notation })} Flux (overflow)
            </Text>
          )}
          {summary.sparkGained.lte(0) && summary.motesGained.lte(0) && (
            <Text style={styles.gainNone}>Your orbiters were idle — buy one to earn offline.</Text>
          )}
          <Pressable style={styles.button} onPress={dismiss}>
            <Text style={styles.buttonText}>Collect</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  title: { color: palette.dim, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  time: { color: palette.ink, fontSize: 22, fontWeight: '800', marginVertical: spacing.sm, ...mono },
  gain: { fontSize: 15, fontWeight: '700', marginTop: 4, ...mono },
  gainNone: { color: palette.dim, fontSize: 12, marginTop: 4, textAlign: 'center' },
  button: {
    marginTop: spacing.lg,
    backgroundColor: palette.coreDeep,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { color: palette.bgDeep, fontSize: 14, fontWeight: '800' },
});
