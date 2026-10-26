import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { GridColumn, SortState } from './types';
import { MIN_COLUMN_WIDTH, useColumnResize } from './useColumnResize';
import { useVirtualWindow } from './useVirtualWindow';
import './grid.css';

export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 32;
export const SELECT_COL_WIDTH = 36;
/** A pinned column wider than this would cover most of a 13-inch screen, so it is not kept in place. */
export const MAX_PINNED_WIDTH = 360;

export interface FocusCell {
  viewRow: number;
  /** 0 = selection column, 1+ = position among the columns as displayed (the pinned column is first). */
  col: number;
}

export interface GridSelectionProps {
  selected: ReadonlySet<number>;
  allVisible: boolean;
  someVisible: boolean;
  /** `anchorFallback` is where a Shift range starts when no anchor is set yet (Shift+Arrow from the focused row). */
  onSelectViewRow: (viewIndex: number, mode: 'replace' | 'toggle' | 'range', anchorFallback?: number) => void;
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
  onClearSort: () => void;
  widths: Readonly<Record<string, number>>;
  onWidthChange: (columnId: string, width: number) => void;
  pinnedColumnId?: string | null;
  onTogglePin?: (columnId: string) => void;
  selection?: GridSelectionProps;
  focus: FocusCell | null;
  onFocusChange: (cell: FocusCell | null) => void;
  onOpenRow?: (viewIndex: number) => void;
  /** Shown over the empty body when `view` has no rows. The grid itself stays mounted, so selection survives. */
  emptyState?: ReactNode;
  /** Changes when the owner resets the view: the grid scrolls back to the top-left. */
  resetToken?: number;
}

export function DataGrid<T>({
  columns,
  data,
  view,
  getRowId,
  label,
  sort,
  onSort,
  onClearSort,
  widths,
  onWidthChange,
  pinnedColumnId = null,
  onTogglePin,
  selection,
  focus,
  onFocusChange,
  onOpenRow,
  emptyState,
  resetToken = 0,
}: DataGridProps<T>) {
  const count = view.length;
  const didAutoFocus = useRef(false);
  const { scrollerRef, start, end, onScroll, totalHeight } = useVirtualWindow({
    count,
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
  });

  useEffect(() => {
    if (didAutoFocus.current || count === 0) return;
    didAutoFocus.current = true;
    if (document.activeElement === document.body) scrollerRef.current?.focus();
  }, [count, scrollerRef]);

  const sortColumn = sort?.columnId;
  const sortDir = sort?.dir;
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [scrollerRef, sortColumn, sortDir]);
  // Reset also returns to the left edge.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0, top: 0 });
  }, [scrollerRef, resetToken]);

  // The shadow next to the pinned column only shows once content is sliding underneath it.
  const [scrolledX, setScrolledX] = useState(false);

  const resize = useColumnResize(onWidthChange);
  const widthOf = (c: GridColumn<T>) => (resize.draft?.id === c.id ? resize.draft.width : (widths[c.id] ?? c.width));

  // A pinned column moves to the front (right after the checkbox) and sticks to the left edge,
  // like frozen panes in a spreadsheet. If it is too wide to be useful it is left where it is.
  const pinnedColumn = pinnedColumnId ? columns.find((c) => c.id === pinnedColumnId) : undefined;
  const stuckId = pinnedColumn && widthOf(pinnedColumn) <= MAX_PINNED_WIDTH ? pinnedColumn.id : null;
  const ordered = useMemo(() => {
    const stuck = stuckId ? columns.find((c) => c.id === stuckId) : undefined;
    return stuck ? [stuck, ...columns.filter((c) => c !== stuck)] : columns;
  }, [columns, stuckId]);

  const dataTemplate = ordered.map((c) => `${widthOf(c)}px`).join(' ');
  const dataWidth = ordered.reduce((sum, c) => sum + widthOf(c), 0);
  const gridWidth = SELECT_COL_WIDTH + dataWidth;
  const template = `${SELECT_COL_WIDTH}px ${dataTemplate}`;
  const style = { '--cols': template, '--grid-width': `${gridWidth}px` } as CSSProperties;

  const colCount = ordered.length + 1;

  const moveFocus = (cell: FocusCell) => {
    const row = Math.max(-1, Math.min(count - 1, cell.viewRow));
    const col = Math.max(0, Math.min(colCount - 1, cell.col));
    onFocusChange({ viewRow: row, col });
    if (row >= 0) scrollRowIntoView(scrollerRef.current, row);
    scrollerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement) || !e.currentTarget.contains(e.target)) return;
    if (e.target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const headerCell = e.target.closest<HTMLElement>('[data-grid-column-index]');
    const activeFocus = headerCell
      ? { viewRow: -1, col: Number(headerCell.dataset.gridColumnIndex) }
      : focus;
    const cmd = e.ctrlKey || e.metaKey;
    const columnShortcut =
      !cmd && !e.altKey && !e.shiftKey && ['p', 's', 'u'].includes(e.key.toLowerCase());
    if (e.target !== e.currentTarget) {
      const navigationKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key);
      if (!columnShortcut && !(headerCell && navigationKey)) return;
      if (navigationKey && headerCell && activeFocus) {
        e.preventDefault();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          moveFocus({ ...activeFocus, viewRow: e.key === 'ArrowDown' && count > 0 ? 0 : -1 });
        } else if (e.key === 'ArrowLeft') {
          moveFocus({ ...activeFocus, col: activeFocus.col - 1 });
        } else if (e.key === 'ArrowRight') {
          moveFocus({ ...activeFocus, col: activeFocus.col + 1 });
        } else {
          moveFocus({ ...activeFocus, col: e.key === 'Home' ? 0 : colCount - 1 });
        }
        return;
      }
      const targetColumnId = e.target.closest<HTMLElement>('[data-grid-column-id]')?.dataset.gridColumnId;
      const columnId = targetColumnId ?? (activeFocus && activeFocus.col > 0 ? ordered[activeFocus.col - 1]?.id : undefined);
      if (!columnId) return;
      e.preventDefault();
      if (e.key.toLowerCase() === 'p') onTogglePin?.(columnId);
      else if (e.key.toLowerCase() === 's' && ordered.find((column) => column.id === columnId)?.sortable) {
        onSort(columnId);
      } else if (e.key.toLowerCase() === 'u' && sort?.columnId === columnId) {
        onClearSort();
      }
      return;
    }
    if (!activeFocus) return;
    const inHeader = activeFocus.viewRow < 0;
    if (count === 0 && !inHeader) return;
    const page = Math.max(1, Math.floor(((scrollerRef.current?.clientHeight ?? 400) - HEADER_HEIGHT) / ROW_HEIGHT));

    if (!inHeader && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.shiftKey && selection) {
      // Shift+Arrow extends the selection from where it started, like a spreadsheet.
      e.preventDefault();
      const row = Math.max(0, Math.min(count - 1, activeFocus.viewRow + (e.key === 'ArrowDown' ? 1 : -1)));
      moveFocus({ ...activeFocus, viewRow: row });
      selection.onSelectViewRow(row, 'range', activeFocus.viewRow);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus({ ...activeFocus, viewRow: inHeader ? (count > 0 ? 0 : -1) : activeFocus.viewRow + 1 });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus({ ...activeFocus, viewRow: inHeader ? -1 : Math.max(-1, activeFocus.viewRow - 1) });
    } else if (cmd && e.key.toLowerCase() === 'a' && selection) {
      e.preventDefault();
      selection.onSelectAllVisible(true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveFocus({ ...activeFocus, col: activeFocus.col + 1 });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus({ ...activeFocus, col: activeFocus.col - 1 });
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus({ ...activeFocus, col: 0 });
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus({ ...activeFocus, col: colCount - 1 });
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      moveFocus({ ...activeFocus, viewRow: inHeader ? (count > 0 ? 0 : -1) : activeFocus.viewRow + page });
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      moveFocus({ ...activeFocus, viewRow: inHeader ? -1 : activeFocus.viewRow - page });
    } else if (columnShortcut && e.key.toLowerCase() === 'p' && activeFocus.col > 0 && onTogglePin) {
      e.preventDefault();
      onTogglePin(ordered[activeFocus.col - 1]!.id);
    } else if (columnShortcut && e.key.toLowerCase() === 's' && activeFocus.col > 0) {
      const column = ordered[activeFocus.col - 1]!;
      if (column.sortable) {
        e.preventDefault();
        onSort(column.id);
      }
    } else if (columnShortcut && e.key.toLowerCase() === 'u' && activeFocus.col > 0) {
      const column = ordered[activeFocus.col - 1]!;
      if (sort?.columnId === column.id) {
        e.preventDefault();
        onClearSort();
      }
    } else if (e.key === ' ' && selection) {
      e.preventDefault();
      if (!inHeader) selection.onSelectViewRow(activeFocus.viewRow, 'toggle');
    } else if (e.key === 'Enter' && onOpenRow && !inHeader) {
      e.preventDefault();
      onOpenRow(activeFocus.viewRow);
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
        columns={ordered}
        selected={selected}
        stuckColumnId={stuckId}
        focus={focus}
        onRowClick={
          selection
            ? (ev) => {
                handleRowClick(ev, i, selection);
                onFocusChange({ viewRow: i, col: focus?.col && focus.col > 0 ? focus.col : 1 });
                scrollerRef.current?.focus();
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
    <div className="grid-wrap">
      <div
        ref={scrollerRef}
        className="grid"
        role="grid"
        aria-label={label}
        aria-rowcount={count + 1}
        aria-colcount={colCount}
        tabIndex={0}
        data-scrolled-x={scrolledX ? '' : undefined}
        onScroll={(e) => {
          onScroll();
          const moved = e.currentTarget.scrollLeft > 0;
          setScrolledX((prev) => (prev === moved ? prev : moved));
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (!focus && count > 0) onFocusChange({ viewRow: 0, col: 1 });
        }}
        style={style}
      >
        <div className="grid__header" role="row" aria-rowindex={1}>
          <SelectHeaderCell selection={selection} focused={focus?.viewRow === -1 && focus.col === 0} />
          {ordered.map((col, idx) => (
            <HeaderCell
              key={col.id}
              column={col}
              colIndex={idx + 1}
              focused={focus?.viewRow === -1 && focus.col === idx + 1}
              width={widthOf(col)}
              sort={sort?.columnId === col.id ? sort.dir : null}
              onSort={onSort}
              resize={resize}
              onReset={() => onWidthChange(col.id, col.width)}
              pinned={pinnedColumnId === col.id}
              stuck={stuckId === col.id}
              onTogglePin={onTogglePin ? () => onTogglePin(col.id) : undefined}
            />
          ))}
        </div>
        <div className="grid__body" role="rowgroup" style={{ height: totalHeight }}>
          {rows}
        </div>
      </div>
      {count === 0 && emptyState && <div className="grid__empty">{emptyState}</div>}
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

function SelectHeaderCell({ selection, focused }: { selection?: GridSelectionProps; focused: boolean }) {
  return (
    <div
      role="columnheader"
      data-grid-column-index={0}
      className={`grid__hcell grid__hcell--select${focused ? ' is-focused' : ''}`}
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
  focused: boolean;
  width: number;
  sort: SortState['dir'] | null;
  onSort: (columnId: string) => void;
  resize: ReturnType<typeof useColumnResize>;
  onReset: () => void;
  /** The user pinned this column. */
  pinned: boolean;
  /** It is also actually held in place (not too wide). */
  stuck: boolean;
  onTogglePin?: () => void;
}

function HeaderCell<T>({
  column,
  colIndex,
  focused,
  width,
  sort,
  onSort,
  resize,
  onReset,
  pinned,
  stuck,
  onTogglePin,
}: HeaderCellProps<T>) {
  const minWidth = column.minWidth ?? MIN_COLUMN_WIDTH;
  const right = column.align === 'right';
  const ariaSort = sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : column.sortable ? 'none' : undefined;
  return (
    <div
      role="columnheader"
      data-grid-column-index={colIndex}
      data-grid-column-id={column.id}
      className={`grid__hcell${right ? ' is-right' : ''}${stuck ? ' is-pinned' : ''}${focused ? ' is-focused' : ''}`}
      aria-sort={ariaSort}
      title={column.header}
    >
      {onTogglePin && (
        <button
          type="button"
          className={`grid__pin${pinned ? ' is-on' : ''}`}
          aria-label={pinned ? `Unpin ${column.header}` : `Pin ${column.header}`}
          title={
            pinned && !stuck
              ? `Pinned, but wider than ${MAX_PINNED_WIDTH}px so it scrolls with the others. Make it narrower to keep it in view.`
              : pinned
                ? 'Unpin column'
                : 'Pin column to the left'
          }
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
  /** The column held in place at the left edge, if any. */
  stuckColumnId: string | null;
  focus: FocusCell | null;
  onRowClick?: (e: MouseEvent) => void;
  onToggleSelect?: () => void;
}

function GridRowInner<T>({
  row,
  viewIndex,
  columns,
  selected,
  stuckColumnId,
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
        className={`grid__cell grid__cell--select${focus?.viewRow === viewIndex && focus.col === 0 ? ' is-focused' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.();
        }}
      >
        <input type="checkbox" className="grid__checkbox" checked={selected} readOnly tabIndex={-1} aria-hidden />
      </div>
      {columns.map((col, idx) => {
        const colIndex = idx + 1;
        const pinned = stuckColumnId === col.id;
        return (
          <div
            key={col.id}
            role="gridcell"
            className={`grid__cell${col.align === 'right' ? ' is-right' : ''}${col.mono ? ' is-mono' : ''}${pinned ? ' is-pinned' : ''}${focus?.viewRow === viewIndex && focus.col === colIndex ? ' is-focused' : ''}`}
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
