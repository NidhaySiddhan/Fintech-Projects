import { workspace } from "./api";
import { Icon, Empty, Progress, TransactionForm } from "./components";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  KEY,
  colors,
  csv,
  demo,
  fresh,
  money,
  parseAmount,
  removeCategory,
  spent,
  summary,
  today,
  validateData,
  type Data,
  type Kind,
  type Transaction,
} from "./model";
const pages = [
  "Dashboard",
  "Transactions",
  "Add Transaction",
  "Categories",
  "Budgets",
  "Settings",
] as const;
type Page = (typeof pages)[number];
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [personal, setPersonal] = useState(fresh),
    [demoData, setDemoData] = useState<Data | null>(null),
    [storageError, setStorageError] = useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const revision=useRef(0);
  const busy=useRef(false);
  const data = demoData || personal;
  const [page, setPage] = useState<Page>("Dashboard"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [edit, setEdit] = useState<Transaction | null>(null),
    [search, setSearch] = useState(""),
    [kindFilter, setKindFilter] = useState("all"),
    [categoryFilter, setCategoryFilter] = useState("all"),
    [editingCategory, setEditingCategory] = useState<string | null>(null),
    [editingBudget, setEditingBudget] = useState<string | null>(null),
    [confirmAction, setConfirmAction] = useState<{
      title: string;
      description: string;
      run: () => unknown;
    } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stats = summary(data, month),
    budgetRows = data.budgets.filter((b) => b.month === month),
    sorted = [...stats.tx]
      .reverse()
      .sort((a, b) => b.date.localeCompare(a.date));
  async function reloadSaved() {
    setLoading(true);
    try { const result=await workspace(); setPersonal(result.data); revision.current=result.revision; setStorageError(""); setError(""); }
    catch { setStorageError("Could not load saved data. Start the local server and retry. Existing records have not been changed."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reloadSaved(); }, []);
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(id);
    }
  }, [notice]);
  useEffect(() => {
    if (confirmAction) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmAction]);
  async function commit(next: Data, message = "Saved successfully.") {
    if (busy.current) return false;
    busy.current=true; setSaving(true);
    try {
      validateData(next);
      if (demoData) {
        setDemoData(next);
      } else {
        if (storageError)
          throw Error("Resolve the storage issue in Settings before saving.");
        const result=await workspace(next,revision.current);
        revision.current=result.revision;
        setPersonal(result.data);
      }
      setError("");
      setNotice(message);
      return true;
    } catch (e) {
      setError(
        (e as Error).message ||
          "Unable to save. Check that the local server is running, then retry.",
      );
      return false;
    } finally { busy.current=false; setSaving(false); }
  }
  function navigate(next: Page) {
    if (next === "Transactions") {
      setSearch("");
      setKindFilter("all");
      setCategoryFilter("all");
    }
    setPage(next);
    setError("");
    setEdit(null);
    setEditingCategory(null);
    setEditingBudget(null);
    window.scrollTo(0, 0);
    setTimeout(() => titleRef.current?.focus(), 0);
  }
  function ask(title: string, description: string, run: () => unknown) {
    setConfirmAction({ title, description, run });
  }
  function startDemo() {
    setDemoData(demo());
    setMonth(today().slice(0, 7));
    setError("");
    setNotice("Demo mode started. Your personal data is untouched.");
  }
  function changeMonth(v: string) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) {
      setMonth(v);
      setEditingBudget(null);
    }
  }
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" },
  );
  const filtered = sorted.filter(
    (t) =>
      (kindFilter === "all" || t.kind === kindFilter) &&
      (categoryFilter === "all" || t.categoryId === categoryFilter) &&
      `${t.title} ${t.note} ${data.categories.find((c) => c.id === t.categoryId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function transactionTable(items: Transaction[], editable = false) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Category</th>
              <th>Date</th>
              <th className="right">Amount</th>
              {editable && <th className="right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((t) => {
              const c = data.categories.find((c) => c.id === t.categoryId)!;
              return (
                <tr key={t.id}>
                  <td>
                    <div className="transaction-name">
                      <span
                        className="category-icon"
                        style={{ background: c.color + "18", color: c.color }}
                      >
                        <Icon
                          name={t.kind === "income" ? "arrow" : "Categories"}
                          size={17}
                        />
                      </span>
                      <span>
                        <strong>{t.title}</strong>
                        <small>
                          {t.kind === "income" ? "Income" : "Expense"}
                          {demoData ? " · Demo" : ""}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="tag">{c.name}</span>
                  </td>
                  <td className="muted nowrap">
                    {new Date(t.date + "T12:00:00").toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short" },
                    )}
                  </td>
                  <td
                    className={`right nowrap amount ${t.kind === "income" ? "positive" : ""}`}
                  >
                    {t.kind === "income" ? "+" : "−"}
                    {money(t.amount)}
                  </td>
                  {editable && (
                    <td className="right">
                      <div className="row-actions">
                        <button
                          className="text-button"
                          aria-label={`Edit ${t.title}`}
                          onClick={() => {
                            setEdit(t);
                            setPage("Add Transaction");
                            setError("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-button danger-text"
                          aria-label={`Delete ${t.title}`}
                          onClick={() =>
                            ask(
                              "Delete transaction?",
                              `“${t.title}” will be removed and your balances will be recalculated.`,
                              () =>
                                commit(
                                  {
                                    ...data,
                                    transactions: data.transactions.filter(
                                      (x) => x.id !== t.id,
                                    ),
                                  },
                                  "Transaction deleted.",
                                ),
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  async function saveTransaction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form=e.currentTarget;
    const f = new FormData(form);
    try {
      const kind = f.get("kind") as Kind,
        categoryId = String(f.get("categoryId")),
        date = String(f.get("date"));
      const item: Transaction = {
        id: edit?.id || crypto.randomUUID(),
        title: String(f.get("title")).trim(),
        amount: parseAmount(String(f.get("amount"))),
        kind,
        categoryId,
        date,
        note: String(f.get("note")).trim(),
      };
      if (!item.title) throw Error("Add a description.");
      if (date > today())
        throw Error("Future transactions are not supported in Phase 1.");
      if (
        await commit(
          {
            ...data,
            transactions: edit
              ? data.transactions.map((t) => (t.id === edit.id ? item : t))
              : [...data.transactions, item],
          },
          edit ? "Transaction updated." : "Transaction added.",
        )
      ) {
        setMonth(date.slice(0, 7));
        navigate("Transactions");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form=e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name")).trim(),
      kind = f.get("kind") as Kind,
      color = String(f.get("color"));
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    if (
      data.categories.some(
        (c) =>
          c.id !== editingCategory &&
          c.kind === kind &&
          c.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("A category with this name and type already exists.");
      return;
    }
    const item = {
      id: editingCategory || crypto.randomUUID(),
      name,
      kind,
      color,
    };
    if (
      await commit(
        {
          ...data,
          categories: editingCategory
            ? data.categories.map((c) => (c.id === editingCategory ? item : c))
            : [...data.categories, item],
        },
        "Category saved.",
      )
    ) {
      setEditingCategory(null);
      form.reset();
    }
  }
  async function saveBudget(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form=e.currentTarget;
    const f = new FormData(form);
    try {
      const categoryId = String(f.get("categoryId")),
        amount = parseAmount(String(f.get("amount")));
      if (
        !editingBudget &&
        data.budgets.some(
          (b) => b.month === month && b.categoryId === categoryId,
        )
      )
        throw Error(
          "This category already has a budget. Use Edit to change it.",
        );
      if (
        await commit(
          {
            ...data,
            budgets: [
              ...data.budgets.filter(
                (b) => !(b.month === month && b.categoryId === categoryId),
              ),
              { month, categoryId, amount },
            ],
          },
          "Monthly budget saved.",
        )
      ) {
        setEditingBudget(null);
        form.reset();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const catEdit = data.categories.find((c) => c.id === editingCategory),
    budgetEdit = budgetRows.find((b) => b.categoryId === editingBudget);
  const breakdown = data.categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({ ...c, amount: spent(data, c.id, month) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const subtitle: Record<Page, string> = {
    Dashboard: "A little clarity for your everyday money.",
    Transactions: "Every little detail, all in one place.",
    "Add Transaction": edit
      ? "Keep your records accurate."
      : "Big plans start with small entries.",
    Categories: "Organise your money in a way that makes sense to you.",
    Budgets: "Give your spending a little direction.",
    Settings: "Your profile, your data, your preferences.",
  };
  if (loading || storageError) return <main className="panel"><h1>Paisa</h1><p role={storageError ? "alert" : "status"}>{storageError || "Loading saved records…"}</p>{storageError && <button onClick={() => void reloadSaved()}>Retry connection</button>}</main>;
  return (
    <fieldset disabled={saving} style={{border:0,padding:0,margin:0,minWidth:0}}>
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Dashboard");
          }}
        >
          <span className="brand-mark">p</span>paisa
          <span className="brand-dot">.</span>
        </a>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {pages.map((p) => (
            <button
              key={p}
              className={page === p ? "nav-item active" : "nav-item"}
              onClick={() => navigate(p)}
              aria-current={page === p ? "page" : undefined}
            >
              <Icon name={p} />
              <span>{p}</span>
              {page === p && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy">
            <span className="privacy-dot" /> A little more peace of mind.
            <small>Your records stay on your computer.</small>
          </div>
          <button
            className="profile-button"
            onClick={() => navigate("Settings")}
          >
            <span className="avatar">
              {(data.profile.name || "You").slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{data.profile.name || "Your space"}</strong>
              <small>
                {demoData ? "Demo profile" : "Personal account · Local"}
              </small>
            </span>
            <span>›</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            PERSONAL FINANCE <span className="top-divider">/</span>{" "}
            <span className="top-page">{page}</span>
          </span>
          <span className="local-pill">
            <span /> {demoData ? "Demo workspace" : "Saved in local database"}
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Dashboard"
                  ? "YOUR MONEY, IN PERSPECTIVE"
                  : "MAKE EVERY RUPEE COUNT"}
              </div>
              <h1 ref={titleRef} tabIndex={-1}>
                {page === "Dashboard"
                  ? `Your money at a glance${data.profile.name ? ", " + data.profile.name.split(" ")[0] : ""}.`
                  : edit && page === "Add Transaction"
                    ? "Edit transaction"
                    : page}
              </h1>
              <p>{subtitle[page]}</p>
            </div>
            <div className="heading-actions">
              {["Dashboard", "Transactions", "Budgets"].includes(page) && (
                <label className="month-picker">
                  <span className="sr-only">Selected month</span>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => changeMonth(e.target.value)}
                    required
                  />
                </label>
              )}
              {page !== "Add Transaction" && (
                <button
                  className="primary"
                  onClick={() => navigate("Add Transaction")}
                >
                  <Icon name="Add Transaction" size={17} />
                  Add transaction
                </button>
              )}
            </div>
          </div>
          {demoData && (
            <div className="banner demo-banner">
              <span>
                <strong>Demo mode</strong> · All records here are examples.
                Changes do not affect your personal data.
              </span>
              <button
                onClick={() => {
                  setDemoData(null);
                  setMonth(today().slice(0, 7));
                  navigate("Dashboard");
                }}
              >
                Exit demo
              </button>
            </div>
          )}
          {storageError && (
            <div className="banner error" role="alert">
              {storageError}{" "}
              <button onClick={() => navigate("Settings")}>
                Open Settings
              </button>
            </div>
          )}
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {(storageError || error) && <button className="secondary" onClick={() => void reloadSaved()}>Reload saved data</button>}
          {loading && <p role="status">Loading saved records…</p>}
          {saving && <p role="status">Saving…</p>}
          {page === "Dashboard" && (
            <>
              <section className="stats-grid" aria-label="Financial summary">
                {[
                  {
                    title: "Total income",
                    value: money(stats.income),
                    note: monthLabel,
                    icon: "arrow",
                    positive: true,
                  },
                  {
                    title: "Total expenses",
                    value: money(stats.expenses),
                    note: monthLabel,
                    icon: "down",
                  },
                  {
                    title: "Net balance",
                    value: money(stats.balance),
                    note: "All recorded income minus expenses",
                    icon: "wallet",
                  },
                  {
                    title: "Budget remaining",
                    value: stats.budget ? money(stats.remaining) : "Not set",
                    note: stats.budget
                      ? stats.remaining < 0
                        ? "You are over your monthly budget"
                        : "Across all monthly spending"
                      : "Set a budget to get started",
                    icon: "Budgets",
                  },
                ].map((s, i) => (
                  <article
                    key={s.title}
                    className={`stat-card ${i === 2 ? "featured" : ""}`}
                  >
                    <div className="stat-top">
                      <span>{s.title}</span>
                      <Icon name={s.icon} />
                    </div>
                    <strong
                      className={
                        i === 3 && stats.remaining < 0 ? "negative" : ""
                      }
                    >
                      {s.value}
                    </strong>
                    <small>{s.note}</small>
                  </article>
                ))}
              </section>
              <div className="dashboard-grid">
                <section className="panel spending-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Spending by category</h2>
                      <p>Where your money went this month</p>
                    </div>
                    <span className="tag">{monthLabel}</span>
                  </div>
                  {breakdown.length ? (
                    <div className="spending-content">
                      <div
                        className="donut"
                        style={{
                          background: `conic-gradient(${breakdown.map((c, i) => `${c.color} ${(breakdown.slice(0, i).reduce((s, x) => s + x.amount, 0) / stats.expenses) * 100}% ${(breakdown.slice(0, i + 1).reduce((s, x) => s + x.amount, 0) / stats.expenses) * 100}%`).join(",")})`,
                        }}
                        role="img"
                        aria-label={`Expenses by category: ${breakdown.map((c) => c.name + " " + money(c.amount)).join(", ")}`}
                      >
                        <div>
                          <small>TOTAL SPENT</small>
                          <strong>{money(stats.expenses)}</strong>
                          <span>{breakdown.length} categories</span>
                        </div>
                      </div>
                      <div className="legend">
                        {breakdown.map((c) => (
                          <div key={c.id}>
                            <span
                              className="color-dot"
                              style={{ background: c.color }}
                            />
                            <span>
                              {c.name}
                              <small>
                                {Math.round((c.amount / stats.expenses) * 100)}%
                                of spending
                              </small>
                            </span>
                            <strong>{money(c.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Empty
                      title="Your spending story starts here"
                      action={
                        <button
                          className="secondary"
                          onClick={() => navigate("Add Transaction")}
                        >
                          Record your first expense
                        </button>
                      }
                    >
                      Add an expense to see how your spending adds up.
                    </Empty>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Monthly budget</h2>
                      <p>A plan for the things that matter</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("Budgets")}
                    >
                      Manage ↗
                    </button>
                  </div>
                  {stats.budget ? (
                    <>
                      <div className="budget-total">
                        <strong>{money(stats.expenses)}</strong>
                        <span>of {money(stats.budget)}</span>
                      </div>
                      <Progress value={stats.expenses} total={stats.budget} />
                      <div className="budget-caption">
                        <span>
                          {Math.round((stats.expenses / stats.budget) * 100)}%
                          used
                        </span>
                        <span
                          className={
                            stats.remaining < 0 ? "negative" : "positive"
                          }
                        >
                          {money(Math.abs(stats.remaining))}{" "}
                          {stats.remaining < 0 ? "over budget" : "left"}
                        </span>
                      </div>
                      <div className="mini-budgets">
                        {budgetRows.slice(0, 3).map((b) => {
                          const c = data.categories.find(
                            (c) => c.id === b.categoryId,
                          )!;
                          const used = spent(data, c.id, month);
                          return (
                            <div key={c.id}>
                              <div>
                                <span>{c.name}</span>
                                <small>
                                  {money(used)} / {money(b.amount)}
                                </small>
                              </div>
                              <Progress value={used} total={b.amount} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="tip">
                        {stats.remaining < 0
                          ? "Time to check your spending plan. Review categories to see where you went over."
                          : "Small steps. Steady progress. A budget gives every rupee a purpose."}
                      </div>
                    </>
                  ) : (
                    <Empty
                      title="Make room for your goals"
                      action={
                        <button
                          className="secondary"
                          onClick={() => navigate("Budgets")}
                        >
                          Set a monthly budget
                        </button>
                      }
                    >
                      Set category limits to keep your monthly spending in view.
                    </Empty>
                  )}
                </section>
              </div>
              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent transactions</h2>
                    <p>Your latest money moves</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("Transactions")}
                  >
                    View all transactions →
                  </button>
                </div>
                {sorted.length ? (
                  transactionTable(sorted.slice(0, 5))
                ) : (
                  <Empty title="A fresh start">
                    Your transactions will appear here once you add them.
                  </Empty>
                )}
              </section>
              {!demoData && !data.transactions.length && (
                <div className="demo-invite">
                  <span>
                    Want to take a look around first? Explore a workspace with
                    sample records.
                  </span>
                  <button className="text-button" onClick={startDemo}>
                    Try demo mode →
                  </button>
                </div>
              )}
            </>
          )}
          {page === "Transactions" && (
            <section className="panel">
              <div className="filters">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    aria-label="Search transactions"
                    placeholder="Search transactions…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter by type"
                  value={kindFilter}
                  onChange={(e) => {
                    setKindFilter(e.target.value);
                    setCategoryFilter("all");
                  }}
                >
                  <option value="all">All types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                </select>
                <select
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {data.categories
                    .filter(
                      (c) => kindFilter === "all" || c.kind === kindFilter,
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button
                  className="secondary"
                  disabled={!filtered.length}
                  onClick={() =>
                    download(
                      `paisa-${demoData ? "demo-" : ""}${month}.csv`,
                      csv(data, filtered),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Icon name="download" size={16} />
                  Export CSV
                </button>
              </div>
              <div className="list-meta">
                {filtered.length} transaction{filtered.length === 1 ? "" : "s"}{" "}
                · {monthLabel}
              </div>
              {filtered.length ? (
                transactionTable(filtered, true)
              ) : (
                <Empty title="No transactions found">
                  Try a different month or filter, or add a transaction.
                </Empty>
              )}
            </section>
          )}
          {page === "Add Transaction" && (
            <TransactionForm
              key={edit?.id || "new"}
              edit={edit}
              data={data}
              onSubmit={saveTransaction}
              onCancel={() => navigate("Transactions")}
            />
          )}
          {page === "Categories" && (
            <div className="two-column">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Your categories</h2>
                    <p>Names stay in sync across transactions and budgets.</p>
                  </div>
                </div>
                {(["expense", "income"] as Kind[]).map((kind) => (
                  <div className="category-group" key={kind}>
                    <h3>{kind === "expense" ? "Expenses" : "Income"}</h3>
                    {data.categories
                      .filter((c) => c.kind === kind)
                      .map((c) => (
                        <div className="category-row" key={c.id}>
                          <span
                            className="color-dot"
                            style={{ background: c.color }}
                          />
                          <strong>{c.name}</strong>
                          <span className="row-actions">
                            <button
                              className="text-button"
                              aria-label={`Edit ${c.name}`}
                              onClick={() => {
                                setEditingCategory(c.id);
                                setError("");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-button danger-text"
                              aria-label={`Delete ${c.name}`}
                              onClick={() => {
                                try {
                                  const next = removeCategory(data, c.id);
                                  ask(
                                    "Delete category?",
                                    `Remove “${c.name}” from your categories?`,
                                    () => commit(next, "Category removed."),
                                  );
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
              </section>
              <section className="panel form-panel">
                <h2>{catEdit ? "Edit category" : "Add a category"}</h2>
                <p className="muted">Keep it simple and easy to recognise.</p>
                <form key={editingCategory || "new"} onSubmit={saveCategory}>
                  <label>
                    Category name
                    <input
                      name="name"
                      maxLength={60}
                      defaultValue={catEdit?.name}
                      placeholder="e.g. Education"
                      required
                    />
                  </label>
                  <label>
                    Type
                    <select
                      name="kind"
                      defaultValue={catEdit?.kind || "expense"}
                      disabled={!!catEdit}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </label>
                  {catEdit && (
                    <input type="hidden" name="kind" value={catEdit.kind} />
                  )}
                  <label>
                    Colour
                    <input
                      type="color"
                      name="color"
                      defaultValue={catEdit?.color || colors[0]}
                    />
                  </label>
                  <div className="form-actions">
                    <button className="primary" type="submit">
                      {catEdit ? "Save category" : "Add category"}
                    </button>
                    {catEdit && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setEditingCategory(null)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </section>
            </div>
          )}
          {page === "Budgets" && (
            <>
              <div className="budget-overview">
                <div>
                  <small>MONTHLY SPENDING PLAN</small>
                  <h2>
                    {stats.budget ? money(stats.budget) : "No budgets yet"}
                  </h2>
                  <p>
                    {monthLabel} · Category limits add up to your monthly
                    budget.
                  </p>
                </div>
                <div>
                  <small>ACTUAL SPENDING</small>
                  <h2>{money(stats.expenses)}</h2>
                  <p>Includes spending in categories without a budget.</p>
                </div>
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Category budgets</h2>
                      <p>Unused amounts do not roll over to the next month.</p>
                    </div>
                  </div>
                  {budgetRows.length ? (
                    budgetRows.map((b) => {
                      const c = data.categories.find(
                        (c) => c.id === b.categoryId,
                      )!;
                      const used = spent(data, c.id, month);
                      return (
                        <div className="budget-row" key={c.id}>
                          <div className="budget-row-title">
                            <strong>
                              <span
                                className="color-dot"
                                style={{ background: c.color }}
                              />
                              {c.name}
                            </strong>
                            <span className="row-actions">
                              <button
                                className="text-button"
                                aria-label={`Edit ${c.name} budget`}
                                onClick={() => setEditingBudget(c.id)}
                              >
                                Edit
                              </button>
                              <button
                                className="text-button danger-text"
                                aria-label={`Delete ${c.name} budget`}
                                onClick={() =>
                                  ask(
                                    "Remove budget?",
                                    `Remove the ${c.name} budget for ${monthLabel}? Transactions will be kept.`,
                                    () =>
                                      commit(
                                        {
                                          ...data,
                                          budgets: data.budgets.filter(
                                            (x) =>
                                              !(
                                                x.month === month &&
                                                x.categoryId === c.id
                                              ),
                                          ),
                                        },
                                        "Budget removed.",
                                      ),
                                  )
                                }
                              >
                                Remove
                              </button>
                            </span>
                          </div>
                          <div className="budget-caption">
                            <span>
                              {money(used)} of {money(b.amount)}
                            </span>
                            <span
                              className={
                                used > b.amount ? "negative" : "positive"
                              }
                            >
                              {used > b.amount ? "Over by " : "Remaining "}
                              {money(Math.abs(b.amount - used))}
                            </span>
                          </div>
                          <Progress value={used} total={b.amount} />
                        </div>
                      );
                    })
                  ) : (
                    <Empty title="Start with one category">
                      Add a limit for food, transport, or anything you want to
                      keep an eye on.
                    </Empty>
                  )}
                </section>
                <section className="panel form-panel">
                  <h2>{budgetEdit ? "Edit budget" : "Set a budget"}</h2>
                  <p className="muted">For {monthLabel}</p>
                  <form key={`${month}-${editingBudget}`} onSubmit={saveBudget}>
                    <label>
                      Expense category
                      <select
                        name="categoryId"
                        defaultValue={budgetEdit?.categoryId || ""}
                        disabled={!!budgetEdit}
                        required
                      >
                        <option value="" disabled>
                          Select category
                        </option>
                        {data.categories
                          .filter((c) => c.kind === "expense")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {budgetEdit && (
                      <input
                        type="hidden"
                        name="categoryId"
                        value={budgetEdit.categoryId}
                      />
                    )}
                    <label>
                      Monthly limit (₹)
                      <input
                        name="amount"
                        inputMode="decimal"
                        placeholder="0.00"
                        defaultValue={budgetEdit ? budgetEdit.amount / 100 : ""}
                        required
                      />
                    </label>
                    <div className="form-actions">
                      <button className="primary">Save budget</button>
                      {budgetEdit && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setEditingBudget(null)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </section>
              </div>
            </>
          )}
          {page === "Settings" && (
            <div className="two-column">
              <section className="panel form-panel">
                <h2>Your profile</h2>
                <p className="muted">
                  Personalise this workspace. No account or login needed.
                </p>
                <form
                  key={demoData ? "demo" : "personal"}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form=e.currentTarget;
    const f = new FormData(form);
                    commit(
                      {
                        ...data,
                        profile: {
                          name: String(f.get("name")).trim(),
                          email: String(f.get("email")).trim(),
                        },
                      },
                      "Profile updated.",
                    );
                  }}
                >
                  <label>
                    Display name
                    <input
                      name="name"
                      maxLength={80}
                      defaultValue={data.profile.name}
                      placeholder="Your name"
                    />
                  </label>
                  <label>
                    Email (optional)
                    <input
                      type="email"
                      name="email"
                      maxLength={160}
                      defaultValue={data.profile.email}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Currency
                    <input value="INR — Indian Rupee (₹)" readOnly />
                  </label>
                  <button className="primary">Save profile</button>
                </form>
                <div className="tip">
                  Paisa uses INR throughout. Your profile is stored in the local database; this is not an authenticated account.
                </div>
              </section>
              <div className="settings-stack">
                <section className="panel form-panel">
                  <h2>Your data, in your hands</h2>
                  <p className="muted">
                    Records are saved in a SQLite database on your computer. Keep JSON backups before replacing or resetting records.
                  </p>
                  <button
                    className="secondary full"
                    onClick={() =>
                      download(
                        `paisa-${demoData ? "demo-" : ""}backup-${today()}.json`,
                        JSON.stringify(data, null, 2),
                        "application/json",
                      )
                    }
                  >
                    <Icon name="download" size={16} />
                    Download JSON backup
                  </button>
                  <label className="import-label">
                    Restore a JSON backup
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          if (file.size > 10 * 1024 * 1024)
                            throw Error("Choose a backup smaller than 10 MB.");
                          const imported = validateData(
                            JSON.parse(await file.text()),
                          );
                          ask(
                            "Replace current workspace?",
                            `This backup contains ${imported.transactions.length} transactions. Existing ${demoData ? "demo" : "personal"} records will be replaced. Download a backup first if you need to keep them.`,
                            () => commit(imported, "Backup restored."),
                          );
                        } catch (e) {
                          setError(
                            (e as Error).message ||
                              "Unable to read this backup.",
                          );
                        }
                      }}
                    />
                  </label>
                  <button className="secondary full" onClick={() => {
                    try {
                      const raw=localStorage.getItem(KEY);
                      if (!raw) throw Error("No earlier browser records were found here. You can restore a JSON backup instead.");
                      const imported=validateData(JSON.parse(raw));
                      ask("Import earlier browser records?", "This replaces the current database workspace. Export a backup first. Your original browser copy will be kept.",()=>commit(imported,"Browser records imported."));
                    } catch { setError("Browser records are missing or unreadable. The original copy has not been changed."); }
                  }}>Import earlier browser records</button>
                  <button className="secondary full" onClick={() => {
                    try { const raw=localStorage.getItem(KEY); if(!raw) throw Error(); download("paisa-browser-backup.txt",raw,"text/plain"); }
                    catch { setError("No accessible browser backup was found."); }
                  }}>Download original browser backup</button>
                </section>
                <section className="panel form-panel">
                  <h2>Explore with demo data</h2>
                  <p className="muted">
                    Sample income, expenses, and budgets in an isolated
                    workspace.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => (demoData ? setDemoData(null) : startDemo())}
                  >
                    {demoData ? "Exit demo mode" : "Try demo mode"}
                  </button>
                </section>
                <section className="panel form-panel danger-zone">
                  <h2>Reset workspace</h2>
                  <p className="muted">
                    Remove transactions, budgets, custom categories, and profile
                    details from the current workspace.
                  </p>
                  <button
                    className="danger-button"
                    onClick={() =>
                      ask(
                        "Reset this workspace?",
                        `This removes all ${demoData ? "demo" : "personal"} data. This cannot be undone without a backup.`,
                        () => commit(fresh(), "Workspace reset."),
                      )
                    }
                  >
                    Reset {demoData ? "demo" : "personal"} data
                  </button>
                </section>
              </div>
            </div>
          )}
          <footer>
            <span>
              paisa.{" "}
              <span className="muted">A clearer view of your money.</span>
            </span>
            <span>Phase 2 · SQLite · INR</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          ✓ {notice}
        </div>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setConfirmAction(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setConfirmAction(null);
        }}
      >
        <h2>{confirmAction?.title}</h2>
        <p>{confirmAction?.description}</p>
        <div className="form-actions">
          <button
            className="secondary"
            autoFocus
            onClick={() => setConfirmAction(null)}
          >
            Cancel
          </button>
          <button
            className="danger-button"
            onClick={() => {
              confirmAction?.run();
              setConfirmAction(null);
            }}
          >
            Confirm
          </button>
        </div>
      </dialog>
    </div>
    </fieldset>
  );
}
