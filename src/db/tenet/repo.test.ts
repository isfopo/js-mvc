import { describe, it, expect, beforeAll } from "vitest";
import { tenetsRepo } from "./repo";
import { usersRepo } from "db/user/repo";
import { initDatabase } from "infrastructure/QueryLoader";
import { env } from "cloudflare:workers";
import schemaSql from "db/init.sql?raw";

beforeAll(async () => {
  await initDatabase(env.DB, schemaSql);
  // Seed a user for FK constraints
  await usersRepo.upsertFromGithub(env.DB, {
    id: 1,
    login: "testuser",
    avatar_url: null,
    name: "Test User",
  });
});

describe("TenetsRepository", () => {
  it("creates a tenet with options", async () => {
    const tenet = await tenetsRepo.createWithOptions(
      env.DB,
      {
        title: "Choose Framework",
        slug: "choose-framework",
        context: "We need to pick a framework",
        proposed_by_id: 1,
      },
      [
        { title: "React", pros: "Popular", cons: "Heavy" },
        { title: "Vue", pros: "Lightweight", cons: "Smaller ecosystem" },
      ],
    );

    expect(tenet.id).toBeDefined();
    expect(tenet.slug).toBe("choose-framework");
    expect(tenet.status).toBe("draft");
    expect(tenet.title).toBe("Choose Framework");
  });

  it("finds a tenet by slug", async () => {
    const tenet = await tenetsRepo.findBySlug(env.DB, "choose-framework");
    expect(tenet).not.toBeNull();
    expect(tenet!.title).toBe("Choose Framework");
  });

  it("returns null for a non-existent slug", async () => {
    const tenet = await tenetsRepo.findBySlug(env.DB, "does-not-exist");
    expect(tenet).toBeNull();
  });

  it("retrieves options for a tenet", async () => {
    const tenet = await tenetsRepo.findBySlug(env.DB, "choose-framework");
    const options = await tenetsRepo.getOptions(env.DB, tenet!.id);

    expect(options).toHaveLength(2);
    expect(options[0].title).toBe("React");
    expect(options[1].title).toBe("Vue");
    expect(options[0].sort_order).toBe(0);
    expect(options[1].sort_order).toBe(1);
  });

  it("lists tenets with proposer info", async () => {
    const rows = await tenetsRepo.listWithProposer(env.DB);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const found = rows.find((r) => r.slug === "choose-framework");
    expect(found).toBeDefined();
    expect(found!.proposer_login).toBe("testuser");
  });

  it("gets a tenet with proposer by slug", async () => {
    const row = await tenetsRepo.getWithProposer(env.DB, "choose-framework");
    expect(row).not.toBeNull();
    expect(row!.proposer_login).toBe("testuser");
    expect(row!.proposer_avatar).toBeNull();
  });

  it("returns null for getWithProposer with non-existent slug", async () => {
    const row = await tenetsRepo.getWithProposer(env.DB, "does-not-exist");
    expect(row).toBeNull();
  });

  it("updates tenet status", async () => {
    const tenet = await tenetsRepo.findBySlug(env.DB, "choose-framework");
    await tenetsRepo.updateStatus(env.DB, tenet!.id, "voting");

    const updated = await tenetsRepo.findBySlug(env.DB, "choose-framework");
    expect(updated!.status).toBe("voting");
  });

  it("finds a tenet by ID", async () => {
    const tenet = await tenetsRepo.findBySlug(env.DB, "choose-framework");
    const found = await tenetsRepo.findById(env.DB, tenet!.id);
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("choose-framework");
  });

  it("creates a tenet with no options", async () => {
    const tenet = await tenetsRepo.createWithOptions(
      env.DB,
      {
        title: "No Options Tenet",
        slug: "no-options",
        context: "A tenet without options",
        proposed_by_id: 1,
      },
      [],
    );

    expect(tenet.slug).toBe("no-options");
    const options = await tenetsRepo.getOptions(env.DB, tenet.id);
    expect(options).toHaveLength(0);
  });

  it("creates options with null description/pros/cons", async () => {
    const tenet = await tenetsRepo.createWithOptions(
      env.DB,
      {
        title: "Minimal Options",
        slug: "minimal-options",
        context: "Testing null fields",
        proposed_by_id: 1,
      },
      [{ title: "Option A" }],
    );

    const options = await tenetsRepo.getOptions(env.DB, tenet.id);
    expect(options).toHaveLength(1);
    expect(options[0].description).toBeNull();
    expect(options[0].pros).toBeNull();
    expect(options[0].cons).toBeNull();
  });

  it("counts tenets", async () => {
    const count = await tenetsRepo.count(env.DB);
    expect(count).toBeGreaterThanOrEqual(3); // choose-framework, no-options, minimal-options
  });

  it("deletes a tenet", async () => {
    const tenet = await tenetsRepo.createWithOptions(
      env.DB,
      {
        title: "Delete Me",
        slug: "delete-me",
        context: "To be deleted",
        proposed_by_id: 1,
      },
      [],
    );

    const deleted = await tenetsRepo.delete(env.DB, tenet.id);
    expect(deleted).toBe(true);

    const found = await tenetsRepo.findBySlug(env.DB, "delete-me");
    expect(found).toBeNull();
  });
});