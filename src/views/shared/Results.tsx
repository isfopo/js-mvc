import { FC } from "hono/jsx";
import { Layout } from "./Layout";

export interface ResultsViewProps {
  variant: "success" | "error" | "info";
  message?: string;
}

export const ResultsView: FC<ResultsViewProps> = ({ variant, message }) => {
  return (
    <Layout>
      <p>
        {variant}
        {message ? `: ${message}` : ""}
      </p>
    </Layout>
  );
};
