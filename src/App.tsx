import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Order } from './data/types';
import { useOrders } from './data/useOrders';
import { applyFilter } from './filter/apply';
import { FilterBuilder } from './filter/FilterBuilder';
import { FilterChips } from './filter/FilterChips';
import { conditionStatus } from './filter/status';
import { EMPTY_FILTER, type FilterRoot } from './filter/types';
import type { SortState } from './grid/types';
import { formatCount } from './lib/format';
import { useDebouncedValue } from './lib/useDebouncedValue';
import { csvFilename, downloadCsv, ordersToCsv, selectedOrdersInOrder } from './orders/exportCsv';
import { OrderDetails } from './orders/OrderDetails';
import { OrdersGrid } from './orders/OrdersGrid';
import { createSorter, DEFAULT_SORT, nextSort } from './orders/sort';
import { buildSearch, DEFAULT_PINNED_ID, parseUrl } from './url/urlState';
import { ShortcutsHelp } from './ShortcutsHelp';
import './App.css';

const NO_ORDERS: readonly Order[] = [];

function isTypingTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
}

export function App() {
  const data = useOrders();

  // Everything the URL remembers starts from the URL. A broken link falls back to defaults and says so.
  const [initial] = useState(() => parseUrl(window.location.search));
  const [filter, setFilter] = useState<FilterRoot>(initial.state.filter);
  const [sort, setSort] = useState<SortState>(initial.state.sort);
  const [pinnedColumnId, setPinnedColumnId] = useState<string | null>(initial.state.pinnedId);
  const [selected, setSelected] = useState<ReadonlySet<number>>(initial.state.selection);
  const [notices, setNotices] = useState<string[]>(initial.problems);

  // Not in the URL: column widths and the open panels.
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [details, setDetails] = useState<Order | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);

  const appliedFilter = useDebouncedValue(filter, 150);
  const orders = data.status === 'ready' ? data.orders : NO_ORDERS;
  const ready = data.status === 'ready';

  // Once the orders are known, drop selected ids from the link that do not exist.
  const prunedRef = useRef(false);
  useEffect(() => {
    if (!ready || prunedRef.current) return;
    prunedRef.current = true;
    const known = new Set(orders.map((o) => o.idNum));
    const kept = [...selected].filter((id) => known.has(id));
    if (kept.length !== selected.size) {
      setSelected(new Set(kept));
      setNotices((n) => [
        ...n,
        `${formatCount(selected.size - kept.length)} selected orders in this link do not exist and were skipped.`,
      ]);
    }
  }, [ready, orders, selected]);

  // Keep the URL in step with the screen (replaceState: no history entry per click or keystroke).
  useEffect(() => {
    const search = buildSearch({ filter: appliedFilter, sort, pinnedId: pinnedColumnId, selection: selected });
    const next = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, '', next);
    }
  }, [appliedFilter, sort, pinnedColumnId, selected]);

  // One cached sort of all orders, then the filter is a cheap mask over it (no re-sort per keystroke).
  const sorter = useMemo(() => createSorter(orders), [orders]);
  const sortedAll = useMemo(() => sorter.sort(sort), [sorter, sort]);
  const filtered = useMemo(() => applyFilter(orders, appliedFilter), [orders, appliedFilter]);
  const view = useMemo(() => {
    if (filtered.length === orders.length) return sortedAll;
    const keep = new Uint8Array(orders.length);
    for (let i = 0; i < filtered.length; i++) keep[filtered[i]!] = 1;
    return sortedAll.filter((i) => keep[i] === 1);
  }, [filtered, orders.length, sortedAll]);

  const total = orders.length; // unique orders (50,000), not records in the file (50,030)
  const shown = view.length;
  const empty = ready && shown === 0;

  const hiddenSelected = useMemo(() => {
    let visible = 0;
    for (let i = 0; i < filtered.length; i++) if (selected.has(orders[filtered[i]!]!.idNum)) visible++;
    return selected.size - visible;
  }, [filtered, orders, selected]);

  const activeConditions = useMemo(
    () => filter.groups.reduce((n, g) => n + g.conditions.filter((c) => conditionStatus(c).state === 'ok').length, 0),
    [filter],
  );

  const onWidthChange = useCallback((id: string, width: number) => setWidths((w) => ({ ...w, [id]: width })), []);
  const onTogglePin = useCallback((id: string) => setPinnedColumnId((cur) => (cur === id ? null : id)), []);
  const onSort = useCallback((id: string) => setSort((cur) => nextSort(cur, id) as SortState), []);
  const resetLayout = useCallback(() => {
    setSort(DEFAULT_SORT);
    setWidths({});
    setPinnedColumnId(DEFAULT_PINNED_ID);
  }, []);

  const deselectHidden = () => {
    const visible = new Set<number>();
    for (let i = 0; i < filtered.length; i++) visible.add(orders[filtered[i]!]!.idNum);
    setSelected(new Set([...selected].filter((id) => visible.has(id))));
  };

  const exportSelected = () => {
    const rows = selectedOrdersInOrder(orders, sortedAll, selected);
    downloadCsv(ordersToCsv(rows), csvFilename());
  };

  const closeFilters = () => {
    setFiltersOpen(false);
    filtersButtonRef.current?.focus();
  };

  // "/" opens the filters, "?" shows the shortcuts. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        setFiltersOpen(true);
        requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('select, input, button')?.focus());
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Orders Explorer</h1>
        {ready && (
          <span className="toolbar__count">
            {formatCount(shown)} of {formatCount(total)} orders
          </span>
        )}
        {ready && (
          <button
            ref={filtersButtonRef}
            type="button"
            className={`btn btn--toggle${filtersOpen ? ' is-open' : ''}`}
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            title="Show or hide the filter builder (/)"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
            {activeConditions > 0 && <span className="badge">{activeConditions}</span>}
            <span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
          </button>
        )}
        <div className="toolbar__spacer" />
        {ready && selected.size > 0 && (
          <span className="toolbar__selection" role="status">
            <strong>{formatCount(selected.size)} selected</strong>
            {hiddenSelected > 0 && ` (${formatCount(hiddenSelected)} hidden by filter)`}
            {hiddenSelected > 0 && (
              <button type="button" className="link" onClick={deselectHidden}>
                Deselect hidden
              </button>
            )}
            <button type="button" className="link" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </span>
        )}
        {ready && (
          <>
            <button
              type="button"
              className="btn btn--primary"
              disabled={selected.size === 0}
              title={selected.size === 0 ? 'Select rows to export them' : 'Download the selected rows as CSV'}
              onClick={exportSelected}
            >
              {selected.size === 0 ? 'Export' : `Export ${formatCount(selected.size)} ${selected.size === 1 ? 'row' : 'rows'}`}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              title="Back to default sort, column widths and pinned column"
              onClick={resetLayout}
            >
              Reset grid
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              onClick={() => setHelpOpen((open) => !open)}
            >
              ?
            </button>
          </>
        )}
      </header>

      {notices.length > 0 && (
        <div className="notice" role="alert">
          <div>
            <strong>This link was not fully understood.</strong>
            <ul>
              {notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="btn" onClick={() => setNotices([])}>
            Dismiss
          </button>
        </div>
      )}

      {ready && filtersOpen && (
        <div
          id="filter-panel"
          ref={panelRef}
          className="filter-panel"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              closeFilters();
            }
          }}
        >
          <FilterBuilder filter={filter} onChange={setFilter} />
        </div>
      )}
      {ready && <FilterChips filter={filter} onChange={setFilter} onClearAll={() => setFilter(EMPTY_FILTER)} />}

      {data.status === 'loading' && (
        <div className="state" role="status">
          {data.phase === 'downloading' ? 'Downloading orders…' : 'Preparing orders…'}
        </div>
      )}
      {data.status === 'error' && (
        <div className="state" role="alert">
          <p>{data.message}</p>
          <button className="btn" onClick={data.reload}>
            Try again
          </button>
        </div>
      )}

      {ready && (
        <div className="app__main">
          <div className="app__grid-wrap">
            <OrdersGrid
              orders={orders}
              view={view}
              sort={sort}
              onSort={onSort}
              widths={widths}
              onWidthChange={onWidthChange}
              pinnedColumnId={pinnedColumnId}
              onTogglePin={onTogglePin}
              detailsOrder={details}
              onOpenDetails={setDetails}
              selected={selected}
              onSelectedChange={setSelected}
              emptyState={
                empty ? (
                  <>
                    <p className="state__title">No orders match these filters</p>
                    {selected.size > 0 && (
                      <p className="state__hint">
                        Your {formatCount(selected.size)} selected orders are kept and will show again when the filter is cleared.
                      </p>
                    )}
                    <button type="button" className="btn btn--primary" onClick={() => setFilter(EMPTY_FILTER)}>
                      Clear all filters
                    </button>
                  </>
                ) : undefined
              }
            />
          </div>
          {details && <OrderDetails order={details} onClose={() => setDetails(null)} />}
        </div>
      )}

      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
