/**
 * Unit tests for the schema DSL and generators (pure — no DB required).
 * Covers: DSL → IR normalization/validation, IR → schema.sql, IR → types,
 * and table-name → type-name conversion.
 */

import { describe, it, expect } from "vitest";
import {
  defineSchema,
  table,
  col,
  index,
  generateSchemaSqlContent,
  generateDbTypesContent,
  tableNameToTypeName,
} from ".";

const sampleSchema = defineSchema({
  tables: {
    users: table({
      id: col.integer("id").primaryKey().autoIncrement(),
      login: col.text("login").notNull(),
      avatar_url: col.text("avatar_url").nullable(),
      status: col.text("status").check(["draft", "active"]).notNull().default("'draft'"),
      created_at: col.text("created_at").notNull().default("(datetime('now'))"),
    }),
    mice: table({
      id: col.integer("id").primaryKey().autoIncrement(),
      squeak_level: col.integer("squeak_level").notNull(),
    }),
  },
  indexes: {
    idx_users_login: index({ table: "users", columns: ["login"], unique: true }),
    idx_mice_level: index({ table: "mice", columns: ["squeak_level DESC"] }),
  },
});

describe("defineSchema", () => {
  it("normalizes table names from object keys", () => {
    const schema = defineSchema({
      tables: {
        users: table({ id: col.integer("x").primaryKey() }),
      },
    });
    expect(schema.tables[0].name).toBe("users");
    expect(schema.tables[0].columns[0].name).toBe("id");
  });

  it("assigns index names from object keys", () => {
    const schema = defineSchema({
      tables: {
        users: table({ id: col.integer("x").primaryKey() }),
      },
      indexes: {
        idx_u: index({ table: "users", columns: ["id"] }),
      },
    });
    expect(schema.indexes[0].name).toBe("idx_u");
  });

  it("rejects references to unknown tables", () => {
    expect(() =>
      defineSchema({
        tables: {
          users: table({
            id: col.integer("x").primaryKey(),
            friend_id: col.integer("friend_id").references("nope", "id"),
          }),
        },
      }),
    ).toThrow(/unknown table "nope"/);
  });

  it("rejects an empty schema", () => {
    expect(() => defineSchema({ tables: {} })).toThrow(/at least one table/);
  });

  it("rejects a table without columns", () => {
    expect(() => table({})).toThrow(/at least one column/);
  });
});

describe("tableNameToTypeName", () => {
  it("converts plural underscore names to PascalCase singular", () => {
    expect(tableNameToTypeName("tenets")).toBe("Tenet");
    expect(tableNameToTypeName("tenet_options")).toBe("TenetOption");
    expect(tableNameToTypeName("users")).toBe("User");
  });

  it("respects overrides", () => {
    expect(tableNameToTypeName("mice", { mice: "Mouse" })).toBe("Mouse");
  });
});

describe("generateDbTypesContent", () => {
  it("generates model interfaces from the schema", () => {
    const content = generateDbTypesContent(sampleSchema, { mice: "Mouse" });
    expect(content).toContain("export interface User {");
    expect(content).toContain("login: string;");
    expect(content).toContain("avatar_url: string | null;");
    expect(content).toContain("export interface Mouse {");
    expect(content).toContain("squeak_level: number;");
    expect(content).toContain("export interface Database {");
    expect(content).toContain("users: User;");
    expect(content).toContain("mice: Mouse;");
    expect(content).toContain(`declare module "*.sql"`);
  });

  it("emits string unions for CHECK columns", () => {
    const schema = defineSchema({
      tables: {
        votes: table({
          id: col.integer("id").primaryKey(),
          choice: col.text("choice").check(["approve", "abstain", "block"]).notNull(),
        }),
      },
    });
    const content = generateDbTypesContent(schema);
    expect(content).toContain(`choice: "approve" | "abstain" | "block";`);
  });
});

describe("generateSchemaSqlContent", () => {
  it("emits idempotent CREATE TABLE/INDEX statements", () => {
    const sql = generateSchemaSqlContent(sampleSchema);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(sql).toContain('PRIMARY KEY AUTOINCREMENT');
    expect(sql).toContain(`CHECK("status" IN (`);
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_login"');
    expect(sql).toContain('ON "users"("login")');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_mice_level"');
  });

  it("emits FK references with ON DELETE CASCADE", () => {
    const schema = defineSchema({
      tables: {
        users: table({ id: col.integer("id").primaryKey() }),
        posts: table({
          id: col.integer("id").primaryKey(),
          user_id: col
            .integer("user_id")
            .notNull()
            .references("users", "id", { onDelete: "CASCADE" }),
        }),
      },
    });
    const sql = generateSchemaSqlContent(schema);
    expect(sql).toContain(
      'REFERENCES "users"("id") ON DELETE CASCADE',
    );
  });

  it("emits table-level unique constraints", () => {
    const schema = defineSchema({
      tables: {
        votes: table(
          {
            id: col.integer("id").primaryKey(),
            tenet_id: col.integer("tenet_id").notNull(),
            user_id: col.integer("user_id").notNull(),
          },
          { unique: [["tenet_id", "user_id"]] },
        ),
      },
    });
    const sql = generateSchemaSqlContent(schema);
    expect(sql).toContain('UNIQUE("tenet_id", "user_id")');
  });
});