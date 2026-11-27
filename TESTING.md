# Phase 2 verification

## Automated

Run `npm test` and `npm run build` with the supported Node version.

- Model: integer-paise arithmetic, monthly boundaries, budget overspend, protected category references, backup validation and CSV escaping.
- SQLite: real temporary file persistence after reopen, parameterised text, edits/deletes, invalid references, duplicate budgets and stale revisions.
- SQL atomicity: inject an insert failure after a save has begun and verify all earlier data and its revision survive rollback.
- HTTP: real loopback requests for GET/PUT, malformed JSON, validation, conflict status, disallowed Origin, wrong content type and unknown routes.
- DOM: transaction/category/budget/profile workflows using a SQLite-backed fetch mock, remount persistence, failed-save retry, stale-tab conflict/reload, isolated demo edits, reset confirmation, valid legacy import and corrupt legacy preservation.

## Manual acceptance

1. Run `npm ci`, `npm run build`, `npm start`; open http://127.0.0.1:3001.
2. Add income ₹10,000 and expense ₹1,500.25; confirm balance ₹8,499.75.
3. Set a ₹1,000 category budget; confirm overspending ₹500.25. Edit the expense and verify updated totals.
4. Rename its category; verify labels update. Deleting a referenced category must be blocked.
5. Export JSON, close the server, restart and confirm records remain. Clear browser storage and confirm database records remain.
6. Open two tabs. Save in one, then attempt a save in the other. Confirm a conflict and no overwritten data. Reload saved data and retry.
7. Stop the server while editing a transaction. Saving must show an error and retain the entered values. Restart and retry.
8. Enter demo, edit/delete sample records and exit. Personal data must remain unchanged.
9. Restore a valid backup only after confirming replacement. Invalid JSON must preserve records. Test legacy-browser import, including Cancel.
10. Test deletion/reset Cancel and Confirm using disposable records.
11. Check all six pages at desktop and 390px mobile width. Confirm tables scroll inside their containers.
12. Test keyboard navigation, form labels, visible focus and confirmation-dialog focus.
13. Verify CSV exports include only the filtered records.

Automated tests and production build were run during implementation. A full real-browser visual/end-to-end suite was not run. Actual deployment must retain the Node server; static-only hosting is unsupported in Phase 2.
