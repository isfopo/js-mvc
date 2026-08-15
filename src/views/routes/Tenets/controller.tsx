import { Context, Env } from "hono";
import { Get, Post, ControllerBase } from "js-mvc/controller/ControllerBase";
import { Exists, Validate } from "js-mvc/gaurds";
import { Layout } from "views/routes/Shared/Layout";
import { handleError } from "error-handler";
import { requireAuth } from "middlewares/auth";
import { tenetService } from "data/tenet/service";
import { ProposeTenetRequest } from "./requests/ProposeTenetRequest";
import { VoteRequest } from "./requests/VoteRequest";
import { FindTenetGuard } from "./guards/FindTenetGuard";
import { View as IndexView } from "./views/index";
import { View as ShowView } from "./views/show";
import { View as NewView } from "./views/new";
import { viewBuilder } from "./view-builder";
import type { UserRow } from "data/user/model";
import type { TenetRow } from "data/tenet/model";
import { TransitionRequest } from "./requests/TransitionRequest";

class TenetsController<T extends Env> extends ControllerBase<T> {
  override base = "tenets";

  constructor() {
    super();
    this.configureRendering({ layout: Layout, handleError });
    this._app.use("*", requireAuth());
  }

  @Get("/")
  async index(c: Context) {
    const user = c.get("user") as UserRow;
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
    const user = c.get("user") as UserRow;
    const input = c.get("body") as ProposeTenetRequest;
    const tenet = await tenetService.propose(
      (c.env as CloudflareBindings).DB,
      user.id,
      input,
    );
    return c.redirect(`/tenets/${tenet.slug}`);
  }

  @Get("/:slug")
  @Exists(FindTenetGuard)
  async show(c: Context) {
    const user = c.get("user") as UserRow;
    const tenetRow = c.get("tenet") as TenetRow;
    const detail = await tenetService.getBySlug(
      (c.env as CloudflareBindings).DB,
      tenetRow.slug,
    );
    return c.render(<ShowView {...viewBuilder.show(detail, user)} />);
  }

  @Post("/:slug/vote")
  @Exists(FindTenetGuard)
  @Validate(VoteRequest)
  async vote(c: Context) {
    const user = c.get("user") as UserRow;
    const tenetRow = c.get("tenet") as TenetRow;
    const input = c.get("body") as VoteRequest;
    await tenetService.vote(
      (c.env as CloudflareBindings).DB,
      user.id,
      tenetRow.slug,
      input,
    );
    return c.redirect(`/tenets/${tenetRow.slug}`);
  }

  @Post("/:slug/status")
  @Exists(FindTenetGuard)
  async transition(c: Context) {
    const user = c.get("user") as UserRow;
    const tenetRow = c.get("tenet") as TenetRow;
    const body = c.get("body") as TransitionRequest;

    await tenetService.transitionStatus(
      (c.env as CloudflareBindings).DB,
      user.id,
      tenetRow.slug,
      body.status,
    );
    return c.redirect(`/tenets/${tenetRow.slug}`);
  }
}

export default new TenetsController();
