/**
 * Rewarded-ad service (spec §15) — native implementation, and the module
 * TypeScript resolves for the bare `./ads` import. Metro picks `ads.web.ts`
 * on web (where no ad SDK exists) and this file everywhere else.
 *
 * DESIGN RULE: the game core never learns that ads exist. This service only
 * answers "was the reward earned?" — what the reward *is* lives in
 * balance.ts, and is granted by the store. That is what keeps the game fully
 * playable with MONETIZATION_ENABLED off, which is how it ships today.
 *
 * TO TURN ADS ON (all four steps are required):
 *   1. In the AdMob console create two REWARDED ad units for the Android app
 *      and paste their ids into ADMOB.rewarded* in monetization.ts.
 *   2. `npx expo install react-native-google-mobile-ads`
 *   3. Add to app.json:
 *        "plugins": [..., ["react-native-google-mobile-ads", {
 *           "androidAppId": "ca-app-pub-9525292071323030~3914844171" }]]
 *   4. Flip MONETIZATION_ENABLED to true and run `npm run build:apk`.
 *      Ads cannot work in Expo Go or on web — they need a native build.
 *
 * Until step 2 the SDK is not installed, so the dynamic import below fails
 * and every request resolves `false`: no ad, no reward, no crash.
 */
import { ADMOB, MONETIZATION_ENABLED } from './monetization';

export type RewardSlot = 'production' | 'offline';

export interface AdService {
  /** Is a rewarded ad available to show right now? */
  isAvailable(slot: RewardSlot): boolean;
  /** Show it. Resolves true only if the user earned the reward. */
  showRewarded(slot: RewardSlot): Promise<boolean>;
}

function unitIdFor(slot: RewardSlot): string {
  return slot === 'production' ? ADMOB.rewardedProductionBoost : ADMOB.rewardedDoubleOffline;
}

/**
 * True only when monetization is switched on AND the ad unit for this slot
 * has actually been configured. An unconfigured slot must never render a
 * "watch an ad" button that cannot work.
 */
function configured(slot: RewardSlot): boolean {
  return MONETIZATION_ENABLED && unitIdFor(slot).length > 0;
}

export const adService: AdService = {
  isAvailable(slot) {
    return configured(slot);
  },

  async showRewarded(slot) {
    if (!configured(slot)) return false;
    try {
      // Imported lazily so the module graph does not require the SDK until
      // ads are actually enabled.
      const ads = await import('react-native-google-mobile-ads');
      const { RewardedAd, RewardedAdEventType, AdEventType } = ads;
      const ad = RewardedAd.createForAdRequest(unitIdFor(slot));

      return await new Promise<boolean>((resolve) => {
        let earned = false;
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          unsubLoaded();
          unsubEarned();
          unsubClosed();
          unsubError();
          resolve(value);
        };

        const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show());
        const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        });
        // Resolve on CLOSED, not on EARNED: closing early must not pay out.
        const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned));
        const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));

        ad.load();
      });
    } catch (error) {
      // SDK missing, no fill, offline — all the same to the player: no reward.
      console.warn('[ads] rewarded ad unavailable', error);
      return false;
    }
  },
};
