import { FC } from "hono/jsx";
import { Layout } from "./Layout";
import { Alert } from "../components/Alert";

const DEFAULT_ERROR_MESSAGE = "Something's wrong";

export interface ResultsViewProps {
  variant: "success" | "error" | "info";
  message?: string;
}

export const ResultsView: FC<ResultsViewProps> = ({ variant, message }) => {
  return (
    <Layout>
      <Alert
        variant={variant}
        header={message ?? DEFAULT_ERROR_MESSAGE}
      ></Alert>
    </Layout>
  );
};
