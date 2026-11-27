import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fresh, validateData } from '../src/model.ts';

export class ConflictError extends Error {}

export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;`);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 1) { db.close(); throw Error('Database version is newer than this app.'); }
  db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS workspace (
      id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0),
      name TEXT NOT NULL, email TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
      color TEXT NOT NULL, UNIQUE(id,kind)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0 AND amount<=10000000000),
      kind TEXT NOT NULL CHECK(kind IN ('income','expense')), categoryId TEXT NOT NULL,
      date TEXT NOT NULL, note TEXT NOT NULL,
      FOREIGN KEY(categoryId,kind) REFERENCES categories(id,kind) ON DELETE RESTRICT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS budgets (
      month TEXT NOT NULL, categoryId TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      amount INTEGER NOT NULL CHECK(amount>0 AND amount<=10000000000), PRIMARY KEY(month,categoryId)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS transactions_category_date ON transactions(categoryId,date);
    PRAGMA user_version=1;
    COMMIT;
  `);
  const categoryInsert = db.prepare('INSERT INTO categories VALUES (?,?,?,?)');
  const transactionInsert = db.prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?)');
  const budgetInsert = db.prepare('INSERT INTO budgets VALUES (?,?,?)');
  function insertRows(data) {
    for (const c of data.categories) categoryInsert.run(c.id,c.name,c.kind,c.color);
    for (const t of data.transactions) transactionInsert.run(t.id,t.title,t.amount,t.kind,t.categoryId,t.date,t.note);
    for (const b of data.budgets) budgetInsert.run(b.month,b.categoryId,b.amount);
  }
  if (!db.prepare('SELECT id FROM workspace').get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO workspace VALUES (1,0,?,?)').run('','');
      insertRows(fresh()); db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); db.close(); throw e; }
  }
  function snapshot() {
    const {revision,name,email} = db.prepare('SELECT * FROM workspace WHERE id=1').get();
    return {revision, data: {version:1, profile:{name,email},
      categories:db.prepare('SELECT * FROM categories ORDER BY rowid').all(),
      transactions:db.prepare('SELECT * FROM transactions ORDER BY rowid').all(),
      budgets:db.prepare('SELECT * FROM budgets ORDER BY rowid').all()}};
  }
  return {
    read() {
      db.exec('BEGIN');
      try { const result=snapshot(); db.exec('COMMIT'); return result; }
      catch(e) { db.exec('ROLLBACK'); throw e; }
    },
    save(input, revision) {
      const data = validateData(input);
      if (!Number.isSafeInteger(revision) || revision<0) throw Error('Invalid revision.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const current=db.prepare('SELECT revision FROM workspace WHERE id=1').get().revision;
        if (current!==revision) throw new ConflictError('Another tab changed your records. Reload saved data before trying again.');
        // One atomic workspace replacement also supports backup restore/reset.
        db.exec('DELETE FROM transactions; DELETE FROM budgets; DELETE FROM categories;');
        insertRows(data);
        db.prepare('UPDATE workspace SET revision=revision+1,name=?,email=? WHERE id=1').run(data.profile.name,data.profile.email);
        const result=snapshot(); db.exec('COMMIT'); return result;
      } catch(e) { db.exec('ROLLBACK'); throw e; }
    },
    close() { db.close(); }
  };
}
