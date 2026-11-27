import { useState, type FormEvent, type ReactNode } from "react";
import { today, type Data, type Kind, type Transaction } from "./model";
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    Dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    Transactions: (
      <>
        <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
      </>
    ),
    "Add Transaction": <path d="M12 5v14M5 12h14" />,
    Categories: (
      <>
        <path d="M3 3h8l10 10-8 8L3 11Z" />
        <circle cx="7.5" cy="7.5" r="1" />
      </>
    ),
    Budgets: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    Settings: (
      <>
        <path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    arrow: <path d="m7 17 10-10M7 7h10v10" />,
    down: <path d="m7 7 10 10M7 17h10V7" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 8h18m-6 5h6v4h-6Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.wallet}
    </svg>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="wallet" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Budget used"
      aria-valuenow={Math.round(total ? (value / total) * 100 : 0)}
      aria-valuemin={0}
      aria-valuemax={Math.max(
        100,
        Math.ceil(total ? (value / total) * 100 : 0),
      )}
    >
      <span
        className={value > total ? "over" : ""}
        style={{
          width: `${Math.min(100, total ? (value / total) * 100 : 0)}%`,
        }}
      />
    </div>
  );
}
export function TransactionForm({
  edit,
  data,
  onSubmit,
  onCancel,
}: {
  edit: Transaction | null;
  data: Data;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<Kind>(edit?.kind || "expense");
  return (
    <div className="transaction-layout">
      <section className="panel form-panel">
        <h2>{edit ? "Transaction details" : "Add your money move"}</h2>
        <p className="muted">A few details now. A clearer picture later.</p>
        <form onSubmit={onSubmit}>
          <div className="segmented" role="group" aria-label="Transaction type">
            <button
              type="button"
              className={kind === "expense" ? "selected" : ""}
              onClick={() => setKind("expense")}
              aria-pressed={kind === "expense"}
            >
              ↗ Expense
            </button>
            <button
              type="button"
              className={kind === "income" ? "selected" : ""}
              onClick={() => setKind("income")}
              aria-pressed={kind === "income"}
            >
              ↙ Income
            </button>
          </div>
          <input type="hidden" name="kind" value={kind} />
          <label>
            Description
            <input
              name="title"
              maxLength={100}
              defaultValue={edit?.title}
              placeholder="e.g. Weekly groceries"
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Amount (₹)
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={edit ? edit.amount / 100 : ""}
                placeholder="0.00"
                required
              />
            </label>
            <label>
              Date
              <input
                type="date"
                name="date"
                defaultValue={edit?.date || today()}
                max={today()}
                required
              />
            </label>
          </div>
          <label>
            Category
            <select
              key={kind}
              name="categoryId"
              defaultValue={edit?.kind === kind ? edit.categoryId : ""}
              required
            >
              <option value="" disabled>
                Select a category
              </option>
              {data.categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Note <span className="muted">(optional)</span>
            <textarea
              name="note"
              maxLength={500}
              defaultValue={edit?.note}
              placeholder="Anything you’d like to remember"
              rows={3}
            />
          </label>
          <div className="form-actions">
            <button className="primary" type="submit">
              {edit ? "Save changes" : "Save transaction"}
            </button>
            <button className="secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </section>
      <aside className="transaction-aside">
        <span className="big-symbol">₹</span>
        <h2>
          Little entries.
          <br />
          Bigger perspective.
        </h2>
        <p>
          Recording everyday transactions helps you understand your habits and
          plan ahead.
        </p>
        <div className="aside-line" />
        <small>YOUR RECORDS STAY YOURS</small>
        <p>
          Saved in your local database. Export a backup from Settings whenever
          you need one.
        </p>
      </aside>
    </div>
  );
}
