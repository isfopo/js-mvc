import { describe, it, expect } from "vitest";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateQueryBarrel } from "./generate-query-barrel";

describe("generateQueryBarrel", () => {
  const testDir = join(tmpdir(), "generate-query-barrel-test-" + Date.now());
  const queriesDir = join(testDir, "queries");
  const dbTypesPath = join(testDir, "db-types.d.ts");
  const modelPath = join(testDir, "model.ts");

  async function setup(files: Record<string, string>, model?: string) {
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
    // Create model.ts if provided
    if (model) {
      await writeFile(modelPath, model, "utf-8");
    }
  }

  async function cleanup() {
    await rm(testDir, { recursive: true, force: true });
  }

  async function readGenerated() {
    return readFile(join(queriesDir, "queries.generated.ts"), "utf-8");
  }

  it("generates barrel with correct imports", async () => {
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
    await cleanup();

    expect(content).toContain('import type { Tenet } from "../db-types"');
    expect(content).toContain('import findBySlugRaw from "./findBySlug.sql?raw"');
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
    await cleanup();

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
    await cleanup();

    expect(content).toContain("result: void;");
  });

  it("handles missing front matter", async () => {
    await setup({
      "simple.sql": `SELECT * FROM tenets`,
    });

    await generateQueryBarrel(queriesDir, ["tenets"], dbTypesPath, null);
    const content = await readGenerated();
    await cleanup();

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
    await cleanup();

    expect(content).toContain('import type { TenetStatus } from "../model"');
  });

  it("generates stripFrontMatter helper", async () => {
    await setup({
      "test.sql": `SELECT 1`,
    });

    await generateQueryBarrel(queriesDir, [], dbTypesPath, null);
    const content = await readGenerated();
    await cleanup();

    expect(content).toContain("function stripFrontMatter(sql: string): string");
    expect(content).toContain("BOM");
    expect(content).toContain("\\r\\n");
  });

  it("generates queries const with stripFrontMatter calls", async () => {
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
    await cleanup();

    expect(content).toContain("export const queries = {");
    expect(content).toContain("findBySlug: stripFrontMatter(findBySlugRaw),");
    expect(content).toContain("} as const;");
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
    await cleanup();

    expect(content).toContain("result: Tenet & { proposer_login: string };");
  });

  it("skips empty directories", async () => {
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

    await cleanup();
    expect(fileExists).toBe(false);
  });
});
