# Paisa — Personal Expense Tracker

A local-first personal expense tracker and budgeting app built with React, TypeScript, and Vite. Phase 1 is designed for one person recording transactions manually in Indian Rupees.

## Run locally

Use **Node.js 24.15+ on the Node 24 LTS line** (or Node 22.22.2+) and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. To test and build:

```bash
npm test
npm run build
npm run preview
```

The production build is generated in `dist/`. Serve this folder with a static web server; don't open `index.html` directly as a file. If hosting under a repository subpath such as `/Fintech-Projects/`, run `npm run build -- --base=/Fintech-Projects/`. No environment variables, paid services, database installation, or API keys are required.

## Phase 1 features

- **Dashboard:** selected-month income and expenses, all-time net balance, remaining monthly budget, recent transactions, expense-category breakdown, and budget progress.
- **Transactions:** add, edit, delete with confirmation, search descriptions/notes/categories, filter by month/type/category, and download the filtered results as CSV.
- **Categories:** add, rename, choose a colour, and delete unused income/expense categories. Renaming preserves record associations. Deletion is blocked while a category is referenced by any transaction or budget.
- **Budgets:** set, edit, and remove category limits for individual months. Shows both remaining amounts and overspending alerts. Category budgets sum to the monthly spending plan.
- **Settings:** edit display name and optional email, export JSON backups, validate and restore backups with replacement confirmation, and reset the workspace with confirmation.
- **Demo mode:** clearly labelled example records in a separate in-memory workspace. Entering/exiting demo mode never replaces personal records. Demo edits are discarded when leaving or reloading.
- Responsive desktop sidebar and mobile navigation, keyboard-focus indicators, labelled forms, accessible confirmation dialogs and status/error messages.

## Data and calculation rules

Amounts are stored as **integer paise** to avoid decimal rounding errors. Inputs must be positive, have at most two decimal places, and be at most ₹10 crore. A transaction is either income or expense; the selected category must have the same type. Future-dated transactions aren't supported in Phase 1.

- **Income / expenses:** only transactions in the selected calendar month.
- **Net balance:** all recorded income minus all recorded expenses up to today. This is a tracked balance, not a connected bank balance.
- **Remaining monthly budget:** sum of that month's category budgets minus *all* that month's expenses, including expenses in unbudgeted categories. With no budgets it shows “Not set”.
- **Category budget:** category spending is matched by stable category ID and calendar month. Unused budgets don't roll over.
- **Dates:** local calendar dates, displayed without UTC shifting.

Data is stored under `paisa-personal-v1` in this browser's `localStorage`. There is **no server, authentication, cloud sync, bank connection, encryption at rest, or shared account**. The optional email stays on this device. Changing browser, device, or site origin creates a separate workspace. Clearing browser storage deletes saved records. Export JSON backups regularly and keep them private.

Corrupt or incompatible saved data is not overwritten automatically. Settings offers a download of the original stored content before resetting. Imports validate schema version, dates, amounts, duplicate IDs/category names/budgets, and category references before any replacement. CSV output escapes quotes and neutralises formula-leading text.

## Project structure

```text
src/
  App.tsx          Page layout, forms, shared state and persistence
  components.tsx   Reusable UI and transaction form
  model.ts         Data types, validation, money calculations, demo and CSV
  main.tsx         React entry point
  style.css        Responsive design and component styles
tests/
  model.test.ts    Calculation, validation and data integrity tests
  ui.test.mjs      DOM integration test exercising the complete data workflow
```

The runtime dependencies are React and React DOM. Vite/TypeScript build the app; Node's test runner, jsdom, and esbuild run the tests. No UI framework, chart library, backend, analytics, remote fonts, or external network calls are used by the app.

## Verification

`npm test` runs eight model tests and one integration suite covering transaction CRUD, cross-page totals, remount persistence, budget editing/overspending, referenced-category protection, category renaming, profile editing, demo isolation, delete/reset confirmation, invalid amount handling, and corrupted storage preservation. Model tests also cover backup round trips and CSV escaping.

`npm run build` performs strict TypeScript checking and creates the production bundle.

Visual and full real-browser testing remain a manual release check: the implementation environment could not launch its command-line browser or connect its separate browser to the local preview server. The DOM tests are not a substitute for checking mobile layout in a real browser. See `TESTING.md` for the exact checklist.

## Scope and future work

Phase 1 is a working local personal tracker, not a banking product. Recurring transactions, multi-currency conversion, bank imports, authentication, encryption, and cloud sync are outside this release. Very large datasets are not optimised; use this version for personal-scale records and keep backups.

## Development transparency

Implemented with AI coding assistance. Before presenting this in a resume or interview, run the app yourself and understand the data model, integer-paise calculations, shared React state, persistence, validation, and tests. Describe your own contribution accurately.
