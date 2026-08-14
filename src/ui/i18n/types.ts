import type { AchievementId, BusinessId } from '../../core/types';

export type LocaleCode = 'en' | 'nl';

/**
 * Every user-visible string in the game.
 *
 * Parameterised strings are functions rather than templates with placeholders,
 * so word order and pluralisation are the translator's decision, not the call
 * site's. Dutch and English happen to agree on order here; German and French
 * will not, and this shape already allows for it.
 *
 * `businesses` is a total `Record<BusinessId, …>`: adding a tier to
 * `core/businesses.ts` is a **compile error** until every locale names it.
 */
export interface Strings {
  businesses: Record<BusinessId, string>;
  /** Achievement titles, keyed by id — total, like `businesses`. */
  achievements: Record<AchievementId, string>;

  // BusinessRow
  buy: (count: number) => string;
  manager: string;
  managerHired: string;
  autoBadge: string;
  nextMilestone: (units: number) => string;
  allMilestones: string;
  tapToRun: string;

  // TopBar
  globalMultiplier: (value: string) => string;

  // BottomBar
  boostActive: (multiplier: number) => string;
  boostOffer: (multiplier: number, seconds: number) => string;
  sellEmpire: string;

  // OfflineModal
  welcomeBack: string;
  offlineRan: (time: string, capped: boolean) => string;
  offlineDouble: (amount: string) => string;
  offlineCollect: string;

  // StreakModal
  streakTitle: (day: number) => string;
  streakBody: string;
  streakRestarted: string;
  streakClaim: string;

  // Achievements
  achievementsTitle: string;
  achievementsCount: (earned: number, total: number) => string;
  achievementUnlocked: string;
  achievementsClose: string;
  a11yOpenAchievements: (earned: number, total: number) => string;

  // PrestigeModal
  prestigeTitle: string;
  prestigeBody: string;
  prestigeSummary: (investors: number, percent: string) => string;
  prestigeConfirm: string;
  prestigeCancel: string;

  // Accessibility labels — never rendered, always read aloud.
  a11yRun: (name: string) => string;
  a11yBuy: (count: number, name: string) => string;
  a11yManagerHired: (name: string) => string;
  a11yHireManager: (name: string) => string;
  a11yBoost: (multiplier: number, seconds: number) => string;
  a11ySellEmpire: (investors: number) => string;
}
