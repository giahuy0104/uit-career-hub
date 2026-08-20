import { timingSafeEqual } from "node:crypto";
import { Router } from "express";

import { AppError } from "../../shared/app-error.js";
import { DailyPendingService } from "./daily-pending.service.js";

function validCronAuthorization(authorization: string | undefined, cronSecret: string | undefined) {
  if (!authorization || !cronSecret) return false;
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authorization);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createDailyPendingRouter(
  service: DailyPendingService,
  cronSecret: string | undefined,
) {
  const router = Router();

  router.get("/cron/daily-pending-notifications", async (request, response) => {
    if (!validCronAuthorization(request.header("authorization"), cronSecret)) {
      throw new AppError(401, "CRON_UNAUTHORIZED", "Cron request không hợp lệ.");
    }

    const result = await service.run();
    response.json({ data: result });
  });

  return router;
}
