<div align="center">

# 🪟 Windows 12 Concept — Web Desktop Simulator

**A full interactive desktop operating-system concept that runs entirely in your browser.**
Boot it, sign in, drag windows, write documents, build spreadsheets, play games — everything
below is real, working code, not a video or a mock-up.

[![CI](https://github.com/hoseinsedaqat/Windows-12/actions/workflows/ci.yml/badge.svg)](https://github.com/hoseinsedaqat/Windows-12/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/live%20demo-GitHub%20Pages-0a7cff?logo=githubpages&logoColor=white)](https://hoseinsedaqat.github.io/Windows-12/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6%20strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Zustand](https://img.shields.io/badge/Zustand-5-7c3aed)](https://zustand-demo.pmnd.rs)
[![Tests](https://img.shields.io/badge/tests-168%20passing-brightgreen?logo=vitest&logoColor=white)](#tests)

[Live demo](https://hoseinsedaqat.github.io/Windows-12/) · [Features](#what-actually-works) · [Apps](#applications-23) · [Architecture](#architecture) · [Tests](#tests)

![Windows 12 Concept — desktop with live app windows](docs/screenshots/desktop-windows.png)
*The simulator running in a real browser: desktop, taskbar and two live app windows
(Excel workbook in front, Accounting behind), each with its own frame, snap and focus.*

</div>

> **An unofficial, fan-made concept.** This project is **not** Windows, **not** a Microsoft
> product, and it is not affiliated with or endorsed by Microsoft. It is a virtual desktop
> that runs entirely inside your browser: every "system" feature (boot, lock screen,
> battery, Wi‑Fi, Bluetooth, Windows Update, security status, Task Manager numbers) is
> **simulated** and clearly labelled as such in the UI. It never claims to control your
> real device.

---

## ⚡ Try it in 30 seconds

```bash
npm install
npm run dev        # → http://localhost:5173
```

Or skip the install: the **[live demo](https://hoseinsedaqat.github.io/Windows-12/)** deploys
from the `test` branch on every merge. First boot shows logo → loading → welcome → lock
screen; the demo password is **`1234`** (change it in *Settings → Accounts → Sign-in
options*, or enable auto sign-in).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `0.0.0.0:5173` |
| `npm run build` | `tsc -b` type-check + production bundle in `dist/` |
| `npm run typecheck` | Type-check only (strict mode) |
| `npm test` | 168 unit + integration tests (Vitest, jsdom, fake-indexeddb) |
| `npm run preview` | Serve the production bundle on `0.0.0.0:4173` |

---

## 🧭 What actually works

### System
- **Boot / lock / sign-in** — animated boot (skippable), lock screen with live clock and
  full date, password show/hide, wrong-password error, power + accessibility buttons.
  Restart / Shut down / Lock / Sign out all run the real state machine.
- **Desktop** — wallpaper switching (8 generated wallpapers + your own uploads), icon
  drag, marquee multi-select, click-to-select / click-again-to-open, custom context
  menus, icon sizes, sort, auto-arrange, new folder / shortcut, inline rename (F2).
- **Taskbar (Windows 11 style)** — centred Start + inline search box + Task View + pins
  with running indicators and jump lists, weather chip with a 5-day flyout (simulated and
  labelled), tray with hidden-icons flyout (Bluetooth / night light / OneDrive /
  security), network-volume-battery cluster, clock, bell, show-desktop sliver, auto-hide,
  position, alignment and icon-size options.
- **Inline search** — the taskbar search box *is* the input: type and a compact flyout
  lists matching apps, files and Settings pages (arrow keys + Enter, Esc or click-away to
  dismiss), plus a "search the web" fallback. On small screens the same experience opens
  from the search button with its own input and recent files.
- **Window manager** — move, edge-resize (8 handles), minimize, maximize/restore, snap
  left/right/corners with snap-assist preview, z-order focus, Alt+Tab cycling, per-app
  multi-window or singleton behaviour, window state preserved across reloads, title-bar
  context menu, double-click title to maximize, always clamped so a window can't be lost.
- **Responsive shell** — windows re-clamp on resize/orientation change, panels and
  flyouts size themselves with `min(…)` against the viewport, the taskbar cluster scrolls
  instead of overflowing on narrow screens, and the whole UI mirrors correctly in RTL.
- **Settings (38 pages)** — System (display, sound, notifications, focus, power, storage,
  multitasking, about), Bluetooth & devices, Network & internet, Personalization
  (background, colors, themes, lock screen, Start, taskbar, fonts), Apps, Accounts,
  Time & language, Privacy & security, Windows Update. Every control is wired to real
  state; simulated ones say so.
- **Quick settings / overlays** — brightness (0–100 live overlay), night light, volume +
  mute, Wi‑Fi / Bluetooth / airplane, focus, battery saver, cast & project (demo),
  accessibility (text size, high contrast, animations, pointer ring).
- **Notifications** — generated by real events, with history, per-item dismiss and clear
  all; suppressed by focus assist; can be turned off in Settings.
- **i18n** — English and Persian with full RTL, Persian calendar, Persian digits,
  locale-aware numbers/currency/dates, switchable live with no reload.
- **Real in-simulator web search** — the Concept Browser renders genuine results fetched
  live from the Wikipedia APIs (CORS), with type-ahead suggestions, a summary card and
  honest one-click buttons that run the same query on Google/Bing/DuckDuckGo/YouTube in a
  real browser tab.

### Applications (23)
| App | Highlights |
| --- | --- |
| **File Explorer / This PC** | Home, Desktop, Documents, Downloads, Pictures, Music, Videos, OneDrive (demo), This PC, Recycle Bin. Grid/list/details, sortable columns, breadcrumbs, search, type filter, back/forward history, multi-select, copy/cut/paste, rename, delete/restore, new folder, drag & drop, properties, folder sizes, storage usage, **real uploads** through the file picker, downloads of virtual files. "New" creates Folder / Word / Excel / PowerPoint / Text / Note / Shortcut and opens it in the matching app. |
| **Word** | Rich-text editor with autosave, Save / Save As, rename, undo/redo, bold/italic/underline/strike, font family + size, colour + highlight, headings, lists, alignment, line spacing, tables, links, images, page setup (A4/Letter + margins), find, word count, page view + print preview, TXT/HTML export, **real `.docx` export**, PDF through the browser print dialog, full RTL/Persian. |
| **Excel** | Grid with row numbers and column letters, formula bar, name box, sheet tabs, status bar. Arrow/Tab navigation, ranges, copy/paste, column width & row height, insert/delete rows & columns, freeze panes, sort, filter, cell formats (number/text/percent/date/currency), bold, fill, alignment, borders, charts. **Formula engine is a real tokenizer + AST evaluator — no `eval`, no string substitution** — supporting `SUM, AVERAGE, MEDIAN, MIN, MAX, PRODUCT, COUNT, COUNTA, IF, IFERROR, AND, OR, NOT, ABS, ROUND, INT, MOD, POWER, SQRT, LEN, UPPER, LOWER, TRIM, CONCAT(ENATE), TEXTJOIN, TODAY, NOW, VLOOKUP, SUMIF, COUNTIF` with `#REF! #DIV/0! #VALUE! #NAME? #NUM? #CYCLE!` errors. CSV import/export and **real `.xlsx` export + import**. |
| **PowerPoint** | Slide list, add/delete/duplicate, drag-reorder, 5 layouts, templates, title/text elements, images, shapes, background colour, font + size, move/resize with handles and live preview, speaker notes, slideshow with keyboard navigation, autosave, PNG export, PDF via print, **real `.pptx` export**. |
| **Notepad / Notes** | Plain text with autosave option, find & replace, line/character counts, save status; Notes with titles, tags, colours, pinning, search, trash & restore — both stored in the same virtual file system. |
| **Browser (Concept Browser)** | Tabs (new/close/reorder/drag), back/forward/reload, address bar + search, bookmarks, history, downloads, three-dot menu, settings, `win://` internal pages, modern new-tab page. Sites that allow framing are shown in a sandboxed iframe; the rest get an **honest notice** plus "open in a real browser tab". It never fakes a certificate or security state. |
| **Accounting** | Dashboard (cash, receivables, payables, income, expense, net profit, margin, overdue alerts), Customers, Suppliers, Accounts, Invoices (lines, per-line discount %, extra discount, tax, issue/due dates, draft → unpaid → partial → paid, payments), Income, Expenses, Transactions, Profit & loss, Cash flow, Categories, Settings (company, currency, tax rate, invoice prefix, next number, fiscal year start). Search, filters, pagination, CSV export, printable invoices, IndexedDB persistence, clearly labelled demo data, real arithmetic with cent rounding. No bank, tax or external service is contacted. |
| **Visual Studio Code (concept)** | CodeMirror-powered editor over the virtual file system: explorer sidebar tree, tabs with dirty dots, syntax highlighting for JS/TS/JSON/HTML/CSS/Markdown/Python, dark/light editor themes, menu bar, command palette (Ctrl+Shift+P), Ctrl+S saves into IndexedDB, status bar with Ln/Col and language mode. Sample source files ship in Documents. |
| **Games — Minesweeper, Snake, 2048** | Playable classics in the desktop `games` folder: Minesweeper with three difficulties, first-click safety, flags, chording, timer and best-time records; Snake with keyboard/touch controls, growing speed and high scores; 2048 with merges, score/best tracking and win detection. Records persist per browser. |
| **Calculator, Calendar, Clock, Run, Photos, Paint, Terminal, Task Manager, Recycle Bin, Settings** | Scientific calculator with history/memory (own shunting-yard evaluator); calendar with events; world clock + timer + stopwatch + alarms; Run dialog with real shell commands; photo viewer/slideshow with "set as wallpaper"; paint with brush/eraser/shapes/fill/eyedropper/undo; a 38-command simulated shell over the virtual file system; task manager with processes and end-task. |

### Keyboard shortcuts
`Win/Ctrl+Esc` Start · `Win+E` Explorer · `Win+I` Settings · `Win+R` Run · `Win+L` Lock ·
`Win+D` Show desktop · `Win+S` Search · `Alt+Tab` switch apps · `Ctrl+Shift+Esc` Task
Manager · `Esc` close overlays · `F2` rename · `Delete` move to Recycle Bin.
Shortcuts are only captured while the simulator is active and no text field has focus;
browser-reserved combinations are left alone.

---

## 🏗 Architecture

```
src/
├── core/            framework-agnostic logic (no React)
│   ├── FileSystem.ts        pure node-map file system (ids are stable, paths are views)
│   ├── ApplicationRegistry  app metadata: sizes, singleton, categories, handled kinds
│   ├── CommandManager       Run dialog / shell command parser
│   ├── Documents.ts         document model factories + type guards
│   ├── games/               pure Minesweeper / Snake / 2048 engines
│   └── spreadsheet/         cell refs, formula engine (tokenizer + AST), cell formatting
├── stores/          Zustand state: settings, system, window, fileSystem, shell,
│                    notification, quickSettings, calendar, browser, accounting
├── services/        IndexedDB (Dexie), formatting/i18n helpers, sounds, sanitising,
│                    auth (demo digest), launcher, weather, web search, office export
├── hooks/           useDocument (autosave/conflicts), useShortcuts, useSearch, useUi…
├── components/      shell: desktop, taskbar, start, panels, window chrome, dialogs, UI kit
├── applications/    23 lazily loaded apps, mapped by app id in registry.ts
├── data/            wallpapers, settings navigation model, seed content, sample images
├── i18n/            en.ts / fa.ts dictionaries (1275+ keys each) + hooks
└── tests/           Vitest suites (file system, formulas, windows, storage, settings,
                     accounting, documents, shell integration, power/session, games,
                     web search, weather, desktop interaction, window chrome, search)
```

Design rules the code follows:

- **One source of truth.** Files live in `fileSystemStore` (persisted to IndexedDB) and
  every app reads/writes through it — Explorer, Search, Start, Terminal, Photos, Notes,
  Word/Excel/PowerPoint/Notepad all see the same nodes.
- **Pure core.** The file system, the formula engine and the game engines are plain
  functions over data, so they are unit-testable without a DOM or a database.
- **Stable identities.** A node's id never changes; paths, breadcrumbs and the Recycle Bin
  are derived views. Windows keep their id across minimize/maximize/reload.
- **Lazy loading.** Every app is a separate `React.lazy` chunk, so the shell boots fast and
  heavy apps (Excel, Accounting, Office export) load on demand.
- **Error boundaries.** A crashing app shows a recovery card instead of a white screen.
- **No click-swallowing overlays.** Window layers and panels are pointer-event audited and
  covered by regression tests, so chrome and app content always stay interactive.

### Persistence

| Data | Where |
| --- | --- |
| Settings, system/account, window layout, notifications, quick settings, browser state | `localStorage` (`win12-concept.*`) |
| Files, accounting ledger, calendar events, key/value side-app state | IndexedDB `windows12-concept` (Dexie) |

Storage failures are detected (`persistenceStatus`, `safeWrite`) and degrade to in-memory
with a visible warning instead of throwing. Corrupted or duplicated legacy seed data is
self-healed on hydrate (identity merge + dedupe + repair).

### Security & honesty

- All rendered rich text passes through DOMPurify; browser iframes are sandboxed.
- The demo password is stored as a salted digest and labelled as a demo credential — it is
  **not** real security, and nothing is ever uploaded.
- No `eval` / `new Function` anywhere: the calculator and the spreadsheet engine both parse
  user input into an AST first.
- Simulated surfaces (network, Bluetooth, battery, update, security, Task Manager metrics)
  carry an explicit "simulated" label in the UI.

---

##  Known limitations (stated, not hidden)

- A web page cannot change your real display resolution, system volume, printer, proxy,
  Bluetooth hardware, or OS settings. Those pages explain this and control the simulator
  only.
- Many websites refuse to be embedded (`X-Frame-Options` / CSP). The browser says so and
  offers to open the page in a real tab; it never pretends a blocked page loaded.
- `.docx` / `.xlsx` / `.pptx` export produce genuine OOXML packages, but only for the
  feature subset this simulator models (e.g. Word tables and lists, Excel values/formats,
  PowerPoint shapes and text). PDF output goes through the browser's print dialog.
- Accounting is a teaching/demo ledger: no bank feeds, no tax filing, no audit trail
  guarantees. Do not use it for real bookkeeping.
- The shell is desktop-first: it adapts down to small viewports (scrolling taskbar,
  viewport-clamped panels and windows), but a touch-phone layout is not the target.

---

## 🧪 Tests

```bash
npm test
```

168 tests across 15 suites — every headline feature has at least one suite:

- `fileSystem.test.ts` — create/rename/move/copy/duplicate, soft delete → Recycle Bin →
  restore → purge, clipboard semantics, paths, search, sorting, sizes, seed integrity.
- `spreadsheet.test.ts` — cell references, formula parsing, dependency collection,
  aggregates, `IF/AND/OR/NOT`, text & lookup functions, error codes, cycle detection,
  number/currency/percent/date formatting, Persian digits, user input parsing.
- `windowManager.test.ts` — unique ids, singleton vs multi-instance, clamping, minimize /
  maximize / restore previous size, z-order, snapping, desktop resize, show desktop,
  Alt+Tab, close/end-task, pinning.
- `windowChrome.test.tsx` — titlebar close/minimize actually close/minimize, frames keep
  `pointer-events: auto`, no full-screen overlay wraps windows, drag starts only after
  real movement (so button clicks survive).
- `search.test.tsx` — inline taskbar search: empty query shows nothing, compact flyout on
  typing, web fallback row, Enter opens the active hit, Esc / click-away dismiss, compact
  recents mode for small screens.
- `settings.test.ts` — section merges, airplane-mode radio logic, language/calendar/number
  system coupling, appearance, default & startup apps, quota, deep patch, localStorage
  persistence + rehydration, reset, locale-aware formatting.
- `storage.test.ts` — IndexedDB init, KV rows, `safeWrite` success/failure, seeding,
  reload recovery, content updates, rename collisions, trash lifecycle, system-folder
  protection, clipboard, quota, recent files, backup import/reset, hydrate self-healing.
- `accounting.test.ts` — invoice maths (line discounts, extra discount, tax, clamped
  payments, cent rounding), statuses, overdue rules, periods, report summary, and the full
  store flow: customer → invoice → issue → payment → balances → reports → reload.
- `documents.test.ts` — document factories for every kind, Word save/reload/DOCX export,
  HTML sanitising, Excel formulas surviving a reload + real XLSX round-trip, PowerPoint
  slides/notes/shapes + PPTX export, Notepad/Notes persistence.
- `games.test.ts` — Minesweeper (first-click safety, flood reveal, flags, chording,
  win/lose), Snake (movement, reversing, eating, wall & self collision, pause),
  2048 (merges, scoring, dead-board detection, random tiles).
- `websearch.test.ts` — Wikipedia API URL shape (`origin=*`), result parsing, HTML
  stripping, language subdomains, network-failure path, suggestions, external engines.
- `weather.test.ts` — deterministic per-day simulation, forecast range sanity, °F conversion.
- `desktop.test.tsx` — icon rendering, single click selects, second click opens, and no
  accidental open when clicks are far apart in time.
- `power.test.ts` — demo credential hashing (per-password salt, legacy fallback), boot →
  lock → sign-in, wrong password, auto sign-in, lock/unlock/sign-out, restart & shutdown
  with files, settings and windows intact, activity history, account persistence,
  simulated update check.
- `shell.test.tsx` — renders the real app: boot → lock → desktop, opens every heavy app,
  drives all shell panels, applies brightness/theme/language live, opens context menus and
  dialogs, and verifies quick settings stay consistent with the settings store.

---

## 🗺 Roadmap ideas

- More spreadsheet functions (`XLOOKUP`, date maths), conditional formatting.
- Slide transitions and richer shape editing.
- Multi-user accounts with per-user file trees.
- Custom snap-layout grid presets in the titlebar flyout.
- Virtual desktops behind Task View.

---

<div align="center">

Built as a design/engineering concept — enjoy exploring it, and remember:
**it's a simulator, not an operating system.**

</div>
