export type TenetStatus =
  | "draft"
  | "voting"
  | "accepted"
  | "rejected"
  | "implemented"
  | "superseded";

/** Row type for the `tenets` D1 table. */
export interface TenetRow {
  id: number;
  title: string;
  slug: string;
  status: TenetStatus;
  context: string;
  decision: string | null;
  rationale: string | null;
  proposed_by_id: number;
  created_at: string;
  updated_at: string;
  superseded_by_id: number | null;
}

/** Row type for the `tenet_options` D1 table. */
export interface TenetOptionRow {
  id: number;
  tenet_id: number;
  title: string;
  description: string | null;
  pros: string | null;
  cons: string | null;
  sort_order: number;
}
