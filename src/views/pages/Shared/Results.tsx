import { FC } from "hono/jsx";
import { Layout } from "./Layout";
import { Alert } from "views/components/Alert";
import { AppError, ValidationError } from "infrastructure/errors/index";

const DEFAULT_ERROR_MESSAGE = "Something's wrong";

export interface ResultsViewProps {
  variant: "success" | "error" | "info";
  message?: string;
  error?: AppError | Error;
  depth?: number;
}

export const ResultsView: FC<ResultsViewProps> = ({ variant, message, error, depth = 0 }) => {
  const title = message ?? DEFAULT_ERROR_MESSAGE;
  const isAppError = error instanceof AppError;

  const subheader = isAppError && error.statusCode
    ? `Error ${error.statusCode}`
    : undefined;

  const fieldErrors = error instanceof ValidationError && error.fields
    ? Object.entries(error.fields).map(([field, msg]) => (
        <li>
          <strong>{field}:</strong> {msg}
        </li>
      ))
    : null;

  const content = (
    <Alert variant={variant} header={title} subheader={subheader}>
      {fieldErrors && <ul>{fieldErrors}</ul>}
    </Alert>
  );

  // At depth > 0, don't wrap in Layout — FrameShell handles that in handleError
  if (depth > 0) {
    return content;
  }

  return (
    <Layout>
      {content}
    </Layout>
  );
};