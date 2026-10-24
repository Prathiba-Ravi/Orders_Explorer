import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { GridColumn } from './types';
import { useVirtualWindow } from './useVirtualWindow';
import './grid.css';

export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 32;

interface DataGridProps<T> {
  columns: readonly GridColumn<T>[];
  data: readonly T[];
  /** Which rows to show, in order: indices into `data`. Sorting and filtering produce this. */
  view: ArrayLike<number>;
  getRowId: (row: T) => string | number;
  label: string;
}

/**
 * A hand-written virtualized grid. Only the rows near the viewport exist in the DOM;
 * column widths live in one CSS variable so rows never re-render for layout.
 */
export function DataGrid<T>({ columns, data, view, getRowId, label }: DataGridProps<T>) {
  const count = view.length;
  const { scrollerRef, start, end, onScroll, totalHeight } = useVirtualWindow({
    count,
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
  });

  const template = useMemo(() => columns.map((c) => `${c.width}px`).join(' '), [columns]);
  const totalWidth = useMemo(() => columns.reduce((sum, c) => sum + c.width, 0), [columns]);
  const style = { '--cols': template, '--grid-width': `${totalWidth}px` } as CSSProperties;

  const rows: ReactNode[] = [];
  for (let i = start; i < end; i++) {
    const row = data[view[i]!];
    if (row === undefined) continue;
    rows.push(<GridRow key={getRowId(row)} row={row} index={i} columns={columns} />);
  }

  return (
    <div
      ref={scrollerRef}
      className="grid"
      role="grid"
      aria-label={label}
      aria-rowcount={count + 1}
      aria-colcount={columns.length}
      onScroll={onScroll}
      style={style}
    >
      <div className="grid__header" role="row" aria-rowindex={1}>
        {columns.map((col) => (
          <HeaderCell key={col.id} column={col} />
        ))}
      </div>
      <div className="grid__body" role="rowgroup" style={{ height: totalHeight }}>
        {rows}
      </div>
    </div>
  );
}

function HeaderCell<T>({ column }: { column: GridColumn<T> }) {
  return (
    <div
      role="columnheader"
      className={`grid__hcell${column.align === 'right' ? ' is-right' : ''}`}
      title={column.header}
    >
      <span className="grid__hlabel">{column.header}</span>
    </div>
  );
}

interface RowProps<T> {
  row: T;
  index: number;
  columns: readonly GridColumn<T>[];
}

function GridRowInner<T>({ row, index, columns }: RowProps<T>) {
  return (
    <div
      className="grid__row"
      role="row"
      aria-rowindex={index + 2}
      style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
    >
      {columns.map((col) => (
        <div
          key={col.id}
          role="gridcell"
          className={`grid__cell${col.align === 'right' ? ' is-right' : ''}${col.mono ? ' is-mono' : ''}`}
          title={col.title?.(row)}
        >
          {col.render(row)}
        </div>
      ))}
    </div>
  );
}

// Memoised so that scrolling by a pixel, or resizing a column, does not re-render rows that did not change.
const GridRow = memo(GridRowInner) as typeof GridRowInner;
