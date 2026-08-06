import type { Context } from "hono";
import type { IExistable } from "js-mvc/validation/decorators";
import { tenetsRepo } from "data/tenet/repo";

export class FindTenetGuard implements IExistable {
  key = "tenet";

  async load(c: Context): Promise<unknown> {
    return tenetsRepo((c.env as CloudflareBindings).DB).findOneBy({
      slug: c.req.param("slug")!,
    });
  }
}
