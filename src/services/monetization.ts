/**
 * Monetization hooks (spec §15) — flagged off until Phase 9.
 *
 * The core stays playable ad-free; every call site checks MONETIZATION_ENABLED.
 * Phase 9 installs react-native-google-mobile-ads, adds the plugin entry to
 * app.json (android_app_id below), and implements:
 *   - rewarded "×2 production for 15 min"
 *   - rewarded "double offline" on the away-summary
 *
 * AdMob App IDs are public (they ship in the AndroidManifest); the *ad unit*
 * ids for the two rewarded placements still need to be created in the AdMob
 * console and filled in here.
 */
export const MONETIZATION_ENABLED = false;

export const ADMOB = {
  /**
   * GYRE Android app. Also set in app.json's config plugin, which is what
   * writes it into the AndroidManifest — both must stay in sync.
   */
  androidAppId: 'ca-app-pub-9525292071323030~3914844171',

  /**
   * REWARDED ad unit ids. Both are still empty, which is why no "watch an
   * ad" button renders anywhere: `adService.isAvailable()` returns false for
   * an unconfigured slot, and the call sites hide themselves rather than
   * showing a button that cannot pay out.
   *
   * To fill these in: AdMob console → your GYRE app → Ad units → Add ad unit
   * → **Rewarded** → create two (one per slot below) → paste the
   * `ca-app-pub-…/…` ids here, then flip MONETIZATION_ENABLED to true and
   * run `npm run build:apk`. Ads need a native build; they cannot work on
   * web or in Expo Go.
   */
  rewardedProductionBoost: '',
  rewardedDoubleOffline: '',
} as const;

/**
 * Google's official always-fill TEST ids. Swap these in temporarily to prove
 * the whole flow works on a device before your real units are approved —
 * never ship them, and never click your own live ads (that is what gets an
 * AdMob account banned).
 */
export const ADMOB_TEST_IDS = {
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;
