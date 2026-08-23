/**
 * applySchema — reconcile a live SQLite/D1 database against a TypeScript
 * SchemaDef. Runs lazily in the Worker (replacing the additive-only applySql).
 *
 * The desired state is the SchemaDef (also the source of model types). We read
 * the live schema via PRAGMA and emit *only* the DDL needed to converge:
 *
 *   - missing table            → CREATE TABLE
 *   - missing, add-legal column→ ALTER TABLE ADD COLUMN
 *   - renamed column (renamedFrom)→ ALTER TABLE RENAME COLUMN (in place)
 *   - type / NOT NULL / PK / default change, or column drop
 *                              → auto table-rebuild (CREATE-new → copy → DROP → RENAME)
 *   - missing index            → CREATE INDEX; extra index → DROP INDEX
 *
 * Destructive operations (rebuilds, drops) run only when the diff truly
 * requires them; an identical schema is a no-op.
 *
 * KNOWN LIMITATION: PRAGMA table_info does not report CHECK / UNIQUE / FK
 * constraint bodies. Constraint edits on an existing table are therefore not
 * detected here — they require an explicit drop or a schema marker. Type,
 * nullability, PK and default changes ARE detected.
 */

import type { Database } from "../types";
import type {
  SchemaDef,
  TableDef,
  ColumnDef,
} from "../schema/schema-def";
import {
  quoteIdent,
  renderColumnDef,
  renderCreateTable,
  renderCreateIndex,
  renderAddColumn,
  renderRenameColumn,
  renderDropIndex,
} from "../schema/ddl";

/** A column as reported by `PRAGMA table_info`. */
interface LiveColumn {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  default: string | null;
}

interface LiveTable {
  exists: boolean;
  columns: LiveColumn[];
}

interface TableIndex {
  name: string;
}

interface TableProperties extends TableIndex {
  cid: number;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

// ---------------------------------------------------------------------------
// Introspection
// ---------------------------------------------------------------------------

/** Read `PRAGMA table_info(<table>)` for a single table. */
async function tableInfo(db: Database, table: string): Promise<LiveColumn[]> {
  const res = await db
    .prepare(`PRAGMA table_info(${quoteIdent(table)})`)
    .all<TableProperties>();
  return (res.results ?? []).map((r) => ({
    name: r.name,
    type: (r.type ?? "").toUpperCase(),
    notNull: r.notnull === 1,
    pk: r.pk > 0,
    default: r.dflt_value ?? null,
  }));
}

/** Read the list of indexes on a table via `PRAGMA index_list`. */
async function liveIndexes(
  db: Database,
  table: string,
): Promise<TableIndex[]> {
  const res = await db
    .prepare(`PRAGMA index_list(${quoteIdent(table)})`)
    .all<TableIndex>();
  return res.results ?? [];
}

// ---------------------------------------------------------------------------
// Reconciliation helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a DEFAULT expression for comparison. SQLite stores the expression
 * text with one level of grouping parens stripped (e.g. `(datetime('now'))` →
 * `datetime('now')`), so both sides must be normalized before comparing —
 * otherwise every boot sees a difference and rebuilds the table forever.
 */
function normalizeDefault(value: string | null): string | null {
  if (value === null) return null;
  let s = value.trim();
  while (s.startsWith("(") && s.endsWith(")")) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Does a desired column reconcile cleanly against an identically-named live column? */
function columnMatches(
  desired: ColumnDef,
  live: LiveColumn,
): boolean {
  if (desired.sqliteType.toUpperCase() !== live.type) return false;
  if (desired.notNull !== live.notNull) return false;
  if (desired.primaryKey !== live.pk) return false;
  // Defaults: normalize null/undefined and parenthesization before comparing.
  if (normalizeDefault(desired.default ?? null) !== normalizeDefault(live.default)) return false;
  return true;
}

/** Is a column legal to add via ALTER TABLE ADD COLUMN (per SQLite rules)? */
function isAddLegal(col: ColumnDef): boolean {
  // Cannot add a column with PRIMARY KEY, UNIQUE, or AUTOINCREMENT.
  if (col.primaryKey || col.unique || col.autoIncrement) return false;
  // A NOT NULL column may only be added if it has a non-NULL default.
  if (col.notNull && col.default === undefined) return false;
  return true;
}

/**
 * Determine the rebuild target name. Column renames are mapped via renamedFrom;
 * this returns an ordered projection of desired columns onto source (live)
 * columns for data copying, using the live column name for the SELECT source
 * and the desired name for the INSERT target.
 */
interface CopyPair {
  source: string;
  target: string;
}

function buildCopyPairs(
  table: TableDef,
  live: Record<string, LiveColumn>,
): CopyPair[] {
  const pairs: CopyPair[] = [];
  for (const col of table.columns) {
    if (live[col.name]) {
      pairs.push({ source: col.name, target: col.name });
    } else if (col.renamedFrom && live[col.renamedFrom]) {
      pairs.push({ source: col.renamedFrom, target: col.name });
    }
    // New columns with no source are left to their DEFAULT in the new table.
  }
  return pairs;
}

function renderTableRebuild(
  table: TableDef,
  liveCols: LiveColumn[],
): string[] {
  const liveMap: Record<string, LiveColumn> = {};
  for (const lc of liveCols) liveMap[lc.name] = lc;

  const tempName = `${table.name}__new`;
  const pairs = buildCopyPairs(table, liveMap);

  const sql: string[] = [];

  // 0. Clear a stale staging table from an interrupted previous rebuild —
  //    otherwise a wedged boot (CREATE ... already exists) can never recover.
  sql.push(`DROP TABLE IF EXISTS ${quoteIdent(tempName)};`);

  // 1. Create the new table with the desired definition.
  sql.push(renderCreateTable({ ...table, name: tempName }, false));

  // 2. Copy data for columns that map from an existing live column.
  if (pairs.length > 0) {
    const cols = pairs
      .map((p) => `${quoteIdent(p.source)} AS ${quoteIdent(p.target)}`)
      .join(", ");
    sql.push(
      `INSERT INTO ${quoteIdent(tempName)} (${pairs.map((p) => quoteIdent(p.target)).join(", ")}) SELECT ${cols} FROM ${quoteIdent(table.name)};`,
    );
  }

  // 3. Drop the old table and rename the new one into place.
  sql.push(`DROP TABLE ${quoteIdent(table.name)};`);
  sql.push(`ALTER TABLE ${quoteIdent(tempName)} RENAME TO ${quoteIdent(table.name)};`);

  return sql;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/** Reconcile and apply a SchemaDef against the live DB. */
export async function applySchema(
  db: Database,
  schema: SchemaDef,
): Promise<void> {
  const feed = (sql: string) => db.prepare(sql).run();

  // 1. Tables (in declaration order — referenced tables should come first).
  for (const table of schema.tables) {
    const live = await tableInfo(db, table.name);

    if (live.length === 0) {
      // Table does not exist → bootstrap it fully.
      await feed(renderCreateTable(table, true));
      continue;
    }

    const liveMap: Record<string, LiveColumn> = {};
    for (const lc of live) liveMap[lc.name] = lc;

    let needRebuild = false;
    const adds: ColumnDef[] = [];
    const renames: { oldName: string; newName: string }[] = [];

    for (const col of table.columns) {
      const existing = liveMap[col.name];

      if (existing) {
        // Present under its desired name — check for in-place incompatibility.
        if (!columnMatches(col, existing)) needRebuild = true;
        continue;
      }

      // Not present under the desired name — check for a rename source.
      if (col.renamedFrom && liveMap[col.renamedFrom]) {
        const src = liveMap[col.renamedFrom];
        if (!columnMatches(col, src)) {
          // Renaming won't fully reconcile the column → rebuild.
          needRebuild = true;
        } else {
          renames.push({ oldName: col.renamedFrom, newName: col.name });
          // Mark the source as consumed so it isn't treated as a drop.
          delete liveMap[col.renamedFrom];
        }
        continue;
      }

      // Pure addition.
      if (!isAddLegal(col)) {
        needRebuild = true;
      } else {
        adds.push(col);
      }
    }

    // Remaining live columns are drops → rebuild.
    const remainingLive = live.filter((lc) => liveMap[lc.name] !== undefined);
    if (remainingLive.length > 0) needRebuild = true;

    if (needRebuild) {
      const statements = renderTableRebuild(table, live);
      if (db.batch) {
        // D1 runs every query in an implicit transaction and ignores
        // `foreign_keys=OFF`, so a DROP of a referenced parent would trip FK
        // enforcement. Defer connections within this one atomic batch instead:
        // checks are re-validated at commit, by which time the renamed table
        // (with preserved ids) backs every child reference again.
        await db.batch([
          db.prepare("PRAGMA defer_foreign_keys = on"),
          ...statements.map((s) => db.prepare(s)),
          db.prepare("PRAGMA defer_foreign_keys = off"),
        ]);
      } else {
        for (const s of statements) await feed(s);
      }
      continue;
    }

    // Exclusively additive/rename actions — apply in place.
    for (const r of renames) {
      await feed(renderRenameColumn(table.name, r.oldName, r.newName));
    }
    for (const col of adds) {
      await feed(renderAddColumn(table.name, col));
    }
  }

  // 2. Indexes.
  for (const table of schema.tables) {
    const desired = schema.indexes.filter((ix) => ix.table === table.name);
    const live = (await liveIndexes(db, table.name)).map((i) => i.name);

    for (const ix of desired) {
      if (!live.includes(ix.name)) {
        await feed(renderCreateIndex(ix, true));
      }
    }

    // Drop indexes that exist live but are no longer desired.
    // (Auto-generated sqlite_autoindex_* names are excluded — managed by SQLite.)
    for (const name of live) {
      if (name.startsWith("sqlite_autoindex_")) continue;
      const stillDesired = desired.some((d) => d.name === name);
      if (!stillDesired) {
        await feed(renderDropIndex(name));
      }
    }
  }
}
