/**
 * Unflatten bracket-notation form keys into nested objects/arrays.
 *
 * HTML forms use keys like `options[0][title]` which Hono's `parseBody()`
 * returns as flat string keys. This utility converts them into properly
 * nested structures so request classes receive `body.options[0].title`.
 *
 * Example:
 *   { "options[0][title]": "React", "options[0][pros]": "Fast" }
 *   → { options: [{ title: "React", pros: "Fast" }] }
 */

export function unflattenFormBody(
  flat: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    // If key has no bracket notation, assign directly
    if (!key.includes("[")) {
      result[key] = value;
      continue;
    }

    // Parse "options[0][title]" → segments ["options", "0", "title"]
    const segments: string[] = [];
    let remaining = key;
    // Match the first segment (before any bracket)
    const head = remaining.match(/^([^[]+)/);
    if (head) {
      segments.push(head[1]);
      remaining = remaining.slice(head[1].length);
    }
    // Match bracket-wrapped segments like [0], [title]
    while (remaining.length > 0) {
      const match = remaining.match(/^\[([^\]]*)\]/);
      if (!match) break;
      segments.push(match[1]);
      remaining = remaining.slice(match[0].length);
    }

    // Walk segments, creating nested objects/arrays as needed
    let current: any = result;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const nextSeg = segments[i + 1];
      const nextIsNumeric = /^\d+$/.test(nextSeg);

      if (current[seg] == null) {
        current[seg] = nextIsNumeric ? [] : {};
      }
      current = current[seg];
    }

    // Set the value at the final segment
    const lastSeg = segments[segments.length - 1];
    if (Array.isArray(current) && /^\d+$/.test(lastSeg)) {
      current[parseInt(lastSeg, 10)] = value;
    } else {
      current[lastSeg] = value;
    }
  }

  // Compact sparse arrays (e.g., { "0": ..., "1": ... } → [...] )
  return compactArrays(result) as Record<string, unknown>;
}

/** Recursively convert array-like objects into true arrays. */
function compactArrays(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(compactArrays);
  }
  if (obj !== null && typeof obj === "object") {
    const keys = Object.keys(obj);
    // If all keys are non-negative integers, convert to array
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      const maxIdx = Math.max(...keys.map(Number));
      const arr: unknown[] = [];
      for (let i = 0; i <= maxIdx; i++) {
        arr.push(compactArrays((obj as Record<string, unknown>)[String(i)]));
      }
      return arr;
    }
    // Regular object — recurse values
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = compactArrays(v);
    }
    return result;
  }
  return obj;
}
