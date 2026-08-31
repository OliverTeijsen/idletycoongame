/** "While you were away" summary (spec §5, §14). */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { format, formatTime } from '../../game/numbers';
import { adService } from '../../services/ads';
import { useGameStore } from '../../state/store';
import { LAYERS, mono, palette, radius, spacing, type } from '../theme';

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
          <Text style={styles.title}>While you were away</Text>
          <Text style={styles.time}>{formatTime(summary.seconds)}</Text>
          {summary.sparkGained.gt(0) && (
            <Text style={[styles.gain, { color: palette.core }]}>
              {LAYERS.spark.glyph} +{format(summary.sparkGained, { notation })} Spark
            </Text>
          )}
          {summary.motesGained.gt(0) && (
            <Text style={[styles.gain, { color: palette.mote }]}>
              {LAYERS.mote.glyph} +{format(summary.motesGained, { notation })} Motes
            </Text>
          )}
          {summary.oreGained.gt(0) && (
            <Text style={[styles.gain, { color: palette.ore }]}>
              {LAYERS.ore.glyph} +{format(summary.oreGained, { notation })} Ore
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
    borderTopColor: palette.core,
    borderTopWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  title: { ...type.label, color: palette.faint },
  time: { ...type.display, color: palette.ink, marginVertical: spacing.sm },
  gain: { ...type.figure, fontSize: 15, marginTop: 4 },
  gainNone: { ...type.body, color: palette.dim, marginTop: 4, textAlign: 'center' },
  button: {
    marginTop: spacing.lg,
    backgroundColor: palette.core,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { ...type.label, fontSize: 12, color: palette.bgDeep },
  rewardButton: { backgroundColor: palette.orbiter, marginBottom: spacing.sm },
  rewardText: { ...type.label, fontSize: 12, color: palette.bgDeep },
  buttonBusy: { opacity: 0.6 },
});
