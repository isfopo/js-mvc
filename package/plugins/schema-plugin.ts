import type { Plugin } from "vite";
import { resolve, dirname, join } from "path";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { build as esbuild } from "esbuild";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { generateDbTypesContent } from "../src/schema/generate-types";
import { serializeSchemaDef, serializeSchemaSql } from "../src/schema/serialize";
import type { SchemaDef } from "../src/schema/schema-def";

// ---------------------------------------------------------------------------
// Options / paths
// ---------------------------------------------------------------------------

export interface SchemaPluginOptions {
  /**
   * Path to the TypeScript schema module (source of truth).
   * @default "src/domains/schema.ts"
   */
  schemaPath?: string;
  /**
   * Output path for the generated model types.
   * @default "src/domains/db-types.d.ts"
   */
  dbTypesPath?: string;
  /**
   * Output path for the derived schema.sql (tooling / manual wrangler use).
   * @default "src/migrations/schema.sql"
   */
  schemaSqlPath?: string;
  /**
   * Output path for the generated runtime schema module the Worker imports.
   * @default "src/.generated/schema.ts"
   */
  generatedSchemaPath?: string;
  /** Override automatic table name to type name conversions. */
  tableNameOverrides?: Record<string, string>;
}

interface ResolvedPaths {
  projectRoot: string;
  schemaPath: string;
  dbTypesPath: string;
  schemaSqlPath: string;
  generatedSchemaPath: string;
  tableNameOverrides: Record<string, string>;
}

function resolvePaths(projectRoot: string, options: SchemaPluginOptions): ResolvedPaths {
  const toAbs = (p: string | undefined, fallback: string) =>
    p && p.startsWith("/") ? p : resolve(projectRoot, p ?? fallback);
  return {
    projectRoot,
    schemaPath: toAbs(options.schemaPath, "src/domains/schema.ts"),
    dbTypesPath: toAbs(options.dbTypesPath, "src/domains/db-types.d.ts"),
    schemaSqlPath: toAbs(options.schemaSqlPath, "src/migrations/schema.sql"),
    generatedSchemaPath: toAbs(
      options.generatedSchemaPath,
      "src/.generated/schema.ts",
    ),
    tableNameOverrides: options.tableNameOverrides ?? {},
  };
}

// ---------------------------------------------------------------------------
// Load the schema module (bundle TS → ESM, resolve js-mvc/schema alias)
// ---------------------------------------------------------------------------

/**
 * Bundle the schema module to a temp ESM file (resolving the js-mvc/schema
 * import to the framework DSL), then import it and return the exported SchemaDef.
 */
async function loadSchemaModule(paths: ResolvedPaths): Promise<SchemaDef> {
  const frameworkIndex = resolve(paths.projectRoot, "package/src/schema/index.ts");

  const result = await esbuild({
    entryPoints: [paths.schemaPath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    // Inline the DSL so the schema module is self-contained (no runtime imports).
    plugins: [
      {
        name: "js-mvc-schema-alias",
        setup(build) {
          build.onResolve({ filter: /^js-mvc\/schema$/ }, () => ({
            path: frameworkIndex,
          }));
        },
      },
    ],
  });

  const code = result.outputFiles[0].text;
  const tmpFile = join(
    tmpdir(),
    `js-mvc-schema-${createHash("sha1").update(paths.schemaPath).digest("hex").slice(0, 12)}-${Date.now()}.mjs`,
  );
  await writeFile(tmpFile, code, "utf-8");
  try {
    const mod = (await import(pathToFileURL(tmpFile).href)) as {
      schema: SchemaDef;
    };
    return mod.schema;
  } finally {
    // Clean up the temp file best-effort (may still be referenced in dev).
    await unlink(tmpFile).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

async function generateSchemaOutputs(paths: ResolvedPaths): Promise<void> {
  const schema = await loadSchemaModule(paths);

  // 1. Model types.
  await mkdir(dirname(paths.dbTypesPath), { recursive: true });
  await writeFile(
    paths.dbTypesPath,
    generateDbTypesContent(schema, paths.tableNameOverrides),
    "utf-8",
  );

  // 2. Derived schema.sql.
  await mkdir(dirname(paths.schemaSqlPath), { recursive: true });
  await writeFile(paths.schemaSqlPath, serializeSchemaSql(schema), "utf-8");

  // 3. Runtime schema module.
  await mkdir(dirname(paths.generatedSchemaPath), { recursive: true });
  await writeFile(paths.generatedSchemaPath, serializeSchemaDef(schema), "utf-8");
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Vite plugin that turns the TypeScript schema definition into:
 *   - generated model types (src/domains/db-types.d.ts)
 *   - a derived schema.sql for tooling
 *   - a runtime schema module (src/.generated/schema.ts) for applySchema()
 * Replaces the SQL-parse→types role of sqlTypesPlugin for schema shape.
 */
export function schemaPlugin(options: SchemaPluginOptions = {}): Plugin {
  let projectRoot: string;
  let paths: ResolvedPaths;

  return {
    name: "js-mvc-schema",
    enforce: "pre",

    configResolved(config) {
      projectRoot = config.root;
      paths = resolvePaths(projectRoot, options);
    },

    async buildStart() {
      console.log("📐 Generating schema outputs (types, sql, runtime)...");
      try {
        await generateSchemaOutputs(paths);
        console.log("✓ Schema outputs generated");
      } catch (e) {
        console.error("✗ Schema generation failed:", (e as Error).message);
      }
    },

    configureServer(server) {
      server.watcher.add(paths.schemaPath);
      const onSchemaChange = async (file: string) => {
        if (file !== paths.schemaPath) return;
        try {
          await generateSchemaOutputs(paths);
          const mods = server.moduleGraph.getModulesByFile(paths.generatedSchemaPath);
          for (const mod of mods ?? []) {
            server.moduleGraph.invalidateModule(mod);
          }
          console.log("✓ Schema outputs regenerated");
        } catch (e) {
          console.error("✗ Schema generation failed:", (e as Error).message);
        }
      };
      server.watcher.on("change", onSchemaChange);
      server.watcher.on("add", onSchemaChange);
    },
  };
}
