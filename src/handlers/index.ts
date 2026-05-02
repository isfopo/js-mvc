import { Env, Hono } from "hono";
import HomeHandler from "./HomeHandler";

export const registerHandlers = <T extends Env>(app: Hono<T>) => {
  HomeHandler.register(app);
};
