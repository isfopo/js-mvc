import { describe, it, expect, afterAll } from "vitest";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateQueryBarrel } from "./generate-query-barrel";

describe("generateQueryBarrel", () => {
  const testDir = join(tmpdir(), "generate-query-barrel-test-" + Date.now());
  const queriesDir = join(testDir, "queries");
  const dbTypesPath = join(testDir, "db-types.d.ts");
  const modelPath = join(testDir, "model.ts");

  // Clean up temp directory after all tests complete
  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function setup(files: Record<string, string>, model?: string) {
    // Clean queries directory before each test to ensure isolation
    try {
      await rm(queriesDir, { recursive: true, force: true });
    } catch {
      // Parent directory may not exist yet — that's fine
    }
    await mkdir(queriesDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(queriesDir, name), content, "utf-8");
    }
    // Create a minimal db-types.d.ts
    await writeFile(
      dbTypesPath,
      `export interface Tenet { id: number; }\nexport interface User { id: number; }`,
      "utf-8",
    );
    // Remove stale model.ts from previous tests
    try {
      await rm(modelPath, { force: true });
    } catch {
      // May not exist — that's fine
    }
    // Create model.ts if provided
    if (model) {
      await writeFile(modelPath, model, "utf-8");
    }
  }

  async function readGenerated() {
    return readFile(join(queriesDir, "queries.generated.ts"), "utf-8");
  }

  it("generates barrel with correct type imports and embedded SQL", async () => {
    await setup({
      "findBySlug.sql": `---
params:
  slug: string
result: Tenet
---
SELECT * FROM tenets WHERE slug = @slug`,
    });

    await generateQueryBarrel(queriesDir, ["tenets", "users"], dbTypesPath, null);
    const content = await readGenerated();

    expect(content).toContain('import type { Tenet } from "../db-types"');
    // SQL is embedded directly, no .sql?raw imports
    expect(content).not.toContain(".sql?raw");
    expect(content).toContain("SELECT * FROM tenets WHERE slug = @slug");
  });

  it("generates QueryMap interface", async () => {
    await setup({
      "findBySlug.sql": `---
params:
  slug: string
result: Tenet
---
SELECT * FROM tenets WHERE slug = @slug`,
      "listAll.sql": `---
result: Tenet
---
SELECT * FROM tenets`,
    });

    await generateQueryBarrel(queriesDir, ["tenets"], dbTypesPath, null);
    const content = await readGenerated();

    expect(content).toContain("export interface QueryMap {");
    expect(content).toContain("findBySlug: {");
    expect(content).toContain("params: { slug: string };");
    expect(content).toContain("result: Tenet;");
    expect(content).toContain("listAll: {");
    expect(content).toContain("params: {};");
  });

  it("handles void result type", async () => {
    await setup({
      "updateStatus.sql": `---
params:
  id: number
  status: string
result: void
---
UPDATE tenets SET status = @status WHERE id = @id`,
    });

    await generateQueryBarrel(queriesDir, ["tenets"], dbTypesPath, null);
    const content = await readGenerated();

    expect(content).toContain("result: void;");
  });

  it("handles missing front matter", async () => {
    await setup({
      "simple.sql": `SELECT * FROM tenets`,
    });

    await generateQueryBarrel(queriesDir, ["tenets"], dbTypesPath, null);
    const content = await readGenerated();

    expect(content).toContain("simple: {");
    expect(content).toContain("params: {};");
    expect(content).toContain("result: Record<string, unknown>;");
  });

  it("imports model types when referenced", async () => {
    await setup(
      {
        "updateStatus.sql": `---
params:
  id: number
  status: TenetStatus
result: void
---
UPDATE tenets SET status = @status WHERE id = @id`,
      },
      `export type TenetStatus = "draft" | "voting" | "accepted";`,
    );

    await generateQueryBarrel(
      queriesDir,
      ["tenets"],
      dbTypesPath,
      modelPath,
    );
    const content = await readGenerated();

    expect(content).toContain('import type { TenetStatus } from "../model"');
  });

  it("does NOT include stripFrontMatter helper (handled by sqlTransformPlugin)", async () => {
    await setup({
      "test.sql": `SELECT 1`,
    });

    await generateQueryBarrel(queriesDir, [], dbTypesPath, null);
    const content = await readGenerated();

    expect(content).not.toContain("stripFrontMatter");
    expect(content).not.toContain("function stripFrontMatter");
  });

  it("generates queries const with embedded SQL (no imports, no wrapping)", async () => {
    await setup({
      "findBySlug.sql": `---
params:
  slug: string
result: Tenet
---
SELECT * FROM tenets WHERE slug = @slug`,
    });

    await generateQueryBarrel(queriesDir, ["tenets"], dbTypesPath, null);
    const content = await readGenerated();

    expect(content).toContain("export const queries = {");
    expect(content).toContain("findBySlug: `SELECT * FROM tenets WHERE slug = @slug`,");
    expect(content).toContain("} as const;");
    // No .sql?raw imports anywhere
    expect(content).not.toContain(".sql?raw");
  });

  it("escapes template literal special chars in SQL", async () => {
    await setup({
      "tricky.sql": `---
result: Tenet
---
SELECT * FROM tenets WHERE title LIKE '\`%\${search}%'`,
    });

    await generateQueryBarrel(queriesDir, ["tenets"], dbTypesPath, null);
    const content = await readGenerated();

    // Backticks and ${} should be escaped
    expect(content).toContain("\\`");
    expect(content).toContain("\\${");
  });

  it("handles complex result types", async () => {
    await setup({
      "listWithProposer.sql": `---
result: "Tenet & { proposer_login: string }"
---
SELECT t.*, u.login AS proposer_login FROM tenets t JOIN users u ON u.id = t.proposed_by_id`,
    });

    await generateQueryBarrel(queriesDir, ["tenets"], dbTypesPath, null);
    const content = await readGenerated();

    expect(content).toContain("result: Tenet & { proposer_login: string };");
  });

  it("skips empty directories", async () => {
    // Clean the directory first to ensure it's truly empty
    try {
      await rm(queriesDir, { recursive: true, force: true });
    } catch {
      // May not exist — that's fine
    }
    await mkdir(queriesDir, { recursive: true });

    // Should not throw or create files
    await generateQueryBarrel(queriesDir, [], dbTypesPath, null);

    // Verify no file was created
    let fileExists = false;
    try {
      await readFile(join(queriesDir, "queries.generated.ts"));
      fileExists = true;
    } catch {
      // Expected — file should not exist
    }

    expect(fileExists).toBe(false);
  });
});
