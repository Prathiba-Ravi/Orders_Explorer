import { describe, expect, it } from 'vitest';
import { parseNumber, parseOrderIdNumber, parseTimestamp } from './parse';

const MAR_14_0930 = Date.UTC(2025, 2, 14, 9, 30, 0);

describe('parseTimestamp', () => {
  it('reads ISO with a Z zone', () => {
    expect(parseTimestamp('2025-03-14T09:30:00.000Z')).toBe(MAR_14_0930);
  });
  it('treats ISO without a zone as UTC, not local time', () => {
    expect(parseTimestamp('2025-03-14T09:30:00')).toBe(MAR_14_0930);
  });
  it('reads epoch seconds', () => {
    expect(parseTimestamp(1741944600)).toBe(MAR_14_0930);
  });
  it('reads DD/MM/YYYY as midnight UTC (day first, not month first)', () => {
    expect(parseTimestamp('14/03/2025')).toBe(Date.UTC(2025, 2, 14));
    expect(parseTimestamp('03/04/2025')).toBe(Date.UTC(2025, 3, 3));
  });
  it('honours explicit offsets', () => {
    expect(parseTimestamp('2025-03-14T15:00:00+05:30')).toBe(MAR_14_0930);
  });
  it('rejects impossible or unreadable values', () => {
    expect(parseTimestamp('31/02/2025')).toBeNull();
    expect(parseTimestamp('2025-13-01T00:00:00Z')).toBeNull();
    expect(parseTimestamp('yesterday')).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp(NaN)).toBeNull();
  });
});

describe('parseNumber', () => {
  it('accepts numbers and numeric strings', () => {
    expect(parseNumber(12.5)).toBe(12.5);
    expect(parseNumber('4599.5')).toBe(4599.5);
    expect(parseNumber(' 10 ')).toBe(10);
  });
  it('rejects everything else', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('12abc')).toBeNull();
    expect(parseNumber('1e5')).toBeNull();
    expect(parseNumber(NaN)).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber({})).toBeNull();
  });
});

describe('parseOrderIdNumber', () => {
  it('extracts the numeric part', () => {
    expect(parseOrderIdNumber('ORD-0001234')).toBe(1234);
    expect(parseOrderIdNumber('ORD-12')).toBe(12);
  });
  it('rejects other shapes', () => {
    expect(parseOrderIdNumber('ord-1')).toBeNull();
    expect(parseOrderIdNumber('ORD-')).toBeNull();
    expect(parseOrderIdNumber('1234')).toBeNull();
  });
});
