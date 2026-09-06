/**
 * Achievements (spec §8.5).
 *
 * Each is a pure predicate over GameState, evaluated in the tick's unlock
 * step — already-earned ones are skipped, so the per-tick cost falls as the
 * player progresses. They grant a small, always-relevant global multiplier
 * (1 + 0.01 · earned) that rewards natural play rather than optimisation.
 *
 * Leaf module (balance/numbers/types only) so multipliers.ts can read the
 * multiplier without an import cycle.
 */
import { AchievementDef, BAL } from '../balance';
import { D, Decimal, ONE, cleanMul } from '../numbers';
import { GameState } from '../types';

interface Achievement extends AchievementDef {
  check(state: GameState): boolean;
}

/** Total orbiters owned across every tier. */
function totalOrbiters(state: GameState): Decimal {
  return state.dims.reduce((sum, d) => sum.add(d.amount), D(0));
}

function unlockedTiers(state: GameState): number {
  return state.dims.filter((d) => d.unlocked).length;
}

function starNodesActive(state: GameState): number {
  return Object.values(state.starChart).filter((rank) => rank > 0).length;
}

/** Total ranks across the whole chart — the number that keeps climbing. */
function starRanksTotal(state: GameState): number {
  return Object.values(state.starChart).reduce((a, b) => a + b, 0);
}

function gridLevels(grid: Record<string, number>): number {
  return Object.values(grid).reduce((a, b) => a + b, 0);
}

function researchOwnedCount(state: GameState): number {
  return Object.values(state.research).filter(Boolean).length;
}

function challengeTiersTotal(state: GameState): number {
  return Object.values(state.challenges).reduce((a, b) => a + b, 0);
}

function maxElementAlloc(state: GameState): number {
  const values = Object.values(state.elements.alloc);
  return values.length === 0 ? 0 : Math.max(...values);
}

const spark = (id: string, name: string, at: string): Achievement => ({
  id,
  name,
  desc: `Reach ✦ ${at} in one run`,
  group: 'spark',
  check: (s) => s.bestSparkRun.gte(D(at)),
});

export const ACHIEVEMENTS: Achievement[] = [
  // — Spark milestones ————————————————————————————————————————————————
  spark('spark1e3', 'First Light', '1e3'),
  spark('spark1e6', 'Kindled', '1e6'),
  spark('spark1e9', 'Radiant', '1e9'),
  spark('spark1e12', 'Blazing', '1e12'),
  spark('spark1e18', 'Stellar', '1e18'),
  spark('spark1e30', 'Galactic', '1e30'),
  spark('spark1e60', 'Beyond Counting', '1e60'),
  spark('spark1e100', 'Googolspark', '1e100'),
  spark('spark1e300', 'Past the Double', '1e300'),
  spark('spark1e1000', 'Kilo-Exponent', '1e1000'),

  // — Orbiters ————————————————————————————————————————————————————————
  {
    id: 'firstOrbiter',
    name: 'It Turns',
    desc: 'Buy your first orbiter',
    group: 'orbiters',
    check: (s) => s.dims[0].amount.gte(1),
  },
  {
    id: 'orbiters100',
    name: 'A Crowd',
    desc: 'Own 100 orbiters in total',
    group: 'orbiters',
    check: (s) => totalOrbiters(s).gte(100),
  },
  {
    id: 'orbiters1e6',
    name: 'A Swarm',
    desc: 'Own 1e6 orbiters in total',
    group: 'orbiters',
    check: (s) => totalOrbiters(s).gte(D('1e6')),
  },
  {
    id: 'orbiters1e15',
    name: 'A Galaxy',
    desc: 'Own 1e15 orbiters in total',
    group: 'orbiters',
    check: (s) => totalOrbiters(s).gte(D('1e15')),
  },
  {
    id: 'tier6',
    name: 'Sixth Ring',
    desc: 'Unlock the sixth orbiter tier',
    group: 'orbiters',
    check: (s) => unlockedTiers(s) >= 6,
  },
  {
    id: 'tier8',
    name: 'The Full Gyre',
    desc: 'Unlock all eight orbiter tiers',
    group: 'orbiters',
    check: (s) => unlockedTiers(s) >= 8,
  },
  {
    id: 'boost1',
    name: 'Deeper',
    desc: 'Perform a Dimension Boost',
    group: 'orbiters',
    check: (s) => s.dimBoosts >= 1,
  },
  {
    id: 'boost25',
    name: 'Compression',
    desc: 'Reach 25 Dimension Boosts in one run',
    group: 'orbiters',
    check: (s) => s.dimBoosts >= 25,
  },
  {
    id: 'taps100',
    name: 'Hands On',
    desc: 'Tap the Core 100 times',
    group: 'orbiters',
    check: (s) => s.totalTaps >= 100,
  },
  {
    id: 'taps5000',
    name: 'Repetitive Strain',
    desc: 'Tap the Core 5,000 times',
    group: 'orbiters',
    check: (s) => s.totalTaps >= 5000,
  },

  // — Motes ———————————————————————————————————————————————————————————
  {
    id: 'firstMote',
    name: 'Drift',
    desc: 'Collect your first Mote',
    group: 'motes',
    check: (s) => s.motesEver.gt(0),
  },
  {
    id: 'motes1e3',
    name: 'Resonant',
    desc: 'Hold ◦ 1e3 Motes',
    group: 'motes',
    check: (s) => s.motes.gte(D('1e3')),
  },
  {
    id: 'motes1e9',
    name: 'Harmonic',
    desc: 'Hold ◦ 1e9 Motes',
    group: 'motes',
    check: (s) => s.motes.gte(D('1e9')),
  },
  {
    id: 'motes1e20',
    name: 'Standing Chord',
    desc: 'Hold ◦ 1e20 Motes',
    group: 'motes',
    check: (s) => s.motes.gte(D('1e20')),
  },
  {
    id: 'focus10',
    name: 'Sharp Focus',
    desc: 'Reach Focus level 10',
    group: 'motes',
    check: (s) => (s.moteUpgrades['focus'] ?? 0) >= 10,
  },
  {
    id: 'resonance10',
    name: 'Feedback Loop',
    desc: 'Reach Resonance level 10',
    group: 'motes',
    check: (s) => (s.moteUpgrades['resonance'] ?? 0) >= 10,
  },

  // — Prestige firsts & counts ————————————————————————————————————————
  {
    id: 'collapse1',
    name: 'Collapse',
    desc: 'Collapse the Core for the first time',
    group: 'prestige',
    check: (s) => s.collapses >= 1,
  },
  {
    id: 'collapse10',
    name: 'Cycle',
    desc: 'Collapse 10 times',
    group: 'prestige',
    check: (s) => s.collapses >= 10,
  },
  {
    id: 'collapse100',
    name: 'Rhythm',
    desc: 'Collapse 100 times',
    group: 'prestige',
    check: (s) => s.collapses >= 100,
  },
  {
    id: 'ascend1',
    name: 'Ascend',
    desc: 'Ascend for the first time',
    group: 'prestige',
    check: (s) => s.ascends >= 1,
  },
  {
    id: 'ascend10',
    name: 'Spectrum',
    desc: 'Ascend 10 times',
    group: 'prestige',
    check: (s) => s.ascends >= 10,
  },
  {
    id: 'converge1',
    name: 'Converge',
    desc: 'Converge for the first time',
    group: 'prestige',
    check: (s) => s.converges >= 1,
  },
  {
    id: 'converge5',
    name: 'Recurrence',
    desc: 'Converge 5 times',
    group: 'prestige',
    check: (s) => s.converges >= 5,
  },
  {
    id: 'unify1',
    name: 'Unify',
    desc: 'Unify the Gyre',
    group: 'prestige',
    check: (s) => s.unifies >= 1,
  },
  {
    id: 'unify5',
    name: 'Eternal Return',
    desc: 'Unify 5 times',
    group: 'prestige',
    check: (s) => s.unifies >= 5,
  },
  {
    id: 'shards1e3',
    name: 'Shardhoard',
    desc: 'Hold ◆ 1,000 Shards',
    group: 'prestige',
    check: (s) => s.shards.gte(1000),
  },
  {
    id: 'prism50',
    name: 'Refraction',
    desc: 'Hold ▲ 50 Prism',
    group: 'prestige',
    check: (s) => s.prism.gte(50),
  },
  {
    id: 'aeon20',
    name: 'Long Now',
    desc: 'Hold ✧ 20 Aeon',
    group: 'prestige',
    check: (s) => s.aeon.gte(20),
  },
  {
    id: 'singularity5',
    name: 'Event Horizon',
    desc: 'Hold ⦿ 5 Singularity',
    group: 'prestige',
    check: (s) => s.singularity.gte(5),
  },

  // — The depths: side systems ————————————————————————————————————————
  {
    id: 'star5',
    name: 'Navigator',
    desc: 'Own 5 different Star Chart nodes',
    group: 'depths',
    check: (s) => starNodesActive(s) >= 5,
  },
  {
    id: 'star11',
    name: 'Cartographer',
    desc: 'Own 11 different Star Chart nodes',
    group: 'depths',
    check: (s) => starNodesActive(s) >= 11,
  },
  {
    id: 'element1',
    name: 'Spectrum Walker',
    desc: 'Allocate your first element point',
    group: 'depths',
    check: (s) => Object.keys(s.elements.alloc).length > 0,
  },
  {
    id: 'elementCapstone',
    name: 'Capstone',
    desc: 'Reach 10 points in a single element',
    group: 'depths',
    check: (s) => maxElementAlloc(s) >= BAL.elements.capstones[0],
  },
  {
    id: 'challenge1',
    name: 'Trial by Fire',
    desc: 'Complete a challenge tier',
    group: 'depths',
    check: (s) => challengeTiersTotal(s) >= 1,
  },
  {
    id: 'challenge5',
    name: 'Tempered',
    desc: 'Complete 5 challenge tiers',
    group: 'depths',
    check: (s) => challengeTiersTotal(s) >= 5,
  },
  {
    id: 'challengeAll',
    name: 'Unbreakable',
    desc: 'Complete every challenge tier',
    group: 'depths',
    check: (s) =>
      challengeTiersTotal(s) >= BAL.challenges.defs.reduce((sum, c) => sum + c.maxTier, 0),
  },
  {
    id: 'miner1',
    name: 'Prospector',
    desc: 'Buy your first miner',
    group: 'depths',
    check: (s) => Object.values(s.miners).some((n) => n > 0),
  },
  {
    id: 'ore1e4',
    name: 'Motherlode',
    desc: 'Hold ⛏ 10,000 Ore',
    group: 'depths',
    check: (s) => s.ore.gte(10000),
  },
  {
    id: 'research4',
    name: 'Scholar',
    desc: 'Buy 4 research nodes',
    group: 'depths',
    check: (s) => researchOwnedCount(s) >= 4,
  },
  {
    id: 'researchAll',
    name: 'The Whole Archive',
    desc: 'Buy every research node',
    group: 'depths',
    check: (s) => researchOwnedCount(s) >= BAL.research.length,
  },
  {
    id: 'manager1',
    name: 'Delegation',
    desc: 'Assign a Boost Manager',
    group: 'depths',
    check: (s) => s.boostSlots.length >= 1,
  },
  {
    id: 'manager3',
    name: 'Full Crew',
    desc: 'Have 3 Boost Managers assigned',
    group: 'depths',
    check: (s) => s.boostSlots.length >= 3,
  },
  {
    id: 'flux1',
    name: 'Banked Time',
    desc: 'Earn Flux from offline overflow',
    group: 'depths',
    check: (s) => s.flux.gt(0),
  },
  {
    id: 'warp',
    name: 'Fast Forward',
    desc: 'Run a Time Warp',
    group: 'depths',
    check: (s) => s.warpRemaining > 0,
  },

  // — The long haul ——————————————————————————————————————————————————
  /*
   * These exist because the achievement multiplier is `1.03^earned` — an
   * always-relevant global — and a list that stops at the first Unify would
   * stop paying on day five of a month-long game. Every one of them is a
   * milestone in a DIFFERENT lane, so they also read as a checklist of the
   * systems a player has actually engaged with.
   */
  {
    id: 'star40',
    name: 'Deep Sky',
    desc: 'Buy 40 Star Chart ranks in total',
    group: 'depths',
    check: (s) => starRanksTotal(s) >= 40,
  },
  {
    id: 'star200',
    name: 'The Whole Sky',
    desc: 'Buy 200 Star Chart ranks in total',
    group: 'depths',
    check: (s) => starRanksTotal(s) >= 200,
  },
  {
    id: 'ore1e9',
    name: 'Deep Seam',
    desc: 'Mine ⛏ 1e9 Ore in one cycle',
    group: 'depths',
    check: (s) => s.oreEver.gte(D('1e9')),
  },
  {
    id: 'ore1e15',
    name: 'Hollow World',
    desc: 'Mine ⛏ 1e15 Ore in one cycle',
    group: 'depths',
    check: (s) => s.oreEver.gte(D('1e15')),
  },
  {
    id: 'refine5',
    name: 'Refinery',
    desc: 'Reach Deep Refinement level 5',
    group: 'depths',
    check: (s) => (s.researchGrid['deepRefine'] ?? 0) >= 5,
  },
  {
    id: 'prismGrid20',
    name: 'Full Spectrum',
    desc: 'Buy 20 Prism grid levels in total',
    group: 'prestige',
    check: (s) => gridLevels(s.prismGrid) >= 20,
  },
  {
    id: 'aeonGrid10',
    name: 'Deep Well',
    desc: 'Buy 10 Aeon upgrade levels in total',
    group: 'prestige',
    check: (s) => gridLevels(s.aeonGrid) >= 10,
  },
  {
    id: 'eternalFlame3',
    name: 'Still Burning',
    desc: 'Reach Eternal Flame level 3',
    group: 'mastery',
    check: (s) => (s.metaGrid['eternalFlame'] ?? 0) >= 3,
  },
  {
    id: 'unify10',
    name: 'Again and Again',
    desc: 'Unify 10 times',
    group: 'mastery',
    check: (s) => s.unifies >= 10,
  },
  {
    id: 'trials20',
    name: 'Trial Hardened',
    desc: 'Complete 20 Trial tiers',
    group: 'depths',
    check: (s) => challengeTiersTotal(s) >= 20,
  },
  {
    id: 'played168h',
    name: 'A Week in the Gyre',
    desc: 'Play for 168 hours',
    group: 'mastery',
    check: (s) => s.timePlayed >= 168 * 3600,
  },
  {
    id: 'played720h',
    name: 'A Month in the Gyre',
    desc: 'Play for 720 hours',
    group: 'mastery',
    check: (s) => s.timePlayed >= 720 * 3600,
  },

  // — Mastery ————————————————————————————————————————————————————————
  {
    id: 'played1h',
    name: 'Settled In',
    desc: 'Play for one hour',
    group: 'mastery',
    check: (s) => s.timePlayed >= 3600,
  },
  {
    id: 'played24h',
    name: 'Devoted',
    desc: 'Play for 24 hours',
    group: 'mastery',
    check: (s) => s.timePlayed >= 86400,
  },
  {
    id: 'meta1',
    name: 'Meta',
    desc: 'Buy a Meta Shop upgrade',
    group: 'mastery',
    check: (s) => Object.values(s.metaShop).some(Boolean),
  },
  {
    id: 'metaAll',
    name: 'Everything, Forever',
    desc: 'Buy every Meta Shop upgrade',
    group: 'mastery',
    check: (s) => Object.values(s.metaShop).filter(Boolean).length >= BAL.metaShop.length,
  },
  {
    id: 'automated',
    name: 'It Runs Itself',
    desc: 'Own auto-Collapse, auto-Ascend and auto-Converge',
    group: 'mastery',
    check: (s) =>
      s.aeonTree['autoCollapse'] === true &&
      s.metaShop['autoAscend'] === true &&
      s.metaShop['autoConverge'] === true,
  },
];

export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);
const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementDef(id: string): Achievement | undefined {
  return byId.get(id);
}

export function achievementUnlocked(state: GameState, id: string): boolean {
  return state.achievements[id] === true;
}

export function achievementCount(state: GameState): number {
  return Object.values(state.achievements).filter(Boolean).length;
}

/**
 * Global multiplier: perAchievement ^ earned.
 *
 * It used to be 1 + 0.01·count — a textbook dead buff. Sixty achievements
 * bought a total of "+60%", which is a fortune at ×1 and literally invisible
 * next to the ×1e40 the rest of the stack is producing by the second day. As
 * an EXPONENT it is worth the same fraction of your output forever, which is
 * rule 1 in balance.ts.
 */
export function achievementMult(state: GameState): Decimal {
  const count = achievementCount(state);
  if (count <= 0) return ONE;
  return cleanMul(D(BAL.achievements.perAchievement).pow(count));
}

/**
 * Evaluate every not-yet-earned achievement. Newly earned ids are appended to
 * the transient `pendingAchievements` queue for the UI to toast, and returned.
 * Mutates `state`.
 */
export function checkAchievements(state: GameState): string[] {
  let earned: string[] | null = null;
  for (const def of ACHIEVEMENTS) {
    if (state.achievements[def.id]) continue;
    if (!def.check(state)) continue;
    // Copy-on-write: only allocate a new record when something actually fires.
    if (!earned) {
      earned = [];
      state.achievements = { ...state.achievements };
    }
    state.achievements[def.id] = true;
    earned.push(def.id);
  }
  if (earned) {
    // Cap the queue: an offline catch-up can earn a dozen at once and the UI
    // only ever shows the most recent few.
    state.pendingAchievements = [...state.pendingAchievements, ...earned].slice(-5);
  }
  return earned ?? [];
}
