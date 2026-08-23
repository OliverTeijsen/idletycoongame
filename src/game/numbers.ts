/**
 * Decimal helpers, sanitizers and display formatting (spec §4).
 *
 * Every game quantity overflows a JS double eventually, so every resource,
 * cost, rate and multiplier is a `Decimal` (break_infinity.js). A plain
 * `number` is only allowed for UI counts, indices and purchase counts.
 *
 * PURE MODULE — no React, no React Native, no services.
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
// Sanitizers — never let NaN/Infinity into state (spec §4, §19)
// ---------------------------------------------------------------------------

/**
 * break_infinity represents ±Infinity as mantissa ±1 with exponent 9e15
 * (EXP_LIMIT) — a *finite* sentinel, so a plain isFinite check misses it.
 * Real gameplay exponents never get anywhere near 1e15.
 */
const EXP_BROKEN = 9e15;

function isBroken(x: Decimal): boolean {
  return (
    !Number.isFinite(x.mantissa) ||
    !Number.isFinite(x.exponent) ||
    Math.abs(x.exponent) >= EXP_BROKEN
  );
}

/** Sanitize a resource-like value: broken → 0, negative → 0. */
export function clean(x: Decimal): Decimal {
  if (isBroken(x)) return ZERO;
  return x.lt(ZERO) ? ZERO : x;
}

/** Sanitize a multiplier: broken → 1, below 1 → 1. */
export function cleanMul(x: Decimal): Decimal {
  if (isBroken(x)) return ONE;
  return x.lt(ONE) ? ONE : x;
}

/**
 * Softcap (spec §6.5): above threshold `t`, effective = t * (value/t)^p.
 * `p` in (0,1); identity below the threshold. Keeps runaway feedback
 * multipliers sublinear instead of exploding.
 */
export function softcap(value: Decimal, t: Decimal, p: number): Decimal {
  const v = clean(value);
  if (v.lte(t)) return v;
  return t.mul(v.div(t).pow(p));
}

// ---------------------------------------------------------------------------
// Serialization — the core owns the canonical Decimal <-> string form
// ---------------------------------------------------------------------------

export function decToString(value: Decimal): string {
  return value.toString();
}

/** Parse a persisted Decimal string. Falls back to 0 on garbage input. */
export function decFromString(value: string | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return ZERO;
  try {
    return clean(new Decimal(value));
  } catch {
    return ZERO;
  }
}

// ---------------------------------------------------------------------------
// Formatting (spec §4)
// ---------------------------------------------------------------------------

export type Notation = 'standard' | 'scientific' | 'engineering';

/**
 * Short-scale suffixes, one per 3 orders of magnitude: K … Dc covers up to
 * 1e36. Beyond the table, standard mode falls back to scientific.
 */
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function scientific(d: Decimal, decimals: number): string {
  // Guard against 9.999 rounding up to "10.00e5" — carry to the next exponent.
  let mantissa = d.mantissa;
  let exponent = d.exponent;
  if (parseFloat(mantissa.toFixed(decimals)) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  return `${mantissa.toFixed(decimals)}e${exponent}`;
}

function engineering(d: Decimal, decimals: number): string {
  let exponent = Math.floor(d.exponent / 3) * 3;
  let mantissa = d.mantissa * Math.pow(10, d.exponent - exponent);
  if (parseFloat(mantissa.toFixed(decimals)) >= 1000) {
    exponent += 3;
    mantissa /= 1000;
  }
  return `${mantissa.toFixed(decimals)}e${exponent}`;
}

export interface FormatOpts {
  places?: number;
  /** Show one decimal below 1000 (rates, fractional resources). */
  small?: boolean;
  notation?: Notation;
}

/**
 * Format a Decimal for display. NEVER prints "NaN" or "Infinity": broken
 * values render as 0 (they should have been cleaned before reaching UI).
 */
export function format(value: DecimalSource, opts: FormatOpts = {}): string {
  const places = opts.places ?? 2;
  const notation = opts.notation ?? 'standard';
  let d = D(value);
  if (isBroken(d)) d = ZERO;
  if (d.lt(ZERO)) return `-${format(d.neg(), opts)}`;
  if (d.eq(ZERO)) return opts.small ? '0.0' : '0';

  if (d.lt(1000)) {
    const n = d.toNumber();
    if (opts.small) return n.toFixed(1);
    if (Number.isInteger(n)) return String(n);
    const out = n.toFixed(places);
    // 999.999 rounds up to "1000.00" — promote it to the K tier instead.
    if (parseFloat(out) < 1000) return out;
    return format(D(1000), opts);
  }

  if (notation === 'scientific') return scientific(d, places);
  if (notation === 'engineering') return engineering(d, places);

  let tier = Math.floor(d.exponent / 3);
  if (tier >= SUFFIXES.length) return scientific(d, places);

  let out = d.div(Decimal.pow(10, tier * 3)).toNumber().toFixed(places);
  // Rounding can push the mantissa to 1000.00 — bump a tier.
  if (parseFloat(out) >= 1000) {
    tier += 1;
    if (tier >= SUFFIXES.length) return scientific(d, places);
    out = d.div(Decimal.pow(10, tier * 3)).toNumber().toFixed(places);
  }
  return `${out}${SUFFIXES[tier]}`;
}

/** Integer-ish display for costs and counts: no decimals below the K tier. */
export function formatWhole(value: DecimalSource, notation?: Notation): string {
  const d = D(value);
  if (d.lt(1000)) return format(d.floor(), { notation });
  return format(d, { notation });
}

/** Durations: `1.5s`, `2m 30s`, `4h 05m`, `2d 4h`. */
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
  const days = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${h}h`;
}
