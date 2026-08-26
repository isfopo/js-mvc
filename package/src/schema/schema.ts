/**
 * defineSchema — the TypeScript source of truth for the database schema.
 *
 *   export const schema = defineSchema({
 *     tables: {
 *       users: table({
 *         id: integer("id").primaryKey().autoIncrement(),
 *       }),
 *     },
 *     indexes: {
 *       idx_users_login: index({ table: "users", columns: ["login"], unique: true }),
 *     },
 *   });
 *
 * The result is a normalized, validated SchemaDef IR consumed by:
 *   - the compiler (model types + derived schema.sql), and
 *   - the runtime reconciliation layer (applySchema).
 *
 * In the `tables` object the column *key* is the default column name — an
 * explicit builder arg overrides it.
 */

import type { SchemaDef, TableDef } from "./schema-def";
import type { TableColumns } from "./table";
import type { IndexInput } from "./index-def";

export interface SchemaInput {
  tables: Record<string, TableColumns>;
  indexes?: Record<string, IndexInput>;
}

export function defineSchema(input: SchemaInput): SchemaDef {
  const tableNames = Object.keys(input.tables);
  if (tableNames.length === 0) {
    throw new Error("Schema must define at least one table");
  }

  const tables: TableDef[] = tableNames.map((name) => ({
    ...input.tables[name],
    name,
  }));

  // Validate references point at known tables (best-effort, catches typos),
  // and resolve checkRef columns to their lookup table's primary key.
  const known = new Set(tableNames);
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.references && !known.has(col.references.table)) {
        throw new Error(
          `Table "${table.name}" references unknown table "${col.references.table}"`,
        );
      }
      if (col.check?.kind === "ref") {
        const check = col.check;
        const lookup = tables.find((t) => t.name === check.table);
        if (!lookup) {
          throw new Error(
            `Table "${table.name}" column "${col.name}" references unknown lookup table "${check.table}"`,
          );
        }
        const pk = lookup.columns.find((c) => c.primaryKey);
        if (!pk) {
          throw new Error(
            `Lookup table "${check.table}" has no primary key for checkRef on "${table.name}.${col.name}"`,
          );
        }
        col.check = { kind: "ref", table: check.table, column: pk.name };
        // A checkRef is also a foreign key — seed sampling, DDL and the
        // reconciler all consume it through `references`.
        if (!col.references) {
          col.references = { table: check.table, column: pk.name };
        }
      }
    }
  }

  const indexes = Object.entries(input.indexes ?? {}).map(([name, def]) => ({
    ...def,
    name,
  }));

  return { tables, indexes };
}
