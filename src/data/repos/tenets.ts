import { RepositoryBase } from "../../infrastructure/db/RepositoryBase";
import type { TenetRow, TenetOptionRow, TenetStatus } from "../models/tenet";
import type { VoteRow } from "../models/vote";

export class TenetsRepository extends RepositoryBase<TenetRow> {
  override readonly tableName = "tenets";

  async findBySlug(db: D1Database, slug: string): Promise<TenetRow | null> {
    return this.queryOne<TenetRow>(
      db, "SELECT * FROM tenets WHERE slug = ?", slug,
    );
  }

  async getOptions(db: D1Database, tenetId: number): Promise<TenetOptionRow[]> {
    return this.queryAll<TenetOptionRow>(
      db,
      "SELECT * FROM tenet_options WHERE tenet_id = ? ORDER BY sort_order",
      tenetId,
    );
  }

  async listWithProposer(db: D1Database): Promise<(TenetRow & { proposer_login: string; proposer_avatar: string | null })[]> {
    return this.queryAll(
      db,
      `SELECT t.*, u.login AS proposer_login, u.avatar_url AS proposer_avatar
       FROM tenets t
       JOIN users u ON u.id = t.proposed_by_id
       ORDER BY t.created_at DESC`,
    );
  }

  async getWithProposer(db: D1Database, slug: string) {
    return this.queryOne(
      db,
      `SELECT t.*, u.login AS proposer_login, u.avatar_url AS proposer_avatar
       FROM tenets t
       JOIN users u ON u.id = t.proposed_by_id
       WHERE t.slug = ?`,
      slug,
    );
  }

  async createWithOptions(
    db: D1Database,
    tenet: {
      title: string;
      slug: string;
      context: string;
      proposed_by_id: number;
    },
    options: { title: string; description?: string; pros?: string; cons?: string }[],
  ): Promise<TenetRow> {
    const row = await this.create(db, tenet as Partial<TenetRow>);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      await this.execute(
        db,
        `INSERT INTO tenet_options (tenet_id, title, description, pros, cons, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row.id, opt.title, opt.description ?? null,
        opt.pros ?? null, opt.cons ?? null, i,
      );
    }

    return row;
  }

  async updateStatus(
    db: D1Database,
    id: number,
    status: TenetStatus,
  ): Promise<void> {
    await this.execute(
      db,
      "UPDATE tenets SET status = ?, updated_at = datetime('now') WHERE id = ?",
      status, id,
    );
  }
}

export const tenetsRepo = new TenetsRepository();
