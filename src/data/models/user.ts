/** Row type for the `users` D1 table. */
export interface UserRow {
  id: number;
  github_id: number;
  login: string;
  avatar_url: string | null;
  name: string | null;
  created_at: string;
  last_login_at: string;
}
