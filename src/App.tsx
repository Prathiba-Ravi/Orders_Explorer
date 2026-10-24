import { useCallback, useMemo, useState } from 'react';
import { useOrders } from './data/useOrders';
import { applyFilter } from './filter/apply';
import { FilterBuilder } from './filter/FilterBuilder';
import { FilterChips } from './filter/FilterChips';
import { EMPTY_FILTER, type FilterRoot } from './filter/types';
import type { SortState } from './grid/types';
import { useDebouncedValue } from './lib/useDebouncedValue';
import { formatCount } from './lib/format';
import { OrderDetails } from './orders/OrderDetails';
import { OrdersGrid } from './orders/OrdersGrid';
import { DEFAULT_SORT, nextSort } from './orders/sort';
import './App.css';

export function App() {
  const data = useOrders();
  const [sort, setSort] = useState<SortState | null>(DEFAULT_SORT);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [pinnedColumnId, setPinnedColumnId] = useState<string | null>('id');
  const [filter, setFilter] = useState<FilterRoot>(EMPTY_FILTER);
  const appliedFilter = useDebouncedValue(filter, 150);
  const [details, setDetails] = useState<import('./data/types').Order | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  const onWidthChange = useCallback((id: string, width: number) => {
    setWidths((w) => ({ ...w, [id]: width }));
  }, []);

  const onTogglePin = useCallback((columnId: string) => {
    setPinnedColumnId((cur) => (cur === columnId ? null : columnId));
  }, []);

  const resetLayout = useCallback(() => {
    setSort(DEFAULT_SORT);
    setWidths({});
    setPinnedColumnId('id');
  }, []);

  const orders = data.status === 'ready' ? data.orders : [];
  const filtered = useMemo(
    () => (data.status === 'ready' ? applyFilter(orders, appliedFilter) : new Int32Array(0)),
    [appliedFilter, data.status, orders],
  );

  // Unique orders (50,000), not records in the file (50,030, which includes the duplicates).
  const total = orders.length;
  const shown = filtered.length;
  const empty = data.status === 'ready' && shown === 0;

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Orders Explorer</h1>
        {data.status === 'ready' && (
          <span className="toolbar__count">
            {formatCount(shown)} of {formatCount(total)} orders
          </span>
        )}
        {data.status === 'ready' && selectedCount > 0 && (
          <span className="toolbar__selection">{formatCount(selectedCount)} selected</span>
        )}
        <div className="toolbar__spacer" />
        {data.status === 'ready' && (
          <button type="button" className="btn btn--ghost" onClick={resetLayout}>
            Reset grid
          </button>
        )}
      </header>

      {data.status === 'ready' && (
        <>
          <FilterBuilder filter={filter} onChange={setFilter} />
          <FilterChips filter={filter} onChange={setFilter} onClearAll={() => setFilter(EMPTY_FILTER)} />
        </>
      )}

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

      {data.status === 'ready' && (
        <div className="app__main">
          <div className="app__grid-wrap">
            {empty ? (
              <div className="state state--empty" role="status">
                <p>No orders match this filter.</p>
                <button type="button" className="btn" onClick={() => setFilter(EMPTY_FILTER)}>
                  Clear filter
                </button>
              </div>
            ) : (
              <OrdersGrid
                orders={orders}
                view={filtered}
                sort={sort}
                onSort={(id) => setSort((cur) => nextSort(cur, id))}
                widths={widths}
                onWidthChange={onWidthChange}
                pinnedColumnId={pinnedColumnId}
                onTogglePin={onTogglePin}
                detailsOrder={details}
                onOpenDetails={setDetails}
                onSelectionCountChange={setSelectedCount}
              />
            )}
          </div>
          {details && <OrderDetails order={details} onClose={() => setDetails(null)} />}
        </div>
      )}
    </div>
  );
}
