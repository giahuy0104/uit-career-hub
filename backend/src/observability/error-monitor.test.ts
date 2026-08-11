import { describe, expect, it, vi } from "vitest";

import { createErrorMonitor, type ErrorMonitorEvent } from "./error-monitor.js";

const event: ErrorMonitorEvent = {
  schemaVersion: 1,
  service: "uit-career-hub-api",
  environment: "test",
  occurredAt: "2026-08-11T00:00:00.000Z",
  traceId: "trace-1",
  event: "request_error",
  request: { method: "GET", path: "/api/v1/test" },
  response: { status: 500, code: "INTERNAL_SERVER_ERROR" },
  error: { name: "Error", message: "safe message" },
};

describe("error monitor", () => {
  it("does nothing when no webhook is configured", async () => {
    await expect(createErrorMonitor().capture(event)).resolves.toBeUndefined();
  });

  it("posts a structured event to the configured webhook", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 })) as unknown as typeof fetch;
    const monitor = createErrorMonitor({
      webhookUrl: "https://monitor.example.test/events",
      timeoutMs: 500,
      fetchImpl,
    });

    await monitor.capture(event);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://monitor.example.test/events");
    expect(JSON.parse(init.body)).toEqual(event);
  });

  it("reports non-successful webhook responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    const monitor = createErrorMonitor({
      webhookUrl: "https://monitor.example.test/events",
      fetchImpl,
    });

    await expect(monitor.capture(event)).rejects.toThrow(/HTTP 503/);
  });
});
