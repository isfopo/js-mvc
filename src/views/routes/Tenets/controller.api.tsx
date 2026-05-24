import { Context, Env } from "hono";
import { Get, Post, ControllerBase } from "infrastructure/ControllerBase";
import { Exists, Validate } from "infrastructure/validation/decorators";
import { requireAuth } from "middlewares/auth";
import { tenetService } from "data/tenet/service";
import { tenetsRepo } from "data/tenet/repo";
import { ProposeTenetRequest } from "views/routes/Tenets/requests/ProposeTenetRequest";
import { VoteRequest } from "views/routes/Tenets/requests/VoteRequest";
import type { UserRow } from "data/user/model";
import type { TenetRow } from "data/tenet/model";

class TenetsApiController<T extends Env> extends ControllerBase<T> {
  override base = "api/tenets";

  constructor() {
    super();
    this._app.use("*", requireAuth());
  }

  @Get("/")
  async list(c: Context) {
    const result = await tenetService.list((c.env as CloudflareBindings).DB);
    return c.json(result);
  }

  @Get("/:slug")
  @Exists("tenet", (c) =>
    tenetsRepo((c.env as CloudflareBindings).DB).findOneBy({
      slug: c.req.param("slug")!,
    }),
  )
  async show(c: Context) {
    const tenetRow = c.get("tenet") as TenetRow;
    const detail = await tenetService.getBySlug(
      (c.env as CloudflareBindings).DB,
      tenetRow.slug,
    );
    return c.json(detail);
  }

  @Post("/")
  @Validate(ProposeTenetRequest)
  async create(c: Context) {
    const user = c.get("user") as unknown as UserRow;
    const input = c.get("validated") as ProposeTenetRequest;
    const tenet = await tenetService.propose(
      (c.env as CloudflareBindings).DB,
      user.id,
      input,
    );
    return c.json(tenet, 201);
  }

  @Post("/:slug/vote")
  @Exists("tenet", (c) =>
    tenetsRepo((c.env as CloudflareBindings).DB).findOneBy({
      slug: c.req.param("slug")!,
    }),
  )
  @Validate(VoteRequest)
  async vote(c: Context) {
    const user = c.get("user") as unknown as UserRow;
    const tenetRow = c.get("tenet") as TenetRow;
    const input = c.get("validated") as VoteRequest;
    await tenetService.vote(
      (c.env as CloudflareBindings).DB,
      user.id,
      tenetRow.slug,
      input,
    );
    return c.json({ success: true });
  }

  @Post("/:slug/status")
  @Exists("tenet", (c) =>
    tenetsRepo((c.env as CloudflareBindings).DB).findOneBy({
      slug: c.req.param("slug")!,
    }),
  )
  async transition(c: Context) {
    const user = c.get("user") as unknown as UserRow;
    const tenetRow = c.get("tenet") as TenetRow;
    const body = await c.req.json<{ status: string }>();
    const detail = await tenetService.transitionStatus(
      (c.env as CloudflareBindings).DB,
      user.id,
      tenetRow.slug,
      body.status as any,
    );
    return c.json(detail);
  }
}

export default new TenetsApiController();
