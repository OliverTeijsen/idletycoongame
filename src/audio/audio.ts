/**
 * Audio service (spec §13) — native implementation, and the module
 * TypeScript resolves for the bare `./audio` import. Metro picks
 * `audio.web.ts` on web and this file everywhere else.
 *
 * Native is intentionally silent for now: spec §13 marks audio optional, and
 * shipping real sound here means bundling audio assets and an `expo-audio`
 * dependency that cannot be tested without a native build. The interface and
 * every call site are already in place, so adding it later is a one-file job
 * — exactly like the Skia seam in the renderer.
 *
 * The mute/volume settings are honoured by the shared layer above, so they
 * already work on web and will apply unchanged when native sound lands.
 */
import { Cue } from './throttle';

export interface AudioService {
  /** Play a cue now. Must never throw and never block. */
  play(cue: Cue, volume: number): void;
  /** Called when the player mutes, so any sustained sound stops. */
  stopAll(): void;
}

export const audioService: AudioService = {
  play() {
    // Silent until native audio assets land — see the file header.
  },
  stopAll() {},
};
