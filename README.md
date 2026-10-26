# Orders Explorer

A data grid and filter builder for 50,000 orders. React, TypeScript, Vite. The grid, virtualization and filter builder are written from scratch. Keyboard shortcuts are listed at `/#docs`.

## 1. How to run

```
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # type-check + production build
```

Node 24 (also works on Node 22).

## 2. Screenshots

Main screen:

![Main screen](docs/screenshots/main.png)

Empty state:

![Empty state](docs/screenshots/empty.png)

## 3. Dependencies

- `react`, `react-dom`: the UI. No other runtime dependencies.

## 4. Data loading

- `orders.json` stays untouched in `public/` and is fetched at startup. Importing it would add 17 MB to the JS bundle and slow the first load.
- Parsing and cleaning run in a Web Worker, so the page does not freeze.
- All `data-notes.md` fixes are in one place, `src/data/normalize.ts`, before data reaches the grid or filter.

## 5. The 200 rows question

- **Choice: export all 200 selected rows.**
- The user selected them on purpose, and a filter is only a view. Dropping the 180 hidden rows would silently lose their work.
- The toolbar shows `200 selected (180 hidden by filter)`, and the CSV has exactly 200 rows, so the screen and the file match.

## 6. Design changes

- Filter builder is collapsed behind a "Filters" button, because open it takes too much height on a 13-inch screen. Chips stay visible.
- Details open in a side panel instead of a popup, so the list stays visible.
- No Currency column, since it is always INR. It is in the details panel and CSV.
- Added later: Reset view and a keyboard shortcuts page.

## 7. Known issues

- At 1280px wide, the Email and Notes columns are off-screen until you scroll sideways.
- Column resizing is mouse-only.
- Selecting thousands of scattered rows makes a long URL.
- Column widths are not in the URL, and Back does not step through filter changes.
- Dates are shown in UTC only.
- Tested in Chromium only. No automated UI tests.
- One sort column at a time.