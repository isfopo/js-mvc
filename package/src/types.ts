/** Minimal database abstraction matching D1's API surface. */

export interface Database {
  prepare(sql: string): Statement;
}

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<DbResult>;
}

export interface DbResult {
  meta: { last_row_id: number; changes: number };
}
