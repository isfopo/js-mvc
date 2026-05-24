/**
 * Parse YAML front matter from SQL files using gray-matter.
 *
 * SQL files can have an optional YAML front matter block delimited by `---`:
 *
 *   ---
 *   params:
 *     slug: string
 *   result: tenets
 *   ---
 *   SELECT * FROM tenets WHERE slug = @slug
 *
 * Returns the clean SQL content and the parsed front matter data.
 */

import matter from "gray-matter";

export interface SqlFrontMatter {
  /** Map of param name to TypeScript type string */
  params?: Record<string, string>;
  /** Result type: table name, TS type expression, or "void" */
  result?: string;
}

export interface ParsedSql {
  /** The SQL content with front matter stripped */
  sql: string;
  /** Parsed front matter data (empty object if no front matter) */
  data: SqlFrontMatter;
}

/**
 * Parse a SQL file's content, extracting YAML front matter and returning
 * the clean SQL string along with the typed metadata.
 */
export function parseFrontMatter(content: string): ParsedSql {
  const { data, content: sql } = matter(content);

  return {
    sql: sql.trim(),
    data: {
      params: data.params as Record<string, string> | undefined,
      result: data.result as string | undefined,
    },
  };
}
