import './DocsPage.css';

const SHORTCUT_SECTIONS: [string, [string, string][]][] = [
  [
    'Grid',
    [
      ['↑ ↓ ← →', 'Move the focused cell through rows, columns, and headers.'],
      ['Home / End', 'Move to the first or last column.'],
      ['Page Up / Page Down', 'Move one page up or down.'],
      ['Enter', 'Open the focused order.'],
    ],
  ],
  [
    'Selection',
    [
      ['Space', 'Select or deselect the focused row.'],
      ['Shift + ↑ / ↓', 'Extend the selection.'],
      ['Ctrl / Cmd + A', 'Select all visible rows.'],
      ['Delete', 'Deselect all rows. Orders are not deleted.'],
    ],
  ],
  [
    'Columns',
    [
      ['S', 'Sort the focused column; press again to reverse.'],
      ['U', 'Clear the focused column’s sort.'],
      ['P', 'Pin or unpin the focused column.'],
    ],
  ],
  [
    'Filters',
    [
      ['/', 'Open Filters.'],
      ['↑ ↓ ← →', 'Move between controls and checkboxes. Select menus and text fields keep their normal arrow-key behavior.'],
      ['Space', 'Toggle a focused option.'],
      ['Ctrl / Cmd + Enter', 'Add a condition to the current group.'],
      ['Ctrl / Cmd + Shift + Enter', 'Add a group.'],
      ['Ctrl / Cmd + Backspace', 'Clear all filters.'],
    ],
  ],
  [
    'Other',
    [
      ['Ctrl + Z / Cmd + Z', 'Undo the last filter, sort, pin, selection, or column-width change (outside text fields).'],
      ['Alt + R', 'Reset the view. Filters and selection are kept.'],
      ['Alt + E', 'Export selected rows.'],
      ['Escape', 'Close order details or Filters.'],
      ['Tab / Shift + Tab', 'Move between controls.'],
    ],
  ],
];

export function DocsPage() {
  return (
    <main className="docs">
      <a href="/">← Orders</a>
      <h1>Keyboard shortcuts</h1>
      {SHORTCUT_SECTIONS.map(([title, shortcuts]) => (
        <section className="docs__section" key={title}>
          <h2>{title}</h2>
          <ul>
            {shortcuts.map(([keys, description]) => (
              <li key={keys}>
                <kbd>{keys}</kbd> — {description}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
