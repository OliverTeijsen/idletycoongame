/**
 * The orbital stage (spec §12), animated with core RN Animated:
 *
 *  - Orbiter dots revolve on up to three radius bands; each band is ONE
 *    looping rotation animation on a container view, so React never
 *    re-renders per frame. Rotation speed tracks the real speedMult
 *    (quantized, so the loop only restarts on meaningful changes).
 *  - The Core breathes on a slow loop and punches on tap.
 *  - Taps emit pooled floating "+N ✦" numbers.
 *  - Collapse/Ascend trigger a full-stage flash themed per layer.
 *
 * All motion is gated by the game's reducedMotion option (static sprites,
 * instant numbers, no loops).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { format, formatWhole } from '../game/numbers';
import { highestUnlockedTier } from '../game/systems/dimensions';
import { speedMult } from '../game/systems/multipliers';
import { tapPower } from '../game/systems/upgrades';
import { useGameStore } from '../state/store';
import { mono, palette, spacing } from '../ui/theme';

const NATIVE = Platform.OS !== 'web';
const STAGE = 240;
const CENTER = STAGE / 2;

// ---------------------------------------------------------------------------
// Orbit ring: one rotation loop per band
// ---------------------------------------------------------------------------

function OrbitRing({
  radius,
  dots,
  seconds,
  color,
  reduced,
}: {
  radius: number;
  dots: number;
  seconds: number;
  color: string;
  reduced: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loop.current?.stop();
    if (reduced || dots <= 0) return;
    loop.current = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: Math.max(900, seconds * 1000),
        easing: Easing.linear,
        useNativeDriver: NATIVE,
      }),
    );
    loop.current.start();
    return () => loop.current?.stop();
  }, [spin, seconds, dots, reduced]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const dotViews = useMemo(() => {
    const views = [];
    for (let i = 0; i < dots; i++) {
      const angle = (i / dots) * Math.PI * 2;
      views.push(
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              shadowColor: color,
              left: CENTER + radius * Math.cos(angle) - 3,
              top: CENTER + radius * Math.sin(angle) - 3,
            },
          ]}
        />,
      );
    }
    return views;
  }, [dots, radius, color]);

  if (dots <= 0) return null;
  return (
    <>
      <View style={[styles.orbitPath, { width: radius * 2, height: radius * 2, borderRadius: radius, left: CENTER - radius, top: CENTER - radius }]} />
      <Animated.View style={[styles.ringLayer, { transform: [{ rotate }] }]} pointerEvents="none">
        {dotViews}
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Floating tap numbers
// ---------------------------------------------------------------------------

interface Floater {
  key: number;
  text: string;
  x: number;
}

function FloatingNumber({ floater, onDone }: { floater: Floater; onDone(key: number): void }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE,
    }).start(() => onDone(floater.key));
  }, [anim, floater.key, onDone]);
  return (
    <Animated.Text
      style={[
        styles.floater,
        {
          left: CENTER - 40 + floater.x,
          opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -56] }) },
          ],
        },
      ]}
      pointerEvents="none"
    >
      {floater.text}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// Prestige flash
// ---------------------------------------------------------------------------

function PrestigeFlash({ reduced }: { reduced: boolean }) {
  const collapses = useGameStore((s) => s.game.collapses);
  const ascends = useGameStore((s) => s.game.ascends);
  const converges = useGameStore((s) => s.game.converges);
  const unifies = useGameStore((s) => s.game.unifies);
  const anim = useRef(new Animated.Value(0)).current;
  const [color, setColor] = useState<string>(palette.shard);
  const prev = useRef({ collapses, ascends, converges, unifies });

  useEffect(() => {
    const was = prev.current;
    prev.current = { collapses, ascends, converges, unifies };
    if (reduced) return;
    if (
      collapses === was.collapses &&
      ascends === was.ascends &&
      converges === was.converges &&
      unifies === was.unifies
    )
      return;
    // Deepest layer wins the flash: Unify white-out > Converge > Ascend > Collapse (§12).
    setColor(
      unifies > was.unifies
        ? '#ffffff'
        : converges > was.converges
          ? palette.aeon
          : ascends > was.ascends
            ? palette.prism
            : palette.shard,
    );
    anim.setValue(0.9);
    Animated.timing(anim, {
      toValue: 0,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start();
  }, [collapses, ascends, converges, unifies, anim, reduced]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: anim }]}
    />
  );
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

/** Quantize so the ring loops only restart on meaningful speed changes. */
function quantizeSpeed(raw: number): number {
  const clamped = Math.min(24, Math.max(0.5, raw));
  return Math.round(clamped * 4) / 4;
}

export function Stage() {
  const tap = useGameStore((s) => s.tap);
  const reduced = useGameStore((s) => s.game.options.reducedMotion);
  // Dot counts change rarely (log-ish thresholds), so this selector keeps
  // stage re-renders rare even though amount changes every tick.
  const t1Dots = useGameStore((s) => {
    const n = s.game.dims[0].amount.toNumber();
    if (n <= 0) return 0;
    if (n < 8) return Math.max(1, Math.floor(n));
    return 8;
  });
  const band2 = useGameStore((s) => (s.game.dims[0].amount.gte(16) ? 10 : 0));
  const band3 = useGameStore((s) => (s.game.dims[0].amount.gte(64) ? 12 : 0));
  const speed = useGameStore((s) => quantizeSpeed(speedMult(s.game).toNumber()));
  const tapText = useGameStore((s) => `+${format(tapPower(s.game), { notation: s.game.options.notation })}`);
  const highest = useGameStore((s) => highestUnlockedTier(s.game));
  const dimsDisplay = useGameStore((s) =>
    s.game.dims
      .slice(0, highestUnlockedTier(s.game))
      .map((d) => formatWhole(d.amount, s.game.options.notation))
      .join('|'),
  );

  const breathe = useRef(new Animated.Value(0)).current;
  const punch = useRef(new Animated.Value(1)).current;
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floaterKey = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(breathe, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduced]);

  const onTap = useCallback(() => {
    tap();
    if (reduced) return;
    punch.setValue(1.14);
    Animated.spring(punch, { toValue: 1, friction: 4, tension: 160, useNativeDriver: NATIVE }).start();
    const key = floaterKey.current++;
    const text = `${tapText} ✦`;
    const x = Math.floor(Math.random() * 48) - 24;
    setFloaters((f) => [...f.slice(-4), { key, text, x }]);
  }, [tap, reduced, punch, tapText]);

  const removeFloater = useCallback((key: number) => {
    setFloaters((f) => f.filter((fl) => fl.key !== key));
  }, []);

  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });
  const coreScale = Animated.multiply(breatheScale, punch);

  const ringSeconds = 9 / speed;
  const dimValues = dimsDisplay.split('|');

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <OrbitRing radius={64} dots={t1Dots} seconds={ringSeconds} color={palette.orbiter} reduced={reduced} />
        <OrbitRing radius={88} dots={band2} seconds={ringSeconds * 1.7} color={palette.orbiterCyan} reduced={reduced} />
        <OrbitRing radius={110} dots={band3} seconds={ringSeconds * 2.6} color={palette.dim} reduced={reduced} />

        <Pressable onPress={onTap} style={styles.coreTouch}>
          <Animated.View style={[styles.coreGlow, { transform: [{ scale: coreScale }] }]}>
            <View style={styles.core}>
              <Text style={styles.coreGlyph}>✦</Text>
            </View>
          </Animated.View>
        </Pressable>

        {floaters.map((f) => (
          <FloatingNumber key={f.key} floater={f} onDone={removeFloater} />
        ))}
        <PrestigeFlash reduced={reduced} />
      </View>
      <Text style={styles.tapHint}>tap {tapText} ✦</Text>

      <View style={styles.rings}>
        {dimValues.slice(0, highest).map((v, i) => (
          <View key={i} style={styles.ring}>
            <Text style={[styles.ringLabel, i === 0 && { color: palette.orbiter }]}>T{i + 1}</Text>
            <Text style={styles.ringValue}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.md },
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  ringLayer: { position: 'absolute', width: STAGE, height: STAGE },
  orbitPath: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: palette.line,
    opacity: 0.6,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 1,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  coreTouch: { position: 'absolute', left: CENTER - 52, top: CENTER - 52 },
  coreGlow: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#2a2113',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: palette.coreDeep,
    borderColor: palette.coreHighlight,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreGlyph: { color: palette.coreHighlight, fontSize: 36 },
  floater: {
    position: 'absolute',
    top: CENTER - 70,
    width: 80,
    textAlign: 'center',
    color: palette.coreHighlight,
    fontSize: 14,
    fontWeight: '800',
    ...mono,
  },
  tapHint: { color: palette.dim, fontSize: 11, marginTop: 2, ...mono },
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
