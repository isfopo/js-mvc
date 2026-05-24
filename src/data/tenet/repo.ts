import { RepositoryBase } from "infrastructure/RepositoryBase";
import { queries, type QueryMap } from "./queries/queries.generated";
import type { Tenet } from "data/db-types";
import type { TenetStatus } from "./model";

export class TenetsRepository extends RepositoryBase<Tenet, QueryMap> {
  override readonly tableName = "tenets";
  protected override readonly queries = queries;

  // Required: base class has explicit constructor, subclasses must call super()
  constructor(db: D1Database) {
    super(db);
  }

  async getOptions(tenetId: number) {
    return this.queryAll("getOptions", { tenetId });
  }

  async listWithProposer() {
    return this.queryAll("listWithProposer");
  }

  async getWithProposer(slug: string) {
    return this.queryOne("getWithProposer", { slug });
  }

  async createWithOptions(
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
    // Build the INSERT statement for the tenet
    const keys = Object.keys(tenet);
    const values = keys.map((k) => (tenet as Record<string, unknown>)[k]);
    const cols = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");

    const stmts: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders})`,
        )
        .bind(...values),
    ];

    // Build INSERT statements for each option using last_insert_rowid()
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      stmts.push(
        this.db
          .prepare(
            `INSERT INTO tenet_options (tenet_id, title, description, pros, cons, sort_order) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?)`,
          )
          .bind(
            opt.title,
            opt.description ?? null,
            opt.pros ?? null,
            opt.cons ?? null,
            i,
          ),
      );
    }

    // db.batch() executes all statements atomically — if any fail, all roll back
    const results = await this.db.batch(stmts);
    const insertedId = (results[0].meta as { last_row_id: number }).last_row_id;

    return (await this.findById(insertedId))!;
  }

  async updateStatus(id: number, status: TenetStatus): Promise<void> {
    await this.execute("updateStatus", { id, status });
  }
}

/** Factory function to create a TenetsRepository with a database connection. */
export const tenetsRepo = (db: D1Database) => new TenetsRepository(db);
