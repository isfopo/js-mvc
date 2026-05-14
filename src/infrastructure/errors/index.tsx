import { StatusCode } from "hono/utils/http-status";
import { ResultsView } from "views/pages/Shared/Results";
import { Context } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { getFrameDepth } from "infrastructure/FrameContext";
import { FrameShell } from "views/pages/Shared/FrameShell";

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
  const depth = getFrameDepth();

  // Helper to render error in the appropriate shell
  function renderError(variant: "success" | "error" | "info", message: string, error?: AppError | Error, statusCode?: StatusCode): Response {
    if (statusCode) {
      c.status(statusCode);
    }

    const content = <ResultsView variant={variant} message={message} error={error} depth={depth} />;

    if (depth === 0) {
      // ResultsView wraps in Layout at depth 0
      return c.html("<!DOCTYPE html>" + renderToString(content));
    }

    // At depth > 0, wrap in FrameShell
    return c.html("<!DOCTYPE html>" + renderToString(
      <FrameShell depth={depth}>{content}</FrameShell>,
    ));
  }

  if (error instanceof NotFoundError) {
    return renderError("error", error.message, error, 404);
  }
  if (error instanceof UnauthorizedError) {
    return renderError("error", error.message, error, 401);
  }
  if (error instanceof ForbiddenError) {
    return renderError("error", error.message, error, 403);
  }
  if (error instanceof ValidationError) {
    return renderError("error", error.message, error, 400);
  }
  if (error instanceof ConflictError) {
    return renderError("error", error.message, error, 409);
  }
  if (error instanceof RateLimitError) {
    return renderError("error", error.message, error, 429);
  }
  if (error instanceof ServerError) {
    return renderError("error", error.message, error, 500);
  }
  if (error instanceof AppError) {
    return renderError("error", error.message, error, error.statusCode);
  }

  return renderError(
    "error",
    error instanceof Error ? error.message : "Unknown error",
    error instanceof Error ? error : undefined,
    500,
  );
}