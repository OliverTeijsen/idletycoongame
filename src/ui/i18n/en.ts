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
    'perks-1': 'First Lesson',
    'perks-25': 'Tuition Paid',
  },

  perks: {
    profit: 'Profit Margin',
    payout: 'Exit Valuation',
    cost: 'Bulk Discount',
    manager: 'Staffing Agency',
    offline: 'Night Shift',
    tap: 'Fast Hands',
    golden: 'Golden Fries',
  },

  perkDesc: {
    profit: '×1.2 profit per level — no ceiling',
    payout: '+10% investors per sale — no ceiling',
    cost: '3% off every business, per level',
    manager: '8% off every manager, per level',
    offline: '+2 hours of offline earnings, per level',
    tap: '+1 cycle per tap, per level',
    golden: 'Golden fries ×1 stronger and 3s longer, per level',
  },

  perkEffect: {
    profit: (v) => `now ×${v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString('en')}`,
    payout: (v) => `now +${Math.round(v * 100)}%`,
    cost: (v) => `now −${Math.round(v * 100)}%`,
    manager: (v) => `now −${Math.round(v * 100)}%`,
    offline: (v) => `now ${v} hours`,
    tap: (v) => `now ${v} ${v === 1 ? 'cycle' : 'cycles'} per tap`,
    golden: (v) => `now ×${v}`,
  },

  buy: (count) => `Buy ×${count}`,
  manager: 'Manager',
  managerHired: '✓ Auto',
  autoBadge: 'AUTO',
  nextMilestone: (units) => `Next ×2 in ${units} ${units === 1 ? 'unit' : 'units'}`,
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
  prestigeBody:
    'Your cash and every business are gone. Your investors and your skill tree stay — for good.',
  prestigeSummary: (investors) => `${investors} investors to spend`,
  prestigeConfirm: 'Sell',
  prestigeCancel: 'Not just yet',

  perksTitle: 'Investors 💼',
  perksAvailable: (available, total) => `${available} free · ${total} earned all-time`,
  perksSpendHint: 'Investors do nothing while they sit on the shelf. Spend them.',
  perkLevelLabel: (level, max) => (max === null ? `Lv. ${level}` : `Lv. ${level}/${max}`),
  perkMaxed: 'MAX',
  perkEndless: '∞',
  perksClose: 'Close',

  a11yRun: (name) => `Run ${name}`,
  a11yBuy: (count, name) => `Buy ${count} ${name}`,
  a11yManagerHired: (name) => `${name} is automated`,
  a11yHireManager: (name) => `Hire a manager for ${name}`,
  a11yBoost: (multiplier, seconds) => `${multiplier}× profit for ${seconds} seconds`,
  a11ySellEmpire: (investors) => `Sell your empire for ${investors} investors`,
  a11yOpenPerks: (available) => `Skill tree, ${available} investors free to spend`,
  a11yBuyPerk: (name, cost) => `Buy ${name} for ${cost} investors`,
};
