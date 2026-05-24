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
 *
 * @throws Error if front matter contains invalid types (e.g., params is not a map).
 */
export function parseFrontMatter(content: string, filename?: string): ParsedSql {
  const { data, content: sql } = matter(content);
  const label = filename ? `${filename}: ` : "";

  // Validate params: must be a plain object map if present
  if (data.params !== undefined) {
    if (
      typeof data.params !== "object" ||
      data.params === null ||
      Array.isArray(data.params)
    ) {
      throw new Error(
        `${label}front matter "params" must be a YAML map (e.g., params:\\n  slug: string), ` +
        `got ${typeof data.params}`,
      );
    }
    // Validate each param value is a string type expression
    for (const [key, value] of Object.entries(data.params)) {
      if (typeof value !== "string") {
        throw new Error(
          `${label}front matter param "${key}" must be a type string (e.g., "string"), ` +
          `got ${typeof value}: ${JSON.stringify(value)}`,
        );
      }
    }
  }

  // Validate result: must be a string if present
  if (data.result !== undefined && typeof data.result !== "string") {
    throw new Error(
      `${label}front matter "result" must be a string (e.g., "Tenet" or "void"), ` +
      `got ${typeof data.result}: ${JSON.stringify(data.result)}`,
    );
  }

  return {
    sql: sql.trim(),
    data: {
      params: data.params as Record<string, string> | undefined,
      result: data.result as string | undefined,
    },
  };
}
