---
params:
  tenetId: number
result: "Vote & { user_login: string, user_avatar: string | null }"
---
SELECT v.*, u.login AS user_login, u.avatar_url AS user_avatar
FROM votes v
JOIN users u ON u.id = v.user_id
WHERE v.tenet_id = @tenetId
ORDER BY v.created_at
