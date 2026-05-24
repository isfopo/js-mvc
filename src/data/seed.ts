/**
 * Database seeding for local development.
 *
 * Populates the database with sample users, tenets, options, and votes
 * so the app has meaningful data to display during development.
 *
 * Uses INSERT OR IGNORE so it's safe to call multiple times —
 * existing rows are silently skipped.
 */

import { initDatabase } from "infrastructure/QueryLoader";
import seedSql from "../../migrations/002_seed_data.sql?raw";

/**
 * Seed the database with sample data.
 * Safe to call repeatedly — uses INSERT OR IGNORE for idempotency.
 */
export async function seedDatabase(db: D1Database): Promise<void> {
  await initDatabase(db, seedSql);
}
