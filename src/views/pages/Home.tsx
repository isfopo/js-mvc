import type { FC } from "hono/jsx";

export interface HomeViewModel {
  today: Date;
}

export const Home: FC<HomeViewModel> = ({ today }) => {
  return <p>Hi! It's {today.toDateString()}</p>;
};
