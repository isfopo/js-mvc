/**
 * Vote stored queries — compiled once by sqlPlugin into static SQL with
 * schema-derived types (procs.generated.ts).
 */
import { defineSql } from "js-mvc/sql";
import type { Database } from "domains/db-types";

const { def, lookup, action, param, sql } = defineSql<Database>();

export const procs = def({
  insertVote: action({
    into: "votes" as const,
    values: {
      tenet_id: param(),
      user_id: param(),
      choice: param(),
      reason: param(),
    },
  }),

  listForTenet: lookup({
    select: ["v.*", "u.login AS user_login", "u.avatar_url AS user_avatar"],
    from: [
      { table: "votes", as: "v" },
      { join: "users", as: "u", on: sql`u.id = v.user_id` },
    ] as const,
    where: { "v.tenet_id": param() },
    orderBy: sql`v.created_at`,
  }),

  updateVote: action({
    into: "votes" as const,
    set: { choice: param(), reason: param(), updated_at: sql`datetime('now')` },
    where: { id: param() },
  }),
});

export default procs;