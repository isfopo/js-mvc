/**
 * Column builder — the building block of a TypeScript-declared SQLite schema.
 *
 * Columns are composed with chained modifiers rather than raw SQL strings:
 *
 *   col.integer().primaryKey().autoIncrement()
 *   col.text().notNull().unique()
 *   col.text().check(["draft", "voting"]).notNull().default("'draft'")
 *   col.integer().references("users", "id", { onDelete: "CASCADE" })
 *
 * Every modifier returns a new builder, so columns are immutable and safe to
 * reuse/derive in a declarative schema.
 */

import type { ColumnDef, SqliteType } from "./schema-def";

export class ColumnBuilder {
  def: ColumnDef;

  private constructor(name: string, sqliteType: SqliteType) {
    this.def = {
      name,
      sqliteType,
      notNull: false,
      primaryKey: false,
    };
  }

  /** Create a new column builder. */
  static create(name: string, sqliteType: SqliteType): ColumnBuilder {
    return new ColumnBuilder(name, sqliteType);
  }

  /** Produce a copy of this builder with an updated definition. */
  private with(patch: Partial<ColumnDef>): ColumnBuilder {
    const next = new ColumnBuilder(this.def.name, this.def.sqliteType);
    next.def = { ...this.def, ...patch };
    return next;
  }

  notNull(): ColumnBuilder {
    return this.with({ notNull: true });
  }

  nullable(): ColumnBuilder {
    return this.with({ notNull: false });
  }

  primaryKey(): ColumnBuilder {
    return this.with({ primaryKey: true });
  }

  autoIncrement(): ColumnBuilder {
    return this.with({ autoIncrement: true });
  }

  unique(): ColumnBuilder {
    return this.with({ unique: true });
  }

  /** Raw default expression, e.g. `"'draft'"` or `"(datetime('now'))"`. */
  default(value: string): ColumnBuilder {
    return this.with({ default: value });
  }

  /** Constrain to an enum-like set — yields a string-union type. */
  check(values: readonly string[]): ColumnBuilder {
    return this.with({ checkValues: [...values] });
  }

  references(
    table: string,
    column: string,
    opts: { onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION" } = {},
  ): ColumnBuilder {
    return this.with({
      references: { table, column, onDelete: opts.onDelete },
    });
  }

  /** Declare this column as a rename of a previous column name. */
  renamedFrom(previousName: string): ColumnBuilder {
    return this.with({ renamedFrom: previousName });
  }

  /** Produce the final ColumnDef, applying the given column name. */
  toColumnDef(name: string): ColumnDef {
    return { ...this.def, name };
  }
}

const make =
  (sqliteType: SqliteType) =>
  (name: string): ColumnBuilder =>
    ColumnBuilder.create(name, sqliteType);

export const integer = make("INTEGER");
export const text = make("TEXT");
export const real = make("REAL");
export const blob = make("BLOB");

/** Convenience namespace: `col.integer("id")`. */
export const col = {
  integer,
  text,
  real,
  blob,
};
