/**
 * Pooled particle system (spec §12).
 *
 * PURE MODULE — no React, no React Native, no canvas. It owns particle state
 * and physics; a backend draws it. Unit-tested in the `core` Jest project.
 *
 * The pool never allocates after construction: every particle lives in a
 * fixed array and is revived in place. That is the whole point — an idle game
 * runs for hours, and a per-frame allocation is a per-frame GC pause.
 */

export type ParticleKind = 'pulse' | 'spark' | 'mote' | 'value';

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived so far. */
  age: number;
  /** Seconds to live in total. */
  life: number;
  size: number;
  /** 0..1 progress, refreshed each update for the backend to read. */
  t: number;
  color: string;
  /** Label for `value` particles (floating numbers). Empty otherwise. */
  text: string;
}

export interface SpawnOpts {
  vx?: number;
  vy?: number;
  life?: number;
  size?: number;
  color?: string;
  text?: string;
}

/**
 * Stage colours, duplicated from ui/theme on purpose.
 *
 * This module is PURE (spec §3/§12) — importing the theme would pull in
 * react-native's Platform and cost this file its Node-only tests. So the
 * values are copied, and copies drift: these were still the pre-instrument
 * teal palette after the ground moved to blue-black, which left the outer
 * orbit band a muddy sage green against it. If you retune ui/theme's orbiter,
 * mote or faint hues, retune these to match.
 */
const DEFAULTS: Record<ParticleKind, { life: number; size: number; color: string }> = {
  pulse: { life: 0.9, size: 6, color: '#4fe3c1' }, // palette.orbiter
  spark: { life: 0.6, size: 2.5, color: '#ffe6a8' }, // palette.coreHighlight
  mote: { life: 1.4, size: 3, color: '#ff7a6b' }, // palette.mote
  value: { life: 0.85, size: 13, color: '#ffe6a8' }, // palette.coreHighlight
};

export class ParticlePool {
  readonly particles: Particle[];
  private cursor = 0;
  private live = 0;

  constructor(capacity: number) {
    this.particles = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.particles[i] = {
        active: false,
        kind: 'spark',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        life: 1,
        size: 1,
        t: 0,
        color: '#ffffff',
        text: '',
      };
    }
  }

  get capacity(): number {
    return this.particles.length;
  }

  get liveCount(): number {
    return this.live;
  }

  /**
   * Revive a dead particle in place. When the pool is full the spawn is
   * dropped — losing a particle is invisible; stuttering is not.
   */
  spawn(kind: ParticleKind, x: number, y: number, opts: SpawnOpts = {}): Particle | null {
    const slot = this.findDead();
    if (slot < 0) return null;
    const d = DEFAULTS[kind];
    const p = this.particles[slot];
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.age = 0;
    p.life = opts.life ?? d.life;
    p.size = opts.size ?? d.size;
    p.color = opts.color ?? d.color;
    p.text = opts.text ?? '';
    p.t = 0;
    this.live += 1;
    return p;
  }

  /** Round-robin scan so spawns spread across the array instead of clustering. */
  private findDead(): number {
    const n = this.particles.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      if (!this.particles[idx].active) {
        this.cursor = (idx + 1) % n;
        return idx;
      }
    }
    return -1;
  }

  /** Advance every live particle by dt seconds and retire the expired ones. */
  update(dt: number): void {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this.live -= 1;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.t = p.age / p.life;
    }
  }

  /** Visit every live particle. Allocation-free. */
  forEach(fn: (p: Particle) => void): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.active) fn(p);
    }
  }

  clear(): void {
    for (let i = 0; i < this.particles.length; i++) this.particles[i].active = false;
    this.live = 0;
  }
}
