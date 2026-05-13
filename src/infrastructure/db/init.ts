/**
 * Database initialization — runs the D1 schema migration at startup.
 *
 * In production this is handled by `wrangler d1 migrations apply`.
 * For local dev, we run it on first load to ensure tables exist.
 */

import schemaSql from "../../data/init.sql?raw";

/**
 * Apply the schema migration. Safe to call multiple times (uses IF NOT EXISTS).
 * Strips SQL comments (single-line --) then splits on semicolons and executes
 * each statement individually.
 */
export async function initDatabase(db: D1Database): Promise<void> {
  // Remove single-line comments (--) before splitting on semicolons,
  // so that semicolons appearing inside comments don't create empty statements.
  const noComments = schemaSql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  const statements = noComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}
