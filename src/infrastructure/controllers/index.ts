import { Env, Hono } from "hono";
import HomeController from "../../pages/Home/controller";
import ComponentsController from "../../pages/Components/controller";
import StateDemoController from "../../pages/StateDemo/controller";
import TenetsController from "../../pages/Tenets/controller";
import TenetsApiController from "../../api/Tenets/controller";
import WellKnownController from "../../api/WellKnown/controller";
import AuthController from "../../api/Auth/controller";

export const registerControllers = <T extends Env>(app: Hono<T>) => {
  HomeController.register(app);
  ComponentsController.register(app);
  StateDemoController.register(app);
  TenetsController.register(app);
  TenetsApiController.register(app);
  WellKnownController.register(app);
  AuthController.register(app);
};
