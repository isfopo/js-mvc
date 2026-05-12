/**
 * RepositoryBase — abstract base for D1 repositories.
 *
 * Follows the same pattern as ControllerBase and BaseHandler.
 * Subclasses declare a table name and inherit generic CRUD.
 * D1Database is passed per-call (repos are stateless singletons).
 */

export abstract class RepositoryBase<T extends { id: number }> {
  /** Each repository declares its table name. */
  abstract readonly tableName: string;

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
    const { results } = await db.prepare(sql).bind(...params).all<T>();
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
  async update(db: D1Database, id: number, data: Partial<T>): Promise<T | null> {
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

  /** Run a SELECT query returning multiple rows. */
  protected queryAll<TResult>(
    db: D1Database,
    sql: string,
    ...params: unknown[]
  ): Promise<TResult[]> {
    return db
      .prepare(sql)
      .bind(...params)
      .all<TResult>()
      .then((r) => r.results);
  }

  /** Run a SELECT query returning at most one row. */
  protected queryOne<TResult>(
    db: D1Database,
    sql: string,
    ...params: unknown[]
  ): Promise<TResult | null> {
    return db.prepare(sql).bind(...params).first<TResult>();
  }

  /** Run an INSERT/UPDATE/DELETE. */
  protected execute(
    db: D1Database,
    sql: string,
    ...params: unknown[]
  ): Promise<D1Result> {
    return db.prepare(sql).bind(...params).run();
  }
}
