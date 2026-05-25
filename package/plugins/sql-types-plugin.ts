import type { Plugin } from "vite";
import { resolve, dirname, join } from "path";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  parseMigrations,
  generateDbTypes,
  generateQueryBarrel,
  generateLocalDb,
  type TableDef,
} from "./sql-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively find all .sql files under a root path and group them
 * by their parent directory. Excludes generated files and init.sql.
 *
 * Returns a Map of directory path → sorted .sql file names.
 */
async function findSqlFileGroups(
  root: string,
  excludePatterns: string[] = [".generated", "init.sql"],
): Promise<Map<string, string[]>> {
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
        !excludePatterns.some((p) => entry.name.includes(p) || entry.name === p)
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

  for (const [, files] of groups) {
    files.sort();
  }

  return groups;
}

/**
 * Recursively hash all .sql files under a directory to detect changes.
 * Returns a SHA-256 hash of all file contents.
 */
async function hashDirectory(
  dir: string,
  excludePatterns: string[] = [".generated", "init.sql"],
): Promise<string> {
  const hash = createHash("sha256");

  async function walk(currentDir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    const sqlFiles = entries
      .filter(
        (f) =>
          f.isFile() &&
          f.name.endsWith(".sql") &&
          !excludePatterns.some((p) => f.name.includes(p) || f.name === p),
      )
      .map((f) => f.name)
      .sort();

    for (const file of sqlFiles) {
      const content = await readFile(join(currentDir, file), "utf-8");
      hash.update(content);
    }

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

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface GenerationCache {
  migrationsHash: string;
  tables: TableDef[];
  barrelHashes: Map<string, string>;
}

function createCache(): GenerationCache {
  return {
    migrationsHash: "",
    tables: [],
    barrelHashes: new Map(),
  };
}

function clearCache(cache: GenerationCache): void {
  cache.migrationsHash = "";
  cache.tables = [];
  cache.barrelHashes.clear();
}

// ---------------------------------------------------------------------------
// Generation pipeline
// ---------------------------------------------------------------------------

export interface SqlTypesPluginOptions {
  /**
   * Path to the migrations directory (relative to project root or absolute).
   * @default "migrations"
   */
  migrationsDir?: string;

  /**
   * Path to the data directory containing .sql query files (relative to project root or absolute).
   * @default "src/data"
   */
  dataDir?: string;

  /**
   * Output path for the generated db-types.d.ts file.
   * @default "src/data/db-types.d.ts"
   */
  dbTypesPath?: string;

  /**
   * Output path for the local.db SQLite file.
   * @default "local.db"
   */
  localDbPath?: string;

  /**
   * Name of the model file to look for in parent directories of .sql files.
   * @default "model.ts"
   */
  modelFileName?: string;

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
   * Patterns to exclude when scanning for .sql files.
   * @default [".generated", "init.sql"]
   */
  sqlExcludePatterns?: string[];
}

interface ResolvedPaths {
  migrationsDir: string;
  dataDir: string;
  dbTypesPath: string;
  localDbPath: string;
  modelFileName: string;
  sqlExcludePatterns: string[];
}

function resolvePaths(
  projectRoot: string,
  options: SqlTypesPluginOptions,
): ResolvedPaths {
  const toAbsolute = (p: string | undefined, fallback: string) =>
    p && p.startsWith("/") ? p : resolve(projectRoot, p ?? fallback);

  return {
    migrationsDir: toAbsolute(options.migrationsDir, "migrations"),
    dataDir: toAbsolute(options.dataDir, "src/data"),
    dbTypesPath: toAbsolute(options.dbTypesPath, "src/data/db-types.d.ts"),
    localDbPath: toAbsolute(options.localDbPath, "local.db"),
    modelFileName: options.modelFileName ?? "model.ts",
    sqlExcludePatterns: options.sqlExcludePatterns ?? [
      ".generated",
      "init.sql",
    ],
  };
}

/**
 * Run the full SQL type generation pipeline:
 * 1. Parse migrations → generate db-types.d.ts
 * 2. Generate local.db for external SQL tools
 * 3. Scan queries/ directories → generate typed barrels
 */
async function runSqlTypeGeneration(
  paths: ResolvedPaths,
  tableNameOverrides: Record<string, string>,
  cache: GenerationCache,
): Promise<TableDef[]> {
  // 1. Parse migrations and generate db-types.d.ts (with caching)
  const migrationsHash = await hashDirectory(
    paths.migrationsDir,
    paths.sqlExcludePatterns,
  );
  let tables: TableDef[];

  if (cache.migrationsHash === migrationsHash && cache.tables.length > 0) {
    console.log("✓ Using cached migration parse");
    tables = cache.tables;
  } else {
    try {
      tables = await parseMigrations(paths.migrationsDir);
      cache.migrationsHash = migrationsHash;
      cache.tables = tables;
    } catch (e) {
      throw new Error(
        `Failed to parse migrations in ${paths.migrationsDir}: ${(e as Error).message}`,
      );
    }

    try {
      await generateDbTypes(tables, paths.dbTypesPath, tableNameOverrides);
    } catch (e) {
      throw new Error(
        `Failed to generate ${paths.dbTypesPath}: ${(e as Error).message}`,
      );
    }

    // 2. Generate local.db
    try {
      generateLocalDb(paths.migrationsDir, paths.localDbPath);
    } catch (e) {
      console.warn(`⚠ Failed to generate local.db: ${(e as Error).message}`);
    }
  }

  // 3. Find all .sql files and generate barrels per directory (with caching)
  const tableNames = tables.map((t) => t.name);
  const sqlFileGroups = await findSqlFileGroups(
    paths.dataDir,
    paths.sqlExcludePatterns,
  );

  for (const [queriesDir] of sqlFileGroups) {
    const dirHash = await hashDirectory(queriesDir, paths.sqlExcludePatterns);
    const barrelHash = `${dirHash}:${migrationsHash}`;
    const cachedHash = cache.barrelHashes.get(queriesDir);

    if (cachedHash === barrelHash) {
      console.log(
        `✓ Using cached barrel for ${queriesDir.split("/").slice(-2).join("/")}`,
      );
      continue;
    }

    const parentDir = dirname(queriesDir);
    const modelPath = join(parentDir, paths.modelFileName);
    const modelFile = existsSync(modelPath) ? modelPath : null;

    try {
      await generateQueryBarrel(
        queriesDir,
        tableNames,
        paths.dbTypesPath,
        modelFile,
        tableNameOverrides,
      );
      cache.barrelHashes.set(queriesDir, barrelHash);
    } catch (e) {
      throw new Error(
        `Failed to generate barrel for ${queriesDir}: ${(e as Error).message}`,
      );
    }
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Vite plugin for SQL type generation.
 *
 * - Parses migration SQL files and generates a typed `db-types.d.ts`
 * - Generates a `local.db` SQLite file for external SQL browser tools
 * - Generates typed query barrels for each `queries/` directory
 * - Watches for changes in dev mode and regenerates automatically
 *
 * Note: YAML front matter stripping is handled by `sqlTransformPlugin`.
 */
export function sqlTypesPlugin(options: SqlTypesPluginOptions = {}): Plugin {
  let projectRoot: string;
  let resolvedPaths: ResolvedPaths;
  const cache = createCache();

  return {
    name: "sql-types",
    enforce: "pre",

    configResolved(config) {
      projectRoot = config.root;
      resolvedPaths = resolvePaths(projectRoot, options);
    },

    async buildStart() {
      console.log("🗄️  Generating SQL types...");
      clearCache(cache);
      try {
        await runSqlTypeGeneration(
          resolvedPaths,
          options.tableNameOverrides ?? {},
          cache,
        );
        console.log("✓ SQL types generated");
      } catch (e) {
        console.error("✗ SQL type generation failed:", (e as Error).message);
      }
    },

    configureServer(server) {
      server.watcher.add(resolvedPaths.migrationsDir);
      server.watcher.add(resolvedPaths.dataDir);

      let regenerationTimeout: ReturnType<typeof setTimeout> | null = null;
      const DEBOUNCE_MS = 100;

      const debouncedRegenerate = (
        _file: string,
        regenerate: () => Promise<void>,
      ) => {
        if (regenerationTimeout) {
          clearTimeout(regenerationTimeout);
        }

        regenerationTimeout = setTimeout(async () => {
          try {
            await regenerate();
          } catch (e) {
            console.error(
              "✗ SQL type generation failed:",
              (e as Error).message,
            );
          }
        }, DEBOUNCE_MS);
      };

      server.watcher.on("change", async (file: string) => {
        // Regenerate on migration changes
        if (
          file.startsWith(resolvedPaths.migrationsDir) &&
          file.endsWith(".sql") &&
          !resolvedPaths.sqlExcludePatterns.some((p) => file.includes(p))
        ) {
          console.log(
            `\n🗄️  Migration changed: ${file.split("/").pop()}, regenerating types...`,
          );
          debouncedRegenerate(file, async () => {
            await runSqlTypeGeneration(
              resolvedPaths,
              options.tableNameOverrides ?? {},
              cache,
            );
            console.log("✓ SQL types regenerated\n");
          });
        }

        // Regenerate barrel on query file changes
        if (
          file.startsWith(resolvedPaths.dataDir) &&
          file.endsWith(".sql") &&
          !resolvedPaths.sqlExcludePatterns.some((p) => file.includes(p))
        ) {
          console.log(
            `\n🗄️  Query changed: ${file.split("/").pop()}, regenerating barrel...`,
          );
          debouncedRegenerate(file, async () => {
            const tables = await parseMigrations(resolvedPaths.migrationsDir);
            const tableNames = tables.map((t) => t.name);

            const queriesDir = dirname(file);
            const parentDir = dirname(queriesDir);
            const modelPath = join(parentDir, resolvedPaths.modelFileName);
            const modelFile = existsSync(modelPath) ? modelPath : null;

            await generateQueryBarrel(
              queriesDir,
              tableNames,
              resolvedPaths.dbTypesPath,
              modelFile,
              options.tableNameOverrides ?? {},
            );
            console.log("✓ Query barrel regenerated\n");
          });
        }
      });
    },
  };
}
