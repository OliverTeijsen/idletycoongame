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
import { LAYERS, mono, palette, radius, spacing, type } from '../ui/theme';
import { Scene, SceneInput, defaultSceneConfig, drawnPerBand } from './scene';
import { StageCanvas } from './StageCanvas';
import { Palette } from './sprites';

const STAGE_SIZE = 264;

const CANVAS_PALETTE: Palette = {
  bg: palette.bgDeep,
  // Orbit paths sit one step brighter than a normal hairline: they are the
  // instrument's graticule, and they have to read against the core's glow.
  path: palette.lineHi,
  core: palette.coreDeep,
  coreEdge: palette.coreHighlight,
  coreGlow: 'rgba(255, 182, 72, 0.22)',
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
      {/*
        The well. The canvas is recessed into the darkest ground in the app
        and lit from inside, so the core reads as the one light source the
        whole palette is built around — that bleed is the point of the
        instrument-plate direction, not an effect on top of it.
      */}
      <View style={styles.well}>
        <StageCanvas
          scene={scene}
          inputRef={inputRef}
          size={STAGE_SIZE}
          palette={CANVAS_PALETTE}
          onTap={onTap}
        />
      </View>
      <StageReadout />
      <TierCounters />
    </View>
  );
}

/**
 * The instrument readout beneath the well (spec §11): what a tap is worth on
 * the left, what the whole multiplier stack is worth on the right, split by a
 * hairline. Text only, so it re-renders on store changes without ever
 * touching the canvas.
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
      <View style={styles.readoutCell}>
        <Text style={styles.readoutLabel}>Per tap</Text>
        <Text style={[styles.readoutValue, { color: palette.core }]}>
          +{tapText} {LAYERS.spark.glyph}
        </Text>
      </View>
      <View style={styles.readoutDivider} />
      <View style={[styles.readoutCell, styles.readoutRight]}>
        <Text style={styles.readoutLabel}>All production</Text>
        <Text style={[styles.readoutValue, { color: palette.orbiter }]}>×{multText}</Text>
      </View>
    </View>
  );
}

/**
 * The tier strip: one continuous plate divided by hairlines rather than eight
 * separate pills. Orbiters are one chain, so they are drawn as one object.
 */
function TierCounters() {
  const game = useGameStore((s) => s.game);
  const highest = highestUnlockedTier(game);
  return (
    <View style={styles.strip}>
      {game.dims.slice(0, highest).map((d, i) => (
        <View key={i} style={[styles.cell, i > 0 && styles.cellDivided]}>
          <Text style={[styles.cellLabel, i === 0 && { color: palette.orbiter }]}>T{i + 1}</Text>
          <Text style={styles.cellValue} numberOfLines={1}>
            {formatWhole(d.amount, game.options.notation)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: spacing.md },
  well: {
    borderRadius: STAGE_SIZE,
    backgroundColor: palette.bgDeep,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: 'hidden',
    // The bleed. Maps to box-shadow on web and elevation-free glow on iOS;
    // Android simply drops it, which costs nothing the layout depends on.
    shadowColor: palette.core,
    shadowOpacity: 0.22,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 0 },
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
  readoutCell: { flex: 1, gap: 2 },
  readoutRight: { alignItems: 'flex-end' },
  readoutDivider: { width: 1, height: 26, backgroundColor: palette.line },
  readoutLabel: { ...type.label, color: palette.faint },
  readoutValue: { ...type.figure, fontSize: 17 },
  strip: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: spacing.md,
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 2 },
  cellDivided: { borderLeftWidth: 1, borderLeftColor: palette.line },
  cellLabel: { ...type.label, fontSize: 9, color: palette.faint },
  cellValue: { ...mono, color: palette.ink, fontSize: 12, fontWeight: '700', marginTop: 2 },
});
