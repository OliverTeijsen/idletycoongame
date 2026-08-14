/**
 * Design tokens. Dark, warm, fry-oil browns with golden accents, a ketchup-red
 * highlight and cream text.
 */
import { Platform, TextStyle } from 'react-native';

export const colors = {
  /** Deep fry-oil brown — app background. */
  bg: '#140F0A',
  surface: '#211A12',
  surfaceRaised: '#2C2318',
  border: '#3B2E20',

  /** Frietvet gold — the money colour. */
  gold: '#F2B33D',
  goldDeep: '#C98A1E',
  goldFaint: '#4A3617',

  /** Ketchup — prestige and destructive highlights. */
  ketchup: '#E2472F',
  ketchupDeep: '#9E2A18',

  /** Mayo cream — text. */
  cream: '#F6EBD9',
  creamDim: '#BCA98D',
  muted: '#7C6B55',

  /** Managed / automated. */
  green: '#5BB85C',
  greenDeep: '#2F6B31',

  locked: '#332920',
  shadow: '#000000',
} as const;

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

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

/** Minimum tap target — accessibility, and these buttons get hammered. */
export const HIT_SIZE = 44;

export const type = {
  cash: { fontSize: 34, fontWeight: '800', color: colors.gold, ...tabular } as TextStyle,
  rate: { fontSize: 14, fontWeight: '600', color: colors.creamDim, ...tabular } as TextStyle,
  title: { fontSize: 16, fontWeight: '700', color: colors.cream } as TextStyle,
  body: { fontSize: 13, fontWeight: '500', color: colors.creamDim } as TextStyle,
  small: { fontSize: 11, fontWeight: '600', color: colors.muted } as TextStyle,
  button: { fontSize: 14, fontWeight: '800', color: colors.bg } as TextStyle,
} as const;
