import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeOrder, normalizeOrders, pickDuplicateWinner } from './normalize';
import { CHANNELS, PAYMENT_METHODS, REGIONS, STATUSES, type Order } from './types';

const base = {
  id: 'ORD-0000001',
  schemaVersion: 2,
  customerName: 'Priya Gupta',
  customerEmail: 'priya@example.com',
  status: 'shipped',
  amount: 1000,
  currency: 'INR',
  createdAt: '2025-03-14T09:30:00.000Z',
  updatedAt: null,
  region: 'EAST',
  channel: 'web',
  priority: 2,
  paymentMethod: 'upi',
  itemCount: 3,
  notes: null,
};

function order(overrides: Record<string, unknown> = {}): Order {
  const result = normalizeOrder({ ...base, ...overrides });
  if (typeof result === 'string') throw new Error(result);
  return result;
}

describe('normalizeOrder', () => {
  it('rule 1: reads customer_name (v1) and customerName (v2) into one field', () => {
    expect(order().customer).toBe('Priya Gupta');
    const v1 = { ...base, schemaVersion: 1, amount: 100 } as Record<string, unknown>;
    delete v1.customerName;
    v1.customer_name = 'Amit Sharma';
    const result = normalizeOrder(v1);
    expect(typeof result === 'string' ? result : result.customer).toBe('Amit Sharma');
  });

  it('rule 2: v1 amounts are paise, v2 amounts are rupees', () => {
    expect(order({ schemaVersion: 1, amount: 12345650 }).amount).toBe(123456.5);
    expect(order({ schemaVersion: 2, amount: 123456.5 }).amount).toBe(123456.5);
    expect(order({ schemaVersion: 1, amount: 14850 }).amount).toBe(148.5);
  });

  it('rule 3: string amounts are numbers, and the unit still follows the version', () => {
    expect(order({ schemaVersion: 2, amount: '4599.5' }).amount).toBe(4599.5);
    // A v1 string is paise too. This is the easy one to get wrong.
    expect(order({ schemaVersion: 1, amount: '131452' }).amount).toBe(1314.52);
  });

  it('rule 4: reads all four createdAt formats to the same instant', () => {
    const expected = Date.UTC(2025, 2, 14, 9, 30);
    expect(order({ createdAt: '2025-03-14T09:30:00.000Z' }).createdAt).toBe(expected);
    expect(order({ createdAt: '2025-03-14T09:30:00' }).createdAt).toBe(expected);
    expect(order({ createdAt: 1741944600 }).createdAt).toBe(expected);
    expect(order({ createdAt: '14/03/2025' }).createdAt).toBe(Date.UTC(2025, 2, 14));
  });

  it('rule 5: null, missing and unreadable updatedAt are all null', () => {
    expect(order({ updatedAt: null }).updatedAt).toBeNull();
    const missing = { ...base } as Record<string, unknown>;
    delete missing.updatedAt;
    const result = normalizeOrder(missing);
    expect(typeof result === 'string' ? result : result.updatedAt).toBeNull();
    expect(order({ updatedAt: 'garbage' }).updatedAt).toBeNull();
    expect(order({ updatedAt: '2025-03-15T00:00:00.000Z' }).updatedAt).toBe(Date.UTC(2025, 2, 15));
  });

  it('rule 6: status and region casing collapses to one style', () => {
    expect(order({ status: 'Shipped' }).status).toBe('shipped');
    expect(order({ status: 'SHIPPED' }).status).toBe('shipped');
    expect(order({ region: 'south' }).region).toBe('SOUTH');
    expect(order({ region: 'Northeast' }).region).toBe('NORTHEAST');
  });

  it('rule 8: missing priority becomes null', () => {
    const noPriority = { ...base } as Record<string, unknown>;
    delete noPriority.priority;
    const result = normalizeOrder(noPriority);
    expect(typeof result === 'string' ? result : result.priority).toBeNull();
    expect(order({ priority: 7 }).priority).toBeNull();
  });

  it('rule 9: notes stay plain text, untouched', () => {
    const html = '<b>URGENT</b> Fragile <script>alert(1)</script>';
    expect(order({ notes: html }).notes).toBe(html);
    expect(order({ notes: null }).notes).toBe('');
    expect(order({ notes: '' }).notes).toBe('');
  });

  it('rule 10: trims the currency', () => {
    expect(order({ currency: 'INR ' }).currency).toBe('INR');
  });

  it('returns a reason instead of throwing on unusable records', () => {
    expect(typeof normalizeOrder(null)).toBe('string');
    expect(typeof normalizeOrder({ ...base, id: 'nope' })).toBe('string');
    expect(typeof normalizeOrder({ ...base, status: 'lost' })).toBe('string');
    expect(typeof normalizeOrder({ ...base, amount: 'abc' })).toBe('string');
    expect(typeof normalizeOrder({ ...base, createdAt: 'soon' })).toBe('string');
    expect(typeof normalizeOrder({ ...base, schemaVersion: 3 })).toBe('string');
  });
});

describe('rule 7: duplicate ids', () => {
  const T1 = '2025-03-10T00:00:00.000Z';
  const T2 = '2025-03-20T00:00:00.000Z';

  it('both have updatedAt: the later updatedAt wins, wherever it sits in the file', () => {
    const early = { ...base, status: 'pending', updatedAt: T2 };
    const late = { ...base, status: 'shipped', updatedAt: T1 };
    expect(normalizeOrders([early, late]).orders[0]!.status).toBe('pending');
    expect(normalizeOrders([late, early]).orders[0]!.status).toBe('pending');
  });

  it('both have the same updatedAt: the later record in the file wins', () => {
    const a = { ...base, status: 'pending', updatedAt: T1 };
    const b = { ...base, status: 'shipped', updatedAt: T1 };
    expect(normalizeOrders([a, b]).orders[0]!.status).toBe('shipped');
  });

  it('only one has updatedAt: that one wins even if it is earlier in the file', () => {
    const withDate = { ...base, status: 'pending', updatedAt: T1 };
    const without = { ...base, status: 'shipped', updatedAt: null };
    expect(normalizeOrders([withDate, without]).orders[0]!.status).toBe('pending');
    expect(normalizeOrders([without, withDate]).orders[0]!.status).toBe('pending');
  });

  it('neither has updatedAt: the later record in the file wins', () => {
    const a = { ...base, status: 'pending' };
    const b = { ...base, status: 'shipped' };
    expect(normalizeOrders([a, b]).orders[0]!.status).toBe('shipped');
  });

  it('each id appears once and the removals are counted', () => {
    const { orders, stats } = normalizeOrders([
      { ...base, id: 'ORD-0000001' },
      { ...base, id: 'ORD-0000002' },
      { ...base, id: 'ORD-0000001', status: 'delivered' },
    ]);
    expect(orders.map((o) => o.id)).toEqual(['ORD-0000002', 'ORD-0000001']);
    expect(stats.duplicatesRemoved).toBe(1);
  });

  it('pickDuplicateWinner is symmetric about updatedAt', () => {
    const x = order({ updatedAt: T1 });
    const y = order({ updatedAt: T2 });
    expect(pickDuplicateWinner(x, y)).toBe(y);
    expect(pickDuplicateWinner(y, x)).toBe(y);
  });
});

describe('normalizeOrders', () => {
  it('skips broken records, keeps going, and reports why', () => {
    const { orders, stats } = normalizeOrders([base, { nonsense: true }, null]);
    expect(orders).toHaveLength(1);
    expect(stats.skipped).toBe(2);
    expect(stats.skippedReasons).toHaveLength(2);
  });
});

describe('the real orders.json', () => {
  const raw = JSON.parse(readFileSync('public/orders.json', 'utf8')) as unknown[];
  const { orders, stats } = normalizeOrders(raw);

  it('ends up with 50,000 unique orders, nothing skipped', () => {
    expect(stats.totalRecords).toBe(50030);
    expect(stats.skipped).toBe(0);
    expect(stats.duplicatesRemoved).toBe(30);
    expect(orders).toHaveLength(50000);
    expect(new Set(orders.map((o) => o.id)).size).toBe(50000);
  });

  it('has exactly the documented set of enum values (no casing variants)', () => {
    expect(new Set(orders.map((o) => o.status))).toEqual(new Set(STATUSES));
    expect(new Set(orders.map((o) => o.region))).toEqual(new Set(REGIONS));
    expect(new Set(orders.map((o) => o.channel))).toEqual(new Set(CHANNELS));
    expect(new Set(orders.map((o) => o.paymentMethod))).toEqual(new Set(PAYMENT_METHODS));
    expect(new Set(orders.map((o) => o.currency))).toEqual(new Set(['INR']));
  });

  it('has sane numbers and dates everywhere', () => {
    const min = Date.UTC(2023, 9, 1);
    const max = Date.UTC(2026, 9, 1);
    const bad = orders.filter(
      (o) =>
        !Number.isFinite(o.amount) ||
        o.amount <= 100 ||
        o.amount >= 4_000 ||
        o.createdAt < min ||
        o.createdAt >= max ||
        (o.updatedAt !== null && o.updatedAt < o.createdAt) ||
        o.customer === '',
    );
    expect(bad).toEqual([]);
  });

  it('applies the paise conversion: v1 and v2 amounts live on the same scale', () => {
    // Without the conversion v1 amounts would be ~100x larger than v2 amounts.
    expect(Math.max(...orders.map((o) => o.amount))).toBeLessThan(4_000);
  });

  it('keeps the expected counts of missing values', () => {
    const noPriority = orders.filter((o) => o.priority === null).length;
    expect(noPriority).toBeGreaterThan(14_000);
    expect(orders.some((o) => o.updatedAt === null)).toBe(true);
  });

  it('picked the right survivor for a known duplicate (ORD-0038222: later updatedAt)', () => {
    const o = orders.find((x) => x.id === 'ORD-0038222')!;
    expect(o.updatedAt).toBe(Date.parse('2024-06-23T01:53:41.000Z'));
  });
});
