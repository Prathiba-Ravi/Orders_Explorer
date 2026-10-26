import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { DataGrid, type FocusCell } from '../grid/DataGrid';
import type { SortState } from '../grid/types';
import type { Order } from '../data/types';
import { ORDER_COLUMNS } from './columns';
import { useGridSelection, type SelectMode } from './useGridSelection';

interface OrdersGridProps {
  orders: readonly Order[];
  /** Rows to show: filtered and sorted, as indices into `orders`. */
  view: ArrayLike<number>;
  sort: SortState | null;
  onSort: (columnId: string) => void;
  onClearSort: () => void;
  widths: Record<string, number>;
  onWidthChange: (id: string, width: number) => void;
  pinnedColumnId: string | null;
  onTogglePin: (columnId: string) => void;
  detailsOrder: Order | null;
  onOpenDetails: (order: Order | null) => void;
  /** Selected orders by numeric id. Owned by the parent so it can live in the URL. */
  selected: ReadonlySet<number>;
  onSelectedChange: (next: Set<number>) => void;
  /** Changes when the view is reset: the grid scrolls back to the top-left. */
  resetToken?: number;
  /** Shown in the grid area when no rows match. The grid stays mounted so the selection is kept. */
  emptyState?: ReactNode;
}

export function OrdersGrid({
  orders,
  view,
  sort,
  onSort,
  onClearSort,
  widths,
  onWidthChange,
  pinnedColumnId,
  onTogglePin,
  detailsOrder,
  onOpenDetails,
  selected,
  onSelectedChange,
  resetToken,
  emptyState,
}: OrdersGridProps) {
  const rowKey = useCallback((dataIndex: number) => orders[dataIndex]!.idNum, [orders]);
  const { selection, selectViewIndex, selectAllVisible } = useGridSelection({
    view,
    rowKey,
    selected,
    onChange: onSelectedChange,
  });

  const [focus, setFocus] = useState<FocusCell | null>(null);

  useEffect(() => {
    if (focus && focus.viewRow >= view.length) {
      setFocus(view.length > 0 ? { viewRow: view.length - 1, col: focus.col } : null);
    }
  }, [view.length, focus]);

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
      const order = orders[view[viewIndex]!];
      if (order) onOpenDetails(order);
    },
    [onOpenDetails, orders, view],
  );

  return (
    <DataGrid
      columns={ORDER_COLUMNS}
      data={orders}
      view={view}
      getRowId={(o) => o.idNum}
      label="Orders"
      sort={sort}
      onSort={onSort}
      onClearSort={onClearSort}
      widths={widths}
      onWidthChange={onWidthChange}
      pinnedColumnId={pinnedColumnId}
      onTogglePin={onTogglePin}
      selection={{
        selected: selection.set,
        allVisible: selection.all,
        someVisible: selection.some,
        onSelectViewRow: (viewIndex: number, mode: SelectMode, anchorFallback?: number) => {
          selectViewIndex(viewIndex, mode, anchorFallback);
          setFocus((f) => f ?? { viewRow: viewIndex, col: 1 });
        },
        onSelectAllVisible: selectAllVisible,
        rowKeyAtViewIndex: (viewIndex) => rowKey(view[viewIndex]!),
      }}
      focus={focus}
      onFocusChange={setFocus}
      onOpenRow={openRow}
      emptyState={emptyState}
      resetToken={resetToken}
    />
  );
}
