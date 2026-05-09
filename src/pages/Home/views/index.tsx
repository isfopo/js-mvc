import type { FC } from "hono/jsx";
import type { HomeViewModel } from "../view-model";

export const View: FC<HomeViewModel> = ({ today }) => {
  return <p>Hi! It's {today.toDateString()}</p>;
};
