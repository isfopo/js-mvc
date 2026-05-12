export type VoteChoice = "approve" | "abstain" | "block";

/** Row type for the `votes` D1 table. */
export interface VoteRow {
  id: number;
  tenet_id: number;
  user_id: number;
  choice: VoteChoice;
  reason: string | null;
  created_at: string;
  updated_at: string;
}
