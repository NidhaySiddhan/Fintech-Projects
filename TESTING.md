# Phase 1 acceptance checklist

## Automated (run with `npm test`)

- Integer paise arithmetic and amount validation.
- Monthly totals versus all-time balance; leap-day/month boundaries.
- Budget overspending and category spending.
- Referenced-category deletion protection.
- Backup round trips, malformed dates, invalid amounts, duplicate records and references.
- CSV quote escaping and formula-leading text protection.
- DOM integration: add/edit/delete income and expenses; shared dashboard totals; persistence after unmount/remount; budget editing; category renaming; profile saving; isolated demo edits; confirmation cancel/accept; invalid input; corrupted storage preservation.

## Manual browser check

1. Run `npm ci`, `npm test`, `npm run build`, and `npm run preview`.
2. Start with an empty workspace. Enter demo mode and verify the banner and example transactions. Exit it and verify your personal workspace is unchanged.
3. Add income ₹10,000 and an expense ₹1,500.25. Check the dashboard shows income ₹10,000, expense ₹1,500.25, and net balance ₹8,499.75.
4. Edit that expense to ₹1,700.25 and set its category budget to ₹1,000. Verify an over-budget amount of ₹700.25.
5. Change selected month. Totals and budgets should change; all-time net balance should not.
6. Rename the category and verify its transaction and budget use the new name. Try deleting it; deletion must be blocked while in use.
7. Test search, type/category filters, and CSV export. Open the downloaded file and check the filtered rows and decimal amounts.
8. Export a JSON backup. Add a record, restore the backup, and confirm the added record disappears only after accepting replacement. Import invalid JSON and verify existing records stay unchanged.
9. Refresh and reopen the browser; personal records should remain. Open a second tab and verify saved changes are reflected there.
10. Test delete and reset confirmations using disposable test data. Cancel must preserve data; confirmation must update totals.
11. Check all six pages at desktop width and 390px mobile width. Tables may scroll inside their containers; the page itself should not overflow horizontally.
12. Navigate using the keyboard, including the confirmation dialog. Verify visible focus, labelled inputs, and dismissible errors.

## Known environment limitation

The production build and model/DOM tests were run during implementation. Full browser visual verification was not completed: the command-line browser was blocked by runtime socket restrictions, and the separate browser could not reach the preview server. No claim of a passed end-to-end browser suite is made.
