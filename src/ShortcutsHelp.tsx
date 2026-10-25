import { useEffect, useRef } from 'react';

const SHORTCUTS: [string, string][] = [
  ['↑ ↓ ← →', 'Move the focused cell'],
  ['Home / End', 'First / last column'],
  ['PageUp / PageDown', 'Move a page up / down'],
  ['Space', 'Select or unselect the focused row'],
  ['Shift + ↑ ↓', 'Extend the selection'],
  ['Ctrl/Cmd + A', 'Select every row shown'],
  ['Enter', 'Open the row details'],
  ['Esc', 'Close details, filters or this list'],
  ['/', 'Open the filters'],
  ['?', 'Show or hide this list'],
  ['Click · Shift+click · Ctrl/Cmd+click', 'Select · select a range · add or remove a row'],
  ['Click a header', 'Sort; click again to reverse'],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<Element | null>(null);

  useEffect(() => {
    previous.current = document.activeElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous.current instanceof HTMLElement) previous.current.focus();
    };
  }, [onClose]);

  return (
    <div className="help" role="dialog" aria-label="Keyboard shortcuts" tabIndex={-1} ref={ref}>
      <div className="help__head">
        <strong>Keyboard shortcuts</strong>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="help__list">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys} className="help__row">
            <dt>{keys}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
