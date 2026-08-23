/**
 * The one game store (spec §3). UI reads via selectors; systems mutate a
 * draft GameState which is re-published immutably so React re-renders.
 *
 * The simulation ticks OUTSIDE React (App.tsx drives createLoop). To keep
 * per-tick GC pressure low, tick() mutates a working copy and publishes a
 * new top-level object reference; Decimal instances are immutable anyway.
 */
import { create } from 'zustand';

import { tick } from '../game/loop';
import { applyOffline, OfflineSummary } from '../game/offline';
import { defaultState } from '../game/state';
import { AutomationId, toggleAutobuyer } from '../game/systems/automation';
import { buyDim, doDimBoost } from '../game/systems/dimensions';
import { buyMoteUpgrade } from '../game/systems/motes';
import { buyShardUpgrade, doCollapse } from '../game/systems/prestige';
import { buyStarNode, respecStarChart } from '../game/systems/starchart';
import { buySparkUpgrade, tapPower } from '../game/systems/upgrades';
import { BuyAmount, GameOptions, GameState } from '../game/types';
import { clearSave, loadGame, saveGame } from '../services/storage';

interface GameStore {
  game: GameState;
  buyAmount: BuyAmount;
  offlineSummary: OfflineSummary | null;

  /** Advance the simulation. Called by the loop driver, not by components. */
  tick(dt: number): void;
  tap(): void;
  buyDimension(tier: number): void;
  buySparkUpgrade(id: string): void;
  buyMoteUpgrade(id: string): void;
  dimBoost(): void;
  collapse(): void;
  buyShardUpgrade(id: string): void;
  buyStarNode(id: string): void;
  respecStarChart(): void;
  toggleAutobuyer(id: AutomationId): void;
  setBuyAmount(amount: BuyAmount): void;
  setOptions(patch: Partial<GameOptions>): void;

  /** Load save + apply offline progress. Called once at startup. */
  init(now?: number): void;
  save(now?: number): void;
  hardReset(): void;
  importState(state: GameState): void;
  dismissOffline(): void;
}

/** Shallow-copy the state so zustand subscribers see a new reference. */
function republish(game: GameState): GameState {
  return { ...game };
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: defaultState(),
  buyAmount: 1,
  offlineSummary: null,

  tick(dt) {
    const game = get().game;
    tick(game, dt);
    set({ game: republish(game) });
  },

  tap() {
    const game = get().game;
    game.spark = game.spark.add(tapPower(game));
    game.totalSpark = game.totalSpark.add(tapPower(game));
    if (game.spark.gt(game.bestSparkRun)) game.bestSparkRun = game.spark;
    game.totalTaps += 1;
    set({ game: republish(game) });
  },

  buyDimension(tier) {
    const { game, buyAmount } = get();
    if (buyDim(game, tier, buyAmount) > 0) set({ game: republish(game) });
  },

  buySparkUpgrade(id) {
    const game = get().game;
    if (buySparkUpgrade(game, id)) set({ game: republish(game) });
  },

  buyMoteUpgrade(id) {
    const game = get().game;
    if (buyMoteUpgrade(game, id)) set({ game: republish(game) });
  },

  dimBoost() {
    const game = get().game;
    if (doDimBoost(game)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  collapse() {
    const game = get().game;
    if (doCollapse(game)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  buyShardUpgrade(id) {
    const game = get().game;
    if (buyShardUpgrade(game, id)) set({ game: republish(game) });
  },

  buyStarNode(id) {
    const game = get().game;
    if (buyStarNode(game, id)) set({ game: republish(game) });
  },

  respecStarChart() {
    const game = get().game;
    respecStarChart(game);
    set({ game: republish(game) });
  },

  toggleAutobuyer(id) {
    const game = get().game;
    toggleAutobuyer(game, id);
    set({ game: republish(game) });
  },

  setBuyAmount(amount) {
    set({ buyAmount: amount });
  },

  setOptions(patch) {
    const game = get().game;
    game.options = { ...game.options, ...patch };
    set({ game: republish(game) });
    get().save();
  },

  init(now = Date.now()) {
    const loaded = loadGame(now);
    if (!loaded) {
      set({ game: defaultState(now), offlineSummary: null });
      return;
    }
    const summary = applyOffline(loaded, (now - loaded.savedAt) / 1000);
    set({ game: republish(loaded), offlineSummary: summary });
  },

  save(now = Date.now()) {
    const game = get().game;
    game.savedAt = now;
    saveGame(game);
  },

  hardReset() {
    clearSave();
    set({ game: defaultState(), offlineSummary: null, buyAmount: 1 });
  },

  importState(state) {
    set({ game: republish(state), offlineSummary: null });
    get().save();
  },

  dismissOffline() {
    set({ offlineSummary: null });
  },
}));
