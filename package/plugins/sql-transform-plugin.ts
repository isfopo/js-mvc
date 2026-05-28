import type { Plugin } from "vite";
import matter from "gray-matter";

/**
 * Generic Vite plugin that strips YAML front matter from .sql file imports.
 *
 * This is the framework-agnostic transform that works regardless of project structure.
 * Project-specific type generation (db-types.d.ts, query barrels) is handled separately.
 */
export function sqlTransformPlugin(): Plugin {
  return {
    name: "sql-transform",
    enforce: "pre",

    transform(code, id) {
      // Strip YAML front matter from .sql files (with or without ?raw suffix)
      // after Vite's raw loader has converted them to `export default "..."` modules.
      if (!id.endsWith(".sql") && !id.endsWith(".sql?raw")) return;

      // Vite's ?raw loader (and the default asset handler) always produces
      // a single-line `export default "<json-escaped-string>";` statement.
      // The `s` flag allows `.` to match newlines in case the string itself
      // contains escaped newline characters (\n).
      const match = code.match(/^export default (.+);$/s);
      if (!match) return;

      try {
        const content = JSON.parse(match[1]);
        const { content: sql } = matter(content);
        return {
          code: `export default ${JSON.stringify(sql.trim())};`,
          map: null,
        };
      } catch {
        // Not a valid JSON string — leave as-is
        return;
      }
    },
  };
}
