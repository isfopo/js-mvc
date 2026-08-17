---
params:
  tenetId: number
  userId: number
  choice: VoteChoice
  reason: "string | null"
result: void
---
INSERT INTO votes (tenet_id, user_id, choice, reason)
VALUES (@tenetId, @userId, @choice, @reason)
