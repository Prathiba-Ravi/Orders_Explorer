import { useState } from 'react';
import { useOrders } from './data/useOrders';
import type { SortState } from './grid/types';
import { formatCount } from './lib/format';
import { OrdersGrid } from './orders/OrdersGrid';
import { DEFAULT_SORT, nextSort } from './orders/sort';
import './App.css';

export function App() {
  const data = useOrders();
  const [sort, setSort] = useState<SortState | null>(DEFAULT_SORT);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Orders Explorer</h1>
        {data.status === 'ready' && (
          <span className="toolbar__count">{formatCount(data.orders.length)} orders</span>
        )}
      </header>
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
      {data.status === 'ready' && <OrdersGrid orders={data.orders} sort={sort} onSort={(id) => setSort((cur) => nextSort(cur, id))} />}
    </div>
  );
}
