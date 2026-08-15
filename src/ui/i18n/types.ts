import type { AchievementId, BusinessId, PerkId } from '../../core/types';

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
  /** Perk names, keyed by id — total, like `businesses`. */
  perks: Record<PerkId, string>;
  /** What one level of a perk buys. Static copy; the numbers are in the text. */
  perkDesc: Record<PerkId, string>;
  /**
   * The perk's effect at its current level, formatted with the right unit.
   *
   * The magnitude comes from `perkEffectValue()` in the core; only the unit and
   * the sign convention ("×3.2", "−18%", "36 h") are a translation decision,
   * which is exactly the split the rest of this file uses.
   */
  perkEffect: Record<PerkId, (value: number) => string>;

  // BusinessRow
  buy: (count: number) => string;
  manager: string;
  managerHired: string;
  autoBadge: string;
  nextMilestone: (units: number) => string;
  /** Label on the cash-upgrade button, given the level already bought. */
  upgrade: (level: number) => string;
  tapToRun: string;
  /** Shown in place of the cycle time once a tier produces without pausing. */
  continuous: string;
  nextSpeed: (units: number) => string;

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
  prestigeSummary: (investors: number) => string;
  prestigeConfirm: string;
  prestigeCancel: string;

  // PerksModal — the investor skill tree
  perksTitle: string;
  /** Headline over the tree: how many investors are free to spend. */
  perksAvailable: (available: number, total: number) => string;
  /** Nudge shown while investors sit unspent — the whole point of the screen. */
  perksSpendHint: string;
  perkLevelLabel: (level: number, max: number | null) => string;
  perkMaxed: string;
  perkEndless: string;
  perksClose: string;

  // Accessibility labels — never rendered, always read aloud.
  a11yRun: (name: string) => string;
  a11yBuy: (count: number, name: string) => string;
  a11yManagerHired: (name: string) => string;
  a11yHireManager: (name: string) => string;
  a11yBoost: (multiplier: number, seconds: number) => string;
  a11ySellEmpire: (investors: number) => string;
  a11yOpenPerks: (available: number) => string;
  a11yBuyPerk: (name: string, cost: number) => string;
  a11yUpgrade: (name: string, level: number) => string;
}
