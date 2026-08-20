import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function requestContext(request: Request, response: Response, next: NextFunction) {
  const requestedTraceId = request.header("x-request-id")?.trim();
  const traceId = requestedTraceId && requestIdPattern.test(requestedTraceId)
    ? requestedTraceId
    : randomUUID();

  response.locals.traceId = traceId;
  response.setHeader("x-request-id", traceId);
  next();
}
