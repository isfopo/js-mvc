/**
 * RepositoryBase — abstract base for D1 repositories.
 *
 * Follows the same pattern as ControllerBase and BaseHandler.
 * Subclasses declare a table name and inherit generic CRUD.
 * D1Database is passed per-call (repos are stateless singletons).
 *
 * Named parameters: SQL files can use @paramName syntax. The helpers
 * below translate @name → ? and map named args to positional order
 * at runtime, since D1 only supports positional binding.
 */

export abstract class RepositoryBase<T extends { id: number }> {
  /** Each repository declares its table name. */
  abstract readonly tableName: string;

  // ── Static utilities ──────────────────────────────

  /**
   * Replace @paramName placeholders with ? and return the positional
   * values array. Handles repeated params (same name → same position).
   */
  static resolveNamedParams(
    sql: string,
    params: Record<string, unknown>,
  ): [string, unknown[]] {
    const paramOrder: string[] = [];
    const seen = new Set<string>();

    // Collect params in order of first appearance
    sql.replace(/@(\w+)/g, (_, name: string) => {
      if (!seen.has(name)) {
        seen.add(name);
        paramOrder.push(name);
      }
      return "";
    });

    // Replace @name with ?
    const resolved = sql.replace(/@(\w+)/g, "?");

    // Build positional array
    const values = paramOrder.map((name) => params[name]);

    return [resolved, values];
  }

  /** Check if value is a plain object (not null, array, or primitive). */
  static isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }

  // ── Generic CRUD ──────────────────────────────────

  /** Find a single row by primary key. */
  async findById(db: D1Database, id: number): Promise<T | null> {
    const row = await db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<T>();
    return row ?? null;
  }

  /** Find all rows, optionally ordered and limited. */
  async findAll(
    db: D1Database,
    options?: { orderBy?: string; limit?: number },
  ): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];
    if (options?.orderBy) sql += ` ORDER BY ${options.orderBy}`;
    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }
    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all<T>();
    return results;
  }

  /** Delete a row by primary key. Returns true if a row was deleted. */
  async delete(db: D1Database, id: number): Promise<boolean> {
    const { meta } = await db
      .prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .run();
    return (meta.changes ?? 0) > 0;
  }

  /** Count all rows in the table. */
  async count(db: D1Database): Promise<number> {
    const row = await db
      .prepare(`SELECT COUNT(*) AS count FROM ${this.tableName}`)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  /**
   * Generic create — builds INSERT from an object's keys.
   * Relies on the DB for defaults (auto-increment id, datetime, etc.).
   */
  async create(db: D1Database, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data as Record<string, unknown>);
    const values = keys.map((k) => (data as Record<string, unknown>)[k]);
    const cols = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");

    const { meta } = await db
      .prepare(
        `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders})`,
      )
      .bind(...values)
      .run();

    return (await this.findById(db, Number(meta.last_row_id)))!;
  }

  /**
   * Generic update — builds SET from an object's keys.
   * Returns the updated row, or null if the row didn't exist.
   */
  async update(
    db: D1Database,
    id: number,
    data: Partial<T>,
  ): Promise<T | null> {
    const keys = Object.keys(data as Record<string, unknown>);
    const values = keys.map((k) => (data as Record<string, unknown>)[k]);
    const setClause = keys.map((k) => `${k} = ?`).join(", ");

    await db
      .prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return this.findById(db, id);
  }

  // ── Helpers for subclasses ────────────────────────

  /** Run a SELECT query returning multiple rows. Supports @named params or positional. */
  protected queryAll<TResult>(
    db: D1Database,
    sql: string,
    ...params: unknown[]
  ): Promise<TResult[]> {
    const [resolved, values] = this._resolveParams(sql, params);
    return db
      .prepare(resolved)
      .bind(...values)
      .all<TResult>()
      .then((r) => r.results);
  }

  /** Run a SELECT query returning at most one row. Supports @named params or positional. */
  protected queryOne<TResult>(
    db: D1Database,
    sql: string,
    ...params: unknown[]
  ): Promise<TResult | null> {
    const [resolved, values] = this._resolveParams(sql, params);
    return db
      .prepare(resolved)
      .bind(...values)
      .first<TResult>();
  }

  /** Run an INSERT/UPDATE/DELETE. Supports @named params or positional. */
  protected execute(
    db: D1Database,
    sql: string,
    ...params: unknown[]
  ): Promise<D1Result> {
    const [resolved, values] = this._resolveParams(sql, params);
    return db
      .prepare(resolved)
      .bind(...values)
      .run();
  }

  // ── Typed query helpers (for use with generated QueryMap) ──

  /**
   * Type-safe SELECT returning at most one row.
   * Result and param types are inferred from the QueryMap generic.
   *
   * Usage: `this.typedOne<QueryMap, "findBySlug">(db, queries, "findBySlug", { slug })`
   */
  protected typedOne<QM, K extends keyof QM>(
    db: D1Database,
    queries: { [P in keyof QM]: string },
    name: K,
    ...args: QM[K] extends { params: infer P } ? ({} extends P ? [] : [P]) : []
  ): Promise<(QM[K] extends { result: infer R } ? R : unknown) | null> {
    const sql = queries[name];
    const params = (args as unknown[])[0] as Record<string, unknown> | undefined;
    return params ? this.queryOne(db, sql, params) : this.queryOne(db, sql);
  }

  /**
   * Type-safe SELECT returning multiple rows.
   * Result and param types are inferred from the QueryMap generic.
   *
   * Usage: `this.typedAll<QueryMap, "listWithProposer">(db, queries, "listWithProposer")`
   */
  protected typedAll<QM, K extends keyof QM>(
    db: D1Database,
    queries: { [P in keyof QM]: string },
    name: K,
    ...args: QM[K] extends { params: infer P } ? ({} extends P ? [] : [P]) : []
  ): Promise<(QM[K] extends { result: infer R } ? R : unknown)[]> {
    const sql = queries[name];
    const params = (args as unknown[])[0] as Record<string, unknown> | undefined;
    return params ? this.queryAll(db, sql, params) : this.queryAll(db, sql);
  }

  /**
   * Type-safe INSERT/UPDATE/DELETE.
   * Param types are inferred from the QueryMap generic.
   *
   * Usage: `this.typedExec<QueryMap, "updateStatus">(db, queries, "updateStatus", { id, status })`
   */
  protected typedExec<QM, K extends keyof QM>(
    db: D1Database,
    queries: { [P in keyof QM]: string },
    name: K,
    ...args: QM[K] extends { params: infer P } ? ({} extends P ? [] : [P]) : []
  ): Promise<D1Result> {
    const sql = queries[name];
    const params = (args as unknown[])[0] as Record<string, unknown> | undefined;
    return params ? this.execute(db, sql, params) : this.execute(db, sql);
  }

  /**
   * Resolve params: if SQL uses @named syntax and a single plain-object
   * arg is passed, translate to positional. Otherwise pass through as-is.
   */
  private _resolveParams(sql: string, params: unknown[]): [string, unknown[]] {
    const hasNamed = /@\w+/.test(sql);
    const isNamedCall =
      hasNamed && params.length === 1 && RepositoryBase.isPlainObject(params[0]);

    if (isNamedCall) {
      return RepositoryBase.resolveNamedParams(sql, params[0] as Record<string, unknown>);
    }
    return [sql, params];
  }
}
