import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { DailyPendingService } from "./daily-pending.service.js";

const cronSecret = "test-cron-secret-with-at-least-32-characters";
const summary = {
  summaryDate: "2026-08-07",
  uitPendingCount: 2,
  companyPendingCount: 3,
  companyCount: 1,
  uitRecipientCount: 1,
  companyRecipientCount: 2,
  notificationsCreated: 3,
};

describe("daily pending cron route", () => {
  it("rejects requests without the configured bearer secret", async () => {
    const run = vi.fn(async () => summary);
    const app = createApp({
      dailyPendingService: { run } as unknown as DailyPendingService,
      cronSecret,
    });

    const missing = await request(app).get("/api/v1/cron/daily-pending-notifications");
    const invalid = await request(app)
      .get("/api/v1/cron/daily-pending-notifications")
      .set("Authorization", "Bearer wrong-secret");

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("CRON_UNAUTHORIZED");
    expect(invalid.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the summary with the correct bearer secret", async () => {
    const run = vi.fn(async () => summary);
    const app = createApp({
      dailyPendingService: { run } as unknown as DailyPendingService,
      cronSecret,
    });

    const response = await request(app)
      .get("/api/v1/cron/daily-pending-notifications")
      .set("Authorization", `Bearer ${cronSecret}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.data).toEqual(summary);
    expect(run).toHaveBeenCalledOnce();
  });
});
