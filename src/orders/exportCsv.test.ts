import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeOrders } from '../data/normalize';
import { createSorter } from './sort';
import { CSV_HEADERS, csvFilename, csvText, ordersToCsv, selectedOrdersInOrder } from './exportCsv';

const { orders } = normalizeOrders(JSON.parse(readFileSync('public/orders.json', 'utf8')) as unknown[]);

/** Minimal RFC 4180 reader, to prove the output parses back to the same data. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  return rows;
}

describe('csvText', () => {
  it('quotes commas, quotes and line breaks, doubling quotes', () => {
    expect(csvText('plain')).toBe('plain');
    expect(csvText('a,b')).toBe('"a,b"');
    expect(csvText('say "hi"')).toBe('"say ""hi"""');
    expect(csvText('two\nlines')).toBe('"two\nlines"');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(csvText('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvText('+1')).toBe("'+1");
    expect(csvText('-1')).toBe("'-1");
    expect(csvText('@cmd')).toBe("'@cmd");
    expect(csvText('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });
});

describe('ordersToCsv on the real data', () => {
  it('has one header line plus one line per order, every row with the same number of cells', () => {
    const pick = orders.slice(0, 500);
    const rows = parseCsv(ordersToCsv(pick));
    expect(rows).toHaveLength(501);
    expect(rows[0]).toEqual([...CSV_HEADERS]);
    expect(rows.every((r) => r.length === CSV_HEADERS.length)).toBe(true);
  });

  it('round-trips awkward notes (commas, quotes, HTML) exactly', () => {
    const tricky = orders.filter((o) => /[",]/.test(o.notes) || /</.test(o.notes)).slice(0, 200);
    expect(tricky.length).toBeGreaterThan(50);
    const rows = parseCsv(ordersToCsv(tricky));
    tricky.forEach((o, i) => expect(rows[i + 1]![13]).toBe(o.notes));
  });

  it('writes amounts in rupees with two decimals, dates in UTC, and missing values as empty or None', () => {
    const o = orders.find((x) => x.updatedAt === null && x.priority === null)!;
    const row = parseCsv(ordersToCsv([o]))[1]!;
    expect(row[4]).toMatch(/^\d+\.\d{2}$/);
    expect(Number(row[4])).toBeCloseTo(o.amount, 2);
    expect(row[7]).toBe('');
    expect(row[11]).toBe('None');
  });

  it('date-only orders export a date, not an invented 00:00 time', () => {
    const o = orders.find((x) => x.createdAtDateOnly)!;
    expect(parseCsv(ordersToCsv([o]))[1]![6]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const full = orders.find((x) => !x.createdAtDateOnly)!;
    expect(parseCsv(ordersToCsv([full]))[1]![6]).toMatch(/T.*Z$/);
  });
});

describe('selectedOrdersInOrder: the export always matches the selection', () => {
  const sorter = createSorter(orders);
  const all = sorter.sort({ columnId: 'amount', dir: 'asc' });

  it('exports exactly the selected orders, including ones a filter hides (200 selected, 180 hidden)', () => {
    const selected = new Set(orders.slice(100, 300).map((o) => o.idNum)); // 200 orders
    const rows = selectedOrdersInOrder(orders, all, selected);
    expect(rows).toHaveLength(200);
    expect(new Set(rows.map((o) => o.idNum))).toEqual(selected);
  });

  it('follows the current sort order', () => {
    const selected = new Set(orders.slice(0, 50).map((o) => o.idNum));
    const amounts = selectedOrdersInOrder(orders, all, selected).map((o) => o.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it('exports nothing for an empty selection and everything for all of them', () => {
    expect(selectedOrdersInOrder(orders, all, new Set())).toHaveLength(0);
    expect(selectedOrdersInOrder(orders, all, new Set(orders.map((o) => o.idNum)))).toHaveLength(50000);
  });
});

describe('csvFilename', () => {
  it('uses the UTC date', () => {
    expect(csvFilename(new Date('2026-10-24T23:30:00Z'))).toBe('orders-selected-2026-10-24.csv');
  });
});
