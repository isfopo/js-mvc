/**
 * Column builder — the building block of a TypeScript-declared SQLite schema.
 *
 * Columns are composed with chained modifiers rather than raw SQL strings:
 *
 *   col.integer().primaryKey().autoIncrement()
 *   col.text().notNull().unique()
 *   col.text().checkRef("statuses").notNull().default("'draft'")
 *   col.integer().between(0, 100).notNull()
 *   col.integer().references("users", "id", { onDelete: "CASCADE" })
 *
 * Every modifier returns a new builder, so columns are immutable and safe to
 * reuse/derive in a declarative schema.
 */

import type { ColumnDef, SqliteType, CheckDef } from "./schema-def";

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

  /**
   * Reference a lookup table's primary key — a referential enum. The DDL
   * emits a foreign key, the seed samples the lookup's rows, and typegen
   * derives a union from the lookup's seeded keys.
   * The referenced column is resolved to the lookup's PK at defineSchema time.
   */
  checkRef(table: string): ColumnBuilder {
    return this.with({ check: { kind: "ref", table, column: "" } });
  }

  /** Inclusive numeric bounds, e.g. between(0, 100) → CHECK (col >= 0 AND col <= 100). */
  between(min: number, max: number): ColumnBuilder {
    if (min > max) {
      throw new Error(`between(${min}, ${max}) — min must be <= max`);
    }
    return this.mergeRange({ greaterThanEqual: min, lessThanEqual: max });
  }

  /** CHECK (col > n) */
  greaterThan(n: number): ColumnBuilder {
    return this.mergeRange({ greaterThan: n });
  }

  /** CHECK (col < n) */
  lessThan(n: number): ColumnBuilder {
    return this.mergeRange({ lessThan: n });
  }

  /** CHECK (col >= n) */
  greaterThanEqual(n: number): ColumnBuilder {
    return this.mergeRange({ greaterThanEqual: n });
  }

  /** CHECK (col <= n) */
  lessThanEqual(n: number): ColumnBuilder {
    return this.mergeRange({ lessThanEqual: n });
  }

  /** Accumulate a numeric range constraint (immutable copy). */
  private mergeRange(
    patch: Partial<Extract<CheckDef, { kind: "range" }>>,
  ): ColumnBuilder {
    const existing = this.def.check;
    const base: Extract<CheckDef, { kind: "range" }> =
      existing && existing.kind === "range"
        ? existing
        : { kind: "range" };
    return this.with({ check: { ...base, ...patch } });
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

  /**
   * Produce the final ColumnDef. An explicit name passed to the builder wins;
   * otherwise (no arg) the column takes the property key it was declared
   * under — so `table({ id: col.integer() })` is equivalent to
   * `table({ id: col.integer("id") })`.
   */
  toColumnDef(name: string): ColumnDef {
    return this.def.name ? { ...this.def } : { ...this.def, name };
  }
}

const make =
  (sqliteType: SqliteType) =>
  (name?: string): ColumnBuilder =>
    ColumnBuilder.create(name ?? "", sqliteType);

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
