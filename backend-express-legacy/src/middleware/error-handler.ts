import type { ErrorRequestHandler, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { errorMonitor, type ErrorMonitor, type ErrorMonitorEvent } from "../observability/error-monitor.js";
import { appLogger, serializeError, type StructuredLogger } from "../observability/structured-logger.js";
import { AppError } from "../shared/app-error.js";

type ErrorHandlerDependencies = {
  logger: Pick<StructuredLogger, "error" | "warn">;
  monitor: ErrorMonitor;
};

async function reportRequestError(
  error: unknown,
  request: Request,
  response: Response,
  status: number,
  code: string,
  dependencies: ErrorHandlerDependencies,
) {
  const traceId = response.locals.traceId ?? "unknown";
  const event: ErrorMonitorEvent = {
    schemaVersion: 1,
    service: "uit-career-hub-api",
    environment: env.nodeEnv,
    occurredAt: new Date().toISOString(),
    traceId,
    event: "request_error",
    request: { method: request.method, path: request.path },
    response: { status, code },
    error: serializeError(error),
  };

  dependencies.logger.error("request_error", event);
  try {
    await dependencies.monitor.capture(event);
  } catch (monitorError) {
    dependencies.logger.warn("error_monitor_delivery_failed", {
      traceId,
      error: serializeError(monitorError),
    });
  }
}

export function createErrorHandler(
  dependencies: ErrorHandlerDependencies = { logger: appLogger, monitor: errorMonitor },
): ErrorRequestHandler {
  return async (error, request, response, _next) => {
    const traceId = response.locals.traceId ?? "unknown";

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu gửi lên không hợp lệ.",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
          traceId,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      if (error.status >= 500) {
        await reportRequestError(
          error,
          request,
          response,
          error.status,
          error.code,
          dependencies,
        );
      }
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          traceId,
        },
      });
      return;
    }

    await reportRequestError(
      error,
      request,
      response,
      500,
      "INTERNAL_SERVER_ERROR",
      dependencies,
    );
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
        details: [],
        traceId,
      },
    });
  };
}

export const errorHandler = createErrorHandler();
