/**
 * Database initialization — runs the D1 schema migration at startup.
 *
 * In production this is handled by `wrangler d1 migrations apply`.
 * For local dev, we run it on first load to ensure tables exist.
 */

const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS users (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "github_id INTEGER NOT NULL UNIQUE, " +
    "login TEXT NOT NULL, " +
    "avatar_url TEXT, " +
    "name TEXT, " +
    "created_at TEXT NOT NULL DEFAULT (datetime('now')), " +
    "last_login_at TEXT NOT NULL DEFAULT (datetime('now'))" +
  ")",

  "CREATE TABLE IF NOT EXISTS tenets (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "title TEXT NOT NULL, " +
    "slug TEXT NOT NULL UNIQUE, " +
    "status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','voting','accepted','rejected','implemented','superseded')), " +
    "context TEXT NOT NULL, " +
    "decision TEXT, " +
    "rationale TEXT, " +
    "proposed_by_id INTEGER NOT NULL REFERENCES users(id), " +
    "created_at TEXT NOT NULL DEFAULT (datetime('now')), " +
    "updated_at TEXT NOT NULL DEFAULT (datetime('now')), " +
    "superseded_by_id INTEGER REFERENCES tenets(id)" +
  ")",

  "CREATE TABLE IF NOT EXISTS tenet_options (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "tenet_id INTEGER NOT NULL REFERENCES tenets(id) ON DELETE CASCADE, " +
    "title TEXT NOT NULL, " +
    "description TEXT, " +
    "pros TEXT, " +
    "cons TEXT, " +
    "sort_order INTEGER NOT NULL" +
  ")",

  "CREATE TABLE IF NOT EXISTS votes (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "tenet_id INTEGER NOT NULL REFERENCES tenets(id) ON DELETE CASCADE, " +
    "user_id INTEGER NOT NULL REFERENCES users(id), " +
    "choice TEXT NOT NULL CHECK(choice IN ('approve','abstain','block')), " +
    "reason TEXT, " +
    "created_at TEXT NOT NULL DEFAULT (datetime('now')), " +
    "updated_at TEXT NOT NULL DEFAULT (datetime('now')), " +
    "UNIQUE(tenet_id, user_id)" +
  ")",

  "CREATE UNIQUE INDEX IF NOT EXISTS idx_tenets_slug ON tenets(slug)",
  "CREATE INDEX IF NOT EXISTS idx_tenets_status ON tenets(status)",
  "CREATE INDEX IF NOT EXISTS idx_votes_tenet ON votes(tenet_id)",
  "CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_options_tenet ON tenet_options(tenet_id)",
];

/**
 * Apply the schema migration. Safe to call multiple times (uses IF NOT EXISTS).
 */
export async function initDatabase(db: D1Database): Promise<void> {
  for (const sql of STATEMENTS) {
    await db.prepare(sql).run();
  }
}
