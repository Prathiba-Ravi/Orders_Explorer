import { memo, useEffect, type CSSProperties, type ReactNode } from 'react';
import type { GridColumn, SortState } from './types';
import { MIN_COLUMN_WIDTH, useColumnResize } from './useColumnResize';
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
  sort: SortState | null;
  /** Called with the id of the clicked (or Enter/Space-activated) sortable header. */
  onSort: (columnId: string) => void;
  /** Widths the user has set, by column id. Missing ids use the column's default width. */
  widths: Readonly<Record<string, number>>;
  onWidthChange: (columnId: string, width: number) => void;
}

/**
 * A hand-written virtualized grid. Only the rows near the viewport exist in the DOM;
 * column widths live in one CSS variable so rows never re-render for layout.
 */
export function DataGrid<T>({
  columns,
  data,
  view,
  getRowId,
  label,
  sort,
  onSort,
  widths,
  onWidthChange,
}: DataGridProps<T>) {
  const count = view.length;
  const { scrollerRef, start, end, onScroll, totalHeight } = useVirtualWindow({
    count,
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
  });

  // A new sort order starts from the top, like every spreadsheet does.
  const sortColumn = sort?.columnId;
  const sortDir = sort?.dir;
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [scrollerRef, sortColumn, sortDir]);

  const resize = useColumnResize(onWidthChange);
  const widthOf = (c: GridColumn<T>) => (resize.draft?.id === c.id ? resize.draft.width : (widths[c.id] ?? c.width));
  const template = columns.map((c) => `${widthOf(c)}px`).join(' ');
  const totalWidth = columns.reduce((sum, c) => sum + widthOf(c), 0);
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
          <HeaderCell
            key={col.id}
            column={col}
            width={widthOf(col)}
            sort={sort?.columnId === col.id ? sort.dir : null}
            onSort={onSort}
            resize={resize}
            onReset={() => onWidthChange(col.id, col.width)}
          />
        ))}
      </div>
      <div className="grid__body" role="rowgroup" style={{ height: totalHeight }}>
        {rows}
      </div>
    </div>
  );
}

interface HeaderCellProps<T> {
  column: GridColumn<T>;
  width: number;
  sort: SortState['dir'] | null;
  onSort: (columnId: string) => void;
  resize: ReturnType<typeof useColumnResize>;
  onReset: () => void;
}

function HeaderCell<T>({ column, width, sort, onSort, resize, onReset }: HeaderCellProps<T>) {
  const minWidth = column.minWidth ?? MIN_COLUMN_WIDTH;
  const right = column.align === 'right';
  const ariaSort = sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : column.sortable ? 'none' : undefined;
  return (
    <div role="columnheader" className={`grid__hcell${right ? ' is-right' : ''}`} aria-sort={ariaSort} title={column.header}>
      {column.sortable ? (
        <button type="button" className="grid__hbtn" onClick={() => onSort(column.id)}>
          <span className="grid__hlabel">{column.header}</span>
          {sort && <SortArrow dir={sort} />}
        </button>
      ) : (
        <span className="grid__hlabel">{column.header}</span>
      )}
      <div
        className={`grid__resizer${resize.draft?.id === column.id ? ' is-active' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${column.header} column. Double-click to reset.`}
        onPointerDown={(e) => resize.onPointerDown(e, column.id, width, minWidth)}
        onPointerMove={resize.onPointerMove}
        onPointerUp={resize.onPointerUp}
        onPointerCancel={resize.onPointerCancel}
        onDoubleClick={onReset}
      />
    </div>
  );
}

function SortArrow({ dir }: { dir: SortState['dir'] }) {
  return (
    <svg className="grid__arrow" width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
      <path d={dir === 'asc' ? 'M4.5 1 8 7H1z' : 'M4.5 8 1 2h7z'} fill="currentColor" />
    </svg>
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
