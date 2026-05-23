import { RepositoryBase } from "infrastructure/RepositoryBase";
import { loadQueries } from "infrastructure/QueryLoader";
import type { TenetRow, TenetOptionRow, TenetStatus } from "./model";
import type { VoteRow } from "data/vote/model";

// Keep this in sync with the .sql files in ./queries/
type TenetQuery =
  | "findBySlug"
  | "getOptions"
  | "getWithProposer"
  | "insertOption"
  | "listWithProposer"
  | "updateStatus";

// Preload all SQL queries at module initialization
const queries = await loadQueries<TenetQuery>(
  import.meta.glob("./queries/*.sql", { query: "raw", import: "default" }),
);

export class TenetsRepository extends RepositoryBase<TenetRow> {
  override readonly tableName = "tenets";

  async findBySlug(db: D1Database, slug: string): Promise<TenetRow | null> {
    return this.queryOne<TenetRow>(db, queries.findBySlug, { slug });
  }

  async getOptions(db: D1Database, tenetId: number): Promise<TenetOptionRow[]> {
    return this.queryAll<TenetOptionRow>(db, queries.getOptions, { tenetId });
  }

  async listWithProposer(
    db: D1Database,
  ): Promise<
    (TenetRow & { proposer_login: string; proposer_avatar: string | null })[]
  > {
    return this.queryAll(db, queries.listWithProposer);
  }

  async getWithProposer(
    db: D1Database,
    slug: string,
  ): Promise<
    | (TenetRow & { proposer_login: string; proposer_avatar: string | null })
    | null
  > {
    return this.queryOne(db, queries.getWithProposer, { slug });
  }

  async createWithOptions(
    db: D1Database,
    tenet: {
      title: string;
      slug: string;
      context: string;
      proposed_by_id: number;
    },
    options: {
      title: string;
      description?: string;
      pros?: string;
      cons?: string;
    }[],
  ): Promise<TenetRow> {
    const row = await this.create(db, tenet as Partial<TenetRow>);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      await this.execute(db, queries.insertOption, {
        tenetId: row.id,
        title: opt.title,
        description: opt.description ?? null,
        pros: opt.pros ?? null,
        cons: opt.cons ?? null,
        sortOrder: i,
      });
    }

    return row;
  }

  async updateStatus(
    db: D1Database,
    id: number,
    status: TenetStatus,
  ): Promise<void> {
    await this.execute(db, queries.updateStatus, { id, status });
  }
}

export const tenetsRepo = new TenetsRepository();
