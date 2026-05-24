/**
 * Shared utilities for SQL type generation.
 */

/** Primitive TypeScript types that don't need imports. */
export const PRIMITIVE_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "void",
  "any",
  "unknown",
  "never",
  "object",
]);

/**
 * Extract non-primitive type identifiers from a type expression string.
 * Looks for identifiers starting with an uppercase letter.
 */
export function extractTypeReferences(typeExpr: string): string[] {
  const refs = new Set<string>();
  const identRegex = /\b([A-Z]\w*)\b/g;
  let match: RegExpExecArray | null;

  while ((match = identRegex.exec(typeExpr)) !== null) {
    if (!PRIMITIVE_TYPES.has(match[1])) {
      refs.add(match[1]);
    }
  }

  return [...refs];
}
