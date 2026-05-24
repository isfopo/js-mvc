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
 * Recursively find all .sql files under a root path and group them
 * by their parent directory. Excludes generated files and init.sql.
 *
 * Returns a Map of directory path → sorted .sql file names.
 */
async function findSqlFileGroups(root: string): Promise<Map<string, string[]>> {
  const groups = new Map<string, string[]>();

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          await walk(fullPath);
        }
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".sql") &&
        entry.name !== "init.sql" &&
        !entry.name.includes(".generated")
      ) {
        const parent = dir;
        const existing = groups.get(parent);
        if (existing) {
          existing.push(entry.name);
        } else {
          groups.set(parent, [entry.name]);
        }
      }
    }
  }

  await walk(root);

  // Sort file names within each group for deterministic output
  for (const [, files] of groups) {
    files.sort();
  }

  return groups;
}

/**
 * Recursively hash all .sql files under a directory to detect changes.
 * Excludes init.sql and .generated files to match findSqlFileGroups behavior.
 * Returns a SHA-256 hash of all file contents.
 */
async function hashDirectory(dir: string): Promise<string> {
  const hash = createHash("sha256");

  async function walk(currentDir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    // Collect and sort .sql files in this directory
    const sqlFiles = entries
      .filter((f) =>
        f.isFile() &&
        f.name.endsWith(".sql") &&
        f.name !== "init.sql" &&
        !f.name.includes(".generated")
      )
      .map((f) => f.name)
      .sort();

    for (const file of sqlFiles) {
      const content = await readFile(join(currentDir, file), "utf-8");
      hash.update(content);
    }

    // Recurse into subdirectories (skip hidden dirs and node_modules)
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        await walk(join(currentDir, entry.name));
      }
    }
  }

  await walk(dir);
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
 * Clear the generation cache. Called at the start of each build
 * to ensure stale entries from deleted directories are removed.
 */
function clearCache(): void {
  cache.migrationsHash = "";
  cache.tables = [];
  cache.barrelHashes.clear();
}

/**
 * Run the full SQL type generation pipeline:
 * 1. Parse migrations → generate db-types.d.ts
 * 2. Generate local.db for external SQL tools
 * 3. Scan queries/ directories → generate typed barrels
 */
async function runSqlTypeGeneration(
  projectRoot: string,
  overrides: Record<string, string> = {},
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

  // 3. Find all .sql files and generate barrels per directory (with caching)
  const tableNames = tables.map((t) => t.name);
  const sqlFileGroups = await findSqlFileGroups(dataDir);

  for (const [queriesDir] of sqlFileGroups) {
    // Check if this barrel needs regeneration.
    // Include migrationsHash so barrels regenerate when db-types.d.ts changes,
    // even if the .sql query files themselves haven't changed.
    const dirHash = await hashDirectory(queriesDir);
    const barrelHash = `${dirHash}:${migrationsHash}`;
    const cachedHash = cache.barrelHashes.get(queriesDir);
    
    if (cachedHash === barrelHash) {
      console.log(`✓ Using cached barrel for ${queriesDir.split("/").slice(-2).join("/")}`);
      continue;
    }

    // Look for a model.ts in the parent directory of the .sql files
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
  const { tableNameOverrides = {} } = options;
  let projectRoot: string;

  return {
    name: "sql-types",
    enforce: "pre",

    configResolved(config) {
      projectRoot = config.root;
    },

    async buildStart() {
      console.log("🗄️  Generating SQL types...");
      clearCache();
      try {
        await runSqlTypeGeneration(projectRoot, tableNameOverrides);
        console.log("✓ SQL types generated");
      } catch (e) {
        console.error("✗ SQL type generation failed:", (e as Error).message);
      }
    },

    transform(code, id) {
      // Strip YAML front matter from .sql files after Vite's raw loader
      // has converted them to `export default "..."` modules.
      if (!id.endsWith(".sql")) return;

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
            await runSqlTypeGeneration(projectRoot, tableNameOverrides);
            console.log("✓ SQL types regenerated\n");
          });
        }

        // Regenerate barrel on query file changes
        if (
          file.startsWith(dataDir) &&
          file.endsWith(".sql") &&
          !file.includes(".generated") &&
          !file.endsWith("init.sql")
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
