import { RepositoryBase } from "infrastructure/RepositoryBase";
import type { UserRow } from "./model";
import { queries, type QueryMap } from "./queries/queries.generated";

export class UsersRepository extends RepositoryBase<UserRow> {
  override readonly tableName = "users";

  /** Look up a user by their GitHub ID. */
  async findByGithubId(db: D1Database, githubId: number): Promise<UserRow | null> {
    return this.queryOne<QueryMap, "findByGithubId">(db, queries, "findByGithubId", { githubId });
  }

  /**
   * Upsert a user from GitHub profile data.
   * Returns the user row (either newly created or updated).
   */
  async upsertFromGithub(
    db: D1Database,
    githubUser: {
      id: number;
      login: string;
      avatar_url: string | null;
      name: string | null;
    },
  ): Promise<UserRow> {
    const existing = await this.findByGithubId(db, githubUser.id);

    if (existing) {
      await this.execute<QueryMap, "updateFromGithub">(db, queries, "updateFromGithub", {
        id: existing.id,
        login: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        name: githubUser.name,
      });
      return (await this.findById(db, existing.id))!;
    }

    return this.create(db, {
      github_id: githubUser.id,
      login: githubUser.login,
      avatar_url: githubUser.avatar_url,
      name: githubUser.name,
    } as Partial<UserRow>);
  }
}

export const usersRepo = new UsersRepository();
