import { useMemo } from 'react';
import { DataGrid } from '../grid/DataGrid';
import type { Order } from '../data/types';
import { ORDER_COLUMNS } from './columns';

interface OrdersGridProps {
  orders: readonly Order[];
}

export function OrdersGrid({ orders }: OrdersGridProps) {
  const view = useMemo(() => {
    // File order for now; sorting arrives in the next commit.
    const indices = new Int32Array(orders.length);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    return indices;
  }, [orders]);

  return <DataGrid columns={ORDER_COLUMNS} data={orders} view={view} getRowId={(o) => o.idNum} label="Orders" />;
}
