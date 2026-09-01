/**
 * Index definition — an index over one or more table columns.
 *
 * Column entries may carry a sort direction, e.g. `["created_at DESC"]`.
 */

import type { IndexDef } from "./schema-def";

export interface IndexInput {
  table: string;
  columns: string[];
  unique?: boolean;
}

/** Build an index definition; its name is assigned by `defineSchema`. */
export function index(input: IndexInput): IndexInput {
  if (input.columns.length === 0) {
    throw new Error("Index must reference at least one column");
  }
  return input;
}

export type { IndexDef } from "./schema-def";
