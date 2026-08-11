import { env } from "../config/env.js";
import type { serializeError } from "./structured-logger.js";

export type ErrorMonitorEvent = {
  schemaVersion: 1;
  service: "uit-career-hub-api";
  environment: string;
  occurredAt: string;
  traceId: string;
  event: "request_error";
  request: {
    method: string;
    path: string;
  };
  response: {
    status: number;
    code: string;
  };
  error: ReturnType<typeof serializeError>;
};

export interface ErrorMonitor {
  capture(event: ErrorMonitorEvent): Promise<void>;
}

type Fetch = typeof fetch;

class DisabledErrorMonitor implements ErrorMonitor {
  async capture(_event: ErrorMonitorEvent) {}
}

export class WebhookErrorMonitor implements ErrorMonitor {
  constructor(
    private readonly webhookUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async capture(event: ErrorMonitorEvent) {
    const response = await this.fetchImpl(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Error monitor returned HTTP ${response.status}.`);
    }
  }
}

export function createErrorMonitor(options: {
  webhookUrl?: string;
  timeoutMs?: number;
  fetchImpl?: Fetch;
} = {}): ErrorMonitor {
  if (!options.webhookUrl) return new DisabledErrorMonitor();
  return new WebhookErrorMonitor(
    options.webhookUrl,
    options.timeoutMs ?? 1_500,
    options.fetchImpl,
  );
}

export const errorMonitor = createErrorMonitor({
  webhookUrl: env.errorMonitorWebhookUrl,
  timeoutMs: env.errorMonitorTimeoutMs,
});
