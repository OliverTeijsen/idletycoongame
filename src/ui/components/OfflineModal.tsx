/** "While you were away" summary (spec §5, §14). */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { format, formatTime } from '../../game/numbers';
import { adService } from '../../services/ads';
import { useGameStore } from '../../state/store';
import { mono, palette, spacing } from '../theme';

export function OfflineModal() {
  const summary = useGameStore((s) => s.offlineSummary);
  const dismiss = useGameStore((s) => s.dismissOffline);
  const watchRewarded = useGameStore((s) => s.watchRewarded);
  const notation = useGameStore((s) => s.game.options.notation);
  const [busy, setBusy] = useState(false);
  if (!summary) return null;

  const gainedSomething = summary.sparkGained.gt(0) || summary.motesGained.gt(0);
  const canDouble = gainedSomething && !summary.doubled && adService.isAvailable('offline');

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
          {/* MONETIZATION CALL SITE (spec §15): rewarded "double offline".
              Hidden entirely unless a configured ad is actually available,
              so the game never shows a button that cannot pay out. */}
          {canDouble && (
            <Pressable
              style={[styles.button, styles.rewardButton, busy && styles.buttonBusy]}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                await watchRewarded('offline');
                setBusy(false);
              }}
            >
              <Text style={styles.rewardText}>
                {busy ? 'loading…' : '▶  Watch an ad to DOUBLE it'}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.button} onPress={dismiss}>
            <Text style={styles.buttonText}>{summary.doubled ? 'Collect ×2' : 'Collect'}</Text>
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
  rewardButton: { backgroundColor: palette.orbiter, marginBottom: spacing.sm },
  rewardText: { color: palette.bgDeep, fontSize: 13, fontWeight: '800' },
  buttonBusy: { opacity: 0.6 },
});
