import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  ChartBar,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  FileText,
  Funnel,
  MagnifyingGlass,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { EmptyHint, MetricCard, Panel, Status } from "../shared/WorkspaceShell.jsx";

const emptyFilters = {
  fromDate: "",
  toDate: "",
  faculty: "",
  major: "",
  cohort: "",
  companyId: "",
  status: "",
  opportunityType: "",
  query: "",
};

const emptyResult = {
  data: [],
  summary: { totalApplications: 0, uniqueStudents: 0, companyCount: 0, hiredCount: 0, hiredRate: 0, statusCounts: [] },
  filterOptions: { faculties: [], majors: [], cohorts: [], companies: [] },
  meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
};

const statusCopy = {
  UIT_REVIEWING: ["UIT đang duyệt", "warning"],
  NEEDS_SUPPLEMENT: ["Cần bổ sung", "urgent"],
  FORWARDED_TO_COMPANY: ["Đã chuyển doanh nghiệp", "blue"],
  COMPANY_REVIEWING: ["Doanh nghiệp đang duyệt", "warning"],
  INTERVIEW_INVITED: ["Đã mời phỏng vấn", "blue"],
  NOT_SUITABLE: ["Không phù hợp", "neutral"],
  INTERVIEW_FAILED: ["Phỏng vấn chưa đạt", "urgent"],
  OFFER_PENDING_STUDENT: ["Chờ phản hồi offer", "warning"],
  ACCEPTED_PENDING_UIT_CONFIRMATION: ["Chờ UIT xác nhận", "warning"],
  HIRED: ["Đã xác nhận placement", "success"],
  OFFER_DECLINED: ["Từ chối offer", "neutral"],
  UIT_REJECTED: ["UIT từ chối", "urgent"],
  WITHDRAWN: ["Đã rút", "neutral"],
};

const opportunityCopy = {
  INTERNSHIP: "Thực tập",
  PART_TIME: "Bán thời gian",
  FULL_TIME: "Toàn thời gian",
  FRESHER: "Fresher",
};

const workModeCopy = { ONSITE: "Tại văn phòng", REMOTE: "Từ xa", HYBRID: "Kết hợp" };

function apiError(error) {
  return error?.message || "Không thể tải báo cáo. Vui lòng thử lại.";
}

function activeFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
}

function dateTime(value) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function fileNameFrom(response, format) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || `uit-application-report.${format.toLowerCase()}`;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AdminReports() {
  const { authorizedRequest, authorizedResponse } = useAuth();
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(emptyResult);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [exporting, setExporting] = useState("");
  const [message, setMessage] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "25", ...activeFilters(applied) });
    try {
      setResult(await authorizedRequest(`/uit/reports/applications?${params}`));
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [applied, authorizedRequest, page, reloadVersion]);

  useEffect(() => { void load(); }, [load]);

  const filterCount = useMemo(() => Object.keys(activeFilters(applied)).length, [applied]);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const applyFilters = (event) => {
    event.preventDefault();
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      setFilterError("Ngày bắt đầu không được sau ngày kết thúc.");
      return;
    }
    setFilterError("");
    setMessage("");
    setPage(1);
    setApplied({ ...filters, query: filters.query.trim() });
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
    setFilterError("");
    setMessage("");
    setPage(1);
  };

  const exportReport = async (format) => {
    setExporting(format);
    setError("");
    setMessage("");
    try {
      const response = await authorizedResponse("/uit/reports/applications/exports", {
        method: "POST",
        body: JSON.stringify({ format, ...activeFilters(applied) }),
      });
      triggerDownload(await response.blob(), fileNameFrom(response, format));
      const count = response.headers.get("x-report-row-count") || result.summary.totalApplications;
      setMessage(`Đã xuất ${count} hồ sơ sang ${format}.`);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setExporting("");
    }
  };

  const summary = result.summary;

  return (
    <>
      {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
      <div className="metric-grid report-metrics">
        <MetricCard label="Tổng hồ sơ" value={summary.totalApplications.toLocaleString("vi-VN")} helper="Theo bộ lọc đang áp dụng" Icon={FileText} />
        <MetricCard label="Sinh viên" value={summary.uniqueStudents.toLocaleString("vi-VN")} helper="Không tính trùng sinh viên" Icon={UsersThree} tone="green" />
        <MetricCard label="Doanh nghiệp" value={summary.companyCount.toLocaleString("vi-VN")} helper="Có hồ sơ trong kỳ" Icon={Buildings} tone="amber" />
        <MetricCard label="Tỷ lệ placement" value={`${(summary.hiredRate * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} helper={`${summary.hiredCount.toLocaleString("vi-VN")} placement đã xác nhận`} Icon={ChartBar} tone="green" />
      </div>

      <Panel title="Bộ lọc báo cáo" className="report-filter-panel">
        <form className="report-filters" onSubmit={applyFilters}>
          <label className="report-query"><span>Tìm nhanh</span><div><MagnifyingGlass /><input aria-label="Tìm hồ sơ báo cáo" value={filters.query} maxLength={100} onChange={(event) => updateFilter("query", event.target.value)} placeholder="MSSV, sinh viên, tin hoặc doanh nghiệp..." /></div></label>
          <label><span>Từ ngày</span><input aria-label="Từ ngày" type="date" value={filters.fromDate} onChange={(event) => updateFilter("fromDate", event.target.value)} /></label>
          <label><span>Đến ngày</span><input aria-label="Đến ngày" type="date" value={filters.toDate} onChange={(event) => updateFilter("toDate", event.target.value)} /></label>
          <label><span>Khoa</span><select aria-label="Khoa" value={filters.faculty} onChange={(event) => updateFilter("faculty", event.target.value)}><option value="">Tất cả khoa</option>{result.filterOptions.faculties.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Ngành</span><select aria-label="Ngành" value={filters.major} onChange={(event) => updateFilter("major", event.target.value)}><option value="">Tất cả ngành</option>{result.filterOptions.majors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Khóa</span><select aria-label="Khóa" value={filters.cohort} onChange={(event) => updateFilter("cohort", event.target.value)}><option value="">Tất cả khóa</option>{result.filterOptions.cohorts.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Doanh nghiệp</span><select aria-label="Doanh nghiệp" value={filters.companyId} onChange={(event) => updateFilter("companyId", event.target.value)}><option value="">Tất cả doanh nghiệp</option>{result.filterOptions.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Trạng thái</span><select aria-label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusCopy).map(([value, copy]) => <option key={value} value={value}>{copy[0]}</option>)}</select></label>
          <label><span>Loại cơ hội</span><select aria-label="Loại cơ hội" value={filters.opportunityType} onChange={(event) => updateFilter("opportunityType", event.target.value)}><option value="">Tất cả loại cơ hội</option>{Object.entries(opportunityCopy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="report-filter-actions">
            {filterCount > 0 && <button type="button" className="link-button" onClick={clearFilters}>Xóa {filterCount} bộ lọc</button>}
            <button className="primary-button"><Funnel />Áp dụng bộ lọc</button>
          </div>
          {filterError && <p className="form-error" role="alert"><Warning />{filterError}</p>}
        </form>
      </Panel>

      <Panel
        title={`Chi tiết hồ sơ (${result.meta.totalItems.toLocaleString("vi-VN")})`}
        className="report-data-panel"
        action={<div className="report-export-actions"><button className="secondary-button small" disabled={Boolean(exporting) || loading} onClick={() => void exportReport("CSV")}>{exporting === "CSV" ? <CircleNotch className="spin" /> : <DownloadSimple />}Xuất CSV</button><button className="primary-button small" disabled={Boolean(exporting) || loading} onClick={() => void exportReport("XLSX")}>{exporting === "XLSX" ? <CircleNotch className="spin" /> : <DownloadSimple />}Xuất Excel</button></div>}
      >
        {error && <div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={() => setReloadVersion((value) => value + 1)}>Thử lại</button></div>}
        {loading ? (
          <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tổng hợp báo cáo...</div>
        ) : !error && result.data.length === 0 ? (
          <EmptyHint icon={ChartBar} title="Không có hồ sơ phù hợp" text="Hãy đổi khoảng thời gian hoặc bộ lọc để xem dữ liệu khác." />
        ) : !error && (
          <div className="report-table" data-testid="report-applications-table">
            <div className="report-table-head"><span>Sinh viên</span><span>Khoa · Ngành</span><span>Doanh nghiệp · Tin</span><span>Loại</span><span>Ngày nộp</span><span>Trạng thái</span></div>
            {result.data.map((item) => {
              const status = statusCopy[item.status] || [item.status, "neutral"];
              return <div className="report-row" key={item.applicationId}><span><strong>{item.student.fullName}</strong><small>{item.student.studentCode} · {item.student.cohort}</small></span><span><strong>{item.student.faculty}</strong><small>{item.student.major}</small></span><span><strong>{item.company.name}</strong><small>{item.job.title}</small></span><span><strong>{opportunityCopy[item.job.opportunityType] || item.job.opportunityType}</strong><small>{workModeCopy[item.job.workMode] || item.job.workMode}</small></span><time dateTime={item.submittedAt}>{dateTime(item.submittedAt)}</time><Status tone={status[1]}>{status[0]}</Status></div>;
            })}
          </div>
        )}
        {!loading && !error && result.meta.totalPages > 1 && <nav className="report-pagination" aria-label="Phân trang báo cáo"><button className="secondary-button small" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft />Trang trước</button><span>Trang <strong>{page}</strong> / {result.meta.totalPages}</span><button className="secondary-button small" disabled={page === result.meta.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau<ArrowRight /></button></nav>}
      </Panel>
    </>
  );
}
