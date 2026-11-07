// SQLite via sql.js (WASM) – zero native compilation, persisted to a file on disk.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { Logger } from '../services/Logger';

const require = createRequire(import.meta.url);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  unique_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  cat_id TEXT NOT NULL,
  total_weight REAL NOT NULL DEFAULT 0,
  fish_count INTEGER NOT NULL DEFAULT 0,
  largest_weight REAL NOT NULL DEFAULT 0,
  largest_fish_id TEXT,
  common_count INTEGER NOT NULL DEFAULT 0,
  uncommon_count INTEGER NOT NULL DEFAULT 0,
  rare_count INTEGER NOT NULL DEFAULT 0,
  epic_count INTEGER NOT NULL DEFAULT 0,
  legendary_count INTEGER NOT NULL DEFAULT 0,
  total_gifts INTEGER NOT NULL DEFAULT 0,
  total_diamonds INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS catches (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  fish_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  weight REAL NOT NULL,
  score INTEGER NOT NULL,
  luck REAL NOT NULL,
  session_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catches_player ON catches(player_id);
CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  gift_name TEXT NOT NULL,
  diamonds INTEGER NOT NULL,
  count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);
`;

export type Row = Record<string, SqlValue>;

/** Adds columns introduced after the first release to existing database files. */
function migrate(database: Database) {
  const cols = database.exec('PRAGMA table_info(players)')[0]?.values.map((v) => String(v[1])) ?? [];
  if (!cols.includes('luck_override')) database.exec('ALTER TABLE players ADD COLUMN luck_override REAL');
}

export class Db {
  private dirty = false;
  private timer: NodeJS.Timeout | null = null;

  private constructor(private db: Database, private file: string | null) {}

  static async open(file: string | null, saveIntervalMs = 3000): Promise<Db> {
    const wasmDir = path.dirname(require.resolve('sql.js'));
    const SQL = await initSqlJs({ locateFile: (f: string) => path.join(wasmDir, f) });
    let database: Database;
    if (file && fs.existsSync(file)) {
      database = new SQL.Database(fs.readFileSync(file));
      Logger.info(`Database loaded: ${file}`);
    } else {
      database = new SQL.Database();
      if (file) Logger.info(`Database created: ${file}`);
    }
    database.exec(SCHEMA);
    migrate(database);
    const db = new Db(database, file);
    if (file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      db.timer = setInterval(() => db.flush(), saveIntervalMs);
      db.dirty = true;
      db.flush();
    }
    return db;
  }

  run(sql: string, params: SqlValue[] = []) {
    this.db.run(sql, params);
    this.dirty = true;
  }

  all(sql: string, params: SqlValue[] = []): Row[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: Row[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as Row);
      return rows;
    } finally {
      stmt.free();
    }
  }

  get(sql: string, params: SqlValue[] = []): Row | undefined {
    return this.all(sql, params)[0];
  }

  transaction(fn: () => void) {
    this.db.exec('BEGIN');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    this.dirty = true;
  }

  flush() {
    if (!this.file || !this.dirty) return;
    try {
      const data = this.db.export();
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, Buffer.from(data));
      fs.renameSync(tmp, this.file);
      this.dirty = false;
    } catch (e) {
      Logger.error(`Database save failed: ${(e as Error).message}`);
    }
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    this.flush();
    this.db.close();
  }
}
