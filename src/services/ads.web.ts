/**
 * Rewarded-ad service — web build.
 *
 * react-native-google-mobile-ads is native-only, so importing it here would
 * break the web bundle. Web reports no ads available, which makes every
 * "watch an ad" affordance hide itself rather than render a dead button.
 */
import type { AdService } from './ads';

export type { AdService, RewardSlot } from './ads';

export const adService: AdService = {
  isAvailable() {
    return false;
  },
  async showRewarded() {
    return false;
  },
};
