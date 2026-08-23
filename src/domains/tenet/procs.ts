/**
 * Tenet stored queries — compiled once by sqlPlugin into static SQL with
 * schema-derived types (procs.generated.ts). Columns without an explicit
 * param tag infer their type from the schema.
 */
import { def, lookup, action, param, sql } from "js-mvc/sql";

export const procs = def({
  getOptions: lookup({
    select: ["*"],
    from: [{ table: "tenet_options" }],
    where: { tenet_id: param() },
    orderBy: sql`sort_order`,
  }),

  listWithProposer: lookup({
    select: [
      "t.*",
      "u.login AS proposer_login",
      "u.avatar_url AS proposer_avatar",
    ],
    from: [
      { table: "tenets", as: "t" },
      { join: "users", as: "u", on: sql`u.id = t.proposed_by_id` },
    ],
    orderBy: sql`t.created_at DESC`,
  }),

  getWithProposer: lookup({
    select: [
      "t.*",
      "u.login AS proposer_login",
      "u.avatar_url AS proposer_avatar",
    ],
    from: [
      { table: "tenets", as: "t" },
      { join: "users", as: "u", on: sql`u.id = t.proposed_by_id` },
    ],
    where: { "t.slug": param() },
  }),

  insertOption: action({
    into: "tenet_options",
    values: {
      tenet_id: param(),
      title: param(),
      description: param(),
      pros: param(),
      cons: param(),
      sort_order: param(),
    },
    returning: ["id"],
  }),

  updateStatus: action({
    into: "tenets",
    set: { status: param(), updated_at: sql`datetime('now')` },
    where: { id: param() },
  }),
});

export default procs;
