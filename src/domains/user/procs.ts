/**
 * User stored queries — compiled once by sqlPlugin into static SQL with
 * schema-derived types (procs.generated.ts).
 */
import { def, action, param, sql } from "js-mvc/sql";

export const procs = def({
  updateFromGithub: action({
    into: "users",
    set: {
      login: param(),
      avatar_url: param(),
      name: param(),
      last_login_at: sql`datetime('now')`,
    },
    where: { id: param() },
  }),
});

export default procs;