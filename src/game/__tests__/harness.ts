/**
 * The shared balance harness (spec §18 Phase 10, extended in Phase 12).
 *
 * NOT a test file — it deliberately does not match jest's testMatch. It holds
 * the simulated player that every balance report drives, so ladder.test.ts,
 * trials.test.ts and longwalk.test.ts can each run in their OWN worker.
 *
 * That split is not tidiness. These are multi-hour simulations that allocate
 * hard, and with two of them in one file the worker died of a V8 out-of-memory
 * partway through — which jest surfaces as "Test suite failed to run" next to
 * a heap dump, not as anything resembling a balance problem. One heavy report
 * per file keeps each within a worker's heap.
 *
 * THE PLAYER MODEL NOW RUNS TRIALS. It has to: since the Phase 12 rebalance,
 * completed Trial tiers gate Converge (5) and Unify (15), so a bot that never
 * entered one would simply stop at P2 forever and report that the game is
 * broken. The trial policy below is the closest thing to a "reasonably good
 * idle player" the harness can state in code — and, because Trials are the
 * lane a routed player pushes hardest, it is also the part of the model most
 * worth arguing with when the numbers come out wrong.
 */
import { BAL } from '../balance';
import { tick } from '../loop';
import { defaultState } from '../state';
import { buyDim, canDimBoost, doDimBoost, highestUnlockedTier } from '../systems/dimensions';
import {
  canEnterChallenge,
  challengeGoal,
  challengeTiers,
  enterChallenge,
  exitChallenge,
} from '../systems/challenges';
import { buyMiner, buyResearch, buyResearchGrid } from '../systems/minerals';
import { buyMoteUpgrade } from '../systems/motes';
import {
  buyAeonGrid,
  buyAeonNode,
  buyMetaGrid,
  buyMetaUpgrade,
  buyPrismUpgrade,
  buyShardUpgrade,
  canUnify,
  doAscend,
  doCollapse,
  doConverge,
  doUnify,
  trialTiersCleared,
  worthAscending,
  worthCollapsing,
  worthConverging,
} from '../systems/prestige';
import { globalMult } from '../systems/multipliers';
import { buyStarNode, canBuyNode } from '../systems/starchart';
import { buySparkUpgrade, tapPower } from '../systems/upgrades';
import { GameState } from '../types';

/**
 * Simulation resolution for the reports. The live game runs at 20 ticks/sec;
 * 5 is enough to keep the dimension cascade accurate to well within the
 * precision these targets are stated at, and makes a multi-hour walk practical
 * in CI. The month-long walk drops to 1 (see longwalk.test.ts).
 */
export const TICKS_PER_SEC = 5;

/**
 * One simulated second of a competent idle player.
 *
 * `shopping` is false on most seconds: sweeping every shop each simulated
 * second is both unlike a real player and the harness's dominant cost (it
 * dwarfs the ticks themselves). Every few seconds is plenty — autobuyers run
 * on their own interval regardless.
 */
export function playSecond(
  s: GameState,
  tapping: boolean,
  shopping = true,
  ticksPerSec = TICKS_PER_SEC,
): void {
  const dt = 1 / ticksPerSec;
  for (let t = 0; t < ticksPerSec; t++) {
    tick(s, dt);
    if (tapping && t < 2) {
      s.spark = s.spark.add(tapPower(s));
      s.totalTaps += 1;
    }
  }
  if (!shopping) return;

  // Spend everything, deepest currency first.
  //
  // This is the HARNESS's model of a player at the shops, and it lives here
  // rather than in the game because the game does not do it: the prestige
  // trees are deliberately never automated (see systems/automation). What the
  // bot must not have its own copy of is the RESET rule — that one is shipped
  // code, and `prestigeIfWorthwhile` below calls it rather than reimplementing.
  for (const m of BAL.metaShop) buyMetaUpgrade(s, m.id);
  for (const n of BAL.aeonTree) buyAeonNode(s, n.id);
  for (const r of BAL.research) buyResearch(s, r.id);
  for (const u of BAL.metaGrid) for (let i = 0; i < 5 && buyMetaGrid(s, u.id); i++);
  for (const u of BAL.aeonUpgrades) for (let i = 0; i < 5 && buyAeonGrid(s, u.id); i++);
  for (const u of BAL.researchGrid) for (let i = 0; i < 5 && buyResearchGrid(s, u.id); i++);
  for (const u of BAL.prismGrid) for (let i = 0; i < 5 && buyPrismUpgrade(s, u.id); i++);
  for (const u of BAL.shardUpgrades) for (let i = 0; i < 5 && buyShardUpgrade(s, u.id); i++);

  // The Star Chart is ranked and is the main Shard sink: buy DOWN it, not one
  // rank per node per pass, or the bot hoards Shards it should be spending.
  for (let pass = 0; pass < 6; pass++) {
    let bought = false;
    for (const n of BAL.starChart) {
      if (canBuyNode(s, n.id) && buyStarNode(s, n.id)) bought = true;
    }
    if (!bought) break;
  }

  for (const u of BAL.sparkUpgrades) buySparkUpgrade(s, u.id);
  for (const u of BAL.motes.upgrades) buyMoteUpgrade(s, u.id);
  for (const m of BAL.miners) for (let i = 0; i < 5 && buyMiner(s, m.id); i++);

  if (canDimBoost(s)) doDimBoost(s);
  for (let tier = highestUnlockedTier(s); tier >= 1; tier--) buyDim(s, tier, 'MAX');

  // Elements: pour points into Lux (global) then Ignis. Crude, but it is what
  // the softcap makes correct — spreading beats deepening past 25 points.
  allocateElements(s);
}

/** Spend element points, respecting the per-element softcap threshold. */
function allocateElements(s: GameState): void {
  if (s.ascends === 0) return;
  const order: ('lux' | 'ignis' | 'aer' | 'aqua' | 'terra')[] = [
    'lux',
    'ignis',
    'aer',
    'aqua',
    'terra',
  ];
  while (s.elements.points > 0) {
    // Fill each element to the softcap knee before starting the next.
    const target = order.find((id) => {
      if (id === 'terra' && s.converges === 0) return false;
      return (s.elements.alloc[id] ?? 0) < BAL.softcap.element.t;
    });
    const id = target ?? 'lux';
    s.elements = {
      ...s.elements,
      points: s.elements.points - 1,
      alloc: { ...s.elements.alloc, [id]: (s.elements.alloc[id] ?? 0) + 1 },
    };
  }
}

/**
 * Reset when the gain is a meaningful step up — what a sensible player does.
 *
 * The rule itself lives in prestige.ts (worth*) because the game's own
 * auto-prestige toggles use it too: the bot in this report and the autobuyers
 * a player actually leaves running must not be playing different games.
 */
export function prestigeIfWorthwhile(s: GameState): void {
  if (canUnify(s)) {
    doUnify(s);
    return;
  }
  if (worthConverging(s)) {
    doConverge(s);
    return;
  }
  if (worthAscending(s)) {
    doAscend(s);
    return;
  }
  if (worthCollapsing(s)) {
    doCollapse(s);
  }
}

// ---------------------------------------------------------------------------
// The Trial policy
// ---------------------------------------------------------------------------

/** Give up on a Trial that has not landed in this long (simulated seconds). */
export const TRIAL_PATIENCE = 45 * 60;
/** After giving up, do something else for this long before trying again. */
const TRIAL_COOLDOWN = 20 * 60;
/**
 * When no gate is blocking, a Trial is something you do BETWEEN pushes, not
 * instead of them.
 *
 * Without this bound the model degenerated in a way worth recording: after the
 * first Unify the bot's Trial target became "all forty", so it re-entered a
 * Trial the moment the cooldown lapsed and never came out. Prestige is
 * suspended inside a Trial run, so 220 simulated hours passed with zero
 * Collapses, zero Ascends and a frozen Shard count — which reads in the report
 * exactly like an economy deadlock, and is not one. A player who has a gate in
 * front of them grinds Trials; a player who does not, does one now and then.
 */
const TRIAL_IDLE_INTERVAL = 2 * 3600;

/**
 * How many Trial tiers does this player currently WANT?
 *
 * Not "all of them, always": a bot that lived in the Trials tab would never
 * prestige, and a bot that never entered one would stall at P2 forever. The
 * honest model is that a player runs Trials when a gate is in front of them,
 * and mops up the rest when the main loop has gone quiet.
 */
function trialTarget(s: GameState, secondsSincePrestige: number): number {
  const total = BAL.challenges.defs.reduce((sum, c) => sum + c.maxTier, 0);
  if (s.converges === 0) return BAL.gates.convergeTrialTiers;
  if (s.unifies === 0) return BAL.gates.unifyTrialTiers;
  // Endgame, or the ladder has gone quiet: go clear the rest.
  return secondsSincePrestige > 20 * 60 ? total : BAL.gates.unifyTrialTiers;
}

export interface TrialPolicyState {
  cooldownUntil: number;
  lastTrialEndedAt: number;
  wasInTrial: boolean;
}

export function freshTrialPolicy(): TrialPolicyState {
  return { cooldownUntil: -Infinity, lastTrialEndedAt: -Infinity, wasInTrial: false };
}

/** Is a gate actually blocking the player right now? */
function gateBlocking(s: GameState): boolean {
  const tiers = trialTiersCleared(s);
  if (s.converges === 0) return tiers < BAL.gates.convergeTrialTiers;
  if (s.unifies === 0) return tiers < BAL.gates.unifyTrialTiers;
  return false;
}

/**
 * Enter, persist in, or abandon a Trial. Called once per simulated second.
 *
 * Picks the trial with the LOWEST remaining goal, which is what a player does
 * — the goals span 1e8 to 1e1400, so "which trial next" is not a close call.
 */
export function runTrialPolicy(
  s: GameState,
  policy: TrialPolicyState,
  now: number,
  secondsSincePrestige: number,
): void {
  if (s.ascends === 0) return;

  // A Trial can end two ways: abandoned here, or completed inside the tick.
  // Both close the sitting, so the transition is what we watch, not the exit.
  if (policy.wasInTrial && s.activeChallenge === null) policy.lastTrialEndedAt = now;
  policy.wasInTrial = s.activeChallenge !== null;

  if (s.activeChallenge !== null) {
    if (s.challengeElapsed > TRIAL_PATIENCE) {
      exitChallenge(s);
      policy.cooldownUntil = now + TRIAL_COOLDOWN;
      policy.lastTrialEndedAt = now;
      policy.wasInTrial = false;
    }
    return;
  }

  if (now < policy.cooldownUntil) return;
  if (trialTiersCleared(s) >= trialTarget(s, secondsSincePrestige)) return;
  // No gate blocking? Then Trials are a side errand, not the whole day.
  if (!gateBlocking(s) && now - policy.lastTrialEndedAt < TRIAL_IDLE_INTERVAL) return;

  let best: string | null = null;
  let bestGoal = 0;
  for (const def of BAL.challenges.defs) {
    if (challengeTiers(s, def.id) >= def.maxTier) continue;
    if (!canEnterChallenge(s, def.id)) continue;
    const goal = challengeGoal(s, def.id).log10();
    if (best === null || goal < bestGoal) {
      best = def.id;
      bestGoal = goal;
    }
  }
  if (best) {
    enterChallenge(s, best);
    policy.wasInTrial = true;
  }
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

export interface Ladder {
  firstOrbiter: number;
  dimBoost: number;
  collapse: number;
  ascend: number;
  trial: number;
  converge: number;
  unify: number;
  reclearP1: number;
  /** Every Converge in the walk, in seconds — the ladder's slowest heartbeat. */
  convergeEvery: number[];
  /** Every Unify in the walk, in seconds. */
  unifyEvery: number[];
  trialTiers: number;
  /** Simulated seconds spent inside Trial runs — prestige is suspended there. */
  trialSeconds: number;
  trace: Sample[];
}

export const NEVER = -1;

/**
 * Both reports here are multi-hour simulations, and `npm test` runs them while
 * the app project is also saturating the cores. An under-sized budget fails as
 * a torn-down environment ("Cannot read properties of undefined"), never as a
 * clean timeout, so it costs more to debug than it ever saves.
 */
export const LADDER_TIMEOUT_MS = 900_000;

export interface WalkOpts {
  ticksPerSec?: number;
  /** Shop every Nth second once past the manual early game. */
  shopEvery?: number;
  stopWhen?: (s: GameState) => boolean;
  /** Sample the curve every N simulated seconds (0 = off). */
  traceEvery?: number;
  /**
   * Never enter a Trial. Used to measure a PURE ladder property — a Trial run
   * suspends prestige and resets Layer 0 on both entry and exit, so a walk
   * that takes Trial detours cannot be asked how fast P1 re-clears.
   */
  noTrials?: boolean;
}

/**
 * One sample of the whole economy.
 *
 * Tuning a five-layer ladder from first-reach times alone is guesswork: when
 * Converge lands twenty hours late, the times cannot tell you whether Prism
 * accrues too slowly, Shards do, or the "worth taking?" rule is holding the
 * Ascend back. The trace can — it is the difference between tuning the game
 * and tuning one constant at a time until the report stops complaining.
 */
export interface Sample {
  sec: number;
  collapses: number;
  ascends: number;
  converges: number;
  unifies: number;
  /** log10 of the headline resource — the exponents are the readable part. */
  sparkExp: number;
  shardsEver: number;
  prismEver: number;
  aeonEver: number;
  oreEver: number;
  trials: number;
  globalExp: number;
}

export function formatSample(t: Sample): string {
  const f = (n: number) => (n >= 1000 ? n.toExponential(1) : n.toFixed(n < 10 ? 1 : 0));
  return [
    `${(t.sec / 3600).toFixed(1).padStart(6)}h`,
    `C${String(t.collapses).padStart(5)}`,
    `A${String(t.ascends).padStart(4)}`,
    `V${String(t.converges).padStart(3)}`,
    `U${String(t.unifies).padStart(2)}`,
    `trials${String(t.trials).padStart(3)}`,
    `spark1e${t.sparkExp.toFixed(0).padStart(6)}`,
    `glob1e${t.globalExp.toFixed(0).padStart(5)}`,
    `sh${f(t.shardsEver).padStart(9)}`,
    `pr${f(t.prismEver).padStart(9)}`,
    `ae${f(t.aeonEver).padStart(9)}`,
    `ore${f(t.oreEver).padStart(9)}`,
  ].join(' ');
}

/**
 * Walk the ladder for `horizonSeconds`, recording first-reach times.
 * `stopWhen` ends the walk early — used to land on a known rung.
 */
export function walkLadder(
  horizonSeconds: number,
  stopWhen?: (s: GameState) => boolean,
  opts: WalkOpts = {},
): { s: GameState; at: Ladder } {
  const ticksPerSec = opts.ticksPerSec ?? TICKS_PER_SEC;
  const shopEvery = opts.shopEvery ?? 4;
  const s = defaultState(0);
  const at: Ladder = {
    firstOrbiter: NEVER,
    dimBoost: NEVER,
    collapse: NEVER,
    ascend: NEVER,
    trial: NEVER,
    converge: NEVER,
    unify: NEVER,
    reclearP1: NEVER,
    convergeEvery: [],
    unifyEvery: [],
    trialTiers: 0,
    trialSeconds: 0,
    trace: [],
  };
  const traceEvery = opts.traceEvery ?? 0;
  let ascendAt = NEVER;
  let trialSecondsAtAscend = 0;
  let converges = 0;
  let unifies = 0;
  let lastPrestige = 0;
  const policy = freshTrialPolicy();

  for (let sec = 0; sec < horizonSeconds; sec++) {
    // Taps for the first two minutes. Shops every second through the manual
    // early game — where each purchase genuinely matters and a keen player is
    // watching — then settles down once autobuyers exist.
    playSecond(s, sec < 120, sec < 900 || sec % shopEvery === 0, ticksPerSec);

    const beforeResets = s.collapses + s.ascends + s.converges + s.unifies;
    // A Trial run must never be interrupted by a prestige — that would throw
    // away the run the goal is measured against.
    if (s.activeChallenge === null) prestigeIfWorthwhile(s);
    if (s.collapses + s.ascends + s.converges + s.unifies > beforeResets) lastPrestige = sec;
    if (!opts.noTrials) runTrialPolicy(s, policy, sec, sec - lastPrestige);

    if (at.firstOrbiter === NEVER && s.dims[0].amount.gte(1)) at.firstOrbiter = sec;
    if (at.dimBoost === NEVER && s.dimBoosts >= 1) at.dimBoost = sec;
    if (at.collapse === NEVER && s.collapses >= 1) at.collapse = sec;
    if (s.activeChallenge !== null) at.trialSeconds += 1;
    if (at.ascend === NEVER && s.ascends >= 1) {
      at.ascend = sec;
      ascendAt = sec;
      trialSecondsAtAscend = at.trialSeconds;
    }
    if (at.trial === NEVER && trialTiersCleared(s) >= 1) at.trial = sec;
    /*
     * §10: each prestige makes the layer below 3–10× faster to re-clear.
     *
     * Measured on shardsEver, not the balance: shardsEver is what the Ascend
     * gate and gain both read, so it is what "P1 is re-cleared" means. Time
     * spent INSIDE a Trial is netted out, because prestige is suspended there
     * — a player who spends forty minutes clearing the Converge gate has not
     * had a slow re-clear, they have been doing something else, and counting
     * it here would make the Trial gate look like a P1 regression.
     */
    if (at.reclearP1 === NEVER && ascendAt !== NEVER && s.shardsEver.gte(BAL.ascend.unlockShards)) {
      at.reclearP1 = sec - ascendAt - (at.trialSeconds - trialSecondsAtAscend);
    }
    if (s.converges > converges) {
      converges = s.converges;
      at.convergeEvery.push(sec);
      if (at.converge === NEVER) at.converge = sec;
    }
    if (s.unifies > unifies) {
      unifies = s.unifies;
      at.unifyEvery.push(sec);
      if (at.unify === NEVER) at.unify = sec;
    }
    if (traceEvery > 0 && sec % traceEvery === 0) {
      at.trace.push({
        sec,
        collapses: s.collapses,
        ascends: s.ascends,
        converges: s.converges,
        unifies: s.unifies,
        sparkExp: Math.max(0, s.bestSparkRun.log10()),
        shardsEver: s.shardsEver.toNumber(),
        prismEver: s.prismEver.toNumber(),
        aeonEver: s.aeonEver.toNumber(),
        oreEver: s.oreEver.toNumber(),
        trials: trialTiersCleared(s),
        globalExp: Math.max(0, globalMult(s).log10()),
      });
    }
    if (stopWhen?.(s) || opts.stopWhen?.(s)) break;
  }
  at.trialTiers = trialTiersCleared(s);
  return { s, at };
}

export const mins = (sec: number) => (sec === NEVER ? 'NOT REACHED' : `${(sec / 60).toFixed(1)}m`);
export const hours = (sec: number) => (sec === NEVER ? 'NOT REACHED' : `${(sec / 3600).toFixed(2)}h`);
export const days = (sec: number) => (sec === NEVER ? 'NOT REACHED' : `${(sec / 86400).toFixed(2)}d`);
