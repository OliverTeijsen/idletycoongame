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
  /** GYRE Android app — provided by Oliver 2026-08-24. */
  androidAppId: 'ca-app-pub-9525292071323030~3914844171',
  /** TODO(Phase 9): create in AdMob console. */
  rewardedProductionBoost: '',
  rewardedDoubleOffline: '',
} as const;
