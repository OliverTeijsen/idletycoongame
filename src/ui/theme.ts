/** Palette + spacing tokens (spec §12). */
export const palette = {
  bg: '#0e1c1e',
  bgDeep: '#071011',
  ink: '#eafff7',
  dim: '#7fa89e',
  core: '#ffbf5c',
  coreHighlight: '#ffe6a8',
  coreDeep: '#f59a3c',
  orbiter: '#5eead4',
  orbiterCyan: '#67e8f9',
  mote: '#ff8a7a',
  shard: '#c4b5fd',
  prism: '#fca5f1',
  aeon: '#7dd3fc',
  singularity: '#fde68a',
  line: '#1c3634',
  panel: '#0b1718',
  danger: '#f87171',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

import type { TextStyle } from 'react-native';

/** Fixed-width numerics so values update without layout shift (spec §11). */
export const mono: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const MAX_CONTENT_WIDTH = 440;
