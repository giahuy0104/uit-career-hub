import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../shared/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
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

  console.error(`[${traceId}]`, error);
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
      details: [],
      traceId,
    },
  });
};
