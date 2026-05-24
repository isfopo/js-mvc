/**
 * Validate SQL syntax and cross-reference front matter declarations.
 *
 * Uses node-sql-parser to:
 * - Validate SQL syntax (SQLite dialect)
 * - Extract @paramName placeholders from SQL
 * - Compare placeholders against params: declarations
 * - Validate result: type references against known types
 */

import pkg from "node-sql-parser";
import type { SqlFrontMatter } from "./parse-front-matter";
import { extractTypeReferences } from "./utils";

// CJS interop: node-sql-parser may export Parser as a named or default property
const Parser = (pkg as any).Parser ?? pkg;
if (typeof Parser !== "function") {
  throw new Error(
    "node-sql-parser: Parser constructor not found. " +
    "Check that node-sql-parser is installed and up to date.",
  );
}
const parser = new Parser();

export interface ValidationResult {
  /** Whether the SQL is syntactically valid */
  valid: boolean;
  /** Fatal errors (e.g., syntax errors) */
  errors: string[];
  /** Non-fatal warnings (e.g., unused params, unknown types) */
  warnings: string[];
  /** Extracted @paramName placeholders from the SQL */
  placeholders: string[];
}

/**
 * Extract @paramName placeholders from SQL.
 * Returns unique placeholder names in order of first appearance.
 * Strips string literals first to avoid matching @param inside quoted strings.
 */
function extractPlaceholders(sql: string): string[] {
  // Remove single-quoted string literals to avoid false positives
  // e.g., WHERE name = '@notAParam' should not extract "notAParam"
  const stripped = sql.replace(/'(?:[^'\\]|\\.)*'/g, "''");

  const placeholders: string[] = [];
  const seen = new Set<string>();
  const regex = /@(\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(stripped)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      placeholders.push(name);
    }
  }

  return placeholders;
}

/**
 * Validate SQL syntax and cross-reference front matter declarations.
 *
 * @param sql - The SQL content (with front matter already stripped)
 * @param frontMatter - Parsed YAML front matter data
 * @param knownTypes - Set of known type names (from db-types.d.ts and model.ts)
 */
export function validateSql(
  sql: string,
  frontMatter: SqlFrontMatter,
  knownTypes: Set<string>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Extract @paramName placeholders from SQL
  const placeholders = extractPlaceholders(sql);

  // 2. Validate SQL syntax
  // Replace @paramName with ? for parsing (node-sql-parser doesn't understand @ syntax)
  const normalizedSql = sql.replace(/@(\w+)/g, "?");

  try {
    parser.astify(normalizedSql, { database: "SQLite" });
  } catch (e) {
    const errorMsg = (e as Error).message;
    errors.push(`SQL syntax error: ${errorMsg}`);
  }

  // 3. Validate placeholders match params
  const paramKeys = frontMatter.params ? Object.keys(frontMatter.params) : [];
  const placeholderSet = new Set(placeholders);
  const paramSet = new Set(paramKeys);

  // Check for placeholders not declared in params
  for (const placeholder of placeholders) {
    if (!paramSet.has(placeholder)) {
      warnings.push(
        `SQL uses @${placeholder} but it's not declared in params:`,
      );
    }
  }

  // Check for params declared but not used in SQL
  for (const param of paramKeys) {
    if (!placeholderSet.has(param)) {
      warnings.push(
        `params: declares ${param} but it's not used in SQL`,
      );
    }
  }

  // 4. Validate result type references
  if (frontMatter.result && frontMatter.result !== "void") {
    const typeRefs = extractTypeReferences(frontMatter.result);

    for (const ref of typeRefs) {
      if (!knownTypes.has(ref)) {
        warnings.push(
          `result: references type "${ref}" which doesn't exist in db-types.d.ts or model.ts`,
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
