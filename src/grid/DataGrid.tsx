import { memo, useEffect, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { GridColumn, SortState } from './types';
import { MIN_COLUMN_WIDTH, useColumnResize } from './useColumnResize';
import { useVirtualWindow } from './useVirtualWindow';
import './grid.css';

export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 32;
export const SELECT_COL_WIDTH = 36;

export interface FocusCell {
  viewRow: number;
  /** 0 = selection column, 1+ = index in `columns` + 1 */
  col: number;
}

export interface GridSelectionProps {
  selected: ReadonlySet<number>;
  allVisible: boolean;
  someVisible: boolean;
  onSelectViewRow: (viewIndex: number, mode: 'replace' | 'toggle' | 'range') => void;
  onSelectAllVisible: (on: boolean) => void;
  rowKeyAtViewIndex: (viewIndex: number) => number;
}

interface DataGridProps<T> {
  columns: readonly GridColumn<T>[];
  data: readonly T[];
  view: ArrayLike<number>;
  getRowId: (row: T) => string | number;
  label: string;
  sort: SortState | null;
  onSort: (columnId: string) => void;
  widths: Readonly<Record<string, number>>;
  onWidthChange: (columnId: string, width: number) => void;
  pinnedColumnId?: string | null;
  onTogglePin?: (columnId: string) => void;
  selection?: GridSelectionProps;
  focus: FocusCell | null;
  onFocusChange: (cell: FocusCell | null) => void;
  onOpenRow?: (viewIndex: number) => void;
}

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
  pinnedColumnId = null,
  onTogglePin,
  selection,
  focus,
  onFocusChange,
  onOpenRow,
}: DataGridProps<T>) {
  const count = view.length;
  const { scrollerRef, start, end, onScroll, totalHeight } = useVirtualWindow({
    count,
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
  });

  const sortColumn = sort?.columnId;
  const sortDir = sort?.dir;
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [scrollerRef, sortColumn, sortDir]);

  const resize = useColumnResize(onWidthChange);
  const widthOf = (c: GridColumn<T>) => (resize.draft?.id === c.id ? resize.draft.width : (widths[c.id] ?? c.width));
  const dataTemplate = columns.map((c) => `${widthOf(c)}px`).join(' ');
  const dataWidth = columns.reduce((sum, c) => sum + widthOf(c), 0);
  const gridWidth = SELECT_COL_WIDTH + dataWidth;
  const template = `${SELECT_COL_WIDTH}px ${dataTemplate}`;
  const style = { '--cols': template, '--grid-width': `${gridWidth}px` } as CSSProperties;

  const stickyLeft = (colId: string | 'select'): number | undefined => {
    if (colId === 'select') return 0;
    if (pinnedColumnId !== colId) return undefined;
    let left = SELECT_COL_WIDTH;
    for (const c of columns) {
      if (c.id === colId) return left;
      left += widthOf(c);
    }
    return undefined;
  };

  const colCount = columns.length + 1;

  const moveFocus = (cell: FocusCell) => {
    const row = Math.max(0, Math.min(count - 1, cell.viewRow));
    const col = Math.max(0, Math.min(colCount - 1, cell.col));
    onFocusChange({ viewRow: row, col });
    scrollRowIntoView(scrollerRef.current, row);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!focus || count === 0) return;
    const page = Math.max(1, Math.floor(((scrollerRef.current?.clientHeight ?? 400) - HEADER_HEIGHT) / ROW_HEIGHT));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus({ ...focus, viewRow: focus.viewRow + 1 });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus({ ...focus, viewRow: focus.viewRow - 1 });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveFocus({ ...focus, col: focus.col + 1 });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus({ ...focus, col: focus.col - 1 });
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus({ ...focus, col: 0 });
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus({ ...focus, col: colCount - 1 });
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      moveFocus({ ...focus, viewRow: focus.viewRow + page });
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      moveFocus({ ...focus, viewRow: focus.viewRow - page });
    } else if (e.key === ' ' && selection) {
      e.preventDefault();
      selection.onSelectViewRow(focus.viewRow, 'toggle');
    } else if (e.key === 'Enter' && onOpenRow) {
      e.preventDefault();
      onOpenRow(focus.viewRow);
    }
  };

  const rows: ReactNode[] = [];
  for (let i = start; i < end; i++) {
    const dataIndex = view[i]!;
    const row = data[dataIndex];
    if (row === undefined) continue;
    const key = getRowId(row);
    const selected = selection?.selected.has(selection.rowKeyAtViewIndex(i)) ?? false;
    rows.push(
      <GridRow
        key={key}
        row={row}
        viewIndex={i}
        columns={columns}
        selected={selected}
        pinnedColumnId={pinnedColumnId}
        stickyLeft={stickyLeft}
        widthOf={widthOf}
        focus={focus}
        onRowClick={
          selection
            ? (ev) => {
                handleRowClick(ev, i, selection);
                onFocusChange({ viewRow: i, col: focus?.col && focus.col > 0 ? focus.col : 1 });
              }
            : undefined
        }
        onToggleSelect={
          selection
            ? () => selection.onSelectViewRow(i, 'toggle')
            : undefined
        }
      />,
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="grid"
      role="grid"
      aria-label={label}
      aria-rowcount={count + 1}
      aria-colcount={colCount}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (!focus && count > 0) onFocusChange({ viewRow: 0, col: 1 });
      }}
      style={style}
    >
      <div className="grid__header" role="row" aria-rowindex={1}>
        <SelectHeaderCell selection={selection} stickyLeft={0} />
        {columns.map((col, idx) => (
          <HeaderCell
            key={col.id}
            column={col}
            colIndex={idx + 1}
            width={widthOf(col)}
            sort={sort?.columnId === col.id ? sort.dir : null}
            onSort={onSort}
            resize={resize}
            onReset={() => onWidthChange(col.id, col.width)}
            pinned={pinnedColumnId === col.id}
            onTogglePin={onTogglePin ? () => onTogglePin(col.id) : undefined}
            stickyLeft={stickyLeft(col.id)}
          />
        ))}
      </div>
      <div className="grid__body" role="rowgroup" style={{ height: totalHeight }}>
        {rows}
      </div>
    </div>
  );
}

function scrollRowIntoView(scroller: HTMLDivElement | null, viewRow: number) {
  if (!scroller) return;
  const top = viewRow * ROW_HEIGHT;
  const bottom = top + ROW_HEIGHT;
  const viewTop = scroller.scrollTop;
  const viewBottom = viewTop + scroller.clientHeight - HEADER_HEIGHT;
  if (top < viewTop) scroller.scrollTop = top;
  else if (bottom > viewBottom) scroller.scrollTop = bottom - (scroller.clientHeight - HEADER_HEIGHT);
}

function handleRowClick(e: MouseEvent, viewIndex: number, selection: GridSelectionProps) {
  if (e.shiftKey) selection.onSelectViewRow(viewIndex, 'range');
  else if (e.metaKey || e.ctrlKey) selection.onSelectViewRow(viewIndex, 'toggle');
  else selection.onSelectViewRow(viewIndex, 'replace');
}

function SelectHeaderCell({
  selection,
  stickyLeft,
}: {
  selection?: GridSelectionProps;
  stickyLeft: number;
}) {
  return (
    <div
      role="columnheader"
      className="grid__hcell grid__hcell--select is-pinned"
      style={{ left: stickyLeft }}
      aria-label="Select rows"
    >
      {selection && (
        <input
          type="checkbox"
          className="grid__checkbox"
          checked={selection.allVisible}
          ref={(el) => {
            if (el) el.indeterminate = selection.someVisible;
          }}
          onChange={() => selection.onSelectAllVisible(!selection.allVisible)}
          aria-label="Select all visible rows"
        />
      )}
    </div>
  );
}

interface HeaderCellProps<T> {
  column: GridColumn<T>;
  colIndex: number;
  width: number;
  sort: SortState['dir'] | null;
  onSort: (columnId: string) => void;
  resize: ReturnType<typeof useColumnResize>;
  onReset: () => void;
  pinned: boolean;
  onTogglePin?: () => void;
  stickyLeft?: number;
}

function HeaderCell<T>({
  column,
  width,
  sort,
  onSort,
  resize,
  onReset,
  pinned,
  onTogglePin,
  stickyLeft: left,
}: HeaderCellProps<T>) {
  const minWidth = column.minWidth ?? MIN_COLUMN_WIDTH;
  const right = column.align === 'right';
  const ariaSort = sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : column.sortable ? 'none' : undefined;
  return (
    <div
      role="columnheader"
      className={`grid__hcell${right ? ' is-right' : ''}${pinned ? ' is-pinned' : ''}`}
      style={left !== undefined ? { left } : undefined}
      aria-sort={ariaSort}
      title={column.header}
    >
      {onTogglePin && (
        <button
          type="button"
          className={`grid__pin${pinned ? ' is-on' : ''}`}
          aria-label={pinned ? `Unpin ${column.header}` : `Pin ${column.header}`}
          aria-pressed={pinned}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          <span className="grid__pin-icon" aria-hidden="true" />
        </button>
      )}
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
  viewIndex: number;
  columns: readonly GridColumn<T>[];
  selected: boolean;
  pinnedColumnId: string | null;
  stickyLeft: (id: string | 'select') => number | undefined;
  widthOf: (c: GridColumn<T>) => number;
  focus: FocusCell | null;
  onRowClick?: (e: MouseEvent) => void;
  onToggleSelect?: () => void;
}

function GridRowInner<T>({
  row,
  viewIndex,
  columns,
  selected,
  pinnedColumnId,
  stickyLeft,
  focus,
  onRowClick,
  onToggleSelect,
}: RowProps<T>) {
  return (
    <div
      className={`grid__row${selected ? ' is-selected' : ''}`}
      role="row"
      aria-rowindex={viewIndex + 2}
      aria-selected={selected}
      style={{ transform: `translateY(${viewIndex * ROW_HEIGHT}px)` }}
      onClick={onRowClick}
    >
      <div
        role="gridcell"
        className={`grid__cell grid__cell--select is-pinned${focus?.viewRow === viewIndex && focus.col === 0 ? ' is-focused' : ''}`}
        style={{ left: stickyLeft('select') }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.();
        }}
      >
        <input type="checkbox" className="grid__checkbox" checked={selected} readOnly tabIndex={-1} aria-hidden />
      </div>
      {columns.map((col, idx) => {
        const colIndex = idx + 1;
        const pinned = pinnedColumnId === col.id;
        const left = stickyLeft(col.id);
        return (
          <div
            key={col.id}
            role="gridcell"
            className={`grid__cell${col.align === 'right' ? ' is-right' : ''}${col.mono ? ' is-mono' : ''}${pinned ? ' is-pinned' : ''}${focus?.viewRow === viewIndex && focus.col === colIndex ? ' is-focused' : ''}`}
            style={left !== undefined ? { left } : undefined}
            title={col.title?.(row)}
          >
            {col.render(row)}
          </div>
        );
      })}
    </div>
  );
}

const GridRow = memo(GridRowInner) as typeof GridRowInner;
