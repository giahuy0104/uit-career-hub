import { DailyPendingRepository } from "./daily-pending.repository.js";

const REPORT_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function dateInTimeZone(date: Date, timeZone = REPORT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export class DailyPendingService {
  constructor(private readonly repository: DailyPendingRepository) {}

  run(now = new Date()) {
    return this.repository.createSummaryNotifications(dateInTimeZone(now));
  }
}
