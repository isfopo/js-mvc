import type { Plugin, ViteDevServer } from "vite";
import { execSync } from "child_process";
import { resolve, dirname, join } from "path";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { parseMigrations } from "./sql-types/parse-migrations";
import { generateDbTypes } from "./sql-types/generate-db-types";
import { generateQueryBarrel } from "./sql-types/generate-query-barrel";
import { generateLocalDb } from "./sql-types/generate-local-db";
import type { TableDef } from "./sql-types/parse-migrations";

/**
 * Custom plugin to rebuild the global CSS bundle on file changes.
 */
export function cssBuilderPlugin(): Plugin {
  let isBuilding = false;

  return {
    name: "css-builder",

    buildStart() {
      console.log("🔨 Building CSS...");
      try {
        execSync("npm run build:css", { stdio: "inherit" });
      } catch (e) {
        console.error("CSS build failed");
      }
    },

    configureServer(server: ViteDevServer) {
      const watchDirs = [
        resolve(process.cwd(), "src", "styles"),
        resolve(process.cwd(), "src", "components"),
        resolve(process.cwd(), "src", "pages"),
        resolve(process.cwd(), "src", "assets", "icons"),
      ];

      watchDirs.forEach((dir) => server.watcher.add(dir));

      server.watcher.on("change", (file: string) => {
        if (
          (file.endsWith(".css") || file.endsWith(".module.css") || file.endsWith(".svg")) &&
          !file.includes("/public/") &&
          !file.includes("/.generated/")
        ) {
          console.log(`\n📝 ${file.split("/").pop()} changed, rebuilding CSS...`);

          if (!isBuilding) {
            isBuilding = true;
            try {
              execSync("npm run build:css", { stdio: "inherit" });
              const layoutFile = resolve(process.cwd(), "src", "layouts", "Layout.tsx");
              server.watcher.emit("change", layoutFile);
              console.log("✓ CSS rebuilt\n");
            } catch (e) {
              console.error("✗ CSS build failed\n");
            } finally {
              isBuilding = false;
            }
          }
        }
      });
    },
  };
}

/**
 * Recursively find all directories with the specified name under a root path.
 */
async function findQueriesDirs(root: string, dirName: string = "queries"): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(dir, entry.name);
      if (entry.name === dirName) {
        results.push(fullPath);
      } else if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        await walk(fullPath);
      }
    }
  }

  await walk(root);
  return results;
}

/**
 * Hash all files in a directory to detect changes.
 * Returns a SHA-256 hash of all file contents.
 */
async function hashDirectory(dir: string): Promise<string> {
  const hash = createHash("sha256");
  
  try {
    const files = (await readdir(dir, { withFileTypes: true }))
      .filter((f) => f.isFile() && f.name.endsWith(".sql"))
      .map((f) => f.name)
      .sort();

    for (const file of files) {
      const content = await readFile(join(dir, file), "utf-8");
      hash.update(content);
    }
  } catch {
    // Directory doesn't exist or can't be read
    return "";
  }

  return hash.digest("hex");
}

/**
 * Cache for tracking file changes and avoiding unnecessary regeneration.
 */
interface GenerationCache {
  migrationsHash: string;
  tables: TableDef[];
  barrelHashes: Map<string, string>;
}

const cache: GenerationCache = {
  migrationsHash: "",
  tables: [],
  barrelHashes: new Map(),
};

/**
 * Run the full SQL type generation pipeline:
 * 1. Parse migrations → generate db-types.d.ts
 * 2. Generate local.db for external SQL tools
 * 3. Scan queries/ directories → generate typed barrels
 */
async function runSqlTypeGeneration(
  projectRoot: string,
  overrides: Record<string, string> = {},
  queriesDirName: string = "queries",
): Promise<TableDef[]> {
  const migrationsDir = resolve(projectRoot, "migrations");
  const srcDir = resolve(projectRoot, "src");
  const dataDir = resolve(srcDir, "data");
  const dbTypesPath = resolve(dataDir, "db-types.d.ts");

  // 1. Parse migrations and generate db-types.d.ts (with caching)
  const migrationsHash = await hashDirectory(migrationsDir);
  let tables: TableDef[];
  
  if (cache.migrationsHash === migrationsHash && cache.tables.length > 0) {
    console.log("✓ Using cached migration parse");
    tables = cache.tables;
  } else {
    try {
      tables = await parseMigrations(migrationsDir);
      cache.migrationsHash = migrationsHash;
      cache.tables = tables;
    } catch (e) {
      throw new Error(
        `Failed to parse migrations in ${migrationsDir}: ${(e as Error).message}`
      );
    }

    try {
      await generateDbTypes(tables, dbTypesPath, overrides);
    } catch (e) {
      throw new Error(
        `Failed to generate ${dbTypesPath}: ${(e as Error).message}`
      );
    }

    // 2. Generate local.db
    try {
      generateLocalDb(migrationsDir, resolve(projectRoot, "local.db"));
    } catch (e) {
      console.warn(`⚠ Failed to generate local.db: ${(e as Error).message}`);
    }
  }

  // 3. Find all queries/ directories and generate barrels (with caching)
  const tableNames = tables.map((t) => t.name);
  const queriesDirs = await findQueriesDirs(dataDir, queriesDirName);

  for (const queriesDir of queriesDirs) {
    // Check if this barrel needs regeneration
    const barrelHash = await hashDirectory(queriesDir);
    const cachedHash = cache.barrelHashes.get(queriesDir);
    
    if (cachedHash === barrelHash) {
      console.log(`✓ Using cached barrel for ${queriesDir.split("/").slice(-2).join("/")}`);
      continue;
    }

    // Look for a model.ts in the parent directory of queries/
    const parentDir = dirname(queriesDir);
    const modelPath = join(parentDir, "model.ts");
    const modelFile = existsSync(modelPath) ? modelPath : null;

    try {
      await generateQueryBarrel(queriesDir, tableNames, dbTypesPath, modelFile, overrides);
      cache.barrelHashes.set(queriesDir, barrelHash);
    } catch (e) {
      throw new Error(
        `Failed to generate barrel for ${queriesDir}: ${(e as Error).message}`
      );
    }
  }

  return tables;
}

export interface SqlTypesPluginOptions {
  /**
   * Override automatic table name to type name conversions.
   * Map of table names (as they appear in the database) to desired TypeScript type names.
   * 
   * @example
   * {
   *   "people": "Person",
   *   "children": "Child",
   *   "user_profiles": "UserProfile"
   * }
   */
  tableNameOverrides?: Record<string, string>;
  
  /**
   * Name of directories containing SQL query files.
   * The plugin will recursively search for directories with this name under src/data/.
   * 
   * @default "queries"
   * 
   * @example
   * "sql" // will search for directories named "sql" instead of "queries"
   */
  queriesDirName?: string;
}

/**
 * Vite plugin for SQL type generation.
 *
 * - Parses migration SQL files and generates `src/data/db-types.d.ts`
 * - Generates `local.db` for external SQL browser tools
 * - Strips YAML front matter from `.sql` imports at build time
 * - Generates typed query barrels for each `queries/` directory
 * - Watches for changes in dev mode and regenerates automatically
 */
export function sqlTypesPlugin(options: SqlTypesPluginOptions = {}): Plugin {
  const { tableNameOverrides = {}, queriesDirName = "queries" } = options;
  let projectRoot: string;

  return {
    name: "sql-types",
    enforce: "pre",

    configResolved(config) {
      projectRoot = config.root;
    },

    async buildStart() {
      console.log("🗄️  Generating SQL types...");
      try {
        await runSqlTypeGeneration(projectRoot, tableNameOverrides, queriesDirName);
        console.log("✓ SQL types generated");
      } catch (e) {
        console.error("✗ SQL type generation failed:", (e as Error).message);
      }
    },

    transform(code, id) {
      // Strip YAML front matter from .sql files after Vite's raw loader
      // has converted them to `export default "..."` modules.
      if (!id.includes(".sql")) return;

      // Match: export default "...";
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

    configureServer(server) {
      const migrationsDir = resolve(projectRoot, "migrations");
      const dataDir = resolve(projectRoot, "src", "data");

      server.watcher.add(migrationsDir);
      server.watcher.add(dataDir);

      // Debounce regeneration to prevent race conditions when multiple files change rapidly
      let regenerationTimeout: ReturnType<typeof setTimeout> | null = null;
      const DEBOUNCE_MS = 100;

      const debouncedRegenerate = (file: string, regenerate: () => Promise<void>) => {
        if (regenerationTimeout) {
          clearTimeout(regenerationTimeout);
        }

        regenerationTimeout = setTimeout(async () => {
          try {
            await regenerate();
          } catch (e) {
            console.error("✗ SQL type generation failed:", (e as Error).message);
          }
        }, DEBOUNCE_MS);
      };

      server.watcher.on("change", async (file: string) => {
        // Regenerate on migration changes
        if (file.includes("/migrations/") && file.endsWith(".sql")) {
          console.log(`\n🗄️  Migration changed: ${file.split("/").pop()}, regenerating types...`);
          debouncedRegenerate(file, async () => {
            await runSqlTypeGeneration(projectRoot, tableNameOverrides, queriesDirName);
            console.log("✓ SQL types regenerated\n");
          });
        }

        // Regenerate barrel on query file changes
        if (
          file.includes(`/${queriesDirName}/`) &&
          file.endsWith(".sql") &&
          !file.includes("queries.generated")
        ) {
          console.log(`\n🗄️  Query changed: ${file.split("/").pop()}, regenerating barrel...`);
          debouncedRegenerate(file, async () => {
            const tables = await parseMigrations(resolve(projectRoot, "migrations"));
            const tableNames = tables.map((t) => t.name);
            const dbTypesPath = resolve(projectRoot, "src", "data", "db-types.d.ts");
            const queriesDir = dirname(file);
            const parentDir = dirname(queriesDir);
            const modelPath = join(parentDir, "model.ts");
            const modelFile = existsSync(modelPath) ? modelPath : null;

            await generateQueryBarrel(queriesDir, tableNames, dbTypesPath, modelFile, tableNameOverrides);
            console.log("✓ Query barrel regenerated\n");
          });
        }
      });
    },
  };
}
