import { EMPTY_FILTER, type FilterRoot } from '../filter/types';
import type { SortState } from '../grid/types';
import { ORDER_COLUMNS } from '../orders/columns';
import { DEFAULT_SORT, SORT_VALUES } from '../orders/sort';
import { decodeFilter, encodeFilter } from './filterCodec';
import { decodeSelection, encodeSelection } from './selectionCodec';

/** What the URL remembers: the filter, the sort, the pinned column and the selected rows. */
export interface UrlState {
  filter: FilterRoot;
  sort: SortState;
  /** null = nothing pinned. */
  pinnedId: string | null;
  /** Selected orders, by numeric id. */
  selection: ReadonlySet<number>;
}

/** The order id column is pinned unless the user says otherwise. */
export const DEFAULT_PINNED_ID = 'id';

export const DEFAULT_URL_STATE: UrlState = {
  filter: EMPTY_FILTER,
  sort: DEFAULT_SORT,
  pinnedId: DEFAULT_PINNED_ID,
  selection: new Set(),
};

const COLUMN_IDS = new Set(ORDER_COLUMNS.map((c) => c.id));

function parseSort(text: string): SortState | null {
  const [columnId, dir, extra] = text.split('.');
  if (extra !== undefined || !columnId || !(columnId in SORT_VALUES)) return null;
  return dir === 'asc' || dir === 'desc' ? { columnId, dir } : null;
}

export interface ParsedUrl {
  state: UrlState;
  /** Plain-language messages about anything that had to be ignored. Empty when the URL was fine. */
  problems: string[];
}

/**
 * Reads the query string. Never throws: any part that is missing or invalid falls back to
 * its default, and a message says so, so a broken link opens the normal view.
 */
export function parseUrl(search: string): ParsedUrl {
  const params = new URLSearchParams(search);
  const problems: string[] = [];
  let { filter, sort, pinnedId, selection } = DEFAULT_URL_STATE;

  const f = params.get('f');
  if (f !== null) {
    const decoded = decodeFilter(f);
    if (decoded) filter = decoded;
    else problems.push('The filter in this link could not be read, so no filter is applied.');
  }

  const s = params.get('s');
  if (s !== null) {
    const decoded = parseSort(s);
    if (decoded) sort = decoded;
    else problems.push('The sort in this link is not valid, so orders are sorted newest first.');
  }

  const p = params.get('p');
  if (p !== null) {
    if (p === 'none') pinnedId = null;
    else if (COLUMN_IDS.has(p)) pinnedId = p;
    else problems.push('The pinned column in this link is not valid, so the default column is pinned.');
  }

  const sel = params.get('sel');
  if (sel !== null) {
    const decoded = decodeSelection(sel);
    if (decoded) selection = new Set(decoded);
    else problems.push('The selected rows in this link could not be read, so nothing is selected.');
  }

  return { state: { filter, sort, pinnedId, selection }, problems };
}

/** The query string (without "?") for a state. Defaults are left out, so the plain view has a clean URL. */
export function buildSearch(state: UrlState): string {
  const params = new URLSearchParams();
  const f = encodeFilter(state.filter);
  if (f) params.set('f', f);
  if (state.sort.columnId !== DEFAULT_SORT.columnId || state.sort.dir !== DEFAULT_SORT.dir) {
    params.set('s', `${state.sort.columnId}.${state.sort.dir}`);
  }
  if (state.pinnedId !== DEFAULT_PINNED_ID) params.set('p', state.pinnedId ?? 'none');
  if (state.selection.size > 0) params.set('sel', encodeSelection(state.selection));
  return params.toString();
}
