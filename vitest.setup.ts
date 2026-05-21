/**
 * Vitest global setup — stubs CSS Module imports so JSX render tests
 * can import components that reference *.module.css without a build step.
 *
 * The Proxy returns the key name as a string (e.g. styles.title → "title"),
 * which is sufficient for asserting rendered class names in tests.
 */
import { vi } from "vitest";

vi.mock("*.module.css", () =>
  new Proxy(
    {},
    {
      get: (_target, key) => String(key),
    },
  ),
);