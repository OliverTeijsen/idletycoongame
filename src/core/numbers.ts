/**
 * Decimal helpers + display formatting.
 *
 * Money in this game overflows Number.MAX_SAFE_INTEGER within an hour of play,
 * so every money value is a `Decimal` (break_infinity.js). Never store money as
 * a JS number.
 *
 * PURE MODULE — no React, no React Native, no services. See src/core/README.
 */
import Decimal from 'break_infinity.js';

export { Decimal };

/** Anything that can be turned into a Decimal. */
export type DecimalSource = Decimal | number | string;

/** Shorthand constructor. `D(4)`, `D('1e30')`, `D(someDecimal)`. */
export function D(value: DecimalSource): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export const ZERO: Decimal = new Decimal(0);
export const ONE: Decimal = new Decimal(1);

// ---------------------------------------------------------------------------
// Serialization (used by services/storage.ts — kept here so the core owns the
// canonical Decimal <-> string representation).
// ---------------------------------------------------------------------------

/** Serialize a Decimal for persistence. Lossless for the mantissa/exponent pair. */
export function decToString(value: Decimal): string {
  return value.toString();
}

/** Parse a persisted Decimal string. Falls back to 0 on garbage input. */
export function decFromString(value: string | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return ZERO;
  try {
    const parsed = new Decimal(value);
    return Number.isNaN(parsed.mantissa) ? ZERO : parsed;
  } catch {
    return ZERO;
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Short-scale suffixes, one per 3 orders of magnitude, covering up to 1e96.
 * Beyond that we fall back to scientific notation (`1.23e123`).
 */
const SUFFIXES = [
  '', 'K', 'M', 'B', 'T',
  'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'ODc', 'NDc',
  'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OVg', 'NVg',
  'Tg',
];

function scientific(d: Decimal, decimals: number): string {
  return `${d.mantissa.toFixed(decimals)}e${d.exponent}`;
}

/**
 * Format a big number for display: `4`, `12.50`, `3.40K`, `1.23M`, `9.99e123`.
 * Values below 1000 keep two decimals unless they are whole.
 */
export function formatBig(value: DecimalSource, decimals = 2): string {
  const d = D(value);
  if (Number.isNaN(d.mantissa)) return 'NaN';
  if (d.eq(ZERO)) return '0';
  if (d.lt(ZERO)) return `-${formatBig(d.neg(), decimals)}`;

  if (d.lt(1000)) {
    const n = d.toNumber();
    if (Number.isInteger(n)) return String(n);
    const small = n.toFixed(decimals);
    // 999.999 rounds up to "1000.00" — promote it to the K tier instead.
    if (parseFloat(small) < 1000) return small;
    return `${(n / 1000).toFixed(decimals)}${SUFFIXES[1]}`;
  }

  let tier = Math.floor(d.log10() / 3);
  if (tier >= SUFFIXES.length) return scientific(d, decimals);

  let out = d.div(Decimal.pow(10, tier * 3)).toNumber().toFixed(decimals);
  // Rounding can push the mantissa to 1000.00 — bump a tier.
  if (parseFloat(out) >= 1000) {
    tier += 1;
    if (tier >= SUFFIXES.length) return scientific(d, decimals);
    out = d.div(Decimal.pow(10, tier * 3)).toNumber().toFixed(decimals);
  }
  return `${out}${SUFFIXES[tier]}`;
}

/** Money with the euro sign: `€1.23M`. */
export function money(value: DecimalSource, decimals = 2): string {
  return `€${formatBig(value, decimals)}`;
}

/** Income rate: `€1.23M/s`. */
export function moneyPerSecond(value: DecimalSource, decimals = 2): string {
  return `${money(value, decimals)}/s`;
}

/** `0.02 -> "+2%"`, `1.5 -> "+150%"`. */
export function formatPercent(fraction: number, decimals = 0): string {
  return `+${(fraction * 100).toFixed(decimals)}%`;
}

/** Durations for cycle timers and offline windows: `1.5s`, `2m 30s`, `4h 05m`. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  if (seconds < 10) {
    const s = Math.round(seconds * 10) / 10;
    return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`;
  }
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}
