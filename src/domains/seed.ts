/**
 * Dev seed spec — describes the data sowed into the local D1 database.
 *
 * Compiled at dev/build time by seedPlugin into a pure-data module
 * (src/.generated/seed.ts) and applied once on worker boot via applySeed().
 * The dataset only changes when this spec changes; reboots stay stable.
 *
 * Columns not listed here are inferred from the schema:
 *   - id (PK)                   → deterministic sequence
 *   - github_id / slug (unique) → unique generated values
 *   - proposed_by_id etc. (FK)  → sampled from the referenced table's rows
 *   - created_at (DEFAULT)      → left to the column default
 *   - context, avatar_url, ...  → column-name heuristics (faker)
 */
import { defineSeed, generate, fake, pick, seq } from "js-mvc/seed";
import { schemaDef } from "../.generated/schema";

export const seed = defineSeed(schemaDef, {
  users: generate(24, {
    login: fake("internet.username"),
    name: fake("person.fullName"),
  }),

  tenets: generate(12, {
    title: fake("lorem.sentence"),
    status: pick([
      "draft",
      "voting",
      "accepted",
      "implemented",
      "rejected",
      "superseded",
    ]),
  }),

  tenet_options: generate(36, {
    title: fake("word.noun"),
    sort_order: seq(),
  }),

  votes: generate(48, {
    choice: pick(["approve", "abstain", "block"]),
  }),
});

export default seed;