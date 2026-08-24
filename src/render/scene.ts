/**
 * The stage's scene model (spec §12).
 *
 * PURE MODULE — no React, no canvas. It integrates orbiter angles, detects
 * full revolutions (emitting a pulse + a drifting mote), breathes the core,
 * and owns the prestige flash. A backend reads `orbiters`, `pool`, `flash`
 * and draws them.
 *
 * Everything is time-based (dt in seconds), so motion is identical at 30fps
 * and 144fps, and upgrade-driven speed changes are smooth rather than stepped
 * — the whole reason the spec forbids CSS keyframes here.
 */
import { ParticlePool } from './particles';

/** Bands keep the stage legible: real counts stay in state, drawn ones don't. */
export interface BandConfig {
  radius: number;
  /** Relative angular speed — outer bands sweep slower. */
  speedScale: number;
  color: string;
}

export interface SceneConfig {
  width: number;
  height: number;
  bands: BandConfig[];
  /** Hard cap on drawn orbiters across all bands (spec §12: ~48). */
  maxDrawn: number;
  particleCapacity: number;
}

export interface DrawnOrbiter {
  band: number;
  /** Current angle in radians. */
  angle: number;
  x: number;
  y: number;
  color: string;
  radius: number;
}

export interface SceneInput {
  /** How many orbiters to draw, per band. */
  drawnPerBand: number[];
  /** Production-speed multiplier — drives revolution rate. */
  speed: number;
  reducedMotion: boolean;
  /** True once Motes are unlocked, so revolutions emit drifting motes. */
  motesActive: boolean;
}

export interface Flash {
  color: string;
  /** 1 → 0 as it fades. */
  alpha: number;
}

const TAU = Math.PI * 2;
/** Base seconds for one revolution of the innermost band at speed ×1. */
const BASE_PERIOD = 9;

export class Scene {
  readonly pool: ParticlePool;
  readonly cfg: SceneConfig;
  readonly cx: number;
  readonly cy: number;

  /** Per-band angle accumulator, radians. */
  private angles: number[];
  /** Revolutions completed per band, used to fire one pulse per lap. */
  private laps: number[];
  private drawn: DrawnOrbiter[] = [];

  /** Core breathing phase, radians. */
  private breath = 0;
  /** Extra scale from a tap punch, decays to 0. */
  private punch = 0;

  flash: Flash = { color: '#ffffff', alpha: 0 };

  constructor(cfg: SceneConfig) {
    this.cfg = cfg;
    this.cx = cfg.width / 2;
    this.cy = cfg.height / 2;
    this.pool = new ParticlePool(cfg.particleCapacity);
    this.angles = cfg.bands.map((_, i) => (i * TAU) / cfg.bands.length);
    this.laps = cfg.bands.map(() => 0);
  }

  /** Core scale: 1 + breath + punch. Backends multiply their base size by it. */
  get coreScale(): number {
    return 1 + Math.sin(this.breath) * 0.055 + this.punch;
  }

  get orbiters(): readonly DrawnOrbiter[] {
    return this.drawn;
  }

  /** Advance the whole scene by dt seconds. */
  advance(dt: number, input: SceneInput): void {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    // A long stall (backgrounded tab) must not fast-forward the visuals.
    const step = Math.min(dt, 0.1);

    const speed = clampSpeed(input.speed);

    if (!input.reducedMotion) {
      this.breath += step * 1.5;
      if (this.breath > TAU) this.breath -= TAU;
      this.punch *= Math.max(0, 1 - step * 9);
      if (this.punch < 0.001) this.punch = 0;
      this.flash.alpha *= Math.max(0, 1 - step * 1.6);
      if (this.flash.alpha < 0.01) this.flash.alpha = 0;
    } else {
      this.breath = 0;
      this.punch = 0;
      this.flash.alpha = 0;
    }

    this.rebuildDrawn(input.drawnPerBand);

    for (let b = 0; b < this.cfg.bands.length; b++) {
      const band = this.cfg.bands[b];
      if (input.reducedMotion) continue;
      const period = (BASE_PERIOD * band.speedScale) / speed;
      this.angles[b] += (TAU / period) * step;

      // One pulse + mote per completed lap, only while that band is populated.
      const lap = Math.floor(this.angles[b] / TAU);
      if (lap > this.laps[b]) {
        this.laps[b] = lap;
        if ((input.drawnPerBand[b] ?? 0) > 0) this.emitRevolution(b, input.motesActive);
      }
      if (this.angles[b] > TAU * 1024) {
        // Keep the accumulator small forever; preserve phase and lap parity.
        this.angles[b] -= TAU * 1024;
        this.laps[b] -= 1024;
      }
    }

    this.positionDrawn();
    if (!input.reducedMotion) this.pool.update(step);
  }

  /**
   * A tap: punch the core, throw a spark burst, and float the earned value
   * upward (spec §11's "floating numbers").
   */
  tap(reducedMotion: boolean, label?: string, count = 8): void {
    if (reducedMotion) return;
    this.punch = 0.14;
    if (label) {
      this.pool.spawn('value', this.cx + (Math.random() * 40 - 20), this.cy - 12, {
        vy: -58,
        text: label,
      });
    }
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const speed = 40 + Math.random() * 70;
      this.pool.spawn('spark', this.cx, this.cy, {
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.4 + Math.random() * 0.35,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  /** A prestige happened: wash the stage in that layer's colour. */
  triggerFlash(color: string, reducedMotion: boolean): void {
    if (reducedMotion) return;
    this.flash.color = color;
    this.flash.alpha = 0.85;
    // An implosion: sparks rush inward from the rim.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const r = Math.min(this.cx, this.cy) * 0.95;
      this.pool.spawn('spark', this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, {
        vx: -Math.cos(a) * r * 1.1,
        vy: -Math.sin(a) * r * 1.1,
        life: 0.85,
        size: 3,
        color,
      });
    }
  }

  /** Pulse ripple + a mote drifting toward the counter (spec §12). */
  private emitRevolution(band: number, motesActive: boolean): void {
    const cfg = this.cfg.bands[band];
    const angle = this.angles[band] % TAU;
    const x = this.cx + Math.cos(angle) * cfg.radius;
    const y = this.cy + Math.sin(angle) * cfg.radius;
    this.pool.spawn('pulse', x, y, { color: cfg.color, size: 5 });
    if (motesActive) {
      // Drift up-left toward the resource bar's Mote counter.
      this.pool.spawn('mote', x, y, { vx: -18, vy: -46, life: 1.3 });
    }
  }

  /** Grow/shrink the drawn list to match, respecting the global cap. */
  private rebuildDrawn(perBand: number[]): void {
    let wanted = 0;
    for (let b = 0; b < this.cfg.bands.length; b++) {
      wanted += Math.max(0, Math.floor(perBand[b] ?? 0));
    }
    wanted = Math.min(wanted, this.cfg.maxDrawn);
    if (wanted === this.drawn.length) return;

    this.drawn.length = 0;
    for (let b = 0; b < this.cfg.bands.length; b++) {
      const n = Math.max(0, Math.floor(perBand[b] ?? 0));
      for (let i = 0; i < n && this.drawn.length < wanted; i++) {
        this.drawn.push({
          band: b,
          angle: 0,
          x: 0,
          y: 0,
          color: this.cfg.bands[b].color,
          radius: this.cfg.bands[b].radius,
        });
      }
    }
  }

  /** Spread each band's orbiters evenly and project to x/y. */
  private positionDrawn(): void {
    const counts: number[] = new Array(this.cfg.bands.length).fill(0);
    for (const o of this.drawn) counts[o.band] += 1;

    const seen: number[] = new Array(this.cfg.bands.length).fill(0);
    for (const o of this.drawn) {
      const n = counts[o.band] || 1;
      const i = seen[o.band]++;
      o.angle = this.angles[o.band] + (i / n) * TAU;
      o.x = this.cx + Math.cos(o.angle) * o.radius;
      o.y = this.cy + Math.sin(o.angle) * o.radius;
    }
  }
}

/** Orbit speed is cosmetic past a point — cap it so fast saves stay readable. */
export function clampSpeed(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(24, Math.max(0.35, raw));
}

/** The default stage layout, shared by every backend. */
export function defaultSceneConfig(size: number): SceneConfig {
  return {
    width: size,
    height: size,
    bands: [
      { radius: size * 0.27, speedScale: 1, color: '#5eead4' },
      { radius: size * 0.37, speedScale: 1.7, color: '#67e8f9' },
      { radius: size * 0.46, speedScale: 2.6, color: '#7fa89e' },
    ],
    maxDrawn: 48,
    particleCapacity: 160,
  };
}

/**
 * How many orbiters to draw per band for a given Tier-1 count. Thresholds
 * are coarse on purpose: the drawn count changes rarely, so the React layer
 * can subscribe to it without re-rendering every tick.
 */
export function drawnPerBand(tier1: number): number[] {
  if (tier1 <= 0) return [0, 0, 0];
  const inner = Math.min(8, Math.max(1, Math.floor(tier1)));
  const mid = tier1 >= 16 ? Math.min(14, Math.floor(tier1 / 2)) : 0;
  const outer = tier1 >= 64 ? Math.min(20, Math.floor(tier1 / 4)) : 0;
  return [inner, mid, outer];
}
