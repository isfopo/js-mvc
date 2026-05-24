import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { initDatabase } from "data/init";
import { usersRepo } from "data/user/repo";
import { tenetsRepo } from "data/tenet/repo";
import { votesRepo } from "data/vote/repo";
import schemaSql from "data/init.sql?raw";

beforeAll(async () => {
  await initDatabase(env.DB, schemaSql);

  // Seed test data
  await usersRepo(env.DB).upsertFromGithub({
    id: 100,
    login: "finder-test-user",
    avatar_url: null,
    name: "Finder Test",
  });

  await usersRepo(env.DB).upsertFromGithub({
    id: 101,
    login: "finder-test-user-2",
    avatar_url: "https://example.com/avatar.png",
    name: "Finder Test 2",
  });
});

describe("RepositoryBase dynamic finders", () => {
  describe("findOneBy", () => {
    it("finds a row by single column", async () => {
      const user = await usersRepo(env.DB).findOneBy({ login: "finder-test-user" });
      expect(user).not.toBeNull();
      expect(user!.login).toBe("finder-test-user");
      expect(user!.github_id).toBe(100);
    });

    it("finds a row by multiple columns", async () => {
      const user = await usersRepo(env.DB).findOneBy({
        login: "finder-test-user",
        github_id: 100,
      });
      expect(user).not.toBeNull();
      expect(user!.id).toBeGreaterThan(0);
    });

    it("returns null when no match", async () => {
      const user = await usersRepo(env.DB).findOneBy({ login: "nonexistent-user-xyz" });
      expect(user).toBeNull();
    });

    it("returns null when multi-column criteria partially matches", async () => {
      const user = await usersRepo(env.DB).findOneBy({
        login: "finder-test-user",
        github_id: 999,
      });
      expect(user).toBeNull();
    });

    it("throws on empty criteria", async () => {
      await expect(
        usersRepo(env.DB).findOneBy({} as any),
      ).rejects.toThrow("Empty criteria is not allowed");
    });

    it("handles null values with IS NULL", async () => {
      // avatar_url is nullable — findOneBy({ avatar_url: null }) should find
      // users where avatar_url IS NULL, not `avatar_url = NULL` (always false)
      const user = await usersRepo(env.DB).findOneBy({ avatar_url: null, login: "finder-test-user" });
      expect(user).not.toBeNull();
      expect(user!.login).toBe("finder-test-user");
      expect(user!.avatar_url).toBeNull();
    });
  });

  describe("findAllBy", () => {
    it("finds all rows matching criteria", async () => {
      const users = await usersRepo(env.DB).findAllBy({
        login: "finder-test-user",
      });
      expect(users).toHaveLength(1);
      expect(users[0].login).toBe("finder-test-user");
    });

    it("returns empty array when no match", async () => {
      const users = await usersRepo(env.DB).findAllBy({
        login: "nonexistent-user-xyz",
      });
      expect(users).toHaveLength(0);
    });

    it("throws on empty criteria", async () => {
      await expect(
        usersRepo(env.DB).findAllBy({} as any),
      ).rejects.toThrow("Empty criteria is not allowed");
    });
  });

  describe("existsBy", () => {
    it("returns true when row exists", async () => {
      const exists = await usersRepo(env.DB).existsBy({ login: "finder-test-user" });
      expect(exists).toBe(true);
    });

    it("returns false when row does not exist", async () => {
      const exists = await usersRepo(env.DB).existsBy({ login: "nonexistent-user-xyz" });
      expect(exists).toBe(false);
    });

    it("works with multi-column criteria", async () => {
      const exists = await usersRepo(env.DB).existsBy({
        login: "finder-test-user",
        github_id: 100,
      });
      expect(exists).toBe(true);

      const notExists = await usersRepo(env.DB).existsBy({
        login: "finder-test-user",
        github_id: 999,
      });
      expect(notExists).toBe(false);
    });

    it("throws on empty criteria", async () => {
      await expect(
        usersRepo(env.DB).existsBy({} as any),
      ).rejects.toThrow("Empty criteria is not allowed");
    });
  });

  describe("deleteBy", () => {
    it("deletes matching rows and returns count", async () => {
      // Create a temporary user to delete
      await usersRepo(env.DB).upsertFromGithub({
        id: 200,
        login: "delete-me-user",
        avatar_url: null,
        name: "Delete Me",
      });

      const count = await usersRepo(env.DB).deleteBy({ login: "delete-me-user" });
      expect(count).toBe(1);

      // Verify it's gone
      const exists = await usersRepo(env.DB).existsBy({ login: "delete-me-user" });
      expect(exists).toBe(false);
    });

    it("returns 0 when no rows match", async () => {
      const count = await usersRepo(env.DB).deleteBy({ login: "nonexistent-user-xyz" });
      expect(count).toBe(0);
    });

    it("throws on empty criteria", async () => {
      await expect(
        usersRepo(env.DB).deleteBy({} as any),
      ).rejects.toThrow("Empty criteria is not allowed");
    });
  });

  describe("_buildWhere security", () => {
    // These tests intentionally bypass TypeScript with `as any` to verify
    // runtime guards against invalid column names and edge cases.

    it("rejects digit-leading column names", async () => {
      // TypeScript would catch this at compile time, but test runtime validation
      await expect(
        usersRepo(env.DB).findOneBy({ "123abc": "value" } as any),
      ).rejects.toThrow('Unsafe column name: "123abc"');
    });

    it("rejects column names with special characters", async () => {
      await expect(
        usersRepo(env.DB).findOneBy({ "col; DROP TABLE": "value" } as any),
      ).rejects.toThrow("Unsafe column name");
    });

    it("rejects column names with spaces", async () => {
      await expect(
        usersRepo(env.DB).findOneBy({ "col name": "value" } as any),
      ).rejects.toThrow("Unsafe column name");
    });

    it("allows underscore-prefixed column names", async () => {
      // This should not throw on validation (will just return null since column doesn't exist)
      // We can't easily test a real underscore-prefixed column, but we can verify
      // the validation passes by checking it doesn't throw the "Unsafe column name" error
      try {
        await usersRepo(env.DB).findOneBy({ _private: "value" } as any);
      } catch (e) {
        // Should fail with a SQL error (no such column), not a validation error
        expect((e as Error).message).not.toContain("Unsafe column name");
      }
    });
  });
});
