/**
 * js-mvc/sql DSL — TypeScript-authored stored queries.
 *
 * A `def({ ... })` block in a `procs.ts` file describes the actions and
 * lookups a repository needs. At dev/build time `sqlPlugin` compiles it —
 * once — into a static SQL module (`procs.generated.ts`) with a typed
 * `ProcMap`, deriving result and parameter types from the schema singleton so
 * they can never drift from the database.
 *
 *   export const procs = def({
 *     getWithProposer: lookup({
 *       select: ["t.*", "u.login AS proposer_login"],
 *       from: [
 *         { table: "tenets", as: "t" },
 *         { join: "users", as: "u", on: sql`u.id = t.proposed_by_id` },
 *       ],
 *       where: { "t.slug": param() },          // param type: Tenet["slug"] = string
 *     }),
 *     updateStatus: action({
 *       into: "tenets",
 *       set: { status: param(), updated_at: sql`datetime('now')` },
 *       where: { id: param() },
 *     }),
 *   });
 *
 * Parameters use `@name` placeholders in the generated SQL, so the existing
 * repository binding (`queryOne`/`queryAll`/`execute` + named-param
 * resolution) is unchanged.
 */

/** Marker for a static (author-written) SQL fragment. Interpolation is rejected. */
export interface SqlFragment {
  __sql: string;
}

export function sql(strings: TemplateStringsArray, ...parts: unknown[]): SqlFragment {
  if (parts.length > 0) {
    throw new Error(
      "sql`` interpolation is not supported — keep fragments static",
    );
  }
  return { __sql: strings.join("") };
}

/** Marker for a bound parameter. The type is inferred from the referenced
 *  schema column when `type` is omitted. */
export interface ParamSpec {
  __param: true;
  type?: string;
}

export function param(type?: string): ParamSpec {
  return { __param: true, type };
}

export function isParam(value: unknown): value is ParamSpec {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ParamSpec).__param === true
  );
}

export function isSql(value: unknown): value is SqlFragment {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SqlFragment).__sql === "string"
  );
}

/** A bare table reference: `{ table: "tenets", as: "t" }`. */
export interface TableRef {
  table: string;
  as?: string;
}

/** A join: `{ join: "users", as: "u", on: sql`...` }` (default INNER). */
export interface JoinRef {
  join: string;
  as?: string;
  on: SqlFragment;
  kind?: "inner" | "left" | "right" | "cross";
}

/** A value slot: a parameter, a raw SQL fragment, or an inline literal. */
export type ValueSlots = ParamSpec | SqlFragment | string | number | boolean | null;

export interface LookupConfig {
  select: (string | SqlFragment)[];
  from: (TableRef | JoinRef)[];
  where?: Record<string, ValueSlots>;
  groupBy?: (string | SqlFragment)[];
  orderBy?: string | SqlFragment | (string | SqlFragment)[];
  limit?: number | ParamSpec;
  offset?: number | ParamSpec;
}

export interface ActionConfig {
  /** INSERT target, or the table UPDATE/DELETE applies to. */
  into: string;
  /** INSERT: column → value. */
  values?: Record<string, ValueSlots>;
  /** UPDATE: column → value. */
  set?: Record<string, ValueSlots>;
  /** WHERE conditions (required for UPDATE/SET). */
  where?: Record<string, ValueSlots>;
  /** Columns returned to the caller. Only "*" or column names. */
  returning?: ("*" | string)[];
}

export interface LookupProc {
  kind: "lookup";
  config: LookupConfig;
}

export interface ActionProc {
  kind: "action";
  config: ActionConfig;
}

export type ProcConfig = LookupProc | ActionProc;
export type ProcDefs = Record<string, ProcConfig>;

export function lookup(config: LookupConfig): ProcConfig {
  return { kind: "lookup", config };
}

export function action(config: ActionConfig): ProcConfig {
  if (!config.values && !config.set) {
    throw new Error("action() requires either values (INSERT) or set (UPDATE)");
  }
  if (config.set && !config.where) {
    throw new Error("action() UPDATE requires a where clause");
  }
  return { kind: "action", config };
}

/** Group a set of stored queries. Exported name is `procs`. */
export function def(procs: ProcDefs): ProcDefs {
  return procs;
}