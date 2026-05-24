import { describe, it, expect } from "vitest";
import { parseMigrations } from "./parse-migrations";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parseMigrations", () => {
  const testDir = join(tmpdir(), "parse-migrations-test-" + Date.now());

  async function setup(files: Record<string, string>) {
    await mkdir(testDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(testDir, name), content, "utf-8");
    }
  }

  async function cleanup() {
    await rm(testDir, { recursive: true, force: true });
  }

  it("parses simple CREATE TABLE", async () => {
    await setup({
      "001_test.sql": `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT
        );
      `,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns).toHaveLength(3);
    expect(tables[0].columns[0]).toMatchObject({
      name: "id",
      sqliteType: "INTEGER",
      isPrimaryKey: true,
    });
    expect(tables[0].columns[1]).toMatchObject({
      name: "name",
      sqliteType: "TEXT",
      notNull: true,
    });
    expect(tables[0].columns[2]).toMatchObject({
      name: "email",
      sqliteType: "TEXT",
      notNull: false,
    });
  });

  it("parses CHECK constraints with IN clause", async () => {
    await setup({
      "001_test.sql": `
        CREATE TABLE tenets (
          id INTEGER PRIMARY KEY,
          status TEXT NOT NULL CHECK(status IN ('draft','voting','accepted'))
        );
      `,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    expect(tables[0].columns[1].checkValues).toEqual([
      "draft",
      "voting",
      "accepted",
    ]);
  });

  it("handles multi-line CREATE TABLE", async () => {
    await setup({
      "001_test.sql": `
        CREATE TABLE users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            github_id       INTEGER NOT NULL UNIQUE,
            login           TEXT NOT NULL,
            avatar_url      TEXT,
            name            TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            last_login_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toHaveLength(7);
  });

  it("skips table-level constraints", async () => {
    await setup({
      "001_test.sql": `
        CREATE TABLE votes (
          id INTEGER PRIMARY KEY,
          tenet_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          UNIQUE(tenet_id, user_id)
        );
      `,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    // Should only have 3 columns, not the UNIQUE constraint
    expect(tables[0].columns).toHaveLength(3);
  });

  it("handles IF NOT EXISTS", async () => {
    await setup({
      "001_test.sql": `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          name TEXT
        );
      `,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
  });

  it("ignores DROP TABLE and ALTER TABLE", async () => {
    await setup({
      "001_test.sql": `
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        DROP TABLE old_users;
        ALTER TABLE users ADD COLUMN email TEXT;
      `,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
  });

  it("processes migrations in sorted order", async () => {
    await setup({
      "002_second.sql": `CREATE TABLE posts (id INTEGER PRIMARY KEY);`,
      "001_first.sql": `CREATE TABLE users (id INTEGER PRIMARY KEY);`,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    expect(tables).toHaveLength(2);
    expect(tables[0].name).toBe("users");
    expect(tables[1].name).toBe("posts");
  });

  it("deduplicates tables across migrations", async () => {
    await setup({
      "001_first.sql": `CREATE TABLE users (id INTEGER PRIMARY KEY);`,
      "002_second.sql": `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);`,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    // Should only have the first definition
    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toHaveLength(1);
  });

  it("handles comments in SQL", async () => {
    await setup({
      "001_test.sql": `
        -- This is a comment
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          -- Another comment
          name TEXT NOT NULL
        );
      `,
    });

    const tables = await parseMigrations(testDir);
    await cleanup();

    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toHaveLength(2);
  });
});
