import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export const MIN_COLUMN_WIDTH = 56;
export const MAX_COLUMN_WIDTH = 720;

interface Drag {
  id: string;
  startX: number;
  startWidth: number;
  min: number;
}

const clamp = (value: number, min: number) => Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(min, value)));

/**
 * Drag-to-resize for column headers. While dragging, the new width lives in `draft`
 * (so the header and rows follow the pointer); it is committed once on release.
 */
export function useColumnResize(onCommit: (columnId: string, width: number) => void) {
  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<{ id: string; width: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, id: string, startWidth: number, minWidth = MIN_COLUMN_WIDTH) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id, startX: e.clientX, startWidth, min: minWidth };
      setDraft({ id, width: startWidth });
    },
    [],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    setDraft({ id: d.id, width: clamp(d.startWidth + e.clientX - d.startX, d.min) });
  }, []);

  const finish = useCallback(
    (e: ReactPointerEvent<HTMLElement>, commit: boolean) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      setDraft(null);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (commit) onCommit(d.id, clamp(d.startWidth + e.clientX - d.startX, d.min));
    },
    [onCommit],
  );

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => finish(e, true), [finish]);
  const onPointerCancel = useCallback((e: ReactPointerEvent<HTMLElement>) => finish(e, false), [finish]);

  return { draft, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
