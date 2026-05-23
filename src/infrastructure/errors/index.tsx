import { StatusCode } from "hono/utils/http-status";
import { ResultsView } from "views/routes/Shared/Results";
import { Context } from "hono";

export class AppError extends Error {
  readonly statusCode: StatusCode;
  override name: string = "AppError";

  constructor(message: string, statusCode: StatusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  override name = "NotFound";
  constructor(message = "Could not be found") {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  override name = "Unauthorized";
  constructor(message = "You must be logged in") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  override name = "Forbidden";
  constructor(message = "You don't have permission to do that") {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  override name = "Validation Error";
  readonly fields?: Record<string, string>;

  constructor(message = "Invalid input", fields?: Record<string, string>) {
    super(message, 400);
    this.fields = fields;
  }
}

export class ConflictError extends AppError {
  override name = "Conflict";
  constructor(message = "Resource already exists") {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  override name = "Rate Limited";
  constructor(message = "Too many requests, try again later") {
    super(message, 429);
  }
}

export class ServerError extends AppError {
  override name = "Server Error";
  constructor(message = "Something went wrong on our end") {
    super(message, 500);
  }
}

export function handleError(
  c: Context,
  error: unknown,
): Response | Promise<Response> {
  if (error instanceof NotFoundError) {
    c.status(404);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }
  if (error instanceof UnauthorizedError) {
    c.status(401);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }
  if (error instanceof ForbiddenError) {
    c.status(403);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }
  if (error instanceof ValidationError) {
    c.status(400);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }
  if (error instanceof ConflictError) {
    c.status(409);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }
  if (error instanceof RateLimitError) {
    c.status(429);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }
  if (error instanceof ServerError) {
    c.status(500);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }
  if (error instanceof AppError) {
    c.status(error.statusCode);
    return c.html(
      <ResultsView variant="error" message={error.message} error={error} />,
    );
  }

  c.status(500);
  return c.html(
    <ResultsView
      variant="error"
      message={error instanceof Error ? error.message : "Unknown error"}
      error={error instanceof Error ? error : undefined}
    />,
  );
}
