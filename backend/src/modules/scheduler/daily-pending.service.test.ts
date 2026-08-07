import { describe, expect, it, vi } from "vitest";

import type { DailyPendingRepository } from "./daily-pending.repository.js";
import { DailyPendingService, dateInTimeZone } from "./daily-pending.service.js";

describe("daily pending service", () => {
  it("uses the calendar date in Asia/Ho_Chi_Minh", () => {
    expect(dateInTimeZone(new Date("2026-08-07T18:30:00.000Z"))).toBe("2026-08-08");
  });

  it("passes the deterministic local date to the repository", async () => {
    const createSummaryNotifications = vi.fn(async (summaryDate: string) => ({ summaryDate }));
    const service = new DailyPendingService({
      createSummaryNotifications,
    } as unknown as DailyPendingRepository);

    await service.run(new Date("2026-08-07T01:15:00.000Z"));

    expect(createSummaryNotifications).toHaveBeenCalledWith("2026-08-07");
  });
});
