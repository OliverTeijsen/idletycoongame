/**
 * Audio service (spec §13) — web, via the Web Audio API.
 *
 * Tones are synthesised at runtime rather than loaded from files: the whole
 * sound set is four short blips and a chord, so generating them costs a few
 * oscillators and keeps the bundle free of audio assets ("keep it tiny").
 *
 * The AudioContext is created lazily on the first cue, because browsers
 * refuse to start one before a user gesture — building it at import time
 * would leave it permanently suspended.
 */
import { CUE_TONES, Cue } from './throttle';
import type { AudioService } from './audio';

export type { AudioService } from './audio';

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;

function ensureContext(): Ctx | null {
  if (ctx) return ctx;
  const Impl: typeof AudioContext | undefined =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Impl) return null;
  try {
    ctx = new Impl();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

export const audioService: AudioService = {
  play(cue: Cue, volume: number) {
    if (volume <= 0) return;
    const context = ensureContext();
    if (!context || !master) return;
    // A context created before the first gesture starts suspended.
    if (context.state === 'suspended') void context.resume();

    const tone = CUE_TONES[cue];
    const now = context.currentTime;

    for (const freq of tone.freqs) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = cue === 'prestige' ? 'triangle' : 'square';
      osc.frequency.value = freq;

      // Short attack, exponential release — a blip, not a click.
      const peak = tone.gain * volume;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + tone.duration + 0.02);
      // Let the nodes be collected as soon as they finish.
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  },

  stopAll() {
    if (master) master.gain.value = 0;
    if (master && ctx) {
      // Restore for the next play; stopAll only kills what is sounding now.
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.setValueAtTime(1, ctx.currentTime + 0.05);
    }
  },
};
