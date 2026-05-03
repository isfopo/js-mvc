import type { FC } from "hono/jsx";

export interface HomeProps {
  today: Date;
}

export const Home: FC<HomeProps> = ({ today }) => {
  return <p>Hi! It's {today.toDateString()}</p>;
};
