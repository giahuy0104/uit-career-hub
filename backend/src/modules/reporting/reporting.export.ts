import ExcelJS from "exceljs";

import type {
  ApplicationReportFilters,
  ApplicationReportRow,
  ApplicationReportSummary,
  ReportExportFormat,
  ReportFile,
} from "./reporting.types.js";

const statusLabels: Record<string, string> = {
  UIT_REVIEWING: "UIT đang duyệt",
  NEEDS_SUPPLEMENT: "Cần bổ sung",
  FORWARDED_TO_COMPANY: "Đã chuyển doanh nghiệp",
  COMPANY_REVIEWING: "Doanh nghiệp đang duyệt",
  INTERVIEW_INVITED: "Đã mời phỏng vấn",
  NOT_SUITABLE: "Không phù hợp",
  INTERVIEW_FAILED: "Phỏng vấn chưa đạt",
  OFFER_PENDING_STUDENT: "Chờ sinh viên phản hồi offer",
  ACCEPTED_PENDING_UIT_CONFIRMATION: "Chờ UIT xác nhận",
  HIRED: "Đã xác nhận placement",
  OFFER_DECLINED: "Sinh viên từ chối offer",
  UIT_REJECTED: "UIT từ chối",
  WITHDRAWN: "Đã rút",
};

const opportunityLabels: Record<string, string> = {
  INTERNSHIP: "Thực tập",
  PART_TIME: "Bán thời gian",
  FULL_TIME: "Toàn thời gian",
  FRESHER: "Fresher",
};

const workModeLabels: Record<string, string> = {
  ONSITE: "Tại văn phòng",
  REMOTE: "Từ xa",
  HYBRID: "Kết hợp",
};

const filterLabels: Array<[keyof ApplicationReportFilters, string]> = [
  ["fromDate", "Từ ngày"],
  ["toDate", "Đến ngày"],
  ["faculty", "Khoa"],
  ["major", "Ngành"],
  ["cohort", "Khóa"],
  ["companyId", "Mã định danh doanh nghiệp"],
  ["status", "Trạng thái"],
  ["opportunityType", "Loại cơ hội"],
  ["query", "Từ khóa"],
];

function safeCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function vietnamDateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function exportTimestamp(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}${get("second")}`;
}

function csvRows(rows: ApplicationReportRow[]) {
  return rows.map((row) => [
    row.applicationId,
    vietnamDateTime(row.submittedAt),
    row.student.studentCode,
    row.student.fullName,
    row.student.faculty,
    row.student.major,
    row.student.cohort,
    row.company.code,
    row.company.name,
    row.job.title,
    opportunityLabels[row.job.opportunityType] ?? row.job.opportunityType,
    workModeLabels[row.job.workMode] ?? row.job.workMode,
    statusLabels[row.status] ?? row.status,
    row.recruitmentResult?.outcome ?? "",
    row.recruitmentResult?.studentDecision ?? "",
    row.recruitmentResult?.startDate ?? "",
  ]);
}

export function buildCsvReport(rows: ApplicationReportRow[], now = new Date()): ReportFile {
  const headers = [
    "Mã hồ sơ",
    "Ngày ứng tuyển",
    "MSSV",
    "Họ và tên",
    "Khoa",
    "Ngành",
    "Khóa",
    "Mã doanh nghiệp",
    "Doanh nghiệp",
    "Tin tuyển dụng",
    "Loại cơ hội",
    "Hình thức làm việc",
    "Trạng thái",
    "Kết quả",
    "Phản hồi offer",
    "Ngày bắt đầu",
  ];
  const body = [headers, ...csvRows(rows)]
    .map((row) => row.map(safeCsvValue).join(","))
    .join("\r\n");
  return {
    buffer: Buffer.from(`\uFEFF${body}`, "utf8"),
    contentType: "text/csv; charset=utf-8",
    fileName: `uit-application-report-${exportTimestamp(now)}.csv`,
    rowCount: rows.length,
  };
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B4F8A" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD5DFEA" } } };
  });
}

function displayFilterValue(key: keyof ApplicationReportFilters, value: string) {
  if (key === "status") return statusLabels[value] ?? value;
  if (key === "opportunityType") return opportunityLabels[value] ?? value;
  return value;
}

export async function buildXlsxReport(
  rows: ApplicationReportRow[],
  summary: ApplicationReportSummary,
  filters: ApplicationReportFilters,
  now = new Date(),
): Promise<ReportFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UIT Career Hub";
  workbook.created = now;
  workbook.modified = now;
  workbook.calcProperties.fullCalcOnLoad = true;

  const overview = workbook.addWorksheet("Tổng quan", {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 20 },
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  overview.columns = [{ width: 31 }, { width: 32 }, { width: 24 }];
  overview.mergeCells("A1:C1");
  const title = overview.getCell("A1");
  title.value = "BÁO CÁO HỒ SƠ ỨNG TUYỂN UIT";
  title.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B4F8A" } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  overview.getRow(1).height = 38;
  overview.getCell("A2").value = "Thời điểm xuất";
  overview.getCell("B2").value = now;
  overview.getCell("B2").numFmt = "dd/mm/yyyy hh:mm:ss";
  overview.getCell("A4").value = "Chỉ số";
  overview.getCell("B4").value = "Giá trị";
  styleHeader(overview.getRow(4));

  const dataEndRow = Math.max(rows.length + 1, 2);
  const metrics: Array<[string, ExcelJS.CellValue, string?]> = [
    ["Tổng hồ sơ", { formula: `COUNTA('Dữ liệu'!A2:A${dataEndRow})`, result: summary.totalApplications }],
    ["Sinh viên duy nhất", summary.uniqueStudents],
    ["Doanh nghiệp", summary.companyCount],
    ["Placement đã xác nhận", { formula: `COUNTIF('Dữ liệu'!M2:M${dataEndRow},\"HIRED\")`, result: summary.hiredCount }],
    ["Tỷ lệ placement", { formula: "IF(B5=0,0,B8/B5)", result: summary.hiredRate }, "0.0%"],
  ];
  metrics.forEach(([label, value, numFmt], index) => {
    const row = index + 5;
    overview.getCell(row, 1).value = label;
    overview.getCell(row, 2).value = value;
    overview.getCell(row, 2).font = { bold: true, color: { argb: "FF0B4F8A" } };
    if (numFmt) overview.getCell(row, 2).numFmt = numFmt;
  });

  overview.getCell("A11").value = "Bộ lọc áp dụng";
  overview.getCell("B11").value = "Giá trị";
  styleHeader(overview.getRow(11));
  const activeFilters = filterLabels.filter(([key]) => filters[key]);
  if (activeFilters.length === 0) {
    overview.getCell("A12").value = "Phạm vi";
    overview.getCell("B12").value = "Toàn bộ dữ liệu";
  } else {
    activeFilters.forEach(([key, label], index) => {
      const row = index + 12;
      overview.getCell(row, 1).value = label;
      overview.getCell(row, 2).value = displayFilterValue(key, String(filters[key]));
    });
  }

  const statusStart = 13 + Math.max(activeFilters.length, 1);
  overview.getCell(statusStart, 1).value = "Phân bố trạng thái";
  overview.getCell(statusStart, 2).value = "Số hồ sơ";
  styleHeader(overview.getRow(statusStart));
  summary.statusCounts.forEach((item, index) => {
    overview.getCell(statusStart + index + 1, 1).value = statusLabels[item.status] ?? item.status;
    overview.getCell(statusStart + index + 1, 2).value = item.count;
  });

  const data = workbook.addWorksheet("Dữ liệu", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 20 },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  data.columns = [
    { header: "Mã hồ sơ", key: "applicationId", width: 38 },
    { header: "Ngày ứng tuyển", key: "submittedAt", width: 20 },
    { header: "MSSV", key: "studentCode", width: 14 },
    { header: "Họ và tên", key: "fullName", width: 24 },
    { header: "Khoa", key: "faculty", width: 24 },
    { header: "Ngành", key: "major", width: 28 },
    { header: "Khóa", key: "cohort", width: 12 },
    { header: "Mã doanh nghiệp", key: "companyCode", width: 18 },
    { header: "Doanh nghiệp", key: "companyName", width: 28 },
    { header: "Tin tuyển dụng", key: "jobTitle", width: 32 },
    { header: "Loại cơ hội", key: "opportunityType", width: 18 },
    { header: "Hình thức", key: "workMode", width: 18 },
    { header: "Trạng thái", key: "status", width: 36 },
    { header: "Kết quả", key: "outcome", width: 14 },
    { header: "Phản hồi offer", key: "studentDecision", width: 18 },
    { header: "Ngày bắt đầu", key: "startDate", width: 16 },
  ];
  styleHeader(data.getRow(1));
  data.autoFilter = { from: "A1", to: "P1" };
  rows.forEach((row) => {
    const added = data.addRow({
      applicationId: row.applicationId,
      submittedAt: new Date(row.submittedAt),
      studentCode: row.student.studentCode,
      fullName: row.student.fullName,
      faculty: row.student.faculty,
      major: row.student.major,
      cohort: row.student.cohort,
      companyCode: row.company.code,
      companyName: row.company.name,
      jobTitle: row.job.title,
      opportunityType: opportunityLabels[row.job.opportunityType] ?? row.job.opportunityType,
      workMode: workModeLabels[row.job.workMode] ?? row.job.workMode,
      status: row.status,
      outcome: row.recruitmentResult?.outcome ?? null,
      studentDecision: row.recruitmentResult?.studentDecision ?? null,
      startDate: row.recruitmentResult?.startDate ? new Date(`${row.recruitmentResult.startDate}T00:00:00Z`) : null,
    });
    added.getCell(2).numFmt = "dd/mm/yyyy hh:mm";
    added.getCell(16).numFmt = "dd/mm/yyyy";
    added.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE1E8F0" } } };
    });
  });

  const output = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(output),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: `uit-application-report-${exportTimestamp(now)}.xlsx`,
    rowCount: rows.length,
  };
}

export async function buildReportFile(
  format: ReportExportFormat,
  rows: ApplicationReportRow[],
  summary: ApplicationReportSummary,
  filters: ApplicationReportFilters,
) {
  return format === "CSV" ? buildCsvReport(rows) : buildXlsxReport(rows, summary, filters);
}
