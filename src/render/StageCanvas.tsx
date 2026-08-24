/**
 * Native stage backend — and the module TypeScript resolves for the bare
 * `./StageCanvas` import. Metro picks `StageCanvas.web.tsx` on web and this
 * file everywhere else; both export the same component with the same props,
 * which is the spec §3 Renderer seam.
 *
 * This draws with core RN Animated: one looping rotation per orbit band on a
 * container view, which the native driver runs off the JS thread. It is
 * deliberately simpler than the canvas version — no per-particle drawing —
 * because @shopify/react-native-skia is a native dependency and adding it
 * requires a fresh EAS build. When Skia lands, it replaces THIS FILE ONLY:
 * the scene, the particle pool and the UI never learn about it.
 *
 * The scene still advances here so gameplay-visible state (revolutions, the
 * particle pool) stays identical across platforms.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Scene, SceneInput, clampSpeed } from './scene';
import { Palette } from './sprites';

export interface StageCanvasProps {
  scene: Scene;
  inputRef: React.MutableRefObject<SceneInput>;
  size: number;
  palette: Palette;
  onTap(): void;
}

const TAU = Math.PI * 2;
const BASE_PERIOD = 9;

function Band({
  scene,
  bandIndex,
  count,
  speed,
  reduced,
}: {
  scene: Scene;
  bandIndex: number;
  count: number;
  speed: number;
  reduced: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const band = scene.cfg.bands[bandIndex];
  // Quantized so the loop only restarts on a meaningful speed change.
  const period = (BASE_PERIOD * band.speedScale) / clampSpeed(speed);

  useEffect(() => {
    if (reduced || count <= 0) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: Math.max(900, period * 1000),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, period, count, reduced]);

  const dots = useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      out.push(
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: band.color,
              shadowColor: band.color,
              left: scene.cx + band.radius * Math.cos(a) - 3,
              top: scene.cy + band.radius * Math.sin(a) - 3,
            },
          ]}
        />,
      );
    }
    return out;
  }, [count, band, scene.cx, scene.cy]);

  if (count <= 0) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <>
      <View
        style={[
          styles.path,
          {
            borderColor: palettePath,
            width: band.radius * 2,
            height: band.radius * 2,
            borderRadius: band.radius,
            left: scene.cx - band.radius,
            top: scene.cy - band.radius,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
      >
        {dots}
      </Animated.View>
    </>
  );
}

const palettePath = '#1c3634';

export function StageCanvas({ scene, inputRef, size, palette, onTap }: StageCanvasProps) {
  const coreScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const input = inputRef.current;

  // Keep the pure scene ticking so revolutions and particles stay in step
  // with the web build even though this backend does not paint them.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = last === 0 ? 0 : (now - last) / 1000;
      last = now;
      scene.advance(dt, inputRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [scene, inputRef]);

  // Breathing.
  useEffect(() => {
    if (input.reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(coreScale, {
          toValue: 1.055,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(coreScale, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [coreScale, input.reducedMotion]);

  const handleTap = () => {
    onTap();
    if (!inputRef.current.reducedMotion) {
      coreScale.setValue(1.16);
      Animated.spring(coreScale, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
  };

  // Mirror the scene's flash onto an overlay.
  useEffect(() => {
    const id = setInterval(() => {
      flash.setValue(scene.flash.alpha);
    }, 60);
    return () => clearInterval(id);
  }, [flash, scene]);

  return (
    <View style={{ width: size, height: size }}>
      {scene.cfg.bands.map((_, i) => (
        <Band
          key={i}
          scene={scene}
          bandIndex={i}
          count={input.drawnPerBand[i] ?? 0}
          speed={input.speed}
          reduced={input.reducedMotion}
        />
      ))}

      <Pressable onPress={handleTap} style={[styles.coreTouch, { left: size / 2 - 52, top: size / 2 - 52 }]}>
        <Animated.View
          style={[
            styles.coreGlow,
            { backgroundColor: palette.coreGlow, transform: [{ scale: coreScale }] },
          ]}
        >
          <View style={[styles.core, { backgroundColor: palette.core, borderColor: palette.coreEdge }]} />
        </Animated.View>
      </Pressable>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: scene.flash.color, opacity: flash }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  path: { position: 'absolute', borderWidth: 1, opacity: 0.6 },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 1,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  coreTouch: { position: 'absolute' },
  coreGlow: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: { width: 72, height: 72, borderRadius: 8, borderWidth: 2, transform: [{ rotate: '45deg' }] },
});
