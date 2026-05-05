import { FC } from "hono/jsx";
import { Layout } from "./Layout";
import { Alert } from "../components/Alert";

export interface ResultsViewProps {
  variant: "success" | "error" | "info";
  message?: string;
}

export const ResultsView: FC<ResultsViewProps> = ({ variant, message }) => {
  return (
    <Layout>
      <Alert variant={variant}>{message && <p>{message}</p>}</Alert>
    </Layout>
  );
};
