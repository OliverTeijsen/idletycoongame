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

/** A pixel diamond-star: four points, drawn as a rotated square + cross. */
export function drawCore(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const base = Math.min(scene.cfg.width, scene.cfg.height) * 0.17;
  const r = base * scene.coreScale;

  ctx.save();
  ctx.translate(scene.cx, scene.cy);

  // Soft glow behind.
  const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.6);
  glow.addColorStop(0, p.coreGlow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.6, 0, TAU);
  ctx.fill();

  // Diamond body.
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = p.core;
  ctx.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
  ctx.strokeStyle = p.coreEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);

  // Highlight cross.
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = p.coreEdge;
  ctx.fillRect(-r * 0.09, -r * 1.05, r * 0.18, r * 2.1);
  ctx.fillRect(-r * 1.05, -r * 0.09, r * 2.1, r * 0.18);

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
