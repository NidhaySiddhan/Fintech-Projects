export type Kind = "expense" | "income";
export type Category = { id: string; name: string; kind: Kind; color: string };
export type Transaction = {
  id: string;
  title: string;
  amount: number;
  kind: Kind;
  categoryId: string;
  date: string;
  note: string;
};
export type Budget = { month: string; categoryId: string; amount: number };
export type Data = {
  version: 1;
  profile: { name: string; email: string };
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
};
export const KEY = "paisa-personal-v1";
export const MAX_AMOUNT = 100_000_000_00; // ₹10 crore, stored as integer paise
export const colors = [
  "#367c67",
  "#c58a36",
  "#688cc1",
  "#b07898",
  "#8479b5",
  "#c57060",
  "#668994",
];
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(paise / 100);
}
export function parseAmount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw Error("Enter a positive amount with at most two decimal places.");
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT)
    throw Error("Amount must be greater than zero and no more than ₹10 crore.");
  return amount;
}
export function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
}
export function fresh(): Data {
  return {
    version: 1,
    profile: { name: "", email: "" },
    categories: [
      ["food", "Food & dining", "expense"],
      ["shopping", "Shopping", "expense"],
      ["transport", "Transport", "expense"],
      ["bills", "Bills & utilities", "expense"],
      ["health", "Health", "expense"],
      ["leisure", "Leisure", "expense"],
      ["salary", "Salary", "income"],
      ["other-income", "Other income", "income"],
    ].map(([id, name, kind], i) => ({
      id,
      name,
      kind: kind as Kind,
      color: colors[i % colors.length],
    })),
    transactions: [],
    budgets: [],
  };
}
export function summary(data: Data, month: string) {
  const tx = data.transactions.filter((t) => t.date.startsWith(month));
  const income = tx
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = tx
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = data.transactions
    .filter((t) => t.date <= today())
    .reduce((s, t) => s + (t.kind === "income" ? t.amount : -t.amount), 0);
  const budget = data.budgets
    .filter((b) => b.month === month)
    .reduce((s, b) => s + b.amount, 0);
  return {
    income,
    expenses,
    balance,
    budget,
    remaining: budget - expenses,
    tx,
  };
}
export function spent(data: Data, categoryId: string, month: string) {
  return data.transactions
    .filter(
      (t) =>
        t.kind === "expense" &&
        t.categoryId === categoryId &&
        t.date.startsWith(month),
    )
    .reduce((s, t) => s + t.amount, 0);
}
export function removeCategory(data: Data, id: string): Data {
  if (
    data.transactions.some((t) => t.categoryId === id) ||
    data.budgets.some((b) => b.categoryId === id)
  )
    throw Error(
      "This category is used by transactions or budgets. Reassign or remove those records first.",
    );
  return { ...data, categories: data.categories.filter((c) => c.id !== id) };
}
export function validateData(input: unknown): Data {
  const d = input as Data;
  if (
    !d ||
    d.version !== 1 ||
    !d.profile ||
    typeof d.profile.name !== "string" ||
    d.profile.name.length > 80 ||
    typeof d.profile.email !== "string" ||
    d.profile.email.length > 160 ||
    !Array.isArray(d.categories) ||
    !Array.isArray(d.transactions) ||
    !Array.isArray(d.budgets)
  )
    throw Error("This is not a valid Paisa v1 backup.");
  if (
    d.categories.length > 500 ||
    d.transactions.length > 100000 ||
    d.budgets.length > 10000
  )
    throw Error("Backup exceeds supported record limits.");
  const ids = new Set<string>();
  const amount = (v: number) =>
    Number.isSafeInteger(v) && v > 0 && v <= MAX_AMOUNT;
  for (const c of d.categories) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      c.name.length > 60 ||
      !["income", "expense"].includes(c.kind) ||
      !/^#[0-9a-f]{6}$/i.test(c.color)
    )
      throw Error("Invalid or duplicate category in backup.");
    ids.add(c.id);
  }
  const names = new Set<string>();
  for (const c of d.categories) {
    const n = c.kind + ":" + c.name.trim().toLowerCase();
    if (names.has(n)) throw Error("Duplicate category name.");
    names.add(n);
  }
  ids.clear();
  for (const t of d.transactions) {
    const c = d.categories.find((c) => c.id === t?.categoryId);
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      ids.has(t.id) ||
      !c ||
      c.kind !== t.kind ||
      !amount(t.amount) ||
      !validDate(t.date) ||
      t.date > today() ||
      typeof t.title !== "string" ||
      !t.title.trim() ||
      t.title.length > 100 ||
      typeof t.note !== "string" ||
      t.note.length > 500
    )
      throw Error("Invalid transaction in backup.");
    ids.add(t.id);
  }
  ids.clear();
  for (const b of d.budgets) {
    const key = b?.month + ":" + b?.categoryId;
    if (
      !b ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month) ||
      !d.categories.some(
        (c) => c.id === b.categoryId && c.kind === "expense",
      ) ||
      !amount(b.amount) ||
      ids.has(key)
    )
      throw Error("Invalid or duplicate budget in backup.");
    ids.add(key);
  }
  return d;
}
export function demo(): Data {
  const d = fresh(),
    month = today().slice(0, 7),
    day = Number(today().slice(8));
  d.profile.name = "Alex";
  d.transactions = [
    ["Monthly salary", 65000, "salary", "income", 1],
    ["Groceries", 2850, "food", "expense", 3],
    ["Metro recharge", 1200, "transport", "expense", 4],
    ["Coffee & catch-up", 480, "food", "expense", 6],
    ["Internet plan", 999, "bills", "expense", 7],
    ["New headphones", 3499, "shopping", "expense", 9],
    ["Weekend lunch", 1250, "food", "expense", 11],
    ["Movie night", 750, "leisure", "expense", 12],
    ["Freelance work", 8000, "other-income", "income", 13],
    ["Electricity bill", 1650, "bills", "expense", 15],
    ["Running shoes", 4200, "shopping", "expense", 16],
  ].map(([title, amount, categoryId, kind, date], i) => ({
    id: `demo-${i}`,
    title: String(title),
    amount: Number(amount) * 100,
    categoryId: String(categoryId),
    kind: kind as Kind,
    date: `${month}-${String(Math.min(Number(date), day)).padStart(2, "0")}`,
    note: "Demo transaction",
  }));
  d.budgets = [
    ["food", 6000],
    ["shopping", 7000],
    ["transport", 3000],
    ["bills", 5000],
    ["leisure", 2000],
    ["health", 2000],
  ].map(([categoryId, amount]) => ({
    month,
    categoryId: String(categoryId),
    amount: Number(amount) * 100,
  }));
  return d;
}
export function csv(data: Data, transactions: Transaction[]) {
  const cell = (value: string) =>
    '"' +
    (/^[=+@\-\t\r\n]/.test(value) ? "'" : "") +
    value.replaceAll('"', '""') +
    '"';
  return [
    "Date,Description,Type,Category,Amount (INR),Note",
    ...transactions.map((t) =>
      [
        t.date,
        t.title,
        t.kind,
        data.categories.find((c) => c.id === t.categoryId)?.name || "",
        (t.amount / 100).toFixed(2),
        t.note,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
