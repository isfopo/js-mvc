/**
 * Canonical Schema IR types shared by the DSL, generators, and the runtime
 * reconciliation layer. These are the shapes a compiled SchemaDef takes.
 */

export type SqliteType = "INTEGER" | "TEXT" | "REAL" | "BLOB";

export interface ReferenceDef {
  table: string;
  column: string;
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface ColumnDef {
  name: string;
  sqliteType: SqliteType;
  notNull: boolean;
  primaryKey: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  default?: string;
  checkValues?: string[];
  references?: ReferenceDef;
  /**
   * If this column was renamed from an older name, the previous name. The
   * reconciliation layer uses this to map old data onto the new column during
   * a table rebuild — without it, a rename is indistinguishable from
   * add+drop and risks data loss.
   */
  renamedFrom?: string;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  /** Table-level unique constraints — each inner array is a set of columns. */
  unique?: string[][];
}

export interface IndexDef {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
}

export interface SchemaDef {
  tables: TableDef[];
  indexes: IndexDef[];
}
