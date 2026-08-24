/**
 * The orbital stage (spec §12).
 *
 * React's only jobs here: own the Scene, keep a mutable snapshot ref fresh,
 * and render the tier counters. The frame loop lives in the backend and reads
 * that ref, so nothing re-renders at 60fps — the §12 performance budget.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { format, formatWhole } from '../game/numbers';
import { highestUnlockedTier } from '../game/systems/dimensions';
import { globalMult, speedMult } from '../game/systems/multipliers';
import { motesUnlocked } from '../game/systems/motes';
import { tapPower } from '../game/systems/upgrades';
import { useGameStore } from '../state/store';
import { mono, palette, spacing } from '../ui/theme';
import { Scene, SceneInput, defaultSceneConfig, drawnPerBand } from './scene';
import { StageCanvas } from './StageCanvas';
import { Palette } from './sprites';

const STAGE_SIZE = 240;

const CANVAS_PALETTE: Palette = {
  bg: palette.bg,
  path: palette.line,
  core: palette.coreDeep,
  coreEdge: palette.coreHighlight,
  coreGlow: 'rgba(255, 191, 92, 0.18)',
};

/** Which layer's colour a prestige flash uses (deepest wins). */
const FLASH_COLORS = {
  unify: '#ffffff',
  converge: palette.aeon,
  ascend: palette.prism,
  collapse: palette.shard,
};

export function Stage() {
  const tap = useGameStore((s) => s.tap);
  const scene = useMemo(() => new Scene(defaultSceneConfig(STAGE_SIZE)), []);

  // The snapshot the frame loop reads. Mutated, never re-created, so updating
  // it costs nothing and triggers no render.
  const inputRef = useRef<SceneInput>({
    drawnPerBand: [0, 0, 0],
    speed: 1,
    reducedMotion: false,
    motesActive: false,
  });

  // Subscribe outside React's render path: recompute the snapshot on every
  // store change without ever setting component state.
  useEffect(() => {
    const apply = (game: ReturnType<typeof useGameStore.getState>['game']) => {
      const input = inputRef.current;
      const bands = drawnPerBand(game.dims[0].amount.toNumber());
      input.drawnPerBand[0] = bands[0];
      input.drawnPerBand[1] = bands[1];
      input.drawnPerBand[2] = bands[2];
      input.speed = speedMult(game).toNumber();
      input.reducedMotion = game.options.reducedMotion;
      input.motesActive = motesUnlocked(game);
    };
    apply(useGameStore.getState().game);
    return useGameStore.subscribe((s) => apply(s.game));
  }, []);

  // Prestige FX: fire the flash when a reset counter changes.
  const prevResets = useRef({ collapses: 0, ascends: 0, converges: 0, unifies: 0 });
  useEffect(() => {
    const seed = useGameStore.getState().game;
    prevResets.current = {
      collapses: seed.collapses,
      ascends: seed.ascends,
      converges: seed.converges,
      unifies: seed.unifies,
    };
    return useGameStore.subscribe((s) => {
      const g = s.game;
      const was = prevResets.current;
      if (
        g.collapses === was.collapses &&
        g.ascends === was.ascends &&
        g.converges === was.converges &&
        g.unifies === was.unifies
      )
        return;
      const color =
        g.unifies > was.unifies
          ? FLASH_COLORS.unify
          : g.converges > was.converges
            ? FLASH_COLORS.converge
            : g.ascends > was.ascends
              ? FLASH_COLORS.ascend
              : FLASH_COLORS.collapse;
      prevResets.current = {
        collapses: g.collapses,
        ascends: g.ascends,
        converges: g.converges,
        unifies: g.unifies,
      };
      scene.triggerFlash(color, g.options.reducedMotion);
    });
  }, [scene]);

  const onTap = useCallback(() => {
    const game = useGameStore.getState().game;
    const label = `+${format(tapPower(game), { notation: game.options.notation })}`;
    tap();
    scene.tap(inputRef.current.reducedMotion, label);
  }, [tap, scene]);

  return (
    <View style={styles.wrap}>
      <StageCanvas
        scene={scene}
        inputRef={inputRef}
        size={STAGE_SIZE}
        palette={CANVAS_PALETTE}
        onTap={onTap}
      />
      <StageReadout />
      <TierCounters />
    </View>
  );
}

/**
 * Tap value + the global-multiplier readout (spec §11). Text only, so it
 * re-renders on store changes without ever touching the canvas.
 */
function StageReadout() {
  const tapText = useGameStore((s) =>
    format(tapPower(s.game), { notation: s.game.options.notation }),
  );
  const multText = useGameStore((s) =>
    format(globalMult(s.game), { notation: s.game.options.notation }),
  );
  return (
    <View style={styles.readout}>
      <Text style={styles.tapHint}>tap +{tapText} ✦</Text>
      <Text style={styles.multReadout}>×{multText} global</Text>
    </View>
  );
}

function TierCounters() {
  const game = useGameStore((s) => s.game);
  const highest = highestUnlockedTier(game);
  return (
    <View style={styles.rings}>
      {game.dims.slice(0, highest).map((d, i) => (
        <View key={i} style={styles.ring}>
          <Text style={[styles.ringLabel, i === 0 && { color: palette.orbiter }]}>T{i + 1}</Text>
          <Text style={styles.ringValue}>{formatWhole(d.amount, game.options.notation)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.md },
  readout: { alignItems: 'center', marginTop: 2, gap: 1 },
  tapHint: { color: palette.dim, fontSize: 11, ...mono },
  multReadout: { color: palette.orbiter, fontSize: 12, fontWeight: '700', ...mono },
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
