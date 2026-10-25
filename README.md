# Orders Explorer

A data grid of 50,000 orders with a filter builder, built for an operations team on 13-inch laptops:
dense rows (28px, 13px type), keyboard-first, state kept in the URL. React, TypeScript, Vite. The grid
and the filter builder are written from scratch (no table, virtualization or query-builder library).

![Main screen](docs/screenshots/main.png)
![No matches](docs/screenshots/empty.png)

## How to run

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 119 unit tests (data cleaning, sort, filter, URL, CSV)
npm run build     # type-check + production build
npm run preview   # serve the build
```

Node 24 (also works on 22).

## Dependencies

Runtime: only `react` and `react-dom` (UI). Dev only: `vite`, `@vitejs/plugin-react`, `typescript`,
`vitest` (tests), and type packages.

## Data loading

- `orders.json` stays untouched in `public/` and is **fetched at runtime**, not bundled, so the 17 MB file
  does not bloat or block the app's JavaScript.
- Parsing and cleaning happen in a **Web Worker**, so the page never freezes (about 1 s for 50,000 rows).
- All ten rules from `data-notes.md` are handled in one function, `src/data/normalize.ts`, before data
  reaches the grid or the filter. Also handled: v1 *string* amounts are paise too, and date-only values
  (DD/MM/YYYY) are flagged so the UI can say "time not recorded".

## The 200 rows question

**Export everything that is selected: 200.** Selection is something the user chose on purpose; a filter
is only a view. Silently dropping 180 selected rows on export would lose their work. To stay honest, the
toolbar always says `200 selected (180 hidden by filter)`, the button says `Export 200 rows`, and the file
has exactly 200 rows. "Deselect hidden" removes just the hidden ones. Rows are exported in the current
sort order.

## What is in the URL

Filter, sort, pinned column and selected rows (`?f=…&s=…&p=…&sel=…`). Refresh keeps everything, a copied
link opens the same screen. Selection is stored as compact ranges (all 50,000 rows = `sel=1-xtd`). A broken
or hand-edited link never crashes the app: each bad part falls back to its default and a notice explains it.

## Design changes

Sketches are in `design/`. Changes made while building:

- The filter builder is **collapsed behind a "Filters" button** (shortcut `/`) so the grid gets the full
  height on a 13-inch screen; active filters stay visible as chips (with and/or joiners).
- Details open in a **side panel** that shares the width, instead of an overlay drawer.
- No Currency column (it is always INR; amounts show ₹), still in details and the CSV.
- Added a keyboard shortcut list (`?`) and Shift+Arrow / Ctrl+A selection.

## Known issues

- Column resize is mouse-only (double-click an edge to reset); there is no keyboard way to resize.
- Selecting thousands of *scattered* rows makes a long URL (about 3 characters per row). Contiguous
  selections stay tiny.
- Column widths and open panels are not kept in the URL. The URL is updated without adding browser
  history entries, so Back/Forward do not step through filter changes.
- Dates are shown in UTC only.
- With the details panel open on a narrow window the grid gets narrow.
- Only tested in Chromium.
