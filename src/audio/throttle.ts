/**
 * Sound throttling (spec §13: "subtle tick on orbiter pulse (throttled)").
 *
 * PURE MODULE — no audio APIs, no React. Tested in the `core` project.
 *
 * Late game emits dozens of orbiter pulses per second. Playing a tick for
 * each is both unpleasant and a performance problem, so a cue may only fire
 * every `minGapMs`; everything in between is silently dropped.
 */
export class SoundThrottle {
  private lastAt = new Map<string, number>();

  constructor(private readonly minGapMs: number) {}

  /** May this cue play at time `now` (ms)? Records the play if so. */
  allow(cue: string, now: number): boolean {
    const last = this.lastAt.get(cue);
    if (last !== undefined && now - last < this.minGapMs) return false;
    this.lastAt.set(cue, now);
    return true;
  }

  reset(): void {
    this.lastAt.clear();
  }
}

/** The cues the game can ask for (spec §13). */
export type Cue = 'tick' | 'tap' | 'prestige' | 'achievement';

/** Tone recipes, in Hz + seconds. A warm chord for prestige, blips elsewhere. */
export const CUE_TONES: Record<Cue, { freqs: number[]; duration: number; gain: number }> = {
  tick: { freqs: [880], duration: 0.05, gain: 0.05 },
  tap: { freqs: [523.25], duration: 0.07, gain: 0.08 },
  achievement: { freqs: [659.25, 987.77], duration: 0.28, gain: 0.1 },
  // C-E-G-C: the "warm chord" the spec asks for on prestige.
  prestige: { freqs: [261.63, 329.63, 392.0, 523.25], duration: 0.9, gain: 0.12 },
};
