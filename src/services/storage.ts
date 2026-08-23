/**
 * Local persistence (MMKV behind a tiny adapter, spec §14).
 *
 *  - The codec lives in the pure core (game/save.ts); this file only owns the
 *    MMKV instance and the last-2-saves backup rotation.
 *  - Loading NEVER throws: corrupt/truncated/future saves fall back to the
 *    backup slot, then to null (fresh game). The worst possible bug in an
 *    idle game is one that bricks the app for a player with a big empire.
 *  - On web, react-native-mmkv is genuinely localStorage-backed (not a stub);
 *    under Jest it swaps in an in-memory store, so persistence tests are real.
 */
import { createMMKV } from 'react-native-mmkv';

import { deserializeState, serializeState } from '../game/save';
import { GameState } from '../game/types';

export const STORAGE_ID = 'gyre';
export const SAVE_KEY = 'save';
export const BACKUP_KEY = 'save.backup';

const storage = createMMKV({ id: STORAGE_ID });

export function saveGame(state: GameState): void {
  try {
    const json = serializeState(state);
    // Rotate: the previous good save becomes the backup before we overwrite.
    const previous = storage.getString(SAVE_KEY);
    if (previous && previous !== json) storage.set(BACKUP_KEY, previous);
    storage.set(SAVE_KEY, json);
  } catch (error) {
    // Never let a failed write take down a play session.
    console.warn('[storage] save failed', error);
  }
}

/** Load the save (falling back to the backup slot), or null for a fresh game. */
export function loadGame(now: number = Date.now()): GameState | null {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const json = storage.getString(key);
      if (!json) continue;
      const state = deserializeState(json, now);
      if (state) return state;
      console.warn(`[storage] unreadable save in "${key}", trying next slot`);
    } catch (error) {
      console.warn(`[storage] load from "${key}" failed`, error);
    }
  }
  return null;
}

export function hasSave(): boolean {
  return storage.contains(SAVE_KEY);
}

export function clearSave(): void {
  storage.remove(SAVE_KEY);
  storage.remove(BACKUP_KEY);
}

/** Export the raw save for the clipboard (base64 of the JSON). */
export function exportSave(state: GameState): string {
  const json = serializeState(state);
  // btoa exists on web; Buffer under Node/Jest; RN Hermes has neither global
  // guaranteed, so do it by hand via encodeURIComponent → binary-safe base64.
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, 'utf8').toString('base64');
}

/** Parse an exported save. Returns null when the blob is not a valid save. */
export function importSave(blob: string, now: number = Date.now()): GameState | null {
  try {
    const trimmed = blob.trim();
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(escape(atob(trimmed)))
        : Buffer.from(trimmed, 'base64').toString('utf8');
    return deserializeState(json, now);
  } catch {
    return null;
  }
}
