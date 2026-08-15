import { BUSINESSES } from '../../../core/businesses';
import type { BusinessId } from '../../../core/types';
import { en } from '../en';
import { DEFAULT_LOCALE, getLocale, resetLocale, resolveLocale, setLocale, strings } from '../index';
import { nl } from '../nl';
import type { Strings } from '../types';

const LOCALES: ReadonlyArray<readonly [string, Strings]> = [
  ['en', en],
  ['nl', nl],
];

afterEach(() => {
  resetLocale();
});

describe('resolveLocale', () => {
  it('matches an exact supported tag', () => {
    expect(resolveLocale(['nl'])).toBe('nl');
    expect(resolveLocale(['en'])).toBe('en');
  });

  it('ignores the region, so Flemish and Dutch share one locale', () => {
    expect(resolveLocale(['nl-BE'])).toBe('nl');
    expect(resolveLocale(['nl-NL'])).toBe('nl');
    expect(resolveLocale(['en-US'])).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(resolveLocale(['NL-be'])).toBe('nl');
  });

  it('takes the first supported language, not the first language', () => {
    expect(resolveLocale(['de-DE', 'fr-FR', 'nl-BE'])).toBe('nl');
  });

  it('falls back to English for an unsupported language', () => {
    expect(resolveLocale(['de-DE'])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(['ja'])).toBe('en');
  });

  // getLocales() is a native call; an empty or malformed list must not crash.
  it('falls back to English for empty or malformed input', () => {
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale([null, undefined])).toBe('en');
    expect(resolveLocale([''])).toBe('en');
  });
});

describe('setLocale', () => {
  it('switches the active strings', () => {
    setLocale('nl');
    expect(getLocale()).toBe('nl');
    expect(strings().offlineCollect).toBe('Ophalen');

    setLocale('en');
    expect(strings().offlineCollect).toBe('Collect');
  });
});

describe('locale completeness', () => {
  const ids: BusinessId[] = BUSINESSES.map((b) => b.id);

  it.each(LOCALES)('%s names every business tier', (_name, locale) => {
    for (const id of ids) {
      expect(locale.businesses[id]).toBeTruthy();
    }
    // No stale keys left behind by a removed tier.
    expect(Object.keys(locale.businesses).sort()).toEqual([...ids].sort());
  });

  it.each(LOCALES)('%s has no empty string anywhere', (_name, locale) => {
    for (const [key, value] of Object.entries(locale)) {
      if (typeof value === 'string') expect(value.length).toBeGreaterThan(0);
      expect(key).toBeTruthy();
    }
  });

  // The core carries an English `name` for logs and fallback. Two sources of the
  // same text drift silently; this is the guard that makes the duplication safe.
  it('en never drifts from the core business names', () => {
    for (const def of BUSINESSES) {
      expect(en.businesses[def.id]).toBe(def.name);
    }
  });

  it('translates every tier away from the Dutch original', () => {
    // Guards against a half-finished translation pass leaving Dutch in `en`.
    for (const def of BUSINESSES) {
      expect(en.businesses[def.id]).not.toBe(nl.businesses[def.id]);
    }
  });
});

describe('every parameterised string', () => {
  // Sample arguments, applied positionally up to each function's arity. The
  // point is not the wording but that no template throws or comes back empty —
  // without this, a broken Dutch string would only surface on a Dutch device,
  // because the rest of the suite pins the locale to English.
  const ARGS: unknown[] = [2, 'x', true];

  it.each(LOCALES)('%s builds without throwing', (_name, locale) => {
    for (const [key, value] of Object.entries(locale)) {
      if (typeof value !== 'function') continue;
      const fn = value as (...args: unknown[]) => string;
      const out = fn(...ARGS.slice(0, fn.length));
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
      // A stray "undefined" or "[object Object]" means a missing placeholder.
      expect(out).not.toMatch(/undefined|\[object/);
      expect(key).toBeTruthy();
    }
  });
});

describe('tight labels', () => {
  /**
   * The upgrade button shares a row with Buy and Manager. On a 360px phone it
   * gets about 64px, and a measurement in the browser put "Upgrade ×2" at 73px
   * — it clipped. This is the guard so a longer translation cannot quietly
   * reintroduce that, in a place no unit test would otherwise look.
   */
  it('keeps the upgrade button label short enough for a narrow phone', () => {
    for (const locale of [en, nl]) {
      for (const level of [0, 1, 9, 42]) {
        expect(locale.upgrade(level).length).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('pluralisation', () => {
  it('uses the singular for one unit', () => {
    expect(en.nextMilestone(1)).toContain('1 unit');
    expect(en.nextMilestone(1)).not.toContain('units');
    expect(nl.nextMilestone(1)).toContain('1 stuk');
    expect(nl.nextMilestone(1)).not.toContain('stuks');
  });

  it('uses the plural for more than one', () => {
    expect(en.nextMilestone(24)).toContain('24 units');
    expect(nl.nextMilestone(24)).toContain('24 stuks');
  });
});

describe('parameterised strings', () => {
  it('interpolates the offline cap only when capped', () => {
    expect(en.offlineRan('2h', true)).toContain('max 12 h');
    expect(en.offlineRan('2h', false)).not.toContain('max');
    expect(nl.offlineRan('2u', true)).toContain('max 12 u');
    expect(nl.offlineRan('2u', false)).not.toContain('max');
  });

  it.each(LOCALES)('%s builds a buy label containing the count', (_name, locale) => {
    expect(locale.buy(10)).toContain('10');
  });
});
