import { RepositoryBase } from "../../infrastructure/RepositoryBase";
import type { UserRow } from "./model";

export class UsersRepository extends RepositoryBase<UserRow> {
  override readonly tableName = "users";

  /** Look up a user by their GitHub ID. */
  async findByGithubId(db: D1Database, githubId: number): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      db,
      "SELECT * FROM users WHERE github_id = ?",
      githubId,
    );
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
      await db
        .prepare(
          `UPDATE users
             SET login = ?, avatar_url = ?, name = ?, last_login_at = datetime('now')
             WHERE id = ?`,
        )
        .bind(githubUser.login, githubUser.avatar_url, githubUser.name, existing.id)
        .run();
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
