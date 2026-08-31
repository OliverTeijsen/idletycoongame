/**
 * Design tokens (spec §12): palette, type scale, spacing, layer identity.
 *
 * THE DIRECTION — an observatory instrument plate.
 *
 * GYRE is a rotating current collapsing into itself, watched from outside. So
 * the chrome is instrumentation, not sci-fi UI: a cold blue-black ground, ONE
 * warm light source (the core), engraved hairlines instead of boxes,
 * monospaced numerals, and labels set as wide-tracked small caps the way a
 * plate is engraved. Every prestige layer owns a hue, and on that layer's
 * screen the hue takes over the accents.
 *
 * The ground moved from teal-black to blue-black on purpose: the old
 * `bg #0e1c1e` / `panel #0b1718` pair differed by three points of luminance,
 * so panels were invisible and the whole app read as one flat green sheet.
 * Cold ground also makes the amber core actually look like light.
 *
 * Everything visual comes from here. Before adding a literal colour, a radius
 * or a font size to a screen, add it here instead — the reason ten screens
 * used to look identical is that each had its own copy of the same panel.
 */
import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

export const palette = {
  /** Outside the column, and the recessed wells inside it. */
  bgDeep: '#04060c',
  /** The column itself. */
  bg: '#090d16',
  /** A card or row sitting on the column. */
  panel: '#111726',
  /** The same card, lifted: hover, selected, affordable. */
  panelHi: '#18202f',
  /** A warm-tinted panel, for anything lit by the core. */
  panelWarm: '#1d1608',

  /** Engraved hairline. */
  line: '#1d2637',
  /** The same rule, live. */
  lineHi: '#30405c',

  ink: '#e9eefb',
  /** Secondary copy. Readable, not a whisper — it carries most of the text. */
  dim: '#8b9ab5',
  /**
   * Tertiary: units, hints, labels. Every text colour here clears 4.5:1
   * against both `bg` and `panel` — this one is the floor, and it sits at
   * 4.66:1 on a panel, which is why it is not the darker grey it looks like
   * it wants to be.
   */
  faint: '#7183a3',

  // The one warm light in the whole app.
  core: '#ffb648',
  coreHighlight: '#ffe6a8',
  coreDeep: '#f2882c',

  // Layer hues, held at a matched chroma so they read as one ordered
  // spectrum rather than as seven unrelated highlighter pens.
  orbiter: '#4fe3c1',
  orbiterCyan: '#49c8ef',
  mote: '#ff7a6b',
  shard: '#b39dff',
  prism: '#f472d0',
  aeon: '#5cc8ff',
  ore: '#a3e635',
  singularity: '#ffd86b',

  danger: '#fb7185',
} as const;

/**
 * One source of truth for every currency's glyph + hue.
 *
 * These pairs used to be inline literals in six different files, which is why
 * Ore was `#a3e635` in the resource bar and had no token at all. A layer's
 * identity is content, not decoration — keep it in one place.
 */
export const LAYERS = {
  spark: { glyph: '✦', color: palette.core, name: 'Spark' },
  mote: { glyph: '◦', color: palette.mote, name: 'Motes' },
  shard: { glyph: '◆', color: palette.shard, name: 'Shards' },
  prism: { glyph: '▲', color: palette.prism, name: 'Prism' },
  ore: { glyph: '⛏', color: palette.ore, name: 'Ore' },
  aeon: { glyph: '✧', color: palette.aeon, name: 'Aeon' },
  singularity: { glyph: '⦿', color: palette.singularity, name: 'Singularity' },
} as const;

export type LayerId = keyof typeof LAYERS;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 10,
} as const;

/**
 * Type stacks.
 *
 * A condensed grotesque for display and labels, a real monospace for every
 * numeral. Both are stacks, not single faces: the app ships no font files (an
 * asset pipeline is not worth an Android build risk here), so each names the
 * best face actually installed per platform and falls back to the system.
 * The personality is carried by the TREATMENT — tracked small caps, tabular
 * figures, a wide type scale — which survives the fallback intact.
 */
const DISPLAY_STACK =
  '"Bahnschrift", "DIN Alternate", "Avenir Next Condensed", "Segoe UI Variable Display", system-ui, sans-serif';
const MONO_STACK =
  'ui-monospace, "Cascadia Mono", "SF Mono", "Roboto Mono", Consolas, monospace';

const display = Platform.select({ web: DISPLAY_STACK, default: undefined });
const monoFamily = Platform.select({ web: MONO_STACK, default: 'monospace' });

/** Fixed-width numerics so values update without layout shift (spec §11). */
export const mono: TextStyle = {
  fontFamily: monoFamily,
  fontVariant: ['tabular-nums'],
};

/**
 * The type scale. Five roles, and no screen should need a sixth.
 *
 * `label` is the plate engraving: small, heavily tracked, upper case. It is
 * the one device used everywhere, so it has to be right.
 */
export const type = {
  /**
   * The headline number. Only ever one on screen at a time.
   *
   * Monospaced rather than set in the display face, and not as a compromise:
   * Spark redraws twenty times a second, so tabular figures are the only
   * thing keeping it from jittering as digits change width.
   */
  display: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, ...mono } as TextStyle,
  /** A card's own headline value. */
  figure: { fontSize: 20, fontWeight: '700', ...mono } as TextStyle,
  /** Row and card titles. */
  title: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 } as TextStyle,
  /** Body copy: descriptions, sub-lines. */
  body: { fontSize: 12, lineHeight: 17 } as TextStyle,
  /** Engraved label. Always paired with `textTransform: 'uppercase'`. */
  label: {
    fontFamily: display,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  } as TextStyle,
  /** Units, hints, counters. */
  micro: { fontSize: 10, lineHeight: 14 } as TextStyle,
} as const;

export const MAX_CONTENT_WIDTH = 440;
