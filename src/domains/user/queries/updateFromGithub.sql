---
params:
  id: number
  login: string
  avatarUrl: "string | null"
  name: "string | null"
result: void
---
UPDATE users
SET login = @login, avatar_url = @avatarUrl, name = @name, last_login_at = datetime('now')
WHERE id = @id
