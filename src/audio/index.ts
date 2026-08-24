/**
 * The one entry point the UI uses for sound. Owns the settings gate and the
 * throttle so both platforms behave identically (spec §13).
 */
import { audioService } from './audio';
import { Cue, SoundThrottle } from './throttle';

export type { Cue } from './throttle';

/** Ticks are the only spammable cue; 120ms keeps them a texture, not a buzz. */
const throttle = new SoundThrottle(120);

let muted = false;
let volume = 0.7;

export function setMuted(next: boolean): void {
  muted = next;
  if (next) audioService.stopAll();
}

export function setVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next));
}

/** Play a cue, honouring mute, volume and the per-cue throttle. */
export function playCue(cue: Cue): void {
  if (muted || volume <= 0) return;
  if (!throttle.allow(cue, Date.now())) return;
  try {
    audioService.play(cue, volume);
  } catch {
    // Sound must never take down a play session.
  }
}
