import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { ErrorMonitor } from "../observability/error-monitor.js";
import type { StructuredLogger } from "../observability/structured-logger.js";
import { AppError } from "../shared/app-error.js";
import { createErrorHandler } from "./error-handler.js";
import { requestContext } from "./request-context.js";

function testApp(error: unknown) {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
  } as unknown as Pick<StructuredLogger, "error" | "warn">;
  const monitor = {
    capture: vi.fn(async () => undefined),
  } satisfies ErrorMonitor;
  const app = express();
  app.use(requestContext);
  app.get("/boom", () => {
    throw error;
  });
  app.use(createErrorHandler({ logger, monitor }));
  return { app, logger, monitor };
}

describe("error handler observability", () => {
  it("logs and monitors a sanitized unexpected error with the response trace id", async () => {
    const { app, logger, monitor } = testApp(new Error("password=super-secret"));

    const response = await request(app).get("/boom").set("x-request-id", "trace-safe-1");

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      traceId: "trace-safe-1",
    });
    expect(logger.error).toHaveBeenCalledWith("request_error", expect.objectContaining({
      traceId: "trace-safe-1",
      request: { method: "GET", path: "/boom" },
      response: { status: 500, code: "INTERNAL_SERVER_ERROR" },
    }));
    expect(monitor.capture).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((monitor.capture as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]))
      .not.toContain("super-secret");
  });

  it("monitors operational 5xx errors but not expected 4xx errors", async () => {
    const unavailable = testApp(new AppError(503, "STORAGE_UNAVAILABLE", "Storage unavailable."));
    expect((await request(unavailable.app).get("/boom")).status).toBe(503);
    expect(unavailable.monitor.capture).toHaveBeenCalledTimes(1);

    const notFound = testApp(new AppError(404, "RESOURCE_NOT_FOUND", "Not found."));
    expect((await request(notFound.app).get("/boom")).status).toBe(404);
    expect(notFound.monitor.capture).not.toHaveBeenCalled();
    expect(notFound.logger.error).not.toHaveBeenCalled();
  });

  it("keeps the API response available when the monitor webhook fails", async () => {
    const logger = { error: vi.fn(), warn: vi.fn() } as unknown as Pick<StructuredLogger, "error" | "warn">;
    const monitorError = new Error("monitor unavailable");
    const monitor: ErrorMonitor = {
      capture: vi.fn(async () => {
        throw monitorError;
      }),
    };
    const app = express();
    app.use(requestContext);
    app.get("/boom", () => {
      throw new Error("boom");
    });
    app.use(createErrorHandler({ logger, monitor }));

    const response = await request(app).get("/boom");

    expect(response.status).toBe(500);
    expect(logger.warn).toHaveBeenCalledWith(
      "error_monitor_delivery_failed",
      expect.objectContaining({ error: expect.objectContaining({ name: "Error" }) }),
    );
  });
});
