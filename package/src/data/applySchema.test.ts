/**
 * applySchema reconciliation tests against a real D1 binding (the actual
 * runtime target) via the Cloudflare Workers vitest pool.
 *
 * Verifies the core behavior:
 *   - fresh DB  → full schema applied (and idempotent)
 *   - additive  → new column added in place, data preserved
 *   - rename    → renamedFrom maps old column, data preserved
 *   - change    → auto table-rebuild, data preserved
 *   - indexes   → created / dropped to match desired state
 */

import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import { applySchema } from "./applySchema";
import { defineSchema, table, col, index } from "../schema";
import type { SchemaDef } from "../schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Drop every non-internal table so each test starts from a clean DB. */
async function resetDb(): Promise<void> {
  const tables = (
    await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
    ).all<{ name: string }>()
  ).results;
  for (const t of tables) {
    await env.DB.prepare(`DROP TABLE IF EXISTS "${t.name}"`).run();
  }
}

async function scalar<T>(sql: string): Promise<T> {
  const row = await env.DB.prepare(sql).first();
  const values = row as Record<string, T>;
  return values[Object.keys(values)[0]];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseSchema = defineSchema({
  tables: {
    users: table({
      id: col.integer("id").primaryKey().autoIncrement(),
      login: col.text("login").notNull(),
      name: col.text("name").nullable(),
    }),
    posts: table({
      id: col.integer("id").primaryKey().autoIncrement(),
      user_id: col.integer("user_id").notNull().references("users", "id"),
      title: col.text("title").notNull(),
    }),
  },
  indexes: {
    idx_posts_user: index({ table: "posts", columns: ["user_id"] }),
    idx_posts_title: index({ table: "posts", columns: ["title"], unique: true }),
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applySchema", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates the full schema on a fresh database and is idempotent", async () => {
    await applySchema(env.DB, baseSchema);

    const tableCount = await scalar<number>(
      `SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
    );
    expect(tableCount).toBe(2);

    const cols = (
      await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>()
    ).results.map((c) => c.name);
    expect(cols).toEqual(["id", "login", "name"]);

    const foreignKeys = (
      await env.DB.prepare("PRAGMA foreign_key_list(posts)").all<{
        table: string;
        from: string;
      }>()
    ).results;
    expect(foreignKeys[0]).toMatchObject({ table: "users", from: "user_id" });

    const idxNames = (
      await env.DB.prepare("PRAGMA index_list(posts)").all<{ name: string }>()
    ).results.map((i) => i.name);
    expect(idxNames).toContain("idx_posts_user");
    expect(idxNames).toContain("idx_posts_title");

    // Idempotent — a second apply is a no-op (no new tables, no errors).
    await applySchema(env.DB, baseSchema);
    const count2 = await scalar<number>(
      `SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
    );
    expect(count2).toBe(2);
  });

  it("adds a new column in place and preserves data", async () => {
    await applySchema(env.DB, baseSchema);
    await env.DB.prepare(
      `INSERT INTO users (login, name) VALUES ('alice', 'Alice')`,
    ).run();

    const next = defineSchema({
      tables: {
        users: table({
          id: col.integer("id").primaryKey().autoIncrement(),
          login: col.text("login").notNull(),
          name: col.text("name").nullable(),
          email: col.text("email").nullable(),
        }),
        posts: baseSchema.tables.find((t) => t.name === "posts")!,
      },
      indexes: baseSchema.indexes,
    });

    await applySchema(env.DB, next);

    const cols = (
      await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>()
    ).results.map((c) => c.name);
    expect(cols).toContain("email");

    const login = await scalar<string>(`SELECT login AS login FROM users`);
    expect(login).toBe("alice");
  });

  it("renames a column via renamedFrom and preserves data", async () => {
    await applySchema(env.DB, baseSchema);
    await env.DB.prepare(
      `INSERT INTO users (login, name) VALUES ('bob', 'Bob')`,
    ).run();

    const next = defineSchema({
      tables: {
        users: table({
          id: col.integer("id").primaryKey().autoIncrement(),
          username: col.text("username").notNull().renamedFrom("login"),
          name: col.text("name").nullable(),
        }),
        posts: baseSchema.tables.find((t) => t.name === "posts")!,
      },
      indexes: baseSchema.indexes,
    });

    await applySchema(env.DB, next);

    const cols = (
      await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>()
    ).results.map((c) => c.name);
    expect(cols).toEqual(["id", "username", "name"]);

    const username = await scalar<string>(
      `SELECT username AS username FROM users`,
    );
    expect(username).toBe("bob");
  });

  it("rebuilds a table for a constraint change and preserves data", async () => {
    await applySchema(env.DB, baseSchema);
    await env.DB.prepare(
      `INSERT INTO users (login, name) VALUES ('carol', 'Carol')`,
    ).run();

    // name: nullable → NOT NULL (not addable/renameable in place → rebuild).
    const next = defineSchema({
      tables: {
        users: table({
          id: col.integer("id").primaryKey().autoIncrement(),
          login: col.text("login").notNull(),
          name: col.text("name").notNull(),
        }),
        posts: baseSchema.tables.find((t) => t.name === "posts")!,
      },
      indexes: baseSchema.indexes,
    });

    await applySchema(env.DB, next);

    const cols = (
      await env.DB.prepare("PRAGMA table_info(users)").all<{
        name: string;
        notnull: number;
      }>()
    ).results;
    expect(cols.find((c) => c.name === "name")?.notnull).toBe(1);

    // Data survives the rebuild.
    const login = await scalar<string>(`SELECT login AS login FROM users`);
    expect(login).toBe("carol");
  });

  it("creates missing indexes and drops extra ones", async () => {
    await applySchema(env.DB, baseSchema);
    await env.DB.prepare(`CREATE INDEX idx_legacy_extra ON users(login)`).run();

    const next: SchemaDef = {
      tables: baseSchema.tables,
      indexes: [
        baseSchema.indexes.find((i) => i.name === "idx_posts_title")!,
        { name: "idx_posts_title2", table: "posts", columns: ["title"] },
      ],
    };

    await applySchema(env.DB, next);

    const postIdx = (
      await env.DB.prepare("PRAGMA index_list(posts)").all<{ name: string }>()
    ).results.map((i) => i.name);
    expect(postIdx).toContain("idx_posts_title");
    expect(postIdx).not.toContain("idx_posts_user");

    const userIdx = (
      await env.DB.prepare("PRAGMA index_list(users)").all<{ name: string }>()
    ).results.map((i) => i.name);
    expect(userIdx).not.toContain("idx_legacy_extra");
  });
});