---
params:
  githubId: number
result: User
---
SELECT * FROM users WHERE github_id = @githubId
