/**
 * Database schema — the single source of truth, declared in TypeScript.
 *
 * From this definition the build generates:
 *   - model interfaces (src/domains/db-types.d.ts)
 *   - a derived schema.sql (for tooling / manual wrangler d1 execute)
 *   - a runtime schema module consumed by applySchema() to reconcile the
 *     live D1 DB against this desired state (initialise or update in place).
 */
import { defineSchema, table, index, col } from "js-mvc/schema";

export const schema = defineSchema({
  tables: {
    users: table({
      id: col.integer("id").primaryKey().autoIncrement(),
      github_id: col.integer("github_id").notNull().unique(),
      login: col.text("login").notNull(),
      avatar_url: col.text("avatar_url").nullable(),
      name: col.text("name").nullable(),
      created_at: col
        .text("created_at")
        .notNull()
        .default("(datetime('now'))"),
      last_login_at: col
        .text("last_login_at")
        .notNull()
        .default("(datetime('now'))"),
    }),

    tenets: table({
      id: col.integer("id").primaryKey().autoIncrement(),
      title: col.text("title").notNull(),
      slug: col.text("slug").notNull().unique(),
      status: col
        .text("status")
        .check([
          "draft",
          "voting",
          "accepted",
          "rejected",
          "implemented",
          "superseded",
        ])
        .notNull()
        .default("'draft'"),
      context: col.text("context").notNull(),
      decision: col.text("decision").nullable(),
      rationale: col.text("rationale").nullable(),
      proposed_by_id: col
        .integer("proposed_by_id")
        .notNull()
        .references("users", "id"),
      created_at: col
        .text("created_at")
        .notNull()
        .default("(datetime('now'))"),
      updated_at: col
        .text("updated_at")
        .notNull()
        .default("(datetime('now'))"),
      superseded_by_id: col
        .integer("superseded_by_id")
        .references("tenets", "id"),
    }),

    tenet_options: table({
      id: col.integer("id").primaryKey().autoIncrement(),
      tenet_id: col
        .integer("tenet_id")
        .notNull()
        .references("tenets", "id", { onDelete: "CASCADE" }),
      title: col.text("title").notNull(),
      description: col.text("description").nullable(),
      pros: col.text("pros").nullable(),
      cons: col.text("cons").nullable(),
      sort_order: col.integer("sort_order").notNull(),
    }),

    votes: table(
      {
        id: col.integer("id").primaryKey().autoIncrement(),
        tenet_id: col
          .integer("tenet_id")
          .notNull()
          .references("tenets", "id", { onDelete: "CASCADE" }),
        user_id: col
          .integer("user_id")
          .notNull()
          .references("users", "id"),
        choice: col
          .text("choice")
          .check(["approve", "abstain", "block"])
          .notNull(),
        reason: col.text("reason").nullable(),
        created_at: col
          .text("created_at")
          .notNull()
          .default("(datetime('now'))"),
        updated_at: col
          .text("updated_at")
          .notNull()
          .default("(datetime('now'))"),
      },
      { unique: [["tenet_id", "user_id"]] },
    ),
  },

  indexes: {
    idx_tenets_slug: index({
      table: "tenets",
      columns: ["slug"],
      unique: true,
    }),
    idx_tenets_status: index({ table: "tenets", columns: ["status"] }),
    idx_votes_tenet: index({ table: "votes", columns: ["tenet_id"] }),
    idx_votes_user: index({ table: "votes", columns: ["user_id"] }),
    idx_options_tenet: index({ table: "tenet_options", columns: ["tenet_id"] }),
  },
});

/** The exported SchemaDef value is what the build/plugin serializes. */
export default schema;
