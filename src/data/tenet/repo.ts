import { RepositoryBase } from "infrastructure/RepositoryBase";
import { queries, type QueryMap } from "./queries/queries.generated";
import type { Tenet } from "data/db-types";
import type { TenetStatus } from "./model";

export class TenetsRepository extends RepositoryBase<Tenet> {
  override readonly tableName = "tenets";

  async findBySlug(db: D1Database, slug: string) {
    return this.queryOne<QueryMap, "findBySlug">(db, queries, "findBySlug", {
      slug,
    });
  }

  async getOptions(db: D1Database, tenetId: number) {
    return this.queryAll<QueryMap, "getOptions">(db, queries, "getOptions", {
      tenetId,
    });
  }

  async listWithProposer(db: D1Database) {
    return this.queryAll<QueryMap, "listWithProposer">(
      db,
      queries,
      "listWithProposer",
    );
  }

  async getWithProposer(db: D1Database, slug: string) {
    return this.queryOne<QueryMap, "getWithProposer">(
      db,
      queries,
      "getWithProposer",
      { slug },
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
    options: {
      title: string;
      description?: string;
      pros?: string;
      cons?: string;
    }[],
  ) {
    const row = await this.create(db, tenet as Partial<Tenet>);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      await this.execute<QueryMap, "insertOption">(
        db,
        queries,
        "insertOption",
        {
          tenetId: row.id,
          title: opt.title,
          description: opt.description ?? null,
          pros: opt.pros ?? null,
          cons: opt.cons ?? null,
          sortOrder: i,
        },
      );
    }

    return row;
  }

  async updateStatus(
    db: D1Database,
    id: number,
    status: TenetStatus,
  ): Promise<void> {
    await this.execute<QueryMap, "updateStatus">(
      db,
      queries,
      "updateStatus",
      { id, status },
    );
  }
}

export const tenetsRepo = new TenetsRepository();
