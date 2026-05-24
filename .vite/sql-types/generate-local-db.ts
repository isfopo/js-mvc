/**
 * Generate a local SQLite database from migration files.
 *
 * Creates `local.db` in the project root by running all migration SQL
 * files through sqlite3. This file can be opened in DB Browser for SQLite
 * or TablePlus for schema reference while editing .sql files.
 */

import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generate local.db from all migration SQL files.
 * Returns true if successful, false if sqlite3 is not available or an error occurred.
 */
export function generateLocalDb(
  migrationsDir: string,
  dbPath: string = "local.db",
): boolean {
  // Check if sqlite3 is available (cross-platform: try running --version)
  try {
    execFileSync("sqlite3", ["--version"], { stdio: "pipe" });
  } catch {
    console.warn("⚠ sqlite3 not found — skipping local.db generation");
    return false;
  }

  try {
    // Remove stale db so migrations run clean
    if (existsSync(dbPath)) unlinkSync(dbPath);

    // Read and concatenate all migration SQL files in order
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.warn("⚠ No migration files found in", migrationsDir);
      return false;
    }

    const allSql = files
      .map((f) => readFileSync(join(migrationsDir, f), "utf-8"))
      .join("\n");

    // Pipe the combined SQL into sqlite3 (use execFileSync to avoid shell injection)
    execFileSync("sqlite3", [dbPath], {
      input: allSql,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return true;
  } catch (e) {
    const err = e as { message?: string; stderr?: Buffer };
    const stderr = err.stderr?.toString().trim();
    const detail = stderr ? `\n  sqlite3: ${stderr}` : "";
    console.warn(`⚠ Could not generate local.db: ${err.message ?? e}${detail}`);
    return false;
  }
}
