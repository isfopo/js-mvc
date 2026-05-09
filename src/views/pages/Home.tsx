import type { FC } from "hono/jsx";
import type { HomeViewModel } from "../../view-models/HomeViewModel";

export const Home: FC<HomeViewModel> = ({ today }) => {
  return <p>Hi! It's {today.toDateString()}</p>;
};
