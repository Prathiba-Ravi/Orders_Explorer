import { useMemo } from 'react';
import { DataGrid } from '../grid/DataGrid';
import type { SortState } from '../grid/types';
import type { Order } from '../data/types';
import { ORDER_COLUMNS } from './columns';
import { createSorter } from './sort';

interface OrdersGridProps {
  orders: readonly Order[];
  sort: SortState | null;
  onSort: (columnId: string) => void;
}

export function OrdersGrid({ orders, sort, onSort }: OrdersGridProps) {
  const sorter = useMemo(() => createSorter(orders), [orders]);
  const view = useMemo(() => sorter.sort(sort), [sorter, sort]);

  return (
    <DataGrid
      columns={ORDER_COLUMNS}
      data={orders}
      view={view}
      getRowId={(o) => o.idNum}
      label="Orders"
      sort={sort}
      onSort={onSort}
    />
  );
}
