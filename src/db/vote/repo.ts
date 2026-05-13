import { RepositoryBase } from "../../infrastructure/RepositoryBase";
import type { VoteRow, VoteChoice } from "./model";

export interface VoteWithUserRow extends VoteRow {
  user_login: string;
  user_avatar: string | null;
}

export class VotesRepository extends RepositoryBase<VoteRow> {
  override readonly tableName = "votes";

  async listForTenet(db: D1Database, tenetId: number): Promise<VoteWithUserRow[]> {
    return this.queryAll<VoteWithUserRow>(
      db,
      `SELECT v.*, u.login AS user_login, u.avatar_url AS user_avatar
       FROM votes v
       JOIN users u ON u.id = v.user_id
       WHERE v.tenet_id = ?
       ORDER BY v.created_at`,
      tenetId,
    );
  }

  async getUserVote(
    db: D1Database,
    tenetId: number,
    userId: number,
  ): Promise<VoteRow | null> {
    return this.queryOne<VoteRow>(
      db,
      "SELECT * FROM votes WHERE tenet_id = ? AND user_id = ?",
      tenetId, userId,
    );
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
      await this.execute(
        db,
        `UPDATE votes SET choice = ?, reason = ?, updated_at = datetime('now')
         WHERE id = ?`,
        choice, reason, existing.id,
      );
    } else {
      await this.execute(
        db,
        `INSERT INTO votes (tenet_id, user_id, choice, reason)
         VALUES (?, ?, ?, ?)`,
        tenetId, userId, choice, reason,
      );
    }
  }
}

export const votesRepo = new VotesRepository();
