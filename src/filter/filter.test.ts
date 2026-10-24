import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeOrders } from '../data/normalize';
import type { Order } from '../data/types';
import { applyFilter } from './apply';
import { compileCondition } from './compile';
import { conditionLabel } from './conditionLabel';
import { parseDateInput } from './dates';
import { conditionStatus } from './status';
import type { FilterCondition, FilterRoot } from './types';

function order(partial: Partial<Order> = {}): Order {
  return {
    id: 'ORD-0000001',
    idNum: 1,
    customer: 'Acme',
    email: 'a@b.com',
    status: 'pending',
    amount: 100,
    currency: 'INR',
    createdAt: Date.UTC(2025, 2, 14, 10, 0),
    createdAtDateOnly: false,
    updatedAt: Date.UTC(2025, 2, 15, 12, 0),
    region: 'NORTH',
    channel: 'web',
    priority: 2,
    paymentMethod: 'upi',
    itemCount: 3,
    notes: 'Hello World',
    customerKey: 'acme',
    emailKey: 'a@b.com',
    notesKey: 'hello world',
    ...partial,
  };
}

const matches = (c: FilterCondition, o: Order) => {
  const pred = compileCondition(c);
  if (!pred) throw new Error('condition was not ready');
  return pred(o);
};

describe('incomplete and invalid conditions are ignored, not treated as 0', () => {
  it('a fresh (empty) condition is incomplete and compiles to nothing', () => {
    const empties: FilterCondition[] = [
      { id: 'a', kind: 'text', field: 'notes', op: 'contains', value: '  ' },
      { id: 'b', kind: 'number', field: 'amount', op: 'gt', value: '' },
      { id: 'c', kind: 'number', field: 'amount', op: 'between', min: '5', max: '' },
      { id: 'd', kind: 'date', field: 'createdAt', op: 'after', value: '' },
      { id: 'e', kind: 'date', field: 'createdAt', op: 'between', from: '2025-01-01', to: '' },
      { id: 'f', kind: 'enum', field: 'status', op: 'isOneOf', values: [] },
    ];
    for (const c of empties) {
      expect(conditionStatus(c).state).toBe('incomplete');
      expect(compileCondition(c)).toBeNull();
    }
  });

  it('min > max and start > end are invalid with a message', () => {
    const num = conditionStatus({ id: 'a', kind: 'number', field: 'amount', op: 'between', min: '10', max: '5' });
    expect(num.state).toBe('invalid');
    const date = conditionStatus({
      id: 'b',
      kind: 'date',
      field: 'createdAt',
      op: 'between',
      from: '2025-02-01',
      to: '2025-01-01',
    });
    expect(date).toMatchObject({ state: 'invalid', message: expect.stringContaining('after') });
  });

  it('an impossible date (31 Feb) is incomplete, not silently shifted', () => {
    expect(parseDateInput('2025-02-31')).toBeNull();
    expect(conditionStatus({ id: 'a', kind: 'date', field: 'createdAt', op: 'after', value: '2025-02-31' }).state).toBe(
      'incomplete',
    );
  });

  it('a half-typed number such as "-" is incomplete', () => {
    expect(conditionStatus({ id: 'a', kind: 'number', field: 'amount', op: 'eq', value: '-' }).state).toBe('incomplete');
  });

  it('with only incomplete conditions the filter shows every row', () => {
    const orders = [order({ idNum: 1 }), order({ id: 'ORD-0000002', idNum: 2 })];
    const filter: FilterRoot = {
      groups: [{ id: 'g', conditions: [{ id: 'a', kind: 'number', field: 'amount', op: 'gt', value: '' }] }],
    };
    expect(applyFilter(orders, filter).length).toBe(2);
  });

  it('an incomplete condition is skipped inside its group while the others still apply', () => {
    const orders = [order({ amount: 10 }), order({ id: 'ORD-0000002', idNum: 2, amount: 900 })];
    const filter: FilterRoot = {
      groups: [
        {
          id: 'g',
          conditions: [
            { id: 'a', kind: 'number', field: 'amount', op: 'gt', value: '500' },
            { id: 'b', kind: 'number', field: 'amount', op: 'lt', value: '' }, // ignored
          ],
        },
      ],
    };
    expect([...applyFilter(orders, filter)]).toEqual([1]);
  });
});

describe('operators', () => {
  it('text: contains / does not contain / equals are case-insensitive', () => {
    const o = order({ notes: 'Fragile, Handle with care', notesKey: 'fragile, handle with care' });
    const t = (op: 'contains' | 'notContains' | 'equals', value: string): FilterCondition => ({
      id: 'x',
      kind: 'text',
      field: 'notes',
      op,
      value,
    });
    expect(matches(t('contains', 'HANDLE'), o)).toBe(true);
    expect(matches(t('notContains', 'handle'), o)).toBe(false);
    expect(matches(t('equals', 'fragile'), o)).toBe(false);
    expect(matches(t('equals', 'Fragile, handle with CARE'), o)).toBe(true);
  });

  it('text on id matches regardless of case', () => {
    const c: FilterCondition = { id: 'x', kind: 'text', field: 'id', op: 'contains', value: 'ord-00000' };
    expect(matches(c, order())).toBe(true);
  });

  it('does not contain matches orders with empty notes', () => {
    const o = order({ notes: '', notesKey: '' });
    expect(matches({ id: 'x', kind: 'text', field: 'notes', op: 'notContains', value: 'refund' }, o)).toBe(true);
    expect(matches({ id: 'x', kind: 'text', field: 'notes', op: 'contains', value: 'refund' }, o)).toBe(false);
  });

  it('numbers: eq, gt, lt, between (inclusive)', () => {
    const o = order({ amount: 1000 });
    const n = (op: 'eq' | 'gt' | 'lt', value: string): FilterCondition => ({
      id: 'x',
      kind: 'number',
      field: 'amount',
      op,
      value,
    });
    expect(matches(n('eq', '1000'), o)).toBe(true);
    expect(matches(n('eq', '1000.00'), o)).toBe(true);
    expect(matches(n('gt', '1000'), o)).toBe(false);
    expect(matches(n('lt', '1000.01'), o)).toBe(true);
    const between = (min: string, max: string): FilterCondition => ({
      id: 'x',
      kind: 'number',
      field: 'amount',
      op: 'between',
      min,
      max,
    });
    expect(matches(between('1000', '1000'), o)).toBe(true);
    expect(matches(between('1001', '2000'), o)).toBe(false);
  });

  it('number on items works too', () => {
    expect(matches({ id: 'x', kind: 'number', field: 'itemCount', op: 'gt', value: '2' }, order({ itemCount: 3 }))).toBe(true);
  });

  it('dates: whole UTC days, before/after exclude the chosen day, between includes both ends', () => {
    const noon = Date.UTC(2025, 2, 14, 12, 0);
    const o = order({ createdAt: noon });
    const d = (op: 'before' | 'after', value: string): FilterCondition => ({
      id: 'x',
      kind: 'date',
      field: 'createdAt',
      op,
      value,
    });
    expect(matches(d('before', '2025-03-14'), o)).toBe(false); // same day is not "before"
    expect(matches(d('before', '2025-03-15'), o)).toBe(true);
    expect(matches(d('after', '2025-03-14'), o)).toBe(false); // same day is not "after"
    expect(matches(d('after', '2025-03-13'), o)).toBe(true);
    const between = (from: string, to: string): FilterCondition => ({
      id: 'x',
      kind: 'date',
      field: 'createdAt',
      op: 'between',
      from,
      to,
    });
    expect(matches(between('2025-03-14', '2025-03-14'), o)).toBe(true);
    expect(matches(between('2025-03-14', '2025-03-14'), order({ createdAt: Date.UTC(2025, 2, 14, 23, 59, 59, 999) }))).toBe(true);
    expect(matches(between('2025-03-14', '2025-03-14'), order({ createdAt: Date.UTC(2025, 2, 15, 0, 0) }))).toBe(false);
  });

  it('orders with no updatedAt never match a date condition', () => {
    const o = order({ updatedAt: null });
    for (const op of ['before', 'after'] as const) {
      expect(matches({ id: 'x', kind: 'date', field: 'updatedAt', op, value: '2025-03-14' }, o)).toBe(false);
    }
    expect(
      matches({ id: 'x', kind: 'date', field: 'updatedAt', op: 'between', from: '2000-01-01', to: '2030-01-01' }, o),
    ).toBe(false);
  });

  it('enum: one of several; priority None matches a missing priority', () => {
    const e = (field: 'status' | 'priority', values: string[]): FilterCondition => ({
      id: 'x',
      kind: 'enum',
      field,
      op: 'isOneOf',
      values,
    });
    expect(matches(e('status', ['shipped', 'pending']), order({ status: 'pending' }))).toBe(true);
    expect(matches(e('status', ['shipped']), order({ status: 'pending' }))).toBe(false);
    expect(matches(e('priority', ['none']), order({ priority: null }))).toBe(true);
    expect(matches(e('priority', ['none']), order({ priority: 1 }))).toBe(false);
    expect(matches(e('priority', ['1', 'none']), order({ priority: 1 }))).toBe(true);
  });
});

describe('groups: OR inside, AND between', () => {
  const orders = [
    order({ id: 'ORD-0000001', idNum: 1, status: 'shipped', amount: 500 }),
    order({ id: 'ORD-0000002', idNum: 2, status: 'delivered', amount: 6000 }),
    order({ id: 'ORD-0000003', idNum: 3, status: 'pending', amount: 10 }),
  ];
  const filter: FilterRoot = {
    groups: [
      { id: 'g1', conditions: [{ id: 'a', kind: 'enum', field: 'status', op: 'isOneOf', values: ['shipped', 'delivered'] }] },
      {
        id: 'g2',
        conditions: [
          { id: 'b', kind: 'number', field: 'amount', op: 'gt', value: '1000' },
          { id: 'c', kind: 'number', field: 'amount', op: 'lt', value: '50' },
        ],
      },
    ],
  };

  it('(shipped OR delivered) AND (amount > 1000 OR amount < 50)', () => {
    expect([...applyFilter(orders, filter)].map((i) => orders[i]!.id)).toEqual(['ORD-0000002']);
  });

  it('an empty filter returns every row in file order', () => {
    expect([...applyFilter(orders, { groups: [] })]).toEqual([0, 1, 2]);
  });
});

describe('chip labels', () => {
  it('formats values the way the grid does and marks missing ones', () => {
    expect(conditionLabel({ id: 'a', kind: 'number', field: 'amount', op: 'gt', value: '1000' })).toBe('Amount > ₹1,000.00');
    expect(conditionLabel({ id: 'a', kind: 'number', field: 'amount', op: 'between', min: '1000', max: '' })).toBe(
      'Amount between ₹1,000.00 and …',
    );
    expect(conditionLabel({ id: 'a', kind: 'date', field: 'createdAt', op: 'after', value: '2026-01-01' })).toBe(
      'Created after 1 Jan 2026',
    );
    expect(conditionLabel({ id: 'a', kind: 'date', field: 'createdAt', op: 'after', value: '' })).toBe('Created after …');
    expect(conditionLabel({ id: 'a', kind: 'enum', field: 'status', op: 'isOneOf', values: ['shipped', 'delivered'] })).toBe(
      'Status is Shipped or Delivered',
    );
    expect(conditionLabel({ id: 'a', kind: 'enum', field: 'region', op: 'isOneOf', values: ['NORTHEAST'] })).toBe(
      'Region is Northeast',
    );
    expect(conditionLabel({ id: 'a', kind: 'text', field: 'notes', op: 'contains', value: 'refund' })).toBe(
      'Notes contains “refund”',
    );
  });
});

describe('on the real orders.json', () => {
  const { orders } = normalizeOrders(JSON.parse(readFileSync('public/orders.json', 'utf8')) as unknown[]);
  const run = (c: FilterCondition) => applyFilter(orders, { groups: [{ id: 'g', conditions: [c] }] });

  it('the brief’s example, amount greater than 5,000, matches nothing (the largest order is ₹3,640)', () => {
    expect(run({ id: 'a', kind: 'number', field: 'amount', op: 'gt', value: '5000' }).length).toBe(0);
  });

  it('priority None matches exactly the orders with no priority', () => {
    const expected = orders.filter((o) => o.priority === null).length;
    expect(expected).toBeGreaterThan(14000);
    expect(run({ id: 'a', kind: 'enum', field: 'priority', op: 'isOneOf', values: ['none'] }).length).toBe(expected);
  });

  it('status filter counts add up across all five values', () => {
    const total = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
      .map((s) => run({ id: 'a', kind: 'enum', field: 'status', op: 'isOneOf', values: [s] }).length)
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(orders.length);
  });

  it('filtering 50,000 rows is fast', () => {
    const t = performance.now();
    applyFilter(orders, {
      groups: [
        { id: 'g1', conditions: [{ id: 'a', kind: 'text', field: 'email', op: 'contains', value: 'priya' }] },
        { id: 'g2', conditions: [{ id: 'b', kind: 'number', field: 'amount', op: 'between', min: '100', max: '2000' }] },
      ],
    });
    expect(performance.now() - t).toBeLessThan(100);
  });
});
