import { getLocales } from 'expo-localization';

import { en } from './en';
import { nl } from './nl';
import type { LocaleCode, Strings } from './types';

export type { LocaleCode, Strings } from './types';

export const DEFAULT_LOCALE: LocaleCode = 'en';

const LOCALES: Record<LocaleCode, Strings> = { en, nl };

function isSupported(code: string): code is LocaleCode {
  return code === 'en' || code === 'nl';
}

/**
 * First supported language among the user's preferences, else English.
 *
 * Takes the tag list as an argument rather than reading the device directly, so
 * the interesting cases (`nl-BE`, an unsupported language, no locales at all)
 * are testable without mocking the native module.
 *
 * Region is discarded: `nl-BE` and `nl-NL` get the same copy. If Flemish and
 * Dutch ever need to diverge, that split belongs here.
 */
export function resolveLocale(tags: readonly (string | null | undefined)[]): LocaleCode {
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const code = tag.split('-')[0]?.toLowerCase();
    if (code !== undefined && isSupported(code)) return code;
  }
  return DEFAULT_LOCALE;
}

function detect(): LocaleCode {
  // Never let a device-locale failure take down the app; English is always fine.
  try {
    return resolveLocale(getLocales().map((l) => l.languageTag ?? l.languageCode));
  } catch {
    return DEFAULT_LOCALE;
  }
}

let active: LocaleCode = detect();

export function getLocale(): LocaleCode {
  return active;
}

/**
 * Override the detected locale. There is no in-game language switcher yet, so
 * this exists for tests — and as the single seam a settings toggle would use.
 * Components read `useStrings()`, which is where the re-render would be wired.
 */
export function setLocale(code: LocaleCode): void {
  active = code;
}

/** Reset to whatever the device says. Used between tests. */
export function resetLocale(): void {
  active = detect();
}

/**
 * The active locale's strings.
 *
 * A hook rather than a bare import so that adding a runtime language switcher
 * later is a change to this function alone, not to all six components.
 */
export function useStrings(): Strings {
  return LOCALES[active];
}

/** Non-component access, for the rare string built outside a render. */
export function strings(): Strings {
  return LOCALES[active];
}
