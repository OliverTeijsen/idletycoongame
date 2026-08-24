/**
 * The render core is pure TS, so it is tested by the `core` project alongside
 * the economy — no React, no canvas, no jsdom.
 */
import { ParticlePool } from '../../render/particles';
import { Scene, clampSpeed, defaultSceneConfig, drawnPerBand } from '../../render/scene';

describe('particle pool', () => {
  it('spawns, ages and retires particles', () => {
    const pool = new ParticlePool(8);
    expect(pool.liveCount).toBe(0);

    const p = pool.spawn('spark', 10, 20, { vx: 100, vy: 0, life: 1 })!;
    expect(p).not.toBeNull();
    expect(pool.liveCount).toBe(1);

    pool.update(0.5);
    expect(p.x).toBeCloseTo(60, 6); // moved by vx·dt
    expect(p.t).toBeCloseTo(0.5, 6);
    expect(pool.liveCount).toBe(1);

    pool.update(0.6); // past its life
    expect(pool.liveCount).toBe(0);
    expect(p.active).toBe(false);
  });

  it('never allocates: a full pool drops spawns instead of growing', () => {
    const pool = new ParticlePool(4);
    for (let i = 0; i < 4; i++) expect(pool.spawn('spark', 0, 0)).not.toBeNull();
    expect(pool.liveCount).toBe(4);
    expect(pool.spawn('spark', 0, 0)).toBeNull(); // dropped, not grown
    expect(pool.particles.length).toBe(4);
  });

  it('reuses slots once particles die', () => {
    const pool = new ParticlePool(2);
    pool.spawn('spark', 0, 0, { life: 0.1 });
    pool.spawn('spark', 0, 0, { life: 0.1 });
    expect(pool.spawn('spark', 0, 0)).toBeNull();
    pool.update(0.2); // both expire
    expect(pool.liveCount).toBe(0);
    expect(pool.spawn('spark', 0, 0)).not.toBeNull(); // slot revived
  });

  it('ignores nonsense dt and survives a long run without leaking', () => {
    const pool = new ParticlePool(32);
    pool.update(NaN);
    pool.update(-1);
    expect(pool.liveCount).toBe(0);

    for (let i = 0; i < 2000; i++) {
      pool.spawn('pulse', 0, 0, { life: 0.3 });
      pool.update(1 / 60);
    }
    expect(pool.liveCount).toBeLessThanOrEqual(pool.capacity);
    expect(pool.particles.length).toBe(32);
  });

  it('clear kills everything', () => {
    const pool = new ParticlePool(4);
    pool.spawn('mote', 0, 0);
    pool.clear();
    expect(pool.liveCount).toBe(0);
  });
});

describe('scene', () => {
  const cfg = () => defaultSceneConfig(240);

  it('places drawn orbiters on their band radius', () => {
    const scene = new Scene(cfg());
    scene.advance(0.016, {
      drawnPerBand: [4, 0, 0],
      speed: 1,
      reducedMotion: false,
      motesActive: false,
    });
    expect(scene.orbiters).toHaveLength(4);
    for (const o of scene.orbiters) {
      const dist = Math.hypot(o.x - scene.cx, o.y - scene.cy);
      expect(dist).toBeCloseTo(scene.cfg.bands[0].radius, 6);
    }
  });

  it('caps the number of drawn orbiters however many are owned', () => {
    const scene = new Scene(cfg());
    scene.advance(0.016, {
      drawnPerBand: [1000, 1000, 1000],
      speed: 1,
      reducedMotion: false,
      motesActive: false,
    });
    expect(scene.orbiters.length).toBe(scene.cfg.maxDrawn);
  });

  it('emits a pulse (and a mote) once per completed revolution', () => {
    const scene = new Scene(cfg());
    const input = {
      drawnPerBand: [3, 0, 0],
      speed: 1,
      reducedMotion: false,
      motesActive: true,
    };
    // One full lap of the inner band at speed 1 takes ~9s.
    for (let i = 0; i < 60 * 10; i++) scene.advance(1 / 60, input);

    let pulses = 0;
    let motes = 0;
    scene.pool.forEach((p) => {
      if (p.kind === 'pulse') pulses += 1;
      if (p.kind === 'mote') motes += 1;
    });
    expect(pulses + motes).toBeGreaterThan(0);
  });

  it('is framerate-independent: coarse and fine steps agree', () => {
    const coarse = new Scene(cfg());
    const fine = new Scene(cfg());
    const input = {
      drawnPerBand: [1, 0, 0],
      speed: 1,
      reducedMotion: false,
      motesActive: false,
    };
    for (let i = 0; i < 100; i++) coarse.advance(1 / 30, input);
    for (let i = 0; i < 200; i++) fine.advance(1 / 60, input);
    const a = coarse.orbiters[0];
    const b = fine.orbiters[0];
    expect(a.x).toBeCloseTo(b.x, 4);
    expect(a.y).toBeCloseTo(b.y, 4);
  });

  it('a long stall does not fast-forward the visuals', () => {
    const scene = new Scene(cfg());
    const input = {
      drawnPerBand: [1, 0, 0],
      speed: 1,
      reducedMotion: false,
      motesActive: false,
    };
    scene.advance(600, input); // backgrounded for ten minutes
    // Clamped to one 0.1s step, so at most a sliver of a lap.
    expect(scene.orbiters[0].angle).toBeLessThan(Math.PI);
  });

  it('reduced motion freezes the scene and spawns nothing', () => {
    const scene = new Scene(cfg());
    const input = {
      drawnPerBand: [4, 0, 0],
      speed: 8,
      reducedMotion: true,
      motesActive: true,
    };
    for (let i = 0; i < 600; i++) scene.advance(1 / 60, input);
    expect(scene.pool.liveCount).toBe(0);
    expect(scene.coreScale).toBe(1);
    expect(scene.orbiters[0].angle).toBeCloseTo(0, 6);

    scene.tap(true);
    expect(scene.pool.liveCount).toBe(0);
    scene.triggerFlash('#fff', true);
    expect(scene.flash.alpha).toBe(0);
  });

  it('tap floats the earned value as a labelled particle', () => {
    const scene = new Scene(cfg());
    scene.tap(false, '+12.5K');
    let found = '';
    scene.pool.forEach((p) => {
      if (p.kind === 'value') found = p.text;
    });
    expect(found).toBe('+12.5K');
  });

  it('tap punches the core and throws sparks that settle', () => {
    const scene = new Scene(cfg());
    scene.tap(false);
    expect(scene.pool.liveCount).toBeGreaterThan(0);
    expect(scene.coreScale).toBeGreaterThan(1);

    const input = {
      drawnPerBand: [0, 0, 0],
      speed: 1,
      reducedMotion: false,
      motesActive: false,
    };
    for (let i = 0; i < 120; i++) scene.advance(1 / 60, input);
    expect(scene.pool.liveCount).toBe(0); // sparks expired
  });

  it('prestige flash fades to nothing', () => {
    const scene = new Scene(cfg());
    scene.triggerFlash('#ffffff', false);
    expect(scene.flash.alpha).toBeGreaterThan(0.5);
    const input = {
      drawnPerBand: [0, 0, 0],
      speed: 1,
      reducedMotion: false,
      motesActive: false,
    };
    for (let i = 0; i < 600; i++) scene.advance(1 / 60, input);
    expect(scene.flash.alpha).toBe(0);
  });

  it('angle accumulators stay bounded over a long session', () => {
    const scene = new Scene(cfg());
    const input = {
      drawnPerBand: [2, 0, 0],
      speed: 24,
      reducedMotion: false,
      motesActive: false,
    };
    // At max speed a lap takes ~0.37s, so 40k coarse steps is thousands of
    // laps — many wraps past the TAU·1024 fold, which is the point.
    for (let i = 0; i < 40000; i++) scene.advance(0.05, input);
    for (const o of scene.orbiters) {
      expect(Number.isFinite(o.angle)).toBe(true);
      expect(Math.abs(o.angle)).toBeLessThan(Math.PI * 2 * 2048);
    }
  }, 60_000);
});

describe('helpers', () => {
  it('clampSpeed keeps orbit speed readable', () => {
    expect(clampSpeed(1)).toBe(1);
    expect(clampSpeed(1e9)).toBe(24);
    expect(clampSpeed(0)).toBe(1);
    expect(clampSpeed(NaN)).toBe(1);
    expect(clampSpeed(-5)).toBe(1);
  });

  it('drawnPerBand reveals bands as orbiters accumulate', () => {
    expect(drawnPerBand(0)).toEqual([0, 0, 0]);
    expect(drawnPerBand(3)[0]).toBe(3);
    expect(drawnPerBand(3)[1]).toBe(0);
    expect(drawnPerBand(20)[1]).toBeGreaterThan(0);
    expect(drawnPerBand(100)[2]).toBeGreaterThan(0);
    // never unbounded
    const big = drawnPerBand(1e9);
    expect(big[0]).toBeLessThanOrEqual(8);
    expect(big[1]).toBeLessThanOrEqual(14);
    expect(big[2]).toBeLessThanOrEqual(20);
  });
});
