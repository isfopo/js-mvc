# SQL Types Plugin Review — Implementation Plan

## Overview

This document outlines the implementation plan to address issues identified in the code review of the type-safe SQL query system (PR #56). The review identified 10 areas for improvement, ranging from critical (missing tests, fragile regex) to nice-to-have (caching, debouncing).

**Goal**: Make the SQL types plugin robust, well-tested, and production-ready.

---

## Phase 1: Critical Fixes (High Priority)

### 1.1 Add Unit Tests for Plugin Modules

**Problem**: Zero test coverage for `parse-migrations.ts`, `generate-db-types.ts`, `generate-query-barrel.ts`, and `parse-front-matter.ts`.

**Solution**: Create comprehensive unit tests for each module.

**Files to Create**:
- `.vite/sql-types/parse-migrations.test.ts`
- `.vite/sql-types/generate-db-types.test.ts`
- `.vite/sql-types/generate-query-barrel.test.ts`
- `.vite/sql-types/parse-front-matter.test.ts`

**Test Cases**:

#### `parse-migrations.test.ts`
```ts
describe("parseMigrations", () => {
  it("parses simple CREATE TABLE", () => {
    // Test basic table with INTEGER, TEXT columns
  });

  it("parses CHECK constraints with IN clause", () => {
    // Test: CHECK(status IN ('draft','voting','accepted'))
  });

  it("handles multi-line CREATE TABLE", () => {
    // Test with newlines and indentation
  });

  it("skips table-level constraints", () => {
    // Test: UNIQUE(col1, col2), FOREIGN KEY, PRIMARY KEY (col1, col2)
  });

  it("handles IF NOT EXISTS", () => {
    // Test: CREATE TABLE IF NOT EXISTS users (...)
  });

  it("ignores DROP TABLE and ALTER TABLE", () => {
    // Ensure only CREATE TABLE is parsed
  });

  it("processes migrations in sorted order", () => {
    // Test: 001_ before 002_
  });
});

describe("parseColumnDef", () => {
  it("extracts column name and type", () => {
    // Test: "id INTEGER PRIMARY KEY" → { name: "id", sqliteType: "INTEGER" }
  });

  it("detects NOT NULL", () => {
    // Test: "name TEXT NOT NULL"
  });

  it("detects PRIMARY KEY", () => {
    // Test: "id INTEGER PRIMARY KEY"
  });

  it("extracts CHECK IN values", () => {
    // Test: "status TEXT CHECK(status IN ('a','b'))"
  });

  it("returns null for table constraints", () => {
    // Test: "UNIQUE(col1, col2)" → null
  });
});

describe("extractCheckValues", () => {
  it("extracts single-quoted values", () => {
    // Test: CHECK(col IN ('a','b','c')) → ['a', 'b', 'c']
  });

  it("handles escaped quotes", () => {
    // Test: CHECK(col IN ('it''s', 'don''t'))
  });

  it("returns null for non-IN CHECK", () => {
    // Test: CHECK(col > 0) → null
  });
});
```

#### `generate-db-types.test.ts`
```ts
describe("singularize", () => {
  it("handles -s", () => {
    // "users" → "user"
  });

  it("handles -es", () => {
    // "boxes" → "box", "buses" → "bus"
  });

  it("handles -ies", () => {
    // "categories" → "category"
  });

  it("handles -ses, -xes, -zes, -ches, -shes", () => {
    // "classes" → "class", "foxes" → "fox"
  });

  it("doesn't singularize words ending in ss/us/is", () => {
    // "status" → "status", "analysis" → "analysis"
  });

  it("handles edge cases", () => {
    // "addresses" → "address" (currently fails)
    // "potatoes" → "potato" (currently fails)
    // "wolves" → "wolf" (currently fails)
  });
});

describe("tableNameToTypeName", () => {
  it("converts snake_case to PascalCase", () => {
    // "user_profiles" → "UserProfile"
  });

  it("uses overrides when provided", () => {
    // overrides: { "people": "Person" } → "Person"
  });

  it("singularizes after PascalCase conversion", () => {
    // "tenets" → "Tenet"
  });
});

describe("columnToTsType", () => {
  it("maps INTEGER to number", () => {});
  it("maps TEXT to string", () => {});
  it("maps REAL to number", () => {});
  it("maps BLOB to ArrayBuffer", () => {});
  it("adds | null for nullable columns", () => {});
  it("creates union types for CHECK IN", () => {});
});
```

#### `generate-query-barrel.test.ts`
```ts
describe("extractTypeReferences", () => {
  it("extracts uppercase identifiers", () => {
    // "Tenet" → ["Tenet"]
  });

  it("extracts multiple references", () => {
    // "Tenet & { option: TenetOption }" → ["Tenet", "TenetOption"]
  });

  it("ignores primitives", () => {
    // "string | null" → []
  });

  it("handles generic types", () => {
    // "Array<Tenet>" → ["Tenet"] (currently may fail)
  });
});

describe("generateBarrel", () => {
  it("generates correct imports", () => {
    // Test with table refs and model refs
  });

  it("generates QueryMap interface", () => {
    // Test with various param/result types
  });

  it("handles missing front matter", () => {
    // Test with SQL files without front matter
  });

  it("handles void result type", () => {
    // Test with INSERT/UPDATE queries
  });
});
```

#### `parse-front-matter.test.ts`
```ts
describe("parseFrontMatter", () => {
  it("parses params and result", () => {
    // Test with full front matter
  });

  it("handles missing params", () => {
    // Test with only result
  });

  it("handles missing result", () => {
    // Test with only params
  });

  it("handles no front matter", () => {
    // Test with plain SQL
  });

  it("handles empty front matter", () => {
    // Test with ---\n---\nSQL
  });
});
```

**Acceptance Criteria**:
- All plugin modules have >80% test coverage
- Edge cases for singularization are tested
- Tests run in CI/CD pipeline
- Tests pass without requiring a real D1 database

**Estimated Effort**: 4-6 hours

---

### 1.2 Fix Singularization Edge Cases

**Problem**: The `singularize` function fails on:
- "addresses" → "addresse" (should be "address")
- "potatoes" → "potatoe" (should be "potato")
- "wolves" → "wolve" (should be "wolf")
- Irregular plurals: "mice", "geese", "children"

**Solution**: Expand singularization rules and document limitations.

**Implementation**:

```ts
// .vite/sql-types/generate-db-types.ts

function singularize(word: string): string {
  // Don't singularize if already singular-looking
  if (word.endsWith("ss") || word.endsWith("us") || word.endsWith("is")) {
    return word;
  }

  // -ies → -y (e.g., Categories → Category)
  if (word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }

  // -ves → -f or -fe (e.g., Wolves → Wolf, Knives → Knife)
  if (word.endsWith("ves")) {
    // Try -f first (wolves → wolf)
    const withoutVes = word.slice(0, -3);
    return withoutVes + "f";
  }

  // -ses, -xes, -zes, -ches, -shes → remove 'es'
  if (
    word.endsWith("ses") ||
    word.endsWith("xes") ||
    word.endsWith("zes") ||
    word.endsWith("ches") ||
    word.endsWith("shes")
  ) {
    return word.slice(0, -2);
  }

  // -oes → -o (e.g., Potatoes → Potato, Tomatoes → Tomato)
  if (word.endsWith("oes")) {
    return word.slice(0, -2);
  }

  // -sses → -ss (e.g., Addresses → Address, Classes → Class)
  if (word.endsWith("sses")) {
    return word.slice(0, -2);
  }

  // -s → remove 's' (default case)
  if (word.endsWith("s")) {
    return word.slice(0, -1);
  }

  return word;
}
```

**Documentation Update**:

Add to `lit/typed-sql-vite-plugin.md`:

```markdown
### Singularization Limitations

The automatic singularization handles common English patterns but may fail on:
- Irregular plurals: "mice", "geese", "children", "people"
- Words with Latin/Greek roots: "data" → "datum", "criteria" → "criterion"

**Solution**: Use `tableNameOverrides` for irregular plurals:

```ts
sqlTypesPlugin({
  tableNameOverrides: {
    "people": "Person",
    "children": "Child",
    "data": "Datum",
  },
})
```
```

**Acceptance Criteria**:
- "addresses" → "address"
- "potatoes" → "potato"
- "wolves" → "wolf"
- Unit tests cover all edge cases
- Documentation explains limitations and override solution

**Estimated Effort**: 1-2 hours

---

### 1.3 Make stripFrontMatter Regex More Robust

**Problem**: The regex `/^---\n[\s\S]*?\n---\n([\s\S]*)$/` is fragile:
- Assumes exact `\n` line endings (fails on `\r\n`)
- Requires front matter to start at position 0 (fails with BOM or leading whitespace)
- Requires trailing newline after closing `---`

**Solution**: Make the regex more flexible and add error handling.

**Implementation**:

```ts
// .vite/sql-types/generate-query-barrel.ts

const helper = `/** Strip YAML front matter from SQL files at runtime. */
function stripFrontMatter(sql: string): string {
  // Handle BOM, leading whitespace, and different line endings
  const cleaned = sql.replace(/^\\ufeff/, "").trimStart();
  
  // Match front matter with flexible line endings
  const match = cleaned.match(/^---[\\r\\n]+[\\s\\S]*?[\\r\\n]+---[\\r\\n]+([\\s\\S]*)$/);
  
  if (!match) {
    // No front matter or malformed — return as-is
    return cleaned.trim();
  }
  
  return match[1].trim();
}`;
```

**Additional Safety**: Add validation in the plugin to warn if front matter stripping fails:

```ts
// .vite/sql-types/generate-query-barrel.ts

function validateFrontMatterStripping(sql: string, originalContent: string): void {
  const stripped = stripFrontMatter(sql);
  
  // If the stripped SQL still contains "---", front matter wasn't removed
  if (stripped.includes("---") && originalContent.includes("---")) {
    console.warn(
      "⚠ Front matter may not have been stripped correctly. " +
      "Check SQL file formatting."
    );
  }
}
```

**Acceptance Criteria**:
- Regex handles `\r\n` line endings
- Regex handles BOM and leading whitespace
- Regex handles missing trailing newline
- Unit tests verify all edge cases
- Validation warns on potential failures

**Estimated Effort**: 1-2 hours

---

### 1.4 Add SQL Validation with node-sql-parser

**Problem**: No validation that:
- SQL syntax is valid
- `@paramName` placeholders match `params:` keys
- `result:` type exists in `db-types.d.ts` or `model.ts`

**Solution**: Use `node-sql-parser` to validate SQL and extract placeholders.

**Installation**:
```bash
npm install -D node-sql-parser
```

**Implementation**:

Create `.vite/sql-types/validate-sql.ts`:

```ts
import { Parser } from "node-sql-parser";
import type { SqlFrontMatter } from "./parse-front-matter";

const parser = new Parser();

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  placeholders: string[];
}

/**
 * Validate SQL syntax and extract @paramName placeholders.
 */
export function validateSql(
  sql: string,
  frontMatter: SqlFrontMatter,
  knownTypes: Set<string>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholders: string[] = [];

  // 1. Validate SQL syntax
  try {
    // Replace @paramName with ? for parsing
    const normalizedSql = sql.replace(/@(\w+)/g, (_, name) => {
      placeholders.push(name);
      return "?";
    });
    
    parser.astify(normalizedSql, { database: "SQLite" });
  } catch (e) {
    errors.push(`SQL syntax error: ${(e as Error).message}`);
  }

  // 2. Validate placeholders match params
  const paramKeys = frontMatter.params ? Object.keys(frontMatter.params) : [];
  const placeholderSet = new Set(placeholders);
  const paramSet = new Set(paramKeys);

  // Check for placeholders not in params
  for (const placeholder of placeholders) {
    if (!paramSet.has(placeholder)) {
      warnings.push(
        `SQL uses @${placeholder} but it's not declared in params:`
      );
    }
  }

  // Check for params not used in SQL
  for (const param of paramKeys) {
    if (!placeholderSet.has(param)) {
      warnings.push(
        `params: declares ${param} but it's not used in SQL`
      );
    }
  }

  // 3. Validate result type exists
  if (frontMatter.result && frontMatter.result !== "void") {
    // Extract type references from result
    const typeRefs = extractTypeReferences(frontMatter.result);
    
    for (const ref of typeRefs) {
      if (!knownTypes.has(ref)) {
        warnings.push(
          `result: references type "${ref}" which doesn't exist in db-types.d.ts or model.ts`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    placeholders,
  };
}

/**
 * Extract type references from a type expression.
 */
function extractTypeReferences(typeExpr: string): string[] {
  const refs = new Set<string>();
  const identRegex = /\b([A-Z]\w*)\b/g;
  let match: RegExpExecArray | null;
  
  while ((match = identRegex.exec(typeExpr)) !== null) {
    const PRIMITIVE_TYPES = new Set([
      "string", "number", "boolean", "null", "undefined",
      "void", "any", "unknown", "never", "object",
    ]);
    
    if (!PRIMITIVE_TYPES.has(match[1])) {
      refs.add(match[1]);
    }
  }
  
  return [...refs];
}
```

**Integration**:

Update `.vite/sql-types/generate-query-barrel.ts`:

```ts
import { validateSql } from "./validate-sql";

export async function generateQueryBarrel(
  queriesDir: string,
  tableNames: string[],
  dbTypesPath: string,
  modelPath: string | null,
  overrides: Record<string, string> = {},
): Promise<void> {
  // ... existing code ...

  // Collect known types for validation
  const knownTypes = new Set<string>();
  
  // Add table types (PascalCase)
  for (const tableName of tableNames) {
    knownTypes.add(tableNameToTypeName(tableName, overrides));
  }
  
  // Add model types (if model.ts exists)
  if (modelPath) {
    const modelContent = await readFile(modelPath, "utf-8");
    const typeRefs = extractTypeReferences(modelContent);
    for (const ref of typeRefs) {
      knownTypes.add(ref);
    }
  }

  // Validate each SQL file
  for (const { name, data, sql } of queryEntries) {
    const validation = validateSql(sql, data, knownTypes);
    
    if (!validation.valid) {
      console.error(`✗ ${name}.sql: ${validation.errors.join(", ")}`);
    }
    
    for (const warning of validation.warnings) {
      console.warn(`⚠ ${name}.sql: ${warning}`);
    }
  }

  // ... rest of generation ...
}
```

**Acceptance Criteria**:
- SQL syntax errors are caught and reported with line numbers
- Placeholders not in `params:` generate warnings
- Params not used in SQL generate warnings
- Result types not in `db-types.d.ts` or `model.ts` generate warnings
- Validation runs on every build and in dev mode
- Build doesn't fail on warnings (only errors)

**Estimated Effort**: 3-4 hours

---

## Phase 2: Important Improvements (Medium Priority)

### 2.1 Update Documentation to Show PascalCase Type Names

**Problem**: `lit/typed-sql-vite-plugin.md` shows old output format with lowercase table names (e.g., `export interface users`), but actual output uses PascalCase (e.g., `export interface User`).

**Solution**: Update all examples in the documentation.

**Changes**:
- Line 132: `export interface users` → `export interface User`
- Line 142: `export interface tenets` → `export interface Tenet`
- Line 156: `export interface tenet_options` → `export interface TenetOption`
- Line 166: `export interface votes` → `export interface Vote`
- Line 177-180: Update `Database` interface to use PascalCase types
- Line 372: Update import statement to use PascalCase
- Line 387: Update `QueryMap` to use PascalCase result types

**Acceptance Criteria**:
- All code examples in documentation match actual output
- No lowercase table names in generated type examples

**Estimated Effort**: 30 minutes

---

### 2.2 Add `enforce: "pre"` to Plugin Configuration

**Problem**: Plugin doesn't specify `enforce: "pre"`, so it runs after Vite's default plugins. If another plugin transforms `.sql` files first, front matter stripping may fail.

**Solution**: Add `enforce: "pre"` to ensure the plugin runs before other transforms.

**Implementation**:

```ts
// .vite/plugins.ts

export function sqlTypesPlugin(options: SqlTypesPluginOptions = {}): Plugin {
  const { tableNameOverrides = {}, queriesDirName = "queries" } = options;
  let projectRoot: string;

  return {
    name: "sql-types",
    enforce: "pre", // ← Add this line

    configResolved(config) {
      projectRoot = config.root;
    },

    // ... rest of plugin ...
  };
}
```

**Acceptance Criteria**:
- Plugin runs before Vite's default transforms
- Front matter stripping works correctly even with other plugins

**Estimated Effort**: 5 minutes

---

### 2.3 Improve Error Messages with File Paths and Line Numbers

**Problem**: Error messages like "SQL type generation failed" don't indicate which file or what the issue was.

**Solution**: Wrap generation calls in try-catch blocks that add context.

**Implementation**:

```ts
// .vite/plugins.ts

async function runSqlTypeGeneration(
  projectRoot: string,
  overrides: Record<string, string> = {},
  queriesDirName: string = "queries",
): Promise<TableDef[]> {
  const migrationsDir = resolve(projectRoot, "migrations");
  const srcDir = resolve(projectRoot, "src");
  const dataDir = resolve(srcDir, "data");
  const dbTypesPath = resolve(dataDir, "db-types.d.ts");

  // 1. Parse migrations and generate db-types.d.ts
  let tables: TableDef[];
  try {
    tables = await parseMigrations(migrationsDir);
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

  // 3. Find all queries/ directories and generate barrels
  const tableNames = tables.map((t) => t.name);
  const queriesDirs = await findQueriesDirs(dataDir, queriesDirName);

  for (const queriesDir of queriesDirs) {
    const parentDir = dirname(queriesDir);
    const modelPath = join(parentDir, "model.ts");
    const modelFile = existsSync(modelPath) ? modelPath : null;

    try {
      await generateQueryBarrel(queriesDir, tableNames, dbTypesPath, modelFile, overrides);
    } catch (e) {
      throw new Error(
        `Failed to generate barrel for ${queriesDir}: ${(e as Error).message}`
      );
    }
  }

  return tables;
}
```

**Acceptance Criteria**:
- Error messages include file paths
- Error messages include original error details
- Errors are logged with clear context

**Estimated Effort**: 1 hour

---

### 2.4 Add Validation Warnings for Result Types

**Problem**: No validation that `result:` types exist in `db-types.d.ts` or `model.ts`.

**Solution**: Already covered in Phase 1.4 (SQL validation with node-sql-parser).

**Acceptance Criteria**: See Phase 1.4

---

## Phase 3: Nice-to-Have Improvements (Low Priority)

### 3.1 Add Debouncing to Prevent Race Conditions in Dev Mode

**Problem**: Multiple rapid file changes can cause race conditions where one regeneration overwrites another.

**Solution**: Add debouncing (100ms delay) before triggering regeneration.

**Implementation**:

```ts
// .vite/plugins.ts

export function sqlTypesPlugin(options: SqlTypesPluginOptions = {}): Plugin {
  const { tableNameOverrides = {}, queriesDirName = "queries" } = options;
  let projectRoot: string;
  let regenerationTimeout: NodeJS.Timeout | null = null;

  const debouncedRegenerate = (file: string) => {
    if (regenerationTimeout) {
      clearTimeout(regenerationTimeout);
    }

    regenerationTimeout = setTimeout(async () => {
      console.log(`\n🗄️  File changed: ${file.split("/").pop()}, regenerating types...`);
      try {
        await runSqlTypeGeneration(projectRoot, tableNameOverrides, queriesDirName);
        console.log("✓ SQL types regenerated\n");
      } catch (e) {
        console.error("✗ SQL type generation failed:", (e as Error).message);
      }
    }, 100); // 100ms debounce
  };

  return {
    name: "sql-types",
    enforce: "pre",

    // ... configResolved, buildStart, transform ...

    configureServer(server) {
      const migrationsDir = resolve(projectRoot, "migrations");
      const dataDir = resolve(projectRoot, "src", "data");

      server.watcher.add(migrationsDir);
      server.watcher.add(dataDir);

      server.watcher.on("change", (file: string) => {
        if (file.includes("/migrations/") && file.endsWith(".sql")) {
          debouncedRegenerate(file);
        }

        if (
          file.includes(`/${queriesDirName}/`) &&
          file.endsWith(".sql") &&
          !file.includes("queries.generated")
        ) {
          debouncedRegenerate(file);
        }
      });
    },
  };
}
```

**Acceptance Criteria**:
- Rapid file changes are debounced (100ms)
- Only one regeneration runs per batch of changes
- No race conditions in dev mode

**Estimated Effort**: 30 minutes

---

### 3.2 Consider Caching for Performance

**Problem**: Plugin re-parses all migrations and regenerates all barrels on every build.

**Solution**: Cache parsed migration results and only regenerate changed barrels.

**Implementation**:

```ts
// .vite/plugins.ts

interface Cache {
  migrations: {
    hash: string;
    tables: TableDef[];
  };
  barrels: Map<string, { hash: string; generated: boolean }>;
}

const cache: Cache = {
  migrations: { hash: "", tables: [] },
  barrels: new Map(),
};

async function runSqlTypeGeneration(
  projectRoot: string,
  overrides: Record<string, string> = {},
  queriesDirName: string = "queries",
): Promise<TableDef[]> {
  const migrationsDir = resolve(projectRoot, "migrations");
  
  // Check if migrations have changed
  const migrationsHash = await hashDirectory(migrationsDir);
  let tables: TableDef[];
  
  if (cache.migrations.hash === migrationsHash) {
    tables = cache.migrations.tables;
    console.log("✓ Using cached migration parse");
  } else {
    tables = await parseMigrations(migrationsDir);
    cache.migrations = { hash: migrationsHash, tables };
  }

  // ... rest of generation ...
}

async function hashDirectory(dir: string): Promise<string> {
  const { createHash } = await import("crypto");
  const { readdir, readFile } = await import("node:fs/promises");
  
  const hash = createHash("sha256");
  const files = (await readdir(dir)).sort();
  
  for (const file of files) {
    const content = await readFile(join(dir, file), "utf-8");
    hash.update(content);
  }
  
  return hash.digest("hex");
}
```

**Acceptance Criteria**:
- Migrations are only re-parsed when files change
- Barrels are only regenerated when their directory changes
- Cache is invalidated on file changes
- Performance improvement is measurable (>20% faster for unchanged files)

**Estimated Effort**: 2-3 hours

---

## Summary

| Phase | Tasks | Estimated Effort | Priority |
|-------|-------|------------------|----------|
| 1 | Unit tests, singularization fixes, regex robustness, SQL validation | 10-14 hours | High |
| 2 | Documentation updates, enforce: "pre", error messages | 2 hours | Medium |
| 3 | Debouncing, caching | 3 hours | Low |

**Total Estimated Effort**: 15-19 hours

**Recommended Approach**:
1. Start with Phase 1 (critical fixes) — these are blocking issues
2. Address Phase 2 (important improvements) — these improve DX significantly
3. Consider Phase 3 (nice-to-have) — these are optimizations for large projects

**Next Steps**:
1. Install `node-sql-parser`: `npm install -D node-sql-parser`
2. Create test files for plugin modules
3. Implement singularization fixes
4. Update stripFrontMatter regex
5. Add SQL validation
6. Update documentation
7. Add enforce: "pre" and improve error messages
8. (Optional) Add debouncing and caching

---

## Appendix: Original Code Review

### Summary

This PR implements a comprehensive type-safe SQL query system that auto-generates TypeScript types from D1 migrations and provides typed query barrels via YAML front matter annotations. The implementation is well-architected, follows project conventions, and solves a real developer experience problem. However, there are significant concerns around test coverage, edge cases in parsing logic, and documentation inconsistencies that should be addressed before merging.

---

### Critical Issues

None found — the core implementation is sound and all existing tests pass.

---

### Significant Concerns

- **No unit tests for the SQL types plugin**: The plugin modules (`parse-migrations.ts`, `generate-db-types.ts`, `generate-query-barrel.ts`, `parse-front-matter.ts`) have zero test coverage. While the integration tests pass, there's no validation of:
  - `parseMigrations` with various SQL formats (multi-line CREATE TABLE, complex CHECK constraints, foreign keys)
  - `singularize` with edge cases (e.g., "addresses", "buses", "status", "analysis")
  - `extractCheckValues` with malformed or nested CHECK constraints
  - `generateQueryBarrel` with missing, invalid, or empty front matter
  - `tableNameToTypeName` with irregular plurals not in overrides
  
  **Recommendation**: Add unit tests for each module, particularly for edge cases. At minimum, test `singularize`, `parseColumnDef`, and `extractCheckValues` with a variety of inputs.

- **Singularization edge cases**: The `singularize` function in `generate-db-types.ts` (lines 44-72) handles common patterns but will fail on:
  - Words ending in "sses" (e.g., "addresses" → "addresse" instead of "address")
  - Words ending in "oes" (e.g., "potatoes" → "potatoe" instead of "potato")
  - Words ending in "ves" (e.g., "wolves" → "wolve" instead of "wolf")
  - Irregular plurals not in overrides (e.g., "mice", "geese", "children")
  
  **Recommendation**: Either expand the singularization rules to handle these cases, or document that irregular plurals must be added to `tableNameOverrides`. Consider using a library like `pluralize` for robust singularization.

- **Runtime front matter stripping is a workaround**: The generated barrel includes a runtime `stripFrontMatter` function (lines 33-37 in `queries.generated.ts`) because vitest doesn't run the Vite transform hook. This means:
  - Every SQL file is processed twice (once at build time, once at runtime)
  - If the regex fails to match (e.g., due to BOM, leading whitespace, or different line endings), the front matter will be included in the SQL string, causing a runtime SQL syntax error
  - The regex `/^---\n[\s\S]*?\n---\n([\s\S]*)$/` is fragile and assumes exact formatting
  
  **Recommendation**: Make the regex more robust by handling `\r\n` line endings and optional leading whitespace. Consider: `/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]+([\s\S]*)$/`. Add a test to verify the regex handles various front matter formats.

- **Type expression parsing is fragile**: The `extractTypeReferences` function in `generate-query-barrel.ts` (lines 32-43) uses a simple regex `/\b([A-Z]\w*)\b/g` to find uppercase identifiers. This will fail on:
  - Generic types like `Array<Tenet>` or `Promise<Tenet>`
  - Complex expressions with nested types like `Tenet & { options: TenetOption[] }`
  - Types with namespaces like `Foo.Bar`
  - Union types with primitives like `Tenet | null`
  
  **Recommendation**: Document the limitations of type expression parsing. For complex types, require users to define them in `model.ts` and reference them by name. Consider adding validation to warn when a type expression contains patterns that may not be parsed correctly.

- **No validation of front matter against SQL**: The plugin doesn't validate that:
  - `@paramName` placeholders in SQL match the keys in `params:`
  - The `result:` type actually exists in `db-types.d.ts` or `model.ts`
  - The SQL syntax is valid
  
  This means typos in front matter will only be caught at runtime (or not at all, if the query is never executed).
  
  **Recommendation**: Add validation warnings in the plugin:
  - Parse `@paramName` placeholders from SQL and compare with `params:` keys
  - Check if `result:` references a known type (from `db-types.d.ts` or `model.ts`)
  - Log warnings for mismatches without failing the build

---

### Minor Suggestions

- **Documentation inconsistency**: The `lit/typed-sql-vite-plugin.md` file shows the old output format with lowercase table names (e.g., `export interface users` on line 132), but the actual generated output uses PascalCase (e.g., `export interface User`). The documentation should be updated to match the actual output.
  
  **Recommendation**: Update the documentation to show PascalCase type names throughout.

- **Missing `enforce: "pre"`**: The plugin doesn't specify `enforce: "pre"`, which means it runs after Vite's default plugins. If another plugin transforms `.sql` files before this one, the front matter stripping may fail.
  
  **Recommendation**: Add `enforce: "pre"` to the plugin configuration to ensure it runs before other transforms.

- **Error messages could be more helpful**: When type generation fails (lines 186-188 in `plugins.ts`), the error message just says "SQL type generation failed" without indicating which file or what the issue was.
  
  **Recommendation**: Include the file path and line number in error messages. Wrap the generation calls in try-catch blocks that add context.

- **Consider caching for performance**: The plugin re-parses all migrations and regenerates all barrels on every build. For large projects with many tables and queries, this could be slow.
  
  **Recommendation**: Cache parsed migration results and only regenerate barrels for directories that have changed. Use file modification times or content hashes to detect changes.

- **Potential race condition in dev mode**: The `configureServer` hook (lines 213-255 in `plugins.ts`) watches for changes and regenerates files asynchronously. If multiple files change rapidly, there could be race conditions where one regeneration overwrites another.
  
  **Recommendation**: Add debouncing (e.g., 100ms delay) before triggering regeneration, or use a queue to ensure regenerations happen sequentially.

- **The `stripFrontMatter` regex assumes exact formatting**: The regex `/^---\n[\s\S]*?\n---\n([\s\S]*)$/` requires:
  - Front matter to start at the very beginning of the file (no BOM, no leading whitespace)
  - Exactly `\n` line endings (not `\r\n`)
  - A trailing newline after the closing `---`
  
  **Recommendation**: Make the regex more flexible: `/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]+([\s\S]*)$/` and trim the result.

---

### Trade-offs Identified

- **Generated files in `src/`**: The generated files (`db-types.d.ts`, `queries.generated.ts`) are in the source tree, which adds noise. This is mitigated by `.gitignore` entries and the `.generated.ts` naming convention, which clearly marks them as auto-generated.

- **YAML type expressions are strings**: The type expressions in front matter (e.g., `result: "Tenet & { proposer_login: string }"`) are not validated at write time. This is a trade-off for simplicity — validating would require a TypeScript parser. The documentation acknowledges this and suggests Phase 5 validation warnings.

- **Runtime front matter stripping**: This is a workaround for vitest limitations. It adds a small runtime cost (regex match per SQL file) but ensures compatibility with the test environment. The trade-off is acceptable given the current constraints.

- **PascalCase singular names**: This convention makes TypeScript types look more idiomatic (e.g., `Tenet` instead of `tenets`). The trade-off is that the singularization logic may not handle all cases, requiring manual overrides for irregular plurals.

- **No SQL validation**: The plugin doesn't validate SQL syntax. This is a trade-off for simplicity — adding a SQL parser would increase complexity and maintenance burden. The assumption is that SQL errors will be caught at runtime or by external tools (e.g., DB Browser for SQLite with `local.db`).

---

### Overall Assessment

This is a well-designed and well-implemented feature that significantly improves developer experience by eliminating manual type synchronization between migrations, models, and queries. The code is clean, well-organized, and follows the project's conventions. The documentation in `lit/typed-sql-vite-plugin.md` is thorough and helpful.

**Verdict: Request Changes**

The PR is viable and the core implementation is solid, but the following must be addressed before merging:

1. **Add unit tests** for the plugin modules, particularly for `singularize`, `parseColumnDef`, and `extractCheckValues`
2. **Fix the singularization edge cases** or document the limitations clearly
3. **Make the `stripFrontMatter` regex more robust** to handle different line endings and formatting variations
4. **Update the documentation** to show PascalCase type names (matching the actual output)

Once these concerns are addressed, the PR will be ready to merge. The remaining minor suggestions (caching, debouncing, validation warnings) can be addressed in follow-up PRs.
