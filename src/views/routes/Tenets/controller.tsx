import { Context, Env } from "hono";
import { Get, Post, ControllerBase } from "infrastructure/ControllerBase";
import { Exists, Validate } from "infrastructure/validation/decorators";
import { requireAuth } from "middlewares/auth";
import { tenetService } from "data/tenet/service";
import { tenetsRepo } from "data/tenet/repo";
import { viewBuilder } from "./view-builder";
import { ProposeTenetRequest } from "./requests/ProposeTenetRequest";
import { VoteRequest } from "./requests/VoteRequest";
import { View as IndexView } from "./views/index";
import { View as ShowView } from "./views/show";
import { View as NewView } from "./views/new";
import type { UserRow } from "data/user/model";
import type { TenetRow } from "data/tenet/model";

class TenetsController<T extends Env> extends ControllerBase<T> {
  override base = "tenets";

  constructor() {
    super();
    this._app.use("*", requireAuth());
  }

  @Get("/")
  async index(c: Context) {
    const user = c.get("user") as unknown as UserRow;
    const result = await tenetService.list((c.env as CloudflareBindings).DB);
    return c.render(<IndexView {...viewBuilder.index(result.tenets, user)} />);
  }

  @Get("/new")
  newTenet(c: Context) {
    return c.render(<NewView isEditing={false} />);
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
    return c.redirect(`/tenets/${tenet.slug}`);
  }

  @Get("/:slug")
  @Exists("tenet", (c) =>
    tenetsRepo((c.env as CloudflareBindings).DB).findOneBy({
      slug: c.req.param("slug")!,
    }),
  )
  async show(c: Context) {
    const user = c.get("user") as unknown as UserRow;
    const tenetRow = c.get("tenet") as TenetRow;
    const detail = await tenetService.getBySlug(
      (c.env as CloudflareBindings).DB,
      tenetRow.slug,
    );
    return c.render(<ShowView {...viewBuilder.show(detail, user)} />);
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
    return c.redirect(`/tenets/${tenetRow.slug}`);
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
    const body = await c.req.parseBody();
    const newStatus = body.status as string;
    await tenetService.transitionStatus(
      (c.env as CloudflareBindings).DB,
      user.id,
      tenetRow.slug,
      newStatus as any,
    );
    return c.redirect(`/tenets/${tenetRow.slug}`);
  }
}

export default new TenetsController();
