/**
 * js-mvc/sql — TypeScript-authored stored queries (actions & lookups).
 *
 *   define in  procs.ts  →  sqlPlugin compiles once  →  procs.generated.ts
 *                         (static SQL + typed ProcMap)
 *
 * Repositories consume the generated module exactly like the old QueryMap
 * barrels: same @name binding, same queryOne/queryAll/execute helpers.
 */

export { def, lookup, action, param, sql, isParam, isSql } from "./spec";
export type {
  ProcDefs,
  ProcConfig,
  LookupConfig,
  ActionConfig,
  TableRef,
  JoinRef,
  ParamSpec,
  SqlFragment,
  ValueSlots,
} from "./spec";
export { compileProcs } from "./compile";
export type { CompiledProcs } from "./compile";