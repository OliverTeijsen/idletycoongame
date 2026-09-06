/**
 * The one game store (spec §3). UI reads via selectors; systems mutate a
 * draft GameState which is re-published immutably so React re-renders.
 *
 * The simulation ticks OUTSIDE React (App.tsx drives createLoop). To keep
 * per-tick GC pressure low, tick() mutates a working copy and publishes a
 * new top-level object reference; Decimal instances are immutable anyway.
 */
import { create } from 'zustand';

import { playCue, setMuted, setVolume } from '../audio';
import { tick } from '../game/loop';
import { applyOffline, grantDoubleOffline, OfflineSummary } from '../game/offline';
import { grantRewardBoost } from '../game/systems/timeflux';
import { adService, RewardSlot } from '../services/ads';
import { defaultState } from '../game/state';
import { AutomationId, toggleAutobuyer } from '../game/systems/automation';
import { enterChallenge, exitChallenge } from '../game/systems/challenges';
import { buyDim, doDimBoost, tapGain } from '../game/systems/dimensions';
import { ElementId } from '../game/balance';
import { allocateElement, respecElements } from '../game/systems/elements';
import { toggleManager } from '../game/systems/managers';
import { buyMiner, buyResearch, buyResearchGrid } from '../game/systems/minerals';
import { buyMoteUpgrade } from '../game/systems/motes';
import {
  buyAeonGrid,
  buyAeonNode,
  buyMetaGrid,
  buyMetaUpgrade,
  buyPrismUpgrade,
  buyShardUpgrade,
  doAscend,
  doCollapse,
  doConverge,
  doUnify,
} from '../game/systems/prestige';
import { startFluxBoost, startWarp } from '../game/systems/timeflux';
import { buyStarNode, respecStarChart } from '../game/systems/starchart';
import { buySparkUpgrade } from '../game/systems/upgrades';
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
  ascend(): void;
  converge(): void;
  unify(): void;
  buyMetaUpgrade(id: string): void;
  buyMetaGrid(id: string): void;
  buyAeonNode(id: string): void;
  buyAeonGrid(id: string): void;
  buyMiner(id: string): void;
  buyResearch(id: string): void;
  buyResearchGrid(id: string): void;
  toggleManager(id: string): void;
  startWarp(): void;
  startFluxBoost(): void;
  buyPrismUpgrade(id: string): void;
  allocateElement(id: ElementId): void;
  respecElements(): void;
  enterChallenge(id: string): void;
  exitChallenge(): void;
  buyShardUpgrade(id: string): void;
  buyStarNode(id: string): void;
  /** Long-press: buy ranks until they run out or the Shards do. */
  buyStarNodeMany(id: string): void;
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
  /** Drop one toasted achievement off the transient queue. */
  dismissAchievement(id: string): void;
  /**
   * Offer a rewarded ad for `slot`. Resolves true when the reward was
   * actually earned; the reward itself is applied here, never by the ad
   * layer (spec §15).
   */
  watchRewarded(slot: RewardSlot): Promise<boolean>;
}

/** Shallow-copy the state so zustand subscribers see a new reference. */
function republish(game: GameState): GameState {
  return { ...game };
}

/** Push persisted audio preferences into the (module-level) sound layer. */
function syncAudio(game: GameState): void {
  setMuted(game.options.muted);
  setVolume(game.options.volume);
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
    // tapGain, not tapPower: a tap is worth the larger of its flat power and
    // a slice of current production, so it stays useful after every reset.
    const gain = tapGain(game);
    game.spark = game.spark.add(gain);
    game.totalSpark = game.totalSpark.add(gain);
    if (game.spark.gt(game.bestSparkRun)) game.bestSparkRun = game.spark;
    game.totalTaps += 1;
    playCue('tap');
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
      playCue('prestige');
      set({ game: republish(game) });
      get().save();
    }
  },

  collapse() {
    const game = get().game;
    if (doCollapse(game)) {
      playCue('prestige');
      set({ game: republish(game) });
      get().save();
    }
  },

  ascend() {
    const game = get().game;
    if (doAscend(game)) {
      playCue('prestige');
      set({ game: republish(game) });
      get().save();
    }
  },

  converge() {
    const game = get().game;
    if (doConverge(game)) {
      playCue('prestige');
      set({ game: republish(game) });
      get().save();
    }
  },

  unify() {
    const game = get().game;
    if (doUnify(game)) {
      playCue('prestige');
      set({ game: republish(game) });
      get().save();
    }
  },

  buyMetaUpgrade(id) {
    const game = get().game;
    if (buyMetaUpgrade(game, id)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  buyMetaGrid(id) {
    const game = get().game;
    if (buyMetaGrid(game, id)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  buyAeonNode(id) {
    const game = get().game;
    if (buyAeonNode(game, id)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  buyAeonGrid(id) {
    const game = get().game;
    if (buyAeonGrid(game, id)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  buyMiner(id) {
    const game = get().game;
    if (buyMiner(game, id)) set({ game: republish(game) });
  },

  buyResearch(id) {
    const game = get().game;
    if (buyResearch(game, id)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  buyResearchGrid(id) {
    const game = get().game;
    if (buyResearchGrid(game, id)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  toggleManager(id) {
    const game = get().game;
    if (toggleManager(game, id)) set({ game: republish(game) });
  },

  startWarp() {
    const game = get().game;
    if (startWarp(game)) set({ game: republish(game) });
  },

  startFluxBoost() {
    const game = get().game;
    if (startFluxBoost(game)) set({ game: republish(game) });
  },

  buyPrismUpgrade(id) {
    const game = get().game;
    if (buyPrismUpgrade(game, id)) set({ game: republish(game) });
  },

  allocateElement(id) {
    const game = get().game;
    if (allocateElement(game, id)) set({ game: republish(game) });
  },

  respecElements() {
    const game = get().game;
    respecElements(game);
    set({ game: republish(game) });
  },

  enterChallenge(id) {
    const game = get().game;
    if (enterChallenge(game, id)) {
      set({ game: republish(game) });
      get().save();
    }
  },

  exitChallenge() {
    const game = get().game;
    if (exitChallenge(game)) {
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

  /*
   * Bounded, and it loops over the LIVE state rather than a snapshot: the
   * chart is where a thousand Shards go, and buying one rank at a time up a
   * geometric price curve is the kind of clicking a game should do for you.
   */
  buyStarNodeMany(id) {
    const game = get().game;
    let bought = false;
    for (let i = 0; i < 50 && buyStarNode(game, id); i++) bought = true;
    if (bought) set({ game: republish(game) });
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
    if (patch.muted !== undefined) setMuted(patch.muted);
    if (patch.volume !== undefined) setVolume(patch.volume);
    set({ game: republish(game) });
    get().save();
  },

  init(now = Date.now()) {
    const loaded = loadGame(now);
    if (!loaded) {
      const fresh = defaultState(now);
      syncAudio(fresh);
      set({ game: fresh, offlineSummary: null });
      return;
    }
    syncAudio(loaded);
    const summary = applyOffline(loaded, (now - loaded.savedAt) / 1000);
    set({
      game: republish(loaded),
      // The gains are still granted when the summary is hidden — the option
      // only controls whether the modal interrupts you on resume.
      offlineSummary: loaded.options.showOfflineSummary ? summary : null,
    });
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

  dismissAchievement(id) {
    const game = get().game;
    if (!game.pendingAchievements.includes(id)) return;
    game.pendingAchievements = game.pendingAchievements.filter((a) => a !== id);
    set({ game: republish(game) });
  },

  async watchRewarded(slot) {
    const earned = await adService.showRewarded(slot);
    if (!earned) return false;
    const game = get().game;
    if (slot === 'production') {
      grantRewardBoost(game);
      set({ game: republish(game) });
    } else {
      const summary = get().offlineSummary;
      // Only ever doubles a summary that is still on screen, and only once.
      if (!summary || summary.doubled) return false;
      const doubled = grantDoubleOffline(game, summary);
      set({ game: republish(game), offlineSummary: doubled });
    }
    get().save();
    return true;
  },
}));
