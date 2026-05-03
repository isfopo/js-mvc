import { Env, Hono } from "hono";
import HomeHandler from "./HomeHandler";
import ComponentsShowcaseHandler from "./ComponentsShowcaseHandler";

export const registerHandlers = <T extends Env>(app: Hono<T>) => {
  HomeHandler.register(app);
  ComponentsShowcaseHandler.register(app);
};
