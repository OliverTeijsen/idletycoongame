import {
  D,
  ONE,
  ZERO,
  clean,
  cleanMul,
  decFromString,
  decToString,
  format,
  formatTime,
  formatWhole,
  softcap,
} from '../numbers';

describe('sanitizers', () => {
  it('clean: passes normal values, zeroes broken/negative ones', () => {
    expect(clean(D(5)).toNumber()).toBe(5);
    expect(clean(D('1e400')).gt(D('1e308'))).toBe(true); // beyond double range survives
    expect(clean(D(-3)).eq(ZERO)).toBe(true);
    expect(clean(D(NaN)).eq(ZERO)).toBe(true);
    expect(clean(D(Infinity)).eq(ZERO)).toBe(true);
    expect(clean(D(-Infinity)).eq(ZERO)).toBe(true);
  });

  it('cleanMul: floors at 1, resets broken to 1', () => {
    expect(cleanMul(D(2.5)).toNumber()).toBe(2.5);
    expect(cleanMul(D(0.3)).eq(ONE)).toBe(true);
    expect(cleanMul(D(NaN)).eq(ONE)).toBe(true);
    expect(cleanMul(D(Infinity)).eq(ONE)).toBe(true);
  });

  it('softcap: identity below threshold, sublinear above', () => {
    const t = D(100);
    expect(softcap(D(50), t, 0.5).toNumber()).toBe(50);
    expect(softcap(D(100), t, 0.5).toNumber()).toBe(100);
    // 100 * (10000/100)^0.5 = 100 * 10 = 1000
    expect(softcap(D(10000), t, 0.5).toNumber()).toBeCloseTo(1000, 6);
    expect(softcap(D(NaN), t, 0.5).eq(ZERO)).toBe(true);
  });
});

describe('serialization', () => {
  it('roundtrips large values losslessly enough', () => {
    for (const s of ['0', '1', '12345.678', '1e100', '2.5e999']) {
      const d = D(s);
      expect(decFromString(decToString(d)).eq(d)).toBe(true);
    }
  });

  it('garbage input parses to 0', () => {
    expect(decFromString('banana').eq(ZERO)).toBe(true);
    expect(decFromString('').eq(ZERO)).toBe(true);
    expect(decFromString(null).eq(ZERO)).toBe(true);
    expect(decFromString(undefined).eq(ZERO)).toBe(true);
    expect(decFromString('NaN').eq(ZERO)).toBe(true);
    expect(decFromString('-5').eq(ZERO)).toBe(true); // resources are non-negative
  });
});

describe('format', () => {
  it('small numbers', () => {
    expect(format(D(0))).toBe('0');
    expect(format(D(7))).toBe('7');
    expect(format(D(12.5))).toBe('12.50');
    expect(format(D(3), { small: true })).toBe('3.0');
  });

  it('suffix tiers in standard mode', () => {
    expect(format(D(1234))).toBe('1.23K');
    expect(format(D(2.5e6))).toBe('2.50M');
    expect(format(D(1e9))).toBe('1.00B');
    expect(format(D(1e12))).toBe('1.00T');
    expect(format(D(1e33))).toBe('1.00Dc');
  });

  it('falls back to scientific past the table', () => {
    expect(format(D('1e45'))).toBe('1.00e45');
    expect(format(D('1.23e308'))).toBe('1.23e308');
    expect(format(D('4.56e1234'))).toBe('4.56e1234');
  });

  it('scientific and engineering modes', () => {
    expect(format(D(123456), { notation: 'scientific' })).toBe('1.23e5');
    expect(format(D(123456), { notation: 'engineering' })).toBe('123.46e3');
    expect(format(D('1e100'), { notation: 'engineering' })).toBe('10.00e99');
  });

  it('rounding never shows a 1000-mantissa or 10-mantissa', () => {
    expect(format(D(999999))).toBe('1.00M');
    expect(format(D(999.999))).toBe('1.00K');
    expect(format(D('9.999e15'), { notation: 'scientific' })).toBe('1.00e16');
  });

  it('never prints NaN or Infinity, even for broken input', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const out = format(D(bad));
      expect(out).not.toContain('NaN');
      expect(out).not.toContain('Infinity');
    }
  });

  it('negative values get a minus sign', () => {
    expect(format(D(-1234))).toBe('-1.23K');
  });

  it('formatWhole floors small values', () => {
    expect(formatWhole(D(7.9))).toBe('7');
    expect(formatWhole(D(1234))).toBe('1.23K');
  });
});

describe('formatTime', () => {
  it('covers the ranges', () => {
    expect(formatTime(1.5)).toBe('1.5s');
    expect(formatTime(42)).toBe('42s');
    expect(formatTime(150)).toBe('2m 30s');
    expect(formatTime(3660)).toBe('1h 01m');
    expect(formatTime(2 * 86400 + 4 * 3600)).toBe('2d 4h');
    expect(formatTime(-5)).toBe('0s');
    expect(formatTime(NaN)).toBe('0s');
  });
});
