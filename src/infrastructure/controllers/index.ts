import { Env, Hono } from "hono";
import HomeController from "../../pages/Home/controller";
import ComponentsController from "../../pages/Components/controller";
import WellKnownController from "../../api/WellKnown/controller";

export const registerControllers = <T extends Env>(app: Hono<T>) => {
  HomeController.register(app);
  ComponentsController.register(app);
  WellKnownController.register(app);
};
