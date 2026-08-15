import type { Strings } from './types';

/** Dutch — the game's native flavour, kept as the original copy was written. */
export const nl: Strings = {
  businesses: {
    friet: 'Frietkot',
    wafel: 'Wafelkraam',
    choco: 'Chocolaterie',
    cafe: 'Biercafé',
    brouw: 'Trappistenbrouwerij',
    resto: 'Sterrenrestaurant',
    truck: 'Foodtruck-franchise',
    super: 'Supermarktketen',
    concern: 'Voedselconcern',
    empire: 'Wereldwijd F&B-imperium',
  },

  achievements: {
    'tap-100': 'Op gang',
    'tap-1k': 'Frituurhanden',
    'tap-10k': 'Muisarm',
    'own-50': 'Hoekwinkel',
    'own-250': 'Regionale keten',
    'own-1000': 'Begrip',
    'managers-5': 'Delegeerder',
    'managers-all': 'Volledig bemand',
    'earn-1m': 'Eerste miljoen',
    'earn-1t': 'Biljonair',
    'prestige-1': 'Verkocht',
    'prestige-10': 'Seriestichter',
    'streak-3': 'Vaste klant',
    'streak-7': 'Week vol',
    'streak-30': 'Instituut',
    'perks-1': 'Eerste les',
    'perks-25': 'Schoolgeld betaald',
    'upgrades-10': 'Verbouwd',
    'upgrades-50': 'Alles vernieuwd',
  },

  perks: {
    profit: 'Winstmarge',
    payout: 'Overnamesom',
    cost: 'Inkoopkorting',
    manager: 'Uitzendbureau',
    offline: 'Nachtploeg',
    tap: 'Snelle handen',
    golden: 'Gouden frietzak',
  },

  perkDesc: {
    profit: '×1,2 winst per niveau — zonder plafond',
    payout: '+10% investeerders per verkoop — zonder plafond',
    cost: '3% korting op elke zaak, per niveau',
    manager: '8% korting op elke manager, per niveau',
    offline: '+2 uur offline verdienen, per niveau',
    tap: '+1 cyclus per tik, per niveau',
    golden: 'Gouden frietzak ×1 sterker en 3s langer, per niveau',
  },

  perkEffect: {
    profit: (v) => `nu ×${v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString('nl')}`,
    payout: (v) => `nu +${Math.round(v * 100)}%`,
    cost: (v) => `nu −${Math.round(v * 100)}%`,
    manager: (v) => `nu −${Math.round(v * 100)}%`,
    offline: (v) => `nu ${v} uur`,
    tap: (v) => `nu ${v} ${v === 1 ? 'cyclus' : 'cycli'} per tik`,
    golden: (v) => `nu ×${v}`,
  },

  buy: (count) => `Koop ×${count}`,
  manager: 'Manager',
  managerHired: '✓ Auto',
  autoBadge: 'AUTO',
  nextMilestone: (units) => `Volgende ×2 over ${units} ${units === 1 ? 'stuk' : 'stuks'}`,
  // Kept to a glyph and a number: on a 360px phone this button is ~64px wide,
  // and "Upgrade ×2" already overflows it. `a11yUpgrade` carries the meaning.
  upgrade: (level) => (level === 0 ? '↑ ×2' : `↑ ×2 · ${level}`),
  tapToRun: 'tik om te draaien',
  continuous: 'doorlopend',
  nextSpeed: (units) => `2× sneller over ${units}`,

  globalMultiplier: (value) => `Globale multiplier ×${value}`,

  boostActive: (multiplier) => `×${multiplier} actief`,
  boostOffer: (multiplier, seconds) => `×${multiplier} winst · ${seconds}s`,
  sellEmpire: 'Verkoop imperium',

  welcomeBack: 'Welkom terug! 🍟',
  offlineRan: (time, capped) =>
    `Je frituur draaide ${time} door${capped ? ' (max 12 u)' : ''}.`,
  offlineDouble: (amount) => `Verdubbel · ${amount}`,
  offlineCollect: 'Ophalen',

  streakTitle: (day) => `Dag ${day} 🔥`,
  streakBody: 'Kom morgen terug om de reeks vol te houden.',
  streakRestarted: 'Je hebt een dag gemist, dus de reeks begint opnieuw.',
  streakClaim: 'Mooi',

  achievementsTitle: 'Prestaties',
  achievementsCount: (earned, total) => `${earned} van ${total} behaald`,
  achievementUnlocked: 'Prestatie behaald',
  achievementsClose: 'Sluiten',
  a11yOpenAchievements: (earned, total) => `Prestaties, ${earned} van ${total} behaald`,

  prestigeTitle: 'Verkoop je imperium?',
  prestigeBody:
    'Je cash en al je zaken verdwijnen. Je investeerders en je skilltree blijven — voorgoed.',
  prestigeSummary: (investors) => `${investors} investeerders om uit te geven`,
  prestigeConfirm: 'Verkopen',
  prestigeCancel: 'Nog even niet',

  perksTitle: 'Investeerders 💼',
  perksAvailable: (available, total) => `${available} vrij · ${total} ooit verdiend`,
  perksSpendHint: 'Investeerders doen niets zolang ze op de plank liggen. Geef ze uit.',
  perkLevelLabel: (level, max) => (max === null ? `Niv. ${level}` : `Niv. ${level}/${max}`),
  perkMaxed: 'MAX',
  perkEndless: '∞',
  perksClose: 'Sluiten',

  a11yRun: (name) => `${name} draaien`,
  a11yBuy: (count, name) => `Koop ${count} ${name}`,
  a11yManagerHired: (name) => `${name} is geautomatiseerd`,
  a11yHireManager: (name) => `Neem manager voor ${name}`,
  a11yBoost: (multiplier, seconds) => `${multiplier}× winst gedurende ${seconds} seconden`,
  a11ySellEmpire: (investors) => `Verkoop je imperium voor ${investors} investeerders`,
  a11yOpenPerks: (available) => `Skilltree, ${available} investeerders vrij te besteden`,
  a11yBuyPerk: (name, cost) => `Koop ${name} voor ${cost} investeerders`,
  a11yUpgrade: (name, level) =>
    `Upgrade ${name} naar niveau ${level}, verdubbelt de winst van deze zaak`,
};
