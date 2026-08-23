/**
 * Value strategies — declarative descriptions of how a column's rows should
 * be produced. The seed compiler interprets these at dev/build time and emits
 * concrete literal rows; the runtime applier never sees them.
 *
 * A raw primitive (string/number/boolean/null) can also be used directly as a
 * strategy, meaning "always this literal value".
 */

export interface FakeStrategy {
  kind: "fake";
  /** Dot-path into faker, e.g. "internet.username", "person.fullName". */
  provider: string;
}

export interface PickStrategy {
  kind: "pick";
  values: unknown[];
}

export interface RefStrategy {
  kind: "ref";
  /** Table whose generated rows this column should sample ids from. */
  table: string;
}

export interface SeqStrategy {
  kind: "seq";
}

export type ValueStrategy =
  | FakeStrategy
  | PickStrategy
  | RefStrategy
  | SeqStrategy
  | string
  | number
  | boolean
  | null;

export function isStrategy(value: unknown): value is
  | FakeStrategy
  | PickStrategy
  | RefStrategy
  | SeqStrategy {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    ["fake", "pick", "ref", "seq"].includes((value as { kind: string }).kind)
  );
}

/** Generate via a faker provider (e.g. fake("internet.username")). */
export function fake(provider: string): FakeStrategy {
  return { kind: "fake", provider };
}

/** Pick uniformly from a fixed set (e.g. an enum). */
export function pick(values: unknown[]): PickStrategy {
  return { kind: "pick", values };
}

/** Sample a row from another table and use its primary-key value. */
export function ref(table: string): RefStrategy {
  return { kind: "ref", table };
}

/** Per-table running index (0, 1, 2, ...) — ideal for sort_order. */
export function seq(): SeqStrategy {
  return { kind: "seq" };
}