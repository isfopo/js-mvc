import { RepositoryBase } from "infrastructure/RepositoryBase";
import type { VoteRow, VoteChoice } from "./model";
import { queries, type QueryMap } from "./queries/queries.generated";

export interface VoteWithUserRow extends VoteRow {
  user_login: string;
  user_avatar: string | null;
}

export class VotesRepository extends RepositoryBase<VoteRow> {
  override readonly tableName = "votes";

  async listForTenet(db: D1Database, tenetId: number): Promise<VoteWithUserRow[]> {
    return this.queryAll<QueryMap, "listForTenet">(db, queries, "listForTenet", { tenetId });
  }

  async getUserVote(
    db: D1Database,
    tenetId: number,
    userId: number,
  ): Promise<VoteRow | null> {
    return this.queryOne<QueryMap, "getUserVote">(db, queries, "getUserVote", { tenetId, userId });
  }

  async upsert(
    db: D1Database,
    tenetId: number,
    userId: number,
    choice: VoteChoice,
    reason: string | null,
  ): Promise<void> {
    const existing = await this.getUserVote(db, tenetId, userId);

    if (existing) {
      await this.execute<QueryMap, "updateVote">(db, queries, "updateVote", {
        id: existing.id,
        choice,
        reason,
      });
    } else {
      await this.execute<QueryMap, "insertVote">(db, queries, "insertVote", {
        tenetId,
        userId,
        choice,
        reason,
      });
    }
  }
}

export const votesRepo = new VotesRepository();
