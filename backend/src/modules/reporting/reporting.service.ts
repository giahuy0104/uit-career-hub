import type { RequestMetadata } from "../auth/auth.types.js";
import { AppError } from "../../shared/app-error.js";
import { buildReportFile } from "./reporting.export.js";
import { ReportingRepository } from "./reporting.repository.js";
import type {
  ApplicationReportExportInput,
  ApplicationReportFilters,
  ApplicationReportListInput,
} from "./reporting.types.js";

const exportRowLimit = 10_000;

function filtersFrom(input: ApplicationReportFilters) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as ApplicationReportFilters;
}

export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  listApplications(input: ApplicationReportListInput) {
    return this.repository.withTransaction(true, (client) => this.repository.getReport(client, input));
  }

  exportApplications(
    actorUserId: string,
    input: ApplicationReportExportInput,
    request: RequestMetadata,
  ) {
    const { format, ...rawFilters } = input;
    const filters = filtersFrom(rawFilters);
    return this.repository.withTransaction(false, async (client) => {
      const rows = await this.repository.getExportRows(client, filters, exportRowLimit + 1);
      if (rows.length > exportRowLimit) {
        throw new AppError(
          422,
          "REPORT_EXPORT_TOO_LARGE",
          `Báo cáo vượt quá ${exportRowLimit.toLocaleString("vi-VN")} dòng. Vui lòng thu hẹp bộ lọc trước khi xuất.`,
        );
      }
      const summary = await this.repository.getSummary(client, filters);
      const file = await buildReportFile(format, rows, summary, filters);
      await this.repository.writeExportAudit(client, {
        actorUserId,
        format,
        rowCount: rows.length,
        filters,
        request,
      });
      return file;
    });
  }
}
