import type { ReactNode } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  columnId: string;
  dir: SortDir;
}

export interface GridColumn<T> {
  id: string;
  header: string;
  /** Default width in px. */
  width: number;
  minWidth?: number;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Monospace text (ids). */
  mono?: boolean;
  render: (row: T) => ReactNode;
  /** Plain-text tooltip, used to reveal the full value of truncated cells. */
  title?: (row: T) => string | undefined;
}
