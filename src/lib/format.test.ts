import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  formatCount,
  formatDateTimeUTC,
  formatDateUTC,
  formatINR,
  groupIndian,
  truncate,
} from './format';

describe('groupIndian', () => {
  it('groups the last three digits, then pairs', () => {
    expect(groupIndian('0')).toBe('0');
    expect(groupIndian('999')).toBe('999');
    expect(groupIndian('1000')).toBe('1,000');
    expect(groupIndian('99999')).toBe('99,999');
    expect(groupIndian('100000')).toBe('1,00,000');
    expect(groupIndian('12345678')).toBe('1,23,45,678');
  });
});

describe('formatINR', () => {
  it('always shows two decimals', () => {
    expect(formatINR(1962.4)).toBe('₹1,962.40');
    expect(formatINR(500)).toBe('₹500.00');
    expect(formatINR(148.43)).toBe('₹148.43');
    expect(formatINR(0)).toBe('₹0.00');
  });
  it('uses Indian grouping', () => {
    expect(formatINR(3640.49)).toBe('₹3,640.49');
    expect(formatINR(123456.5)).toBe('₹1,23,456.50');
    expect(formatINR(12345678.9)).toBe('₹1,23,45,678.90');
  });
  it('rounds to paise and handles carries', () => {
    expect(formatINR(999.999)).toBe('₹1,000.00');
    expect(formatINR(99999.996)).toBe('₹1,00,000.00');
  });
  it('handles negatives and bad input', () => {
    expect(formatINR(-1234.5)).toBe('-₹1,234.50');
    expect(formatINR(-0.001)).toBe('₹0.00');
    expect(formatINR(NaN)).toBe(EMPTY);
    expect(formatINR(Infinity)).toBe(EMPTY);
  });
});

describe('formatCount', () => {
  it('groups counts', () => {
    expect(formatCount(1284)).toBe('1,284');
    expect(formatCount(50000)).toBe('50,000');
    expect(formatCount(123456)).toBe('1,23,456');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(NaN)).toBe(EMPTY);
  });
});

describe('dates (UTC)', () => {
  const t = Date.UTC(2025, 2, 14, 9, 5);
  it('formats date and time', () => {
    expect(formatDateUTC(t)).toBe('14 Mar 2025');
    expect(formatDateTimeUTC(t)).toBe('14 Mar 2025, 09:05');
    expect(formatDateTimeUTC(t, true)).toBe('14 Mar 2025, 09:05 UTC');
  });
  it('does not shift by the local time zone at day edges', () => {
    expect(formatDateTimeUTC(Date.UTC(2025, 0, 1, 0, 0))).toBe('1 Jan 2025, 00:00');
    expect(formatDateTimeUTC(Date.UTC(2025, 11, 31, 23, 59))).toBe('31 Dec 2025, 23:59');
  });
  it('shows a dash for missing values', () => {
    expect(formatDateTimeUTC(null)).toBe(EMPTY);
    expect(formatDateUTC(null)).toBe(EMPTY);
    expect(formatDateTimeUTC(NaN)).toBe(EMPTY);
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
  it('cuts with an ellipsis within the limit', () => {
    const out = truncate('abcdefghij', 6);
    expect(out).toBe('abcde…');
    expect(out.length).toBe(6);
  });
  it('does not leave trailing spaces before the ellipsis', () => {
    expect(truncate('ab cd ef', 4)).toBe('ab…');
  });
  it('does not split a surrogate pair', () => {
    expect(truncate('ab😀cd', 4)).toBe('ab…');
  });
});
