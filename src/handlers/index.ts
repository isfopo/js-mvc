import { Env, Hono } from "hono";
import HomeHandler from "./HomeHandler";
import ComponentsHandler from "./ComponentsHandler";

export const registerHandlers = <T extends Env>(app: Hono<T>) => {
  HomeHandler.register(app);
  ComponentsHandler.register(app);
};
