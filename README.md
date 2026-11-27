# Paisa — Personal Expense Tracker

A single-user expense tracker built with **React, TypeScript, Node.js and SQLite**. Phase 2 adds a relational database and an HTTP API to the existing dashboard, transactions, categories, monthly budgets and settings pages.

## Run locally

Use Node.js **24.15+ on the Node 24 line** (or Node 22.22.2+) and npm. No separate database installation, account, API key or paid service is required. Node's built-in SQLite module stores your database in `data/paisa.sqlite`.

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3001**. The Node server serves both the production frontend and API. Keep it running while using the app. Stop it with Ctrl+C; records remain on disk.

For development, use two terminals:

```sh
# Terminal 1: database and API
npm run server
```

```sh
# Terminal 2: frontend with hot reload
npm run dev
```

Open **http://127.0.0.1:5173**. Vite forwards `/api` to port 3001. Port 5173 is fixed to keep the permitted development origin explicit. `PORT` changes the production API port; the development proxy remains at 3001. `PAISA_DB` can select a different database path.

**This version requires its Node backend.** Deploying only `dist/` to GitHub Pages or another static host will not run the database API. The server binds to loopback only. It has no login or multi-user isolation and is not intended to be exposed publicly or on a LAN.

## Features

- Dashboard: selected-month income/expenses, all-time tracked balance, remaining budget, recent transactions and spending by category.
- Transactions: create, edit, delete with confirmation, search/filter, and export filtered CSV.
- Categories: add, rename, choose colours and remove unused categories; referenced categories are protected.
- Budgets: category limits for each month, editable limits and overspending indicators.
- Settings: profile editing, JSON backup/restore and confirmed workspace reset.
- Demo mode: isolated in-memory sample records; demo changes never enter the database.
- Database persistence: records survive browser storage clearing and server restart.
- Conflict protection: stale tabs cannot overwrite newer database records. Use **Reload saved data**, review the latest records and retry your edit.
- Failed saves show an error and do not report success or navigate away from the transaction form.

## Bring over Phase 1 browser data

In **Settings**, choose **Import earlier browser records** and confirm replacement. The old browser copy is retained. Import is explicit because it replaces the current database workspace; export the database's JSON backup first if it contains records you want to keep.

Browser storage belongs to a specific origin. If you used another address, port, browser or device for Phase 1, export a JSON backup from that original app and restore it here instead. **Download original browser backup** also preserves raw unreadable browser content for recovery. Invalid imports never replace existing database records.

## Architecture and database design

```text
React UI → /api/workspace → shared validation → SQLite transaction → saved response
```

| Table | Purpose and key |
| --- | --- |
| `workspace` | Singleton profile and revision number; primary key `id=1` |
| `categories` | Stable category IDs, names, type and colour |
| `transactions` | Income/expense records; composite foreign key ensures category/type match |
| `budgets` | One limit per `(month, categoryId)`; foreign key to categories |

Amounts are positive **integer paise**, with a per-record maximum of ₹10 crore. SQL uses bound parameters, strict tables, amount constraints and enabled foreign keys. Date and category/date indexes are included for future filtered queries. Schema version 1 is recorded with `PRAGMA user_version`; newer unsupported database versions are rejected.

- `GET /api/workspace` returns `{revision, data}`.
- `PUT /api/workspace` accepts `{revision, data}` with JSON content type.
- The server validates the complete workspace, acquires a write transaction, compares the revision, replaces the related rows and increments the revision in one atomic commit.
- Invalid bodies return 400; stale revisions return 409; non-JSON writes return 415; payloads over 10 MB return 413. Unknown API routes return 404.
- A failed SQL write rolls back the whole replacement. The UI applies saved state only after a successful response.

This snapshot API deliberately keeps the first database upgrade simple. It rewrites the workspace on each save and loads all records into the UI; it is suited to small personal datasets, not high-volume or multi-user workloads. Pagination, per-record endpoints and incremental writes are future work.

## Calculation rules

- Income and expenses include only the selected calendar month.
- Net balance is all recorded income minus expenses through today; it is not a connected bank balance.
- Remaining budget is the sum of that month's category budgets minus **all** its expenses, including unbudgeted categories. Without limits it displays “Not set”.
- Category budgets use stable IDs, do not roll over and only apply to expense categories.
- Future-dated transactions are rejected. Dates are local calendar dates.
- CSV text is quoted and formula-leading text is neutralised.

## Privacy and backups

The database contains personal financial records and is not encrypted at rest. `data/` and SQLite files are ignored by Git. Do not upload actual records to GitHub. Clearing browser storage does not erase the database, but deleting the database file does.

Use **Download JSON backup** in Settings for a portable backup. Keep it private. To copy the SQLite file directly, stop the server first so you do not copy an inconsistent live database without its WAL files. Restore through Settings validates data and asks before replacement. This app has no bank connection, cloud sync or account authentication.

## Tests and project structure

```sh
npm test
npm run build
```

`npm test` runs model tests, real SQLite tests, HTTP API tests and a React DOM integration suite backed by SQLite. It covers calculations, persistence after reopen, SQL rollback after an injected failure, stale writes, invalid imports, origin checks, transaction/budget workflows, failed-save retry and demo isolation. The DOM suite mocks the fetch transport; separate HTTP tests exercise real requests.

```text
server/database.mjs  Schema, prepared statements, atomic saves and revisions
server/app.mjs       HTTP API, input limits, local access checks and static serving
server/index.mjs     Loopback startup and shutdown
src/api.ts           Typed frontend API client
src/model.ts         Shared validation, integer-paise calculations and exports
src/App.tsx          Pages, forms, asynchronous saves and migration controls
src/components.tsx   Reusable controls and transaction form
src/style.css        Responsive styles
vite.config.ts       Development API proxy
tests/              Model, database, HTTP and DOM integration tests
```

Full browser visual testing and real-user acceptance remain manual checks; see [TESTING.md](TESTING.md). Automated tests do not establish production security or performance at scale.

## What to understand for interviews

Explain primary/foreign keys, integer money representation, prepared statements, transaction rollback, HTTP status codes and optimistic concurrency. Trace an expense from the form to the database and back. Explain why a stale tab gets a conflict and why a failed import leaves saved data intact.

Implemented with AI coding assistance. Describe your own design, testing and learning contributions accurately. Authentication, recurring transactions, bank imports, encryption and public deployment remain outside this release.
