/**
 * QueryLoader — loads SQL files from a queries directory.
 *
 * Uses Vite's `?raw` import to inline SQL files at build time.
 * Each query is loaded by name (without .sql extension).
 *
 * Usage:
 *   type UserQueries = "findBySlug" | "listAll";
 *   const queries = await loadQueries<UserQueries>(
 *     import.meta.glob("./*.sql", { query: "raw", import: "default" }),
 *   );
 *   // queries.findBySlug — typed as string, autocomplete works
 */

/**
 * Preload all queries from a Vite glob and return them as a typed record.
 * @param modules - Result of import.meta.glob with { query: "raw", import: "default" }
 * @returns A record mapping query names (filename without .sql) to SQL strings
 */
export async function loadQueries<TKeys extends string = string>(
  modules: Record<string, () => Promise<unknown>>,
): Promise<Record<TKeys, string>> {
  const entries = await Promise.all(
    Object.entries(modules).map(async ([path, loader]) => {
      const name = path.replace(/^.*\/(.+)\.sql$/, "$1");
      const result = await loader();
      const sql = typeof result === "string" ? result : String(result);
      return [name, sql.trim()] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<TKeys, string>;
}
