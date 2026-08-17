---
params:
  id: number
  choice: VoteChoice
  reason: "string | null"
result: void
---
UPDATE votes SET choice = @choice, reason = @reason, updated_at = datetime('now')
WHERE id = @id
