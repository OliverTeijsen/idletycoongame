/**
 * Canvas 2D stage backend (web). One rAF loop; it reads a snapshot ref that
 * React updates, and never causes a React render itself (spec §12).
 *
 * Metro resolves this file on web and StageCanvas.native.tsx elsewhere, which
 * is the Renderer seam from spec §3 — a Skia backend drops in as a third file
 * without touching the scene, the particles or the UI.
 */
import React, { useEffect, useRef } from 'react';

import { Scene, SceneInput } from './scene';
import {
  clearStage,
  drawCore,
  drawFlash,
  drawOrbitPaths,
  drawOrbiter,
  drawParticle,
  Palette,
} from './sprites';

export interface StageCanvasProps {
  scene: Scene;
  /** Mutable snapshot the render loop reads — never a React prop per frame. */
  inputRef: React.MutableRefObject<SceneInput>;
  size: number;
  palette: Palette;
  onTap(): void;
}

export function StageCanvas({ scene, inputRef, size, palette, onTap }: StageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match the backing store to the device pixel ratio so pixel art stays crisp.
    const dpr = Math.min(3, (globalThis.devicePixelRatio ?? 1) || 1);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      const dt = last === 0 ? 0 : (now - last) / 1000;
      last = now;

      const input = inputRef.current;
      scene.advance(dt, input);

      clearStage(ctx, size, size, palette);
      drawOrbitPaths(ctx, scene, palette);
      if (!input.reducedMotion) scene.pool.forEach((p) => drawParticle(ctx, p));
      for (const o of scene.orbiters) drawOrbiter(ctx, scene, o, !input.reducedMotion);
      drawCore(ctx, scene, palette);
      drawFlash(ctx, scene, size, size);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [scene, inputRef, size, palette]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onTap}
      style={{ width: size, height: size, cursor: 'pointer', touchAction: 'manipulation' }}
    />
  );
}
