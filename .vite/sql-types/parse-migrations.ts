/**
 * Parse CREATE TABLE statements from migration SQL files.
 *
 * Extracts table names, column definitions (name, type, nullability),
 * CHECK constraints (for enum-like columns), and PRIMARY KEY info.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ColumnDef {
  name: string;
  /** SQLite type: INTEGER, TEXT, REAL, BLOB */
  sqliteType: string;
  /** Whether the column has NOT NULL constraint */
  notNull: boolean;
  /** Whether the column is a PRIMARY KEY */
  isPrimaryKey: boolean;
  /** Values from CHECK(col IN ('a','b','c')) — for enum-like columns */
  checkValues: string[] | null;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
}

/**
 * Split a string by a delimiter while respecting parenthesis nesting depth.
 */
function splitRespectingParens(str: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of str) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === delimiter && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

/**
 * Extract quoted values from a CHECK(col IN ('a','b','c')) constraint.
 * Returns null if no CHECK IN constraint is found.
 */
function extractCheckValues(columnDef: string): string[] | null {
  // Match CHECK(col IN ('a','b','c')) — handles multi-line
  const checkMatch = columnDef.match(
    /CHECK\s*\(\s*\w+\s+IN\s*\(([^)]+)\)\s*\)/i,
  );
  if (!checkMatch) return null;

  const valuesStr = checkMatch[1];
  // Extract all single-quoted values
  const values: string[] = [];
  const quoteRegex = /'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = quoteRegex.exec(valuesStr)) !== null) {
    values.push(match[1]);
  }
  return values.length > 0 ? values : null;
}

/**
 * Parse a single column definition string into a ColumnDef.
 */
function parseColumnDef(raw: string): ColumnDef | null {
  // Normalize whitespace (collapse multi-line into single line)
  const def = raw.replace(/\s+/g, " ").trim();

  // Skip table-level constraints (UNIQUE, PRIMARY KEY, FOREIGN KEY, CHECK, CONSTRAINT)
  const tableConstraintKeywords = [
    "UNIQUE",
    "PRIMARY KEY",
    "FOREIGN KEY",
    "CHECK",
    "CONSTRAINT",
  ];
  for (const kw of tableConstraintKeywords) {
    if (def.toUpperCase().startsWith(kw)) return null;
  }

  // Extract column name (first word) and type (second word)
  const parts = def.split(/\s+/);
  if (parts.length < 2) return null;

  const name = parts[0];
  const sqliteType = parts[1].toUpperCase();

  // Validate it's a known SQLite type
  const knownTypes = ["INTEGER", "TEXT", "REAL", "BLOB"];
  if (!knownTypes.includes(sqliteType)) return null;

  const upperDef = def.toUpperCase();
  const notNull = upperDef.includes("NOT NULL");
  const isPrimaryKey = upperDef.includes("PRIMARY KEY");
  const checkValues = extractCheckValues(def);

  return { name, sqliteType, notNull, isPrimaryKey, checkValues };
}

/**
 * Parse a single CREATE TABLE statement body into a TableDef.
 */
function parseCreateTable(statement: string): TableDef | null {
  // Match: CREATE TABLE [IF NOT EXISTS] tableName ( ... )
  const tableMatch = statement.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]+)\)\s*;?\s*$/i,
  );
  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const body = tableMatch[2];

  // Split column definitions by comma, respecting nested parens
  const rawColumns = splitRespectingParens(body, ",");

  const columns: ColumnDef[] = [];
  for (const rawCol of rawColumns) {
    const col = parseColumnDef(rawCol);
    if (col) columns.push(col);
  }

  if (columns.length === 0) return null;
  return { name: tableName, columns };
}

/**
 * Parse all migration SQL files in a directory and extract table definitions.
 * Files are processed in sorted order (so 001_ before 002_, etc.).
 */
export async function parseMigrations(
  migrationsDir: string,
): Promise<TableDef[]> {
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const tables: TableDef[] = [];
  const seenTables = new Set<string>();

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf-8");

    // Remove single-line comments
    const noComments = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    // Find all CREATE TABLE statements
    // Split on semicolons, then filter for CREATE TABLE
    const statements = noComments
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      if (!/CREATE\s+TABLE/i.test(stmt)) continue;
      const table = parseCreateTable(stmt + ";");
      if (table && !seenTables.has(table.name)) {
        seenTables.add(table.name);
        tables.push(table);
      }
    }
  }

  return tables;
}
