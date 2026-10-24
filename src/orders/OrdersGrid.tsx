import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataGrid, type FocusCell } from '../grid/DataGrid';
import type { SortState } from '../grid/types';
import type { Order } from '../data/types';
import { ORDER_COLUMNS } from './columns';
import { createSorter } from './sort';
import { useGridSelection } from './useGridSelection';

interface OrdersGridProps {
  orders: readonly Order[];
  view: ArrayLike<number>;
  sort: SortState | null;
  onSort: (columnId: string) => void;
  widths: Record<string, number>;
  onWidthChange: (id: string, width: number) => void;
  pinnedColumnId: string | null;
  onTogglePin: (columnId: string) => void;
  detailsOrder: Order | null;
  onOpenDetails: (order: Order | null) => void;
  onSelectionCountChange?: (count: number) => void;
}

export function OrdersGrid({
  orders,
  view,
  sort,
  onSort,
  widths,
  onWidthChange,
  pinnedColumnId,
  onTogglePin,
  detailsOrder,
  onOpenDetails,
  onSelectionCountChange,
}: OrdersGridProps) {
  const sorter = useMemo(() => createSorter(orders), [orders]);
  const sortedView = useMemo(() => sorter.sortSubset(view, sort), [sorter, view, sort]);

  const rowKey = useCallback((dataIndex: number) => orders[dataIndex]!.idNum, [orders]);
  const { selection, selectViewIndex, selectAllVisible } = useGridSelection({
    view: sortedView,
    rowKey,
  });

  const [focus, setFocus] = useState<FocusCell | null>(null);

  useEffect(() => {
    onSelectionCountChange?.(selection.count);
  }, [onSelectionCountChange, selection.count]);

  useEffect(() => {
    if (focus && focus.viewRow >= sortedView.length) {
      setFocus(sortedView.length > 0 ? { viewRow: sortedView.length - 1, col: focus.col } : null);
    }
  }, [sortedView.length, focus]);

  useEffect(() => {
    if (!detailsOrder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenDetails(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailsOrder, onOpenDetails]);

  const openRow = useCallback(
    (viewIndex: number) => {
      const order = orders[sortedView[viewIndex]!];
      if (order) onOpenDetails(order);
    },
    [onOpenDetails, orders, sortedView],
  );

  return (
    <DataGrid
      columns={ORDER_COLUMNS}
      data={orders}
      view={sortedView}
      getRowId={(o) => o.idNum}
      label="Orders"
      sort={sort}
      onSort={onSort}
      widths={widths}
      onWidthChange={onWidthChange}
      pinnedColumnId={pinnedColumnId}
      onTogglePin={onTogglePin}
      selection={{
        selected: selection.set,
        allVisible: selection.all,
        someVisible: selection.some,
        onSelectViewRow: (viewIndex, mode) => {
          selectViewIndex(viewIndex, mode);
          setFocus((f) => f ?? { viewRow: viewIndex, col: 1 });
        },
        onSelectAllVisible: selectAllVisible,
        rowKeyAtViewIndex: (viewIndex) => rowKey(sortedView[viewIndex]!),
      }}
      focus={focus}
      onFocusChange={setFocus}
      onOpenRow={openRow}
    />
  );
}
