import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(request: Request, response: Response, next: NextFunction) {
  const requestedTraceId = request.header("x-request-id")?.trim();
  const traceId = requestedTraceId && requestedTraceId.length <= 128
    ? requestedTraceId
    : randomUUID();

  response.locals.traceId = traceId;
  response.setHeader("x-request-id", traceId);
  next();
}
