/**
 * Design tokens.
 *
 * The palette is taken from the thing the game is about: a Belgian frituur at
 * night. Fry-oil browns for the ground, the warm gold of the hatch light for
 * money, mayo-cream for paper, and — the part that carries the design — a
 * **sauce colour per business tier**.
 *
 * Ten identical rows is what made the old list read as a spreadsheet. Giving
 * each tier a sauce means a row is recognised by its colour rather than by its
 * position, and the colours come from the subject instead of from a generic
 * chart palette.
 */
import { Platform, TextStyle } from 'react-native';

import type { BusinessId } from '../core/types';

export const colors = {
  /** Deep fry-oil brown — app background. */
  bg: '#12100C',
  surface: '#1C1811',
  surfaceRaised: '#262019',
  border: '#3A3024',

  /** Frituurvet gold — the money colour, and only ever the money colour. */
  gold: '#F2B33D',
  goldDeep: '#C98A1E',
  goldFaint: '#4A3617',

  /** Ketchup — prestige and destructive highlights. */
  ketchup: '#E2472F',
  ketchupDeep: '#9E2A18',

  /** Mayo cream — paper, and text. */
  cream: '#F3E7CE',
  creamDim: '#B9A88B',
  muted: '#7A6952',

  /** Managed / automated. */
  green: '#6DBF63',
  greenDeep: '#2F6B31',

  locked: '#2A2219',
  shadow: '#000000',
} as const;

/**
 * One sauce per tier, in menu order.
 *
 * These are identity, not decoration: the same colour marks a row's edge, its
 * icon tile, its production bar and its owned count, so a glance down the list
 * reads as ten different businesses rather than ten copies of one.
 *
 * Deliberately excludes anything close to `gold` (money) and `green`
 * (automated), which already mean something specific everywhere else.
 */
export const sauces: Record<BusinessId, string> = {
  friet: '#EBD9A8', // mayonaise
  wafel: '#E8B04B', // suikerstroop
  choco: '#8C5A3C', // chocolade
  cafe: '#C98F3F', // blond bier
  brouw: '#7B4A2D', // trappist
  resto: '#D9B65C', // béarnaise
  truck: '#D96A3A', // andalouse
  super: '#A8B54A', // piccalilly
  concern: '#C0453A', // samurai
  empire: '#8E6BC4', // — the one tier with no sauce; it left the frituur behind
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/**
 * Tabular figures everywhere numbers tick, so digits do not jitter as the cash
 * counter changes width.
 */
export const tabular: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/**
 * No font files ship with the app, so the display face has to come from the
 * platform. Android's condensed and black system faces are the closest thing to
 * the chunky lettering on a frituur price board; iOS gets its condensed face,
 * and web falls back to a system stack.
 */
export const fonts = {
  display: Platform.select({
    android: 'sans-serif-condensed',
    ios: 'Avenir Next Condensed',
    // No exotic faces on web: the narrow Windows display fonts (Haettenschweiler
    // in particular) squash the cash counter into an unreadable blob.
    default: '"Arial Narrow", "Roboto Condensed", system-ui, sans-serif',
  }),
  displayHeavy: Platform.select({
    android: 'sans-serif-black',
    ios: 'Avenir Next Condensed',
    default: '"Arial Black", system-ui, sans-serif',
  }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

/** Minimum tap target — accessibility, and these buttons get hammered. */
export const HIT_SIZE = 44;

export const type = {
  /** The hero. Cash is the one number the whole screen is built around. */
  cash: {
    fontFamily: fonts.displayHeavy,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    color: colors.gold,
    ...tabular,
  } as TextStyle,
  rate: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.creamDim,
    ...tabular,
  } as TextStyle,
  title: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '700',
    color: colors.cream,
    letterSpacing: 0.2,
  } as TextStyle,
  body: { fontSize: 13, fontWeight: '500', color: colors.creamDim } as TextStyle,
  small: { fontSize: 11, fontWeight: '600', color: colors.muted } as TextStyle,
  /** Uppercase micro-label, for things that name a thing rather than say it. */
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  } as TextStyle,
  button: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '800',
    color: colors.bg,
    letterSpacing: 0.3,
  } as TextStyle,
} as const;
