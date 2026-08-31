/**
 * Canvas 2D draw routines (spec §12). Kept separate from the scene so the
 * scene stays pure and this file stays a dumb painter.
 *
 * Web-only: `CanvasRenderingContext2D` does not exist on native, where the
 * Animated backend draws instead.
 */
import { Particle } from './particles';
import { DrawnOrbiter, Scene } from './scene';

const TAU = Math.PI * 2;

export interface Palette {
  bg: string;
  path: string;
  core: string;
  coreEdge: string;
  coreGlow: string;
}

export function clearStage(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  ctx.clearRect(0, 0, w, h);
  // Radial ground so the core sits in its own pool of light.
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
  g.addColorStop(0, p.coreGlow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawOrbitPaths(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  ctx.save();
  ctx.strokeStyle = p.path;
  ctx.lineWidth = 1;
  for (const band of scene.cfg.bands) {
    ctx.beginPath();
    ctx.arc(scene.cx, scene.cy, band.radius, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** `#rrggbb` -> `rgba(...)`. The palette is hex; light needs alpha. */
function tint(hex: string, a: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Four tapered blades from the centre, at `rotation`.
 *
 * This is what makes a bright point read as a STAR rather than as a dot: a
 * blade is widest where the light is and vanishes at the tip, so it describes
 * light bleeding along an axis. A bar of constant width — which is what the
 * old highlight cross was — describes a plank.
 */
function drawSpikes(
  ctx: CanvasRenderingContext2D,
  len: number,
  halfWidth: number,
  color: string,
  alpha: number,
  rotation: number,
): void {
  ctx.save();
  ctx.rotate(rotation);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, tint(color, alpha));
  g.addColorStop(1, tint(color, 0));
  ctx.fillStyle = g;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -halfWidth);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(Math.PI / 2);
  }
  ctx.restore();
}

/**
 * The core: the one warm light source in the app (§12, and the direction note
 * in theme.ts).
 *
 * Drawn as LIGHT, not as a sprite. It was a flat rotated square with a
 * full-width highlight cross laid over it, which read as a crosshair on a
 * placeholder tile — the cross arms reached past the diamond's own points
 * (1.05r against 0.88r) and so ended in blunt square stubs poking out at the
 * compass points, and a single flat fill can never look like it is emitting.
 *
 * Now: a bloom, four diffraction blades, and a body that runs white-hot at
 * the centre out through the amber to nothing. The bloom and blades composite
 * with 'lighter' so overlapping light accumulates the way light does; the
 * body is painted normally so the core keeps a definite, readable form
 * instead of blowing out into a blob.
 *
 * It is also smaller. The old body spanned 94px of a 264px stage and crowded
 * the innermost orbit at r=0.27 — the instrument's graticule has to stay
 * legible around the light. The body now sits at 0.115 and only the blades
 * cross the first ring, which is exactly what a bright star does on a plate.
 */
export function drawCore(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const base = Math.min(scene.cfg.width, scene.cfg.height) * 0.115;
  const r = base * scene.coreScale;

  ctx.save();
  ctx.translate(scene.cx, scene.cy);
  ctx.globalCompositeOperation = 'lighter';

  // Bloom. Four stops rather than two: a straight ramp to transparent lands
  // as a visible disc edge, and the whole point of the well is light with no
  // edge to it.
  const bloom = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 3.6);
  bloom.addColorStop(0, tint(p.coreEdge, 0.3));
  bloom.addColorStop(0.25, tint(p.core, 0.15));
  bloom.addColorStop(0.6, tint(p.core, 0.05));
  bloom.addColorStop(1, tint(p.core, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(0, 0, r * 3.6, 0, TAU);
  ctx.fill();

  // Long blades on the axes, short ones on the diagonals — the asymmetry is
  // what keeps it from reading as an eight-pointed snowflake.
  drawSpikes(ctx, r * 2.8, r * 0.15, p.coreEdge, 0.5, 0);
  drawSpikes(ctx, r * 1.45, r * 0.1, p.core, 0.35, Math.PI / 4);

  // Body.
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  body.addColorStop(0, '#fffdf4');
  body.addColorStop(0.3, tint(p.coreEdge, 1));
  body.addColorStop(0.72, tint(p.core, 0.95));
  body.addColorStop(1, tint(p.core, 0));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  ctx.restore();
}

/** 6px pixel body + soft glow + a short fading trail behind it. */
export function drawOrbiter(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  o: DrawnOrbiter,
  trails: boolean,
): void {
  if (trails) {
    const steps = 6;
    for (let i = steps; i > 0; i--) {
      const a = o.angle - i * 0.055;
      const x = scene.cx + Math.cos(a) * o.radius;
      const y = scene.cy + Math.sin(a) * o.radius;
      ctx.globalAlpha = (1 - i / steps) * 0.32;
      ctx.fillStyle = o.color;
      const s = 4 * (1 - i / (steps * 1.6));
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.shadowColor = o.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = o.color;
  ctx.fillRect(o.x - 3, o.y - 3, 6, 6);
  ctx.restore();
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const fade = 1 - p.t;
  switch (p.kind) {
    case 'pulse': {
      // An expanding ring where an orbiter completed its lap.
      ctx.save();
      ctx.globalAlpha = fade * 0.55;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * fade;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + p.t * 26, 0, TAU);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'mote': {
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.restore();
      break;
    }
    case 'value': {
      // Floating damage-number style: rises, fades, never blocks the core.
      ctx.save();
      ctx.globalAlpha = p.t < 0.75 ? 1 : (1 - p.t) / 0.25;
      ctx.fillStyle = p.color;
      ctx.font = `700 ${p.size}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
      break;
    }
    default: {
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.globalAlpha = 1;
      break;
    }
  }
}

export function drawFlash(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number): void {
  if (scene.flash.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, scene.flash.alpha);
  ctx.fillStyle = scene.flash.color;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
