import { describe, expect, it } from 'vitest';
import type { FilterRoot } from '../filter/types';
import { decodeFilter, encodeFilter } from './filterCodec';
import { decodeSelection, encodeSelection, MAX_SELECTION } from './selectionCodec';
import { buildSearch, DEFAULT_URL_STATE, parseUrl, type UrlState } from './urlState';

const sampleFilter: FilterRoot = {
  groups: [
    {
      id: 'g1',
      conditions: [
        { id: 'a', kind: 'enum', field: 'status', op: 'isOneOf', values: ['shipped', 'delivered'] },
        { id: 'b', kind: 'enum', field: 'priority', op: 'isOneOf', values: ['none', '1'] },
      ],
    },
    {
      id: 'g2',
      conditions: [
        { id: 'c', kind: 'number', field: 'amount', op: 'between', min: '1000', max: '2500.50' },
        { id: 'd', kind: 'number', field: 'itemCount', op: 'gt', value: '' }, // unfinished
        { id: 'e', kind: 'date', field: 'createdAt', op: 'between', from: '2026-01-01', to: '2026-03-31' },
        { id: 'f', kind: 'date', field: 'updatedAt', op: 'after', value: '2025-12-31' },
        { id: 'g', kind: 'text', field: 'notes', op: 'notContains', value: 'a "quoted" & <b>odd</b> value, 100%' },
      ],
    },
  ],
};

/** Ignores generated ids, which are not stored in the URL. */
const stripIds = (root: FilterRoot) =>
  root.groups.map((g) => g.conditions.map(({ id: _id, ...rest }) => rest));

describe('selection codec', () => {
  it('round-trips single ids, runs and gaps', () => {
    for (const ids of [[], [1], [5, 6, 7], [1, 3, 5, 7], [1, 2, 3, 10, 11, 500, 50000], [0, 1]]) {
      expect(decodeSelection(encodeSelection(ids))).toEqual(ids);
    }
  });

  it('ignores order, duplicates and bad numbers when encoding', () => {
    expect(decodeSelection(encodeSelection([7, 5, 6, 5, -1, 1.5, NaN]))).toEqual([5, 6, 7]);
  });

  it('selecting all 50,000 orders stays tiny', () => {
    const all = Array.from({ length: 50_000 }, (_, i) => i + 1);
    const text = encodeSelection(all);
    expect(text.length).toBeLessThan(12);
    expect(decodeSelection(text)).toHaveLength(50_000);
  });

  it('5,000 scattered rows stay well under 20 KB', () => {
    const ids = Array.from({ length: 5000 }, (_, i) => 1 + i * 9 + (i % 3));
    expect(encodeSelection(ids).length).toBeLessThan(20_000);
  });

  it('rejects text that encodeSelection could not have produced', () => {
    for (const bad of ['!!', '1..2', '.', '1.', '.1', '1-', '-1', '1-2-3', 'A', '1,2', '1.0', 'zzzzzzzzzzzzzzzzzzzz']) {
      expect(decodeSelection(bad), bad).toBeNull();
    }
  });

  it('refuses a selection larger than the cap', () => {
    expect(decodeSelection(`1-${(MAX_SELECTION + 5).toString(36)}`)).toBeNull();
  });
});

describe('filter codec', () => {
  it('round-trips every condition type, including unfinished ones and awkward text', () => {
    const decoded = decodeFilter(encodeFilter(sampleFilter));
    expect(decoded).not.toBeNull();
    expect(stripIds(decoded!)).toEqual(stripIds(sampleFilter));
  });

  it('an empty filter encodes to nothing', () => {
    expect(encodeFilter({ groups: [] })).toBe('');
    expect(encodeFilter({ groups: [{ id: 'x', conditions: [] }] })).toBe('');
  });

  it('rejects garbage without throwing', () => {
    const bad = [
      '',
      '{',
      'null',
      '42',
      '"x"',
      '{}',
      '[]',
      '[[]]',
      '[1]',
      '[[1]]',
      '[[["t"]]]',
      '[[["t","nope","c","x"]]]', // unknown field
      '[[["t","customer","zz","x"]]]', // unknown operator
      '[[["t","status","c","x"]]]', // field of the wrong kind
      '[[["e","status","shipped","shipped"]]]', // duplicate value
      '[[["e","status","teleported"]]]', // not an allowed value
      '[[["n","amount","gt","abc"]]]',
      '[[["n","amount","bt","1"]]]', // missing max
      '[[["d","createdAt","af","2025-02-31"]]]', // impossible date
      '[[["d","createdAt","af","yesterday"]]]',
      '[[["t","customer","c",5]]]', // wrong value type
      `[[["t","customer","c","${'x'.repeat(201)}"]]]`, // too long
      `[${'[["t","customer","c","x"]],'.repeat(11)}[["t","customer","c","x"]]]`, // too many groups
    ];
    for (const text of bad) expect(decodeFilter(text), text).toBeNull();
  });
});

describe('parseUrl / buildSearch', () => {
  it('the plain view has a clean URL and parses to the defaults', () => {
    expect(buildSearch(DEFAULT_URL_STATE)).toBe('');
    const { state, problems } = parseUrl('');
    expect(problems).toEqual([]);
    expect(state.sort).toBeNull(); // unsorted: original order
    expect(state.pinnedId).toBeNull();
    expect(state.selection.size).toBe(0);
    expect(state.filter.groups).toHaveLength(0);
  });

  it('round-trips filter, sort, pinned column and selection', () => {
    const original: UrlState = {
      filter: sampleFilter,
      sort: { columnId: 'amount', dir: 'asc' },
      pinnedId: 'customer',
      selection: new Set([1, 2, 3, 40, 41, 9999]),
    };
    const { state, problems } = parseUrl(`?${buildSearch(original)}`);
    expect(problems).toEqual([]);
    expect(stripIds(state.filter)).toEqual(stripIds(original.filter));
    expect(state.sort).toEqual(original.sort);
    expect(state.pinnedId).toBe('customer');
    expect([...state.selection].sort((a, b) => a - b)).toEqual([1, 2, 3, 40, 41, 9999]);
  });

  it('only what the user changed is written to the URL', () => {
    expect(buildSearch({ ...DEFAULT_URL_STATE, pinnedId: 'region' })).toBe('p=region');
    expect(buildSearch({ ...DEFAULT_URL_STATE, sort: { columnId: 'amount', dir: 'desc' } })).toBe('s=amount.desc');
    expect(parseUrl('?p=region').state.pinnedId).toBe('region');
  });

  it('a broken link never throws: each bad part falls back and says so', () => {
    const cases: [string, string][] = [
      ['?f=%7B', 'filter'],
      ['?f=%5B%5B1%5D%5D', 'filter'],
      ['?s=amount', 'sort'],
      ['?s=amount.sideways', 'sort'],
      ['?s=bogus.asc', 'sort'],
      ['?s=a.b.c', 'sort'],
      ['?p=nonsense', 'pinned'],
      ['?sel=!!!', 'selected'],
      ['?sel=1..2', 'selected'],
    ];
    for (const [search, word] of cases) {
      const { state, problems } = parseUrl(search);
      expect(problems, search).toHaveLength(1);
      expect(problems[0], search).toContain(word);
      // the bad part fell back to its default
      if (search.startsWith('?s=')) expect(state.sort).toBeNull();
      if (search.startsWith('?p=')) expect(state.pinnedId).toBeNull();
    }
  });

  it('keeps the good parts when only one part is bad', () => {
    const { state, problems } = parseUrl('?s=amount.desc&p=nonsense&sel=1-3');
    expect(problems).toHaveLength(1);
    expect(state.sort).toEqual({ columnId: 'amount', dir: 'desc' });
    expect(state.pinnedId).toBeNull();
    expect([...state.selection]).toEqual([1, 2, 3, 4]); // "1-3" = start at 1, three more
  });

  it('survives odd query strings', () => {
    for (const search of ['?', '??', '?f', '?f=', '?=&=', '?%', '?f=%E0%A4%A', 'garbage', '?f=1&f=2']) {
      expect(() => parseUrl(search), search).not.toThrow();
    }
  });
});
