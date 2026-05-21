import { describe, it, expect, beforeAll } from "vitest";
import { usersRepo } from "./repo";
import { initDatabase } from "infrastructure/QueryLoader";
import { env } from "cloudflare:workers";
import schemaSql from "db/init.sql?raw";

beforeAll(async () => {
  await initDatabase(env.DB, schemaSql);
});

describe("UsersRepository", () => {
  it("creates a user from GitHub profile data", async () => {
    const user = await usersRepo.upsertFromGithub(env.DB, {
      id: 100,
      login: "octocat",
      avatar_url: "https://github.com/octocat.png",
      name: "Octo Cat",
    });

    expect(user.id).toBeDefined();
    expect(user.login).toBe("octocat");
    expect(user.github_id).toBe(100);
    expect(user.avatar_url).toBe("https://github.com/octocat.png");
    expect(user.name).toBe("Octo Cat");
  });

  it("finds a user by GitHub ID", async () => {
    const user = await usersRepo.findByGithubId(env.DB, 100);
    expect(user).not.toBeNull();
    expect(user!.login).toBe("octocat");
  });

  it("returns null for a non-existent GitHub ID", async () => {
    const user = await usersRepo.findByGithubId(env.DB, 99999);
    expect(user).toBeNull();
  });

  it("upserts an existing user (updates login, avatar, name)", async () => {
    const updated = await usersRepo.upsertFromGithub(env.DB, {
      id: 100,
      login: "octocat-updated",
      avatar_url: "https://github.com/new-avatar.png",
      name: "Octo Updated",
    });

    expect(updated.login).toBe("octocat-updated");
    expect(updated.avatar_url).toBe("https://github.com/new-avatar.png");
    expect(updated.name).toBe("Octo Updated");
    // Same row, not a new insert
    expect(updated.github_id).toBe(100);
  });

  it("finds a user by primary key", async () => {
    const byGithub = await usersRepo.findByGithubId(env.DB, 100);
    const byId = await usersRepo.findById(env.DB, byGithub!.id);
    expect(byId).not.toBeNull();
    expect(byId!.login).toBe("octocat-updated");
  });

  it("creates a second user independently", async () => {
    const user = await usersRepo.upsertFromGithub(env.DB, {
      id: 200,
      login: "seconduser",
      avatar_url: null,
      name: null,
    });
    expect(user.login).toBe("seconduser");
    expect(user.avatar_url).toBeNull();
    expect(user.name).toBeNull();
  });

  it("counts users", async () => {
    const count = await usersRepo.count(env.DB);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("deletes a user", async () => {
    const user = await usersRepo.upsertFromGithub(env.DB, {
      id: 300,
      login: "deleteme",
      avatar_url: null,
      name: null,
    });
    const deleted = await usersRepo.delete(env.DB, user.id);
    expect(deleted).toBe(true);

    const found = await usersRepo.findById(env.DB, user.id);
    expect(found).toBeNull();
  });

  it("returns false when deleting a non-existent user", async () => {
    const deleted = await usersRepo.delete(env.DB, 99999);
    expect(deleted).toBe(false);
  });
});