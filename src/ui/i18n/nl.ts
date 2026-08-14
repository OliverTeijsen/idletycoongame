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
  },

  buy: (count) => `Koop ×${count}`,
  manager: 'Manager',
  managerHired: '✓ Auto',
  autoBadge: 'AUTO',
  nextMilestone: (units) => `Volgende ×2 over ${units} ${units === 1 ? 'stuk' : 'stuks'}`,
  allMilestones: 'Alle mijlpalen behaald ×1024',
  tapToRun: 'tik om te draaien',

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
  prestigeBody: 'Je cash en al je zaken verdwijnen. Je investeerders blijven — voorgoed.',
  prestigeSummary: (investors, percent) =>
    `${investors} investeerders · ${percent} winst, permanent`,
  prestigeConfirm: 'Verkopen',
  prestigeCancel: 'Nog even niet',

  a11yRun: (name) => `${name} draaien`,
  a11yBuy: (count, name) => `Koop ${count} ${name}`,
  a11yManagerHired: (name) => `${name} is geautomatiseerd`,
  a11yHireManager: (name) => `Neem manager voor ${name}`,
  a11yBoost: (multiplier, seconds) => `${multiplier}× winst gedurende ${seconds} seconden`,
  a11ySellEmpire: (investors) => `Verkoop je imperium voor ${investors} investeerders`,
};
