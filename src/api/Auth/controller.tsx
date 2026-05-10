import { Context, Env } from "hono";
import { Get, Post, ControllerBase } from "../../infrastructure/ControllerBase";
import { buildAuthorizeUrl, exchangeCode, fetchUser } from "./github";
import { usersRepo } from "../../data/repos/users";
import { createSession, destroySession } from "../../infrastructure/middlewares/auth";

class AuthController<T extends Env> extends ControllerBase<T> {
  override base = "auth";

  @Get("/login")
  async login(c: Context) {
    const clientId = c.env.GITHUB_CLIENT_ID;
    const origin = new URL(c.req.url).origin;
    const redirectUri = `${origin}/auth/callback`;
    const url = buildAuthorizeUrl(clientId, redirectUri);
    return c.redirect(url);
  }

  @Get("/callback")
  async callback(c: Context) {
    const code = c.req.query("code");
    if (!code) {
      return c.redirect("/auth/login");
    }

    try {
      const clientId = c.env.GITHUB_CLIENT_ID;
      const clientSecret = c.env.GITHUB_CLIENT_SECRET;

      // Exchange code for token
      const token = await exchangeCode(clientId, clientSecret, code);

      // Fetch GitHub user
      const githubUser = await fetchUser(token);

      // Upsert user in D1
      const user = await usersRepo.upsertFromGithub(c.env.DB, githubUser);

      // Create session
      const cookie = await createSession(c.env.SESSIONS, user.id);
      c.header("Set-Cookie", cookie);

      return c.redirect("/tenets");
    } catch (error) {
      console.error("Auth callback failed:", error);
      return c.redirect("/auth/login");
    }
  }

  @Post("/logout")
  async logout(c: Context) {
    await destroySession(c.env.SESSIONS, c);
    c.header(
      "Set-Cookie",
      "tenet_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    );
    return c.redirect("/");
  }
}

export default new AuthController();
