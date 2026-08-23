/**
 * The orbital stage — Phase 0–2 placeholder for the Phase 8 art pass.
 *
 * A tappable Core plus a readout of Tier-1 orbiters and higher-tier rings.
 * The real canvas renderer (Skia native / Canvas2D web, pooled particles,
 * revolution-driven pulses) replaces the internals in Phase 8; the props
 * contract (read a snapshot, never mutate) is already the final one.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { format, formatWhole } from '../game/numbers';
import { highestUnlockedTier } from '../game/systems/dimensions';
import { tapPower } from '../game/systems/upgrades';
import { useGameStore } from '../state/store';
import { mono, palette, spacing } from '../ui/theme';

export function Stage() {
  const game = useGameStore((s) => s.game);
  const tap = useGameStore((s) => s.tap);
  const [pulse, setPulse] = useState(false);

  const onTap = useCallback(() => {
    tap();
    // A cheap tap "punch" (scale flick) until the Phase 8 particle pass.
    if (!useGameStore.getState().game.options.reducedMotion) {
      setPulse(true);
      setTimeout(() => setPulse(false), 90);
    }
  }, [tap]);

  const notation = game.options.notation;
  const highest = highestUnlockedTier(game);

  return (
    <View style={styles.stage}>
      <Pressable onPress={onTap} style={({ pressed }) => [styles.coreWrap, (pressed || pulse) && styles.corePunch]}>
        <View style={styles.coreGlow}>
          <View style={styles.core}>
            <Text style={styles.coreGlyph}>✦</Text>
          </View>
        </View>
      </Pressable>
      <Text style={styles.tapHint}>tap +{format(tapPower(game), { notation })} ✦</Text>

      <View style={styles.rings}>
        {game.dims.slice(0, highest).map((d, i) => (
          <View key={i} style={styles.ring}>
            <Text style={[styles.ringLabel, i === 0 && { color: palette.orbiter }]}>T{i + 1}</Text>
            <Text style={styles.ringValue}>{formatWhole(d.amount, notation)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  coreWrap: { transform: [{ scale: 1 }] },
  corePunch: { transform: [{ scale: 1.08 }] },
  coreGlow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2a2113',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.coreDeep,
    borderColor: palette.coreHighlight,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreGlyph: { color: palette.coreHighlight, fontSize: 40 },
  tapHint: { color: palette.dim, fontSize: 11, marginTop: spacing.sm, ...mono },
  rings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ring: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    minWidth: 64,
  },
  ringLabel: { color: palette.dim, fontSize: 10, fontWeight: '700' },
  ringValue: { color: palette.ink, fontSize: 12, fontWeight: '700', ...mono },
});
