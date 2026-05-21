import { describe, it, expect, beforeAll } from "vitest";
import { votesRepo } from "./repo";
import { tenetsRepo } from "db/tenet/repo";
import { usersRepo } from "db/user/repo";
import { initDatabase } from "infrastructure/QueryLoader";
import { env } from "cloudflare:workers";
import schemaSql from "db/init.sql?raw";

let tenetId: number;
let userId: number;
let secondUserId: number;

beforeAll(async () => {
  await initDatabase(env.DB, schemaSql);

  // Seed users
  const user1 = await usersRepo.upsertFromGithub(env.DB, {
    id: 10,
    login: "voter1",
    avatar_url: "https://github.com/voter1.png",
    name: "Voter One",
  });
  userId = user1.id;

  const user2 = await usersRepo.upsertFromGithub(env.DB, {
    id: 20,
    login: "voter2",
    avatar_url: null,
    name: "Voter Two",
  });
  secondUserId = user2.id;

  // Seed a tenet in voting status
  const tenet = await tenetsRepo.createWithOptions(
    env.DB,
    {
      title: "Vote Test Tenet",
      slug: "vote-test-tenet",
      context: "Testing votes",
      proposed_by_id: userId,
    },
    [{ title: "Option A" }],
  );
  tenetId = tenet.id;

  // Transition to voting so votes can be cast
  await tenetsRepo.updateStatus(env.DB, tenetId, "voting");
});

describe("VotesRepository", () => {
  it("casts an approve vote", async () => {
    await votesRepo.upsert(env.DB, tenetId, userId, "approve", null);

    const vote = await votesRepo.getUserVote(env.DB, tenetId, userId);
    expect(vote).not.toBeNull();
    expect(vote!.choice).toBe("approve");
    expect(vote!.reason).toBeNull();
  });

  it("casts a block vote with a reason", async () => {
    await votesRepo.upsert(env.DB, tenetId, secondUserId, "block", "Security concern");

    const vote = await votesRepo.getUserVote(env.DB, tenetId, secondUserId);
    expect(vote).not.toBeNull();
    expect(vote!.choice).toBe("block");
    expect(vote!.reason).toBe("Security concern");
  });

  it("lists votes for a tenet with user info", async () => {
    const votes = await votesRepo.listForTenet(env.DB, tenetId);
    expect(votes).toHaveLength(2);

    const approveVote = votes.find((v) => v.user_id === userId);
    expect(approveVote!.user_login).toBe("voter1");
    expect(approveVote!.user_avatar).toBe("https://github.com/voter1.png");

    const blockVote = votes.find((v) => v.user_id === secondUserId);
    expect(blockVote!.user_login).toBe("voter2");
    expect(blockVote!.user_avatar).toBeNull();
  });

  it("updates an existing vote (upsert)", async () => {
    // Change from approve to abstain
    await votesRepo.upsert(env.DB, tenetId, userId, "abstain", null);

    const vote = await votesRepo.getUserVote(env.DB, tenetId, userId);
    expect(vote).not.toBeNull();
    expect(vote!.choice).toBe("abstain");
  });

  it("returns null for a non-existent vote", async () => {
    const vote = await votesRepo.getUserVote(env.DB, 99999, 99999);
    expect(vote).toBeNull();
  });

  it("returns empty list for a tenet with no votes", async () => {
    // Create a new tenet that hasn't been voted on
    const newTenet = await tenetsRepo.createWithOptions(
      env.DB,
      {
        title: "Unvoted Tenet",
        slug: "unvoted-tenet",
        context: "No votes yet",
        proposed_by_id: userId,
      },
      [],
    );

    const votes = await votesRepo.listForTenet(env.DB, newTenet.id);
    expect(votes).toHaveLength(0);
  });
});