import { describe, expect, it } from 'vitest';
import type { Order } from '../data/types';
import { applyFilter } from './apply';
import { compileCondition } from './compile';
import { dateBetweenValue, dateOpValue, parseDateInput } from './dates';
import type { FilterRoot } from './types';

function order(partial: Partial<Order> & Pick<Order, 'id' | 'idNum'>): Order {
  return {
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
    notes: 'hello',
    customerKey: 'acme',
    emailKey: 'a@b.com',
    notesKey: 'hello',
    ...partial,
  };
}

describe('filter edge cases', () => {
  it('None priority matches enum none', () => {
    const o = order({ id: 'ORD-0000001', idNum: 1, priority: null });
    const pred = compileCondition({
      id: 'c1',
      kind: 'enum',
      field: 'priority',
      op: 'isOneOf',
      values: ['none'],
    });
    expect(pred(o)).toBe(true);
  });

  it('null updatedAt fails date filters', () => {
    const o = order({ id: 'ORD-0000002', idNum: 2, updatedAt: null });
    const pred = compileCondition({
      id: 'c2',
      kind: 'date',
      field: 'updatedAt',
      op: 'after',
      value: 0,
    });
    expect(pred(o)).toBe(false);
  });

  it('empty notes: does not contain matches non-empty needle', () => {
    const o = order({ id: 'ORD-0000003', idNum: 3, notes: '', notesKey: '' });
    const pred = compileCondition({
      id: 'c3',
      kind: 'text',
      field: 'notes',
      op: 'notContains',
      value: 'refund',
    });
    expect(pred(o)).toBe(true);
  });

  it('date between is inclusive on calendar-day bounds', () => {
    const day = parseDateInput('2025-03-14')!;
    const o = order({
      id: 'ORD-0000004',
      idNum: 4,
      createdAt: day.end,
    });
    const range = dateBetweenValue('2025-03-14', '2025-03-14')!;
    const pred = compileCondition({
      id: 'c4',
      kind: 'date',
      field: 'createdAt',
      op: 'between',
      value: range,
    });
    expect(pred(o)).toBe(true);
    expect(dateOpValue('before', '2025-03-15')).toBe(parseDateInput('2025-03-15')!.start);
  });
});

describe('applyFilter groups', () => {
  const orders = [
    order({ id: 'ORD-0000001', idNum: 1, status: 'shipped', amount: 500 }),
    order({ id: 'ORD-0000002', idNum: 2, status: 'delivered', amount: 6000 }),
    order({ id: 'ORD-0000003', idNum: 3, status: 'pending', amount: 100 }),
  ];

  it('AND between groups, OR inside a group', () => {
    const filter: FilterRoot = {
      groups: [
        {
          id: 'g1',
          conditions: [
            {
              id: 'a',
              kind: 'enum',
              field: 'status',
              op: 'isOneOf',
              values: ['shipped', 'delivered'],
            },
          ],
        },
        {
          id: 'g2',
          conditions: [
            { id: 'b', kind: 'number', field: 'amount', op: 'gt', value: 1000 },
            { id: 'c', kind: 'number', field: 'amount', op: 'lt', value: 50 },
          ],
        },
      ],
    };
    const idx = applyFilter(orders, filter);
    expect([...idx].map((i) => orders[i]!.id)).toEqual(['ORD-0000002']);
  });
});
