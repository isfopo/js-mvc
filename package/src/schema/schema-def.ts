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

/**
 * A CHECK-class constraint on a column. Either a reference to a lookup
 * table's primary key (referential enum — the typegen derives a union from
 * the lookup's seeded rows), or a numeric range.
 */
export type CheckDef =
  | { kind: "ref"; table: string; column: string }
  | {
      kind: "range";
      greaterThan?: number;
      lessThan?: number;
      greaterThanEqual?: number;
      lessThanEqual?: number;
    };

export interface ColumnDef {
  name: string;
  sqliteType: SqliteType;
  notNull: boolean;
  primaryKey: boolean;
  autoIncrement?: boolean;
  unique?: boolean;
  default?: string;
  check?: CheckDef;
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
