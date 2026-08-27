/**
 * Public DSL surface for declaring a database schema in TypeScript.
 */

export { defineSchema } from "./schema";
export type { SchemaInput } from "./schema";

export { table } from "./table";
export type { TableColumns, TableOptions } from "./table";

export { index } from "./index-def";

export { col, integer, text, real, blob, ColumnBuilder } from "./column";

// Canonical IR types (re-exported for generators / application code).
export type {
  SchemaDef,
  TableDef,
  ColumnDef,
  IndexDef,
  SqliteType,
  ReferenceDef,
} from "./schema-def";

// Generators (build-time / tooling).
export { generateSchemaSqlContent } from "./generate-sql";
export { generateDbTypesContent, tableNameToTypeName } from "./generate-types";
