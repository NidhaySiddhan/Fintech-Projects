import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  parseAmount,
  summary,
  spent,
  removeCategory,
  validateData,
  csv,
  today,
  demo,
  type Data,
} from "../src/model.ts";
const month = today().slice(0, 7);
const tx = (overrides = {}) => ({
  id: "a",
  title: "Groceries",
  amount: 10001,
  kind: "expense" as const,
  categoryId: "food",
  date: today(),
  note: "",
  ...overrides,
});
test("amounts use integer paise, including decimals", () => {
  assert.equal(parseAmount("0.29"), 29);
  assert.equal(parseAmount("1299.99"), 129999);
  for (const x of [
    "0",
    "-1",
    "1.001",
    "NaN",
    "1e6",
    "Infinity",
    "100000000.01",
    "",
  ])
    assert.throws(() => parseAmount(x));
});
test("monthly totals, all-time balance and budget overspend are distinct", () => {
  const d = fresh();
  d.transactions = [
    tx(),
    tx({ id: "b", kind: "income", categoryId: "salary", amount: 50000 }),
    tx({ id: "c", date: "2020-01-01", amount: 2000 }),
  ];
  d.budgets = [{ month, categoryId: "food", amount: 9000 }];
  const s = summary(d, month);
  assert.equal(s.expenses, 10001);
  assert.equal(s.income, 50000);
  assert.equal(s.balance, 37999);
  assert.equal(s.remaining, -1001);
  assert.equal(spent(d, "food", month), 10001);
});
test("month boundaries do not leak transactions or budgets", () => {
  const d = fresh();
  d.transactions = [
    tx({ date: "2024-02-29" }),
    tx({ id: "b", date: "2024-03-01", amount: 200 }),
  ];
  d.budgets = [{ month: "2024-02", categoryId: "food", amount: 1000 }];
  assert.equal(summary(d, "2024-03").expenses, 200);
  assert.equal(summary(d, "2024-03").budget, 0);
});
test("deletion protects referenced categories", () => {
  const d = fresh();
  d.transactions = [tx()];
  assert.throws(() => removeCategory(d, "food"));
  assert.ok(
    !removeCategory(d, "shopping").categories.some((c) => c.id === "shopping"),
  );
  d.transactions = [];
  d.budgets = [{ month, categoryId: "food", amount: 100 }];
  assert.throws(() => removeCategory(d, "food"));
});
test("backup round trip and demo are valid", () => {
  for (const d of [fresh(), demo()])
    assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))), d);
});
test("reject invalid backups without silently dropping records", () => {
  const mutate = (fn: (d: Data) => void) => {
    const d = fresh();
    d.transactions = [tx()];
    fn(d);
    assert.throws(() => validateData(d));
  };
  mutate((d) => (d.transactions[0].categoryId = "missing"));
  mutate((d) => (d.transactions[0].date = "2024-02-30"));
  mutate((d) => (d.transactions[0].amount = 1.5));
  mutate((d) => d.transactions.push({ ...d.transactions[0] }));
  mutate((d) => d.categories.push({ ...d.categories[0], id: "different" }));
  mutate((d) => (d.transactions[0].kind = "income"));
  mutate(
    (d) =>
      (d.budgets = [{ month: "2024-13", categoryId: "food", amount: 100 }]),
  );
  mutate((d) => (d.budgets = [{ month, categoryId: "salary", amount: 100 }]));
});
test("transaction edits and deletes change totals", () => {
  const d = fresh();
  d.transactions = [tx()];
  d.transactions[0].amount = 100;
  assert.equal(summary(d, month).expenses, 100);
  d.transactions = [];
  assert.equal(summary(d, month).expenses, 0);
});
test("CSV preserves commas and quotes and neutralises spreadsheet formulas", () => {
  const d = fresh();
  d.transactions = [tx({ title: "=SUM(1,2)", note: 'a "quoted", note' })];
  const result = csv(d, d.transactions);
  assert.ok(result.includes('"\'=SUM(1,2)"'));
  assert.ok(result.includes('"a ""quoted"", note"'));
  assert.ok(result.includes('"100.01"'));
});
