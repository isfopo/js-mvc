import { Env, Hono } from "hono";
import HomeController from "./HomeController";
import ComponentsController from "./ComponentsController";
import WellKnownController from "./WellKnownController";

export const registerControllers = <T extends Env>(app: Hono<T>) => {
  HomeController.register(app);
  ComponentsController.register(app);
  WellKnownController.register(app);
};
