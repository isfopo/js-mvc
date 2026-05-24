---
params:
  id: number
  status: TenetStatus
result: void
---
UPDATE tenets SET status = @status, updated_at = datetime('now') WHERE id = @id
