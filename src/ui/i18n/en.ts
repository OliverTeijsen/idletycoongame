import type { Strings } from './types';

/** Default locale and the fallback for every unsupported system language. */
export const en: Strings = {
  businesses: {
    friet: 'Fry Shack',
    wafel: 'Waffle Stand',
    choco: 'Chocolate Shop',
    cafe: 'Beer Café',
    brouw: 'Trappist Brewery',
    resto: 'Michelin-Star Restaurant',
    truck: 'Food Truck Franchise',
    super: 'Supermarket Chain',
    concern: 'Food Conglomerate',
    empire: 'Global F&B Empire',
  },

  achievements: {
    'tap-100': 'Warming Up',
    'tap-1k': 'Fryer Hands',
    'tap-10k': 'Repetitive Strain',
    'own-50': 'Corner Shop',
    'own-250': 'Local Chain',
    'own-1000': 'Household Name',
    'managers-5': 'Delegator',
    'managers-all': 'Fully Staffed',
    'earn-1m': 'First Million',
    'earn-1t': 'Trillionaire',
    'prestige-1': 'Sold Out',
    'prestige-10': 'Serial Founder',
    'streak-3': 'Regular',
    'streak-7': 'Week Straight',
    'streak-30': 'Institution',
  },

  buy: (count) => `Buy ×${count}`,
  manager: 'Manager',
  managerHired: '✓ Auto',
  autoBadge: 'AUTO',
  nextMilestone: (units) => `Next ×2 in ${units} ${units === 1 ? 'unit' : 'units'}`,
  allMilestones: 'All milestones reached ×1024',
  tapToRun: 'tap to run',
  continuous: 'non-stop',
  nextSpeed: (units) => `2× faster in ${units}`,

  globalMultiplier: (value) => `Global multiplier ×${value}`,

  boostActive: (multiplier) => `×${multiplier} active`,
  boostOffer: (multiplier, seconds) => `×${multiplier} profit · ${seconds}s`,
  sellEmpire: 'Sell empire',

  welcomeBack: 'Welcome back! 🍟',
  offlineRan: (time, capped) => `Your shop kept running for ${time}${capped ? ' (max 12 h)' : ''}.`,
  offlineDouble: (amount) => `Double · ${amount}`,
  offlineCollect: 'Collect',

  streakTitle: (day) => `Day ${day} 🔥`,
  streakBody: 'Come back tomorrow to keep the run going.',
  streakRestarted: 'You missed a day, so the run starts over.',
  streakClaim: 'Nice',

  achievementsTitle: 'Achievements',
  achievementsCount: (earned, total) => `${earned} of ${total} earned`,
  achievementUnlocked: 'Achievement unlocked',
  achievementsClose: 'Close',
  a11yOpenAchievements: (earned, total) => `Achievements, ${earned} of ${total} earned`,

  prestigeTitle: 'Sell your empire?',
  prestigeBody: 'Your cash and every business are gone. Your investors stay — for good.',
  prestigeSummary: (investors, percent) =>
    `${investors} investors · ${percent} profit, permanently`,
  prestigeConfirm: 'Sell',
  prestigeCancel: 'Not just yet',

  a11yRun: (name) => `Run ${name}`,
  a11yBuy: (count, name) => `Buy ${count} ${name}`,
  a11yManagerHired: (name) => `${name} is automated`,
  a11yHireManager: (name) => `Hire a manager for ${name}`,
  a11yBoost: (multiplier, seconds) => `${multiplier}× profit for ${seconds} seconds`,
  a11ySellEmpire: (investors) => `Sell your empire for ${investors} investors`,
};
