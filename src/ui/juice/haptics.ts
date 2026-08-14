import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics that can never break the game.
 *
 * Web has no haptics API and older/cheaper Android devices may have no motor or
 * no permission, so every call is fire-and-forget: unsupported is not an error,
 * it is simply nothing happening. Nothing here is awaited — a buzz that lands a
 * frame late is fine, a tap that blocks on one is not.
 */
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

function fire(run: () => Promise<void>): void {
  if (!SUPPORTED) return;
  void run().catch(() => {
    // A device without a motor is a normal device, not a failure.
  });
}

/** A business cycle paid out, or a tier was tapped. The most frequent buzz. */
export function tapFeedback(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A purchase landed. */
export function buyFeedback(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** A ×2 milestone, the golden bag, or a manager hire — the good moments. */
export function rewardFeedback(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Prestige: the heaviest thing the player can do. */
export function prestigeFeedback(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}
