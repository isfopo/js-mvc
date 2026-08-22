# TypeScript Schema as Source of Truth

## Status

Implemented on the `ts-to-sql` branch (Aug 2026):

- `schemaPlugin` generates `db-types.d.ts`, a derived `schema.sql`
  (gitignored), and the runtime schema module from `src/domains/schema.ts`.
- `applySchema()` reconciles the live D1 DB against the desired state
  (add/rename/rebuild/index sync) on first request; the additive-only
  `applySql` schema path is gone.
- `sqlTypesPlugin` query barrels key off the generated schema module;
  the SQL-parse→types path and the `local.db` generator are removed.
- DSL unit tests (12) and reconciliation tests against a real D1 pool
  binding (5) pass — 106 total. Dev-seed smoke test is the remaining
  verification item.

## Problem

Today the database schema is defined *twice*, in two different directions:

1. `src/migrations/schema.sql` is the hand-written **source of truth**.
2. `sqlTypesPlugin` **parses that SQL** at build time to generate
   `src/domains/db-types.d.ts` (model interfaces) and a `local.db`.
3. The Worker imports `schema.sql?raw` and applies it lazily at first request
   via `applySql()` (`CREATE TABLE IF NOT EXISTS`, additive only).

This has several pain points:

- **SQL is the source of truth**, so there's no type-level enforcement of the
  schema when authoring it — errors surface only at runtime/parse time.
- **Additive-only** — `schema.sql` can never drop/rename/rettype a column, so
  evolving a live DB to a new schema shape is impossible without hand-writing
  manual migration SQL steps.
- **Model types are a parse byproduct** — the editor can't give you
  autocomplete/type-safety when writing the schema.

## Goal

Flip the source of truth to **TypeScript**. A single TS schema definition:

- is the authoritative description of tables, columns, indexes, constraints;
- generates **model interfaces** (`db-types.d.ts`) so models always match;
- compiles to a **runtime schema program** that the Worker applies lazily,
  reconciling the *live* DB against the desired state and emitting the needed
  DDL — including automated table-rebuilds for changes SQLite can't do in
  place;
- optionally emits a **static `schema.sql`** for `local.db` tooling and manual
  `wrangler d1 execute` use.

No sequential migrations. One evolving definition that can update a DB in
place.

## Design decisions (confirmed with user)

| Decision | Choice |
|---|---|
| Update strategy | **Reconciliation layer** (diff live DB via `PRAGMA`, emit targeted DDL) |
| Apply mechanism | **Lazy runtime in Worker** (keep current `applySql()` pattern) |
| Destructive DDL | **Auto table-rebuild** (CREATE-new → copy → DROP-old → RENAME) |
| Model types | **TS defines schema + models** (replaces SQL-parse→types path) |

> **Consequence (important):** A static `.sql` file cannot do reconciliation —
> the target DDL depends on the live DB's current state. Therefore the primary
> generated artifact is a **runtime schema program** (a function/module), not a
> static SQL file. The static `schema.sql` is kept only as a *derived*,
> convenience output.

## Current pipeline (for reference)

```
src/migrations/schema.sql  ──sqlTypesPlugin─▶  src/domains/db-types.d.ts
      │  (import ?raw)                            + local.db
      ▼
 src/index.tsx  ── applySql() on first request ─▶  D1
```

Consumers of `schema.sql`:
- `src/index.tsx` (runtime apply, `import schemaSql from "./migrations/schema.sql?raw"`)
- `sqlTypesPlugin` (parses to types + `local.db`)
- `package/plugins/sql-types/generate-local-db.ts` (`local.db` for SQL tools)

## Proposed pipeline

```
src/domains/schema.ts  (TS source of truth — declarative schema DSL)
   │
   ├─▶ (build)  generateDbTypes        ─▶ src/domains/db-types.d.ts   (model interfaces)
   ├─▶ (build)  generateSchemaSql      ─▶ src/migrations/schema.sql  (derived, for tooling)
   └─▶ (build)  compileSchemaProgram   ─▶ src/.generated/schema.ts    (desired-state IR, inlined)
                                                    │
                          snapshot import ?raw (schema.sql) ── optional fallback
                                                    ▼
                     Runtime:  applySchema(db, desiredState)  ──lazy in Worker──▶ D1
```

## Module layout (new framework code in `package/src`)

All new code lives in the framework (`package/`), imported via `js-mvc/*`
aliases, mirroring the existing plugin architecture.

### 1. Schema DSL — `package/src/schema/`

Declarative, type-safe descriptions of a SQLite schema.

```ts
// src/domains/schema.ts
export const schema = defineSchema({
  tables: {
    users: table({
      id: col.integer().primaryKey().autoIncrement(),
      github_id: col.integer().notNull().unique(),
      login: col.text().notNull(),
      avatar_url: col.text().nullable(),
      name: col.text().nullable(),
      created_at: col.text().notNull().default("(datetime('now'))"),
    }),
    tenets: table({
      id: col.integer().primaryKey().autoIncrement(),
      title: col.text().notNull(),
      slug: col.text().notNull().unique(),
      status: col
        .text()
        .check(["draft","voting","accepted","rejected","implemented","superseded"])
        .notNull()
        .default("'draft'"),
      proposed_by_id: col.integer().notNull().references("users", "id"),
      superseded_by_id: col.integer().references("tenets", "id"),
    }),
    // ...
  },
  indexes: {
    idx_tenets_slug: index({ table: "tenets", columns: ["slug"], unique: true }),
    idx_votes_tenet: index({ table: "votes", columns: ["tenet_id"] }),
  },
});
```

The DSL produces a **desired-state IR** (`SchemaDef`):

```ts
interface SchemaDef {
  tables: Record<string, TableDef>;
  indexes: Record<string, IndexDef>;
}
interface TableDef {
  name: string;
  columns: ColumnDef[];
}
interface ColumnDef {
  name: string;
  sqliteType: "INTEGER" | "TEXT" | "REAL" | "BLOB";
  notNull: boolean;
  primaryKey: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  default?: string;
  checkValues?: string[];
  references?: { table: string; column: string; onDelete?: string };
  /** If this column was renamed from an older name, the previous name — used
   *  by the rebuild path to map old data to the new column. Without it, a
   *  rename is indistinguishable from add+drop and risks data loss. */
  renamedFrom?: string;
}
interface IndexDef {
  table: string;
  columns: string[];      // supports ["created_at DESC"] style
  unique?: boolean;
}
```

**Design intent (matches the user's API taste):** the DSL is declarative,
self-describing, and keeps to the least boilerplate — a column's constraints
are expressed as chained modifers rather than raw SQL strings.

### 2. Compiler / Plugin — `package/plugins/`

A Vite plugin (`schemaPlugin` or an extension of `sqlTypesPlugin`) runs at
build time and:

- Imports the app's `src/domains/schema.ts` (via `tsx`/esbuild-transpile + eval
  or a direct import in the plugin process), producing the `SchemaDef` IR.
- `generateDbTypes(schema)` → writes `src/domains/db-types.d.ts`.
  Reuses/adapts the existing singularization + nullability logic from
  `generate-db-types.ts`, but driven by the **TS schema** instead of parsed
  SQL. Table name → PascalCase via `tableNameToTypeName`.
- `generateSchemaSql(schema)` → writes `src/migrations/schema.sql` (derived,
  additive bootstrap: `CREATE TABLE IF NOT EXISTS` … `CREATE INDEX IF NOT
  EXISTS`), for external tooling / `local.db` / manual `wrangler d1 execute`.
- Emits `src/.generated/schema.ts` — a module that re-exports the desired-state
  `SchemaDef` (a serialized constant) so the runtime can bundle it.

### 3. Runtime reconcile + apply — `package/src/data/`

A new `applySchema(db, desired: SchemaDef)` replacing the additive-only
`applySql()`. It runs lazily in the Worker (as today) and:

1. **Introspect** the live DB: `PRAGMA table_info(<t>)`,
   `PRAGMA index_list(<t>)`, `PRAGMA index_info(<ix>)`, and column static
   info via `PRAGMA table_xinfo` where available.
2. **Compute the diff** between live state and `SchemaDef`:
   - table exists / missing → `CREATE TABLE IF NOT EXISTS`
   - column adds → `ALTER TABLE … ADD COLUMN` (must satisfy SQLite add-column
     rules; nullable/default only unless PHP-style rebuild)
   - column type/nullability/constraint changes & renames → **table rebuild**
   - index adds/get removed → `CREATE INDEX IF NOT EXISTS` / `DROP INDEX`
   - unique/check changes → table rebuild (cannot ALTER)
3. **Emit ordered DDL**, wrapped in a transaction where D1 permits, each
   statement individually via `db.prepare(...).run()`.

**Auto table-rebuild (`rebuildTable`):** for changes SQLite can't apply in
place (rename column, drop constraint, type change, CHECK change):

```
CREATE TABLE <name>__new (<new-def>);
INSERT INTO <name>__new (<cols>) SELECT <cols> FROM <name>;
DROP TABLE <name>;
ALTER TABLE <name>__new RENAME TO <name>;
-- recreate indexes / FKs referencing the table
```

Renames use the declared `ColumnDef` ordering when mapping old→new; if a table
is renamed we treat it as add (no rename tracking). The rebuild is emitted only
when the diff actually requires it — an unmodified table is untouched.

### 4. Wiring — `src/index.tsx`

Replace

```ts
import schemaSql from "./migrations/schema.sql?raw";
await applySql(env.DB, schemaSql);
```

with

```ts
import { applySchema } from "js-mvc/data/applySchema";
import { schemaDef } from "./.generated/schema";
// ...
await applySchema(env.DB, schemaDef);
```

Seed flow (`clearSeedData` + seed in DEV) is unchanged. If we keep a
`schema.sql` fallback for manual/`wrangler` use, it is *derived*, not the
runtime input.

## SQL type → TS type mapping (unchanged behavior)

Reuse `sqliteTypeToTs` / `columnToTsType` from `generate-db-types.ts`:
- INTEGER → `number`; TEXT → `string`; REAL → `number`; BLOB → `ArrayBuffer`
- `checkValues` → string union; PK → non-null; absence of NOT NULL → `| null`

The DSL gains the same expressiveness: an enum check column yields a string
union type, matching today's `status: "draft" | "voting" | …`.

## Migration path (delete old path, per user preference)

Following the user's established preference for breaking changes over
compat shims:

- `src/migrations/schema.sql` becomes **derived output** (gitignored, like
  `db-types.d.ts`), regenerated from `src/domains/schema.ts` on build.
- `sqlTypesPlugin`'s SQL-parse→types role is replaced by the TS schema path.
  The `.sql` **query** files (`src/domains/*/queries/*.sql` + `sqlTransformPlugin`)
  are **out of scope and remain** — they're query files, not schema.
- `applySql.ts` is replaced by `applySchema.ts`. `clearSeedData` stays.
- `node-sql-parser` remains for `.sql` query-file validation; the schema plugin
  does not depend on it.

## Scope explicitly excluded

- `.sql` **query** files, `sqlTransformPlugin`, query barrels — unchanged.
- Sequential migration history / versioned migrations table — explicitly *not*
  wanted; one evolving definition.
- Referential-integrity/dependency ordering beyond simple FK creation order
  (bootstrap) — no fan-in topo-sort yet unless needed.
- Any change to the repository/service layer — they keep consuming the
  generated `db-types.d.ts`.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Auto table-rebuild can lose data (rename/rettype mismatch) | Rebuild copies columns by declared order; default to additive for ambiguous cases; require explicit `renamedFrom`/transform map for renames. |
| Reconciliation at runtime adds a hot-path cost on first request | Runs once, guarded by the same `initPromise`/`initialized` flag as today. Diff is cheap (PRAGMA calls). |
| SQLite `ADD COLUMN` restrictions (no PK/UNIQUE/expr default) | Rebuild path handles non-additive changes; additive path only emits SQLite-legal ADD COLUMN. |
| Generated `.sql` drift from the TS source | `.sql` is derived only; it's regenerated on build and gitignored. Runtime never reads it. |
| Destructive DDL on a live prod DB | DDL is additive by default; rebuilds/drops require an explicit schema marker. Deploy gate remains the deploy pipeline. |
| Typegen no longer derives from SQL → possible drift | Single source (TS); types and SQL are both generated from it, eliminating drift. |
| D1 transaction support for multi-statement DDL | Rebuild as individual statements in the init block (D1 supports batched `.batch()`) — confirm at implementation. |

## Verification plan

1. `npm run build` regenerates `db-types.d.ts` from TS (byte-identical to the
   SQL-derived one for the unchanged schema) and regenerates `schema.sql`.
2. `npm run check:type` — no new type errors.
3. Unit tests for the DSL parse → IR, IR → SQL generation, IR → type generation
   (mirror `parse-migrations.test.ts`, now against the TS schema).
4. Runtime reconcile tests against a D1/local SQLite: (a) fresh DB applies full
   schema; (b) additive change (new column) applies without rebuild; (c)
   non-additive change (rename / retype / CHECK change) triggers a rebuild and
   preserves data.
5. Dev-seed smoke test: `npm run dev`, first request initializes + seeds.
6. Keep the diff additive-by-default so an untouched DB is a no-op.

## Resolved decisions

- **DSL ergonomics:** chained **builder** (`col.integer().notNull()`) — chosen
  for readability and to avoid colliding with the existing `ColumnDef` naming.
- **Renames:** explicit `renamedFrom?: string` field on the column. The rebuild
  path maps old→new by this marker; without it, add+drop would be assumed and
  could lose data.
- **Derived `schema.sql`:** moved under the generated/build artifact and
  **gitignored**, alongside `db-types.d.ts`. Regenerated on build; never read
  at runtime.


## Deliverable size note

Full build (per user): DSL + plugin/compiler + runtime reconcile + model
typegen + auto-rebuild + tests + old-path removal, in one end-to-end increment,
with review before delivery.
