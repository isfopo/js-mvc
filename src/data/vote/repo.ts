import { RepositoryBase } from "js-mvc/repository/RepositoryBase";
import type { VoteRow, VoteChoice } from "./model";
import { queries, type QueryMap } from "./queries/queries.generated";

export interface VoteWithUserRow extends VoteRow {
  user_login: string;
  user_avatar: string | null;
}

export class VotesRepository extends RepositoryBase<VoteRow, QueryMap> {
  override readonly tableName = "votes";
  protected override readonly queries = queries;

  async listForTenet(tenetId: number): Promise<VoteWithUserRow[]> {
    return this.queryAll("listForTenet", { tenetId });
  }

  async upsert(
    tenetId: number,
    userId: number,
    choice: VoteChoice,
    reason: string | null,
  ): Promise<void> {
    const existing = await this.findOneBy({ tenet_id: tenetId, user_id: userId });

    if (existing) {
      await this.execute("updateVote", {
        id: existing.id,
        choice,
        reason,
      });
    } else {
      await this.execute("insertVote", {
        tenetId,
        userId,
        choice,
        reason,
      });
    }
  }
}

/** Factory function to create a VotesRepository with a database connection. */
export const votesRepo = (db: D1Database) => new VotesRepository(db);
