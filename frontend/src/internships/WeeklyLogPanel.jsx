import { useEffect, useMemo, useState } from "react";
import {
  BookmarkSimple,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  ClockCounterClockwise,
  FileText,
  Lightbulb,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  Question,
  SealCheck,
  Trophy,
  Warning,
  X,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { EmptyHint, Panel, Status } from "../shared/WorkspaceShell.jsx";
import "./weekly-log.css";

const statusCopy = {
  DRAFT: ["Bản nháp", "neutral"],
  SUBMITTED: ["Chờ doanh nghiệp", "warning"],
  COMPANY_REVISION_REQUIRED: ["Cần chỉnh sửa", "urgent"],
  COMPANY_CONFIRMED: ["Đã xác nhận", "success"],
  CANCELLED: ["Đã hủy", "neutral"],
};

const actionCopy = {
  SUBMIT: "Sinh viên đã nộp nhật ký",
  COMPANY_CONFIRM: "Doanh nghiệp đã xác nhận",
  COMPANY_REQUEST_REVISION: "Doanh nghiệp yêu cầu chỉnh sửa",
  CANCEL: "Nhật ký đã hủy",
};

const roleBase = {
  student: "/student/internships",
  company: "/company/internships",
  admin: "/uit/internship-supervision",
};

const emptyForm = { workSummary: "", outcomes: "", difficulties: "", nextPlan: "" };
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

const journeyFieldSpecs = [
  { field: "workSummary", number: "01", label: "Công việc đã thực hiện", helper: "Mô tả các công việc, sản phẩm bạn đã thực hiện trong tuần.", placeholder: "Nhập nội dung...", maxLength: 6000, required: true, Icon: FileText },
  { field: "outcomes", number: "02", label: "Kết quả đạt được", helper: "Nêu kết quả, sản phẩm hoặc hiệu quả đạt được.", placeholder: "Nhập nội dung...", maxLength: 4000, required: true, Icon: Trophy },
  { field: "difficulties", number: "03", label: "Khó khăn và hướng xử lý", helper: "Những khó khăn gặp phải và cách bạn đã xử lý.", placeholder: "Nhập nội dung...", maxLength: 4000, required: false, Icon: Warning },
  { field: "nextPlan", number: "04", label: "Kế hoạch tuần tiếp theo", helper: "Kế hoạch công việc bạn sẽ thực hiện ở tuần tiếp theo.", placeholder: "Nhập nội dung...", maxLength: 4000, required: true, Icon: PaperPlaneTilt },
];

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = withTime ? new Date(value) : new Date(`${value.slice(0, 10)}T00:00:00`);
  return (withTime ? dateTimeFormatter : dateFormatter).format(date);
}

function formatShortDate(value) {
  if (!value) return "—";
  return shortDateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function dueCopy(value) {
  if (!value) return "";
  const due = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Hạn nộp hôm nay";
  return `${days} ngày nữa`;
}

function getError(error) {
  return error?.message || "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
}

function toForm(log) {
  return {
    workSummary: log?.workSummary || "",
    outcomes: log?.outcomes || "",
    difficulties: log?.difficulties || "",
    nextPlan: log?.nextPlan || "",
  };
}

function ReviewModal({ mode, busy, error, onClose, onSubmit }) {
  const revision = mode === "revision";
  const [reasonCode, setReasonCode] = useState("LOG_CONTENT_INCOMPLETE");
  const [note, setNote] = useState("");
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal portal-modal weekly-log-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-log-modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="modal-close" aria-label="Đóng" disabled={busy} onClick={onClose}><X /></button>
      <span className={`modal-icon ${revision ? "" : "success"}`}>{revision ? <NotePencil /> : <SealCheck />}</span>
      <h2 id="weekly-log-modal-title">{revision ? "Yêu cầu chỉnh sửa nhật ký" : "Xác nhận nhật ký tuần"}</h2>
      <p>{revision ? "Góp ý sẽ được gửi đến sinh viên và lưu trong lịch sử xử lý." : "Xác nhận rằng nội dung phản ánh đúng công việc và tiến độ trong tuần."}</p>
      <div className="modal-form">
        {revision && <label><span>Nhóm lý do *</span><select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="LOG_CONTENT_INCOMPLETE">Nội dung chưa đầy đủ</option><option value="OUTCOME_NEEDS_EVIDENCE">Kết quả cần làm rõ</option><option value="NEXT_PLAN_NEEDS_DETAIL">Kế hoạch tuần tới chưa cụ thể</option><option value="OTHER">Lý do khác</option></select></label>}
        <label><span>{revision ? "Góp ý chi tiết *" : "Ghi chú (không bắt buộc)"}</span><textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder={revision ? "Nêu rõ nội dung sinh viên cần bổ sung..." : "Ghi nhận ngắn của người hướng dẫn..."} /></label>
      </div>
      {error && <p className="form-error" role="alert"><Warning />{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Hủy</button><button type="button" className="primary-button" disabled={busy || (revision && note.trim().length < 5)} onClick={() => onSubmit({ reasonCode: revision ? reasonCode : null, note: note.trim() || null })}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : revision ? <><PaperPlaneTilt />Gửi yêu cầu</> : <><Check />Xác nhận nhật ký</>}</button></div>
    </div>
  </div>;
}

function LogFields({ form, setForm, editable, journey = false }) {
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  if (journey) return <div className={`weekly-log-form journey-log-fields ${editable ? "is-editable" : "is-readonly"}`}>
    {journeyFieldSpecs.map(({ field, number, label, helper, placeholder, maxLength, required, Icon }) => <label className="journey-log-field" key={field}>
      <span className="journey-field-number">{number}</span>
      <span className="journey-field-icon"><Icon size={22} weight="duotone" /></span>
      <span className="journey-field-copy"><strong>{label}{required ? " *" : ""}</strong><small>{helper}</small></span>
      {editable
        ? <span className="journey-field-control"><textarea aria-label={`${label}${required ? " *" : ""}`} value={form[field]} onChange={set(field)} maxLength={maxLength} placeholder={placeholder} /><small>{form[field].length}/{maxLength}</small></span>
        : <span className="journey-field-control readonly"><span>{form[field] || "—"}</span></span>}
    </label>)}
  </div>;

  if (editable) return <div className="weekly-log-form">
    <label><span>Công việc đã thực hiện *</span><textarea value={form.workSummary} onChange={set("workSummary")} maxLength={6000} placeholder="Mô tả các đầu việc chính trong tuần..." /></label>
    <label><span>Kết quả đạt được *</span><textarea value={form.outcomes} onChange={set("outcomes")} maxLength={4000} placeholder="Sản phẩm bàn giao, kiến thức hoặc kỹ năng đạt được..." /></label>
    <label><span>Khó khăn và hướng xử lý</span><textarea value={form.difficulties} onChange={set("difficulties")} maxLength={4000} placeholder="Vấn đề gặp phải và cách đã hoặc sẽ xử lý..." /></label>
    <label><span>Kế hoạch tuần tiếp theo *</span><textarea value={form.nextPlan} onChange={set("nextPlan")} maxLength={4000} placeholder="Mục tiêu và đầu việc dự kiến cho tuần tiếp theo..." /></label>
  </div>;

  return <div className="weekly-log-readonly">
    <div><small>Công việc đã thực hiện</small><p>{form.workSummary || "—"}</p></div>
    <div><small>Kết quả đạt được</small><p>{form.outcomes || "—"}</p></div>
    <div><small>Khó khăn và hướng xử lý</small><p>{form.difficulties || "—"}</p></div>
    <div><small>Kế hoạch tuần tiếp theo</small><p>{form.nextPlan || "—"}</p></div>
  </div>;
}

function LogHistory({ history = [] }) {
  if (!history.length) return <EmptyHint icon={ClockCounterClockwise} title="Chưa có lịch sử xử lý" text="Lịch sử bắt đầu khi sinh viên nộp nhật ký lần đầu." />;
  return <ol className="weekly-log-history">{[...history].reverse().map((entry) => <li key={entry.id}><span><CheckCircle weight="fill" /></span><div><strong>{actionCopy[entry.action] || entry.action}</strong><small>{entry.actorName} · {formatDate(entry.createdAt, true)}</small>{entry.note && <blockquote>{entry.note}</blockquote>}</div></li>)}</ol>;
}

export function WeeklyLogPanel({ role, placementId }) {
  const { authorizedRequest } = useAuth();
  const [data, setData] = useState(null);
  const [globalSummary, setGlobalSummary] = useState(null);
  const [overdueTotal, setOverdueTotal] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewMode, setReviewMode] = useState("");

  const endpoint = `${roleBase[role]}/${placementId}/weekly-logs`;
  const logs = data?.logs || [];
  const selected = logs.find((log) => log.id === selectedId) || logs[0] || null;
  const editable = role === "student" && selected?.availableActions?.includes("SAVE");
  const orderedLogs = useMemo(() => [...logs].sort((a, b) => b.weekNumber - a.weekNumber), [logs]);
  const chronologicalLogs = useMemo(() => [...logs].sort((a, b) => a.weekNumber - b.weekNumber), [logs]);
  const logsByWeek = useMemo(() => new Map(logs.map((log) => [log.weekNumber, log])), [logs]);

  const load = async (keepSelection = true) => {
    setLoading(true);
    setError("");
    try {
      const requests = [authorizedRequest(endpoint)];
      if (role === "admin") {
        requests.push(authorizedRequest("/uit/internship-supervision/summary"));
        requests.push(authorizedRequest("/uit/internship-supervision/overdue"));
      }
      const [viewResponse, summaryResponse, overdueResponse] = await Promise.all(requests);
      setData(viewResponse.data);
      setSelectedId((current) => keepSelection && viewResponse.data.logs.some((log) => log.id === current) ? current : viewResponse.data.logs[0]?.id || "");
      if (summaryResponse) setGlobalSummary(summaryResponse.data);
      if (overdueResponse) setOverdueTotal(overdueResponse.data.length);
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    setSelectedId("");
    setMessage("");
    void load(false);
  }, [endpoint]);
  useEffect(() => { setForm(toForm(selected)); setError(""); }, [selected?.id, selected?.version]);

  const applyView = (next, preferredId = selectedId) => {
    setData(next);
    setSelectedId(next.logs.some((log) => log.id === preferredId) ? preferredId : next.logs[0]?.id || "");
  };

  const create = async () => {
    if (busy || !data?.summary?.canCreate) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({ weekNumber: data.summary.nextWeekNumber }),
      });
      applyView(response.data, response.data.logs.find((log) => log.weekNumber === data.summary.nextWeekNumber)?.id);
      setMessage(`Đã tạo bản nháp nhật ký tuần ${data.summary.nextWeekNumber}.`);
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedRequest(`${endpoint}/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...form, expectedVersion: selected.version, weekNumber: selected.weekNumber }),
      });
      applyView(response.data, selected.id);
      setMessage(`Đã lưu nhật ký tuần ${selected.weekNumber}.`);
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedRequest(`${endpoint}/${selected.id}/submit`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ expectedVersion: selected.version }),
      });
      applyView(response.data, selected.id);
      setMessage(`Đã nộp nhật ký tuần ${selected.weekNumber} đến doanh nghiệp.`);
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const review = async (payload) => {
    if (!selected || busy) return;
    const revision = reviewMode === "revision";
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedRequest(`${endpoint}/${selected.id}/${revision ? "request-revision" : "confirm"}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ expectedVersion: selected.version, ...payload }),
      });
      applyView(response.data, selected.id);
      setReviewMode("");
      setMessage(revision ? `Đã gửi yêu cầu chỉnh sửa nhật ký tuần ${selected.weekNumber}.` : `Đã xác nhận nhật ký tuần ${selected.weekNumber}.`);
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Panel title="Nhật ký thực tập hằng tuần"><div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải nhật ký thực tập...</div></Panel>;
  if (error && !data) return <Panel title="Nhật ký thực tập hằng tuần"><div className="portal-error" role="alert"><Warning />{error}<button type="button" className="secondary-button small" onClick={() => void load(false)}>Thử lại</button></div></Panel>;

  const selectedStatus = selected ? statusCopy[selected.status] || [selected.status, "neutral"] : null;
  if (role === "student") {
    const activeWeekNumber = selected?.weekNumber || data?.summary?.nextWeekNumber || 1;
    const journeyLength = Math.max(12, activeWeekNumber, ...logs.map((log) => log.weekNumber));
    const selectedIndex = chronologicalLogs.findIndex((log) => log.id === selected?.id);
    const previousLog = selectedIndex > 0 ? chronologicalLogs[selectedIndex - 1] : null;
    const nextLog = selectedIndex >= 0 && selectedIndex < chronologicalLogs.length - 1 ? chronologicalLogs[selectedIndex + 1] : null;

    return <>
      {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
      <section className="student-weekly-panel" aria-labelledby="student-weekly-title">
        <div className="student-journey-ribbon">
          <nav className="student-journey-phases" aria-label="Các giai đoạn thực tập">
            <button type="button" className="done" onClick={() => document.getElementById("student-plan-heading")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>1</span><small>Kế hoạch<br />thực tập</small></button>
            <button type="button" className="active" aria-current="step"><span>2</span><small>Nhật ký<br />tuần</small></button>
            <button type="button" disabled aria-disabled="true"><span>3</span><small>Báo cáo<br />cuối kỳ</small></button>
          </nav>

          <div className="student-journey-main">
            <span className="student-journey-fold" aria-hidden="true" />
            <div className="student-week-identity">
              <strong>{String(activeWeekNumber).padStart(2, "0")}<small>/ {journeyLength}</small></strong>
              <div><span>Tuần {activeWeekNumber}:</span><b>{selected ? `${formatShortDate(selected.periodStart)} – ${formatShortDate(selected.periodEnd)}` : "Chưa tạo nhật ký"}</b></div>
            </div>
            <div className="student-week-deadline"><CalendarBlank size={19} /><span>Hạn nộp:<strong>{formatShortDate(selected?.dueDate)}</strong><small>{selected?.overdue ? "Đã quá hạn" : dueCopy(selected?.dueDate)}</small></span></div>
            <nav className="weekly-log-list student-week-track" aria-label="Danh sách tuần thực tập">
              {Array.from({ length: journeyLength }, (_, index) => index + 1).map((weekNumber) => {
                const log = logsByWeek.get(weekNumber);
                const current = selected?.id === log?.id;
                const completed = Boolean(log && weekNumber < activeWeekNumber && log.status !== "DRAFT");
                return <button type="button" key={weekNumber} className={`${current ? "selected current" : ""} ${completed ? "completed" : ""}`} disabled={!log} aria-label={`Tuần ${weekNumber}${current ? ", đang chọn" : ""}`} onClick={() => log && setSelectedId(log.id)}><span aria-hidden="true">{completed ? <Check size={10} weight="bold" /> : weekNumber}</span><span className="sr-only">Tuần {weekNumber}</span></button>;
              })}
            </nav>
          </div>
        </div>

        {error && <p className="review-error weekly-log-error" role="alert"><Warning />{error}</p>}

        <div className="student-journal-toolbar">
          <div><span>Nhật ký thực tập hằng tuần</span><strong id="student-weekly-title">Ghi lại tiến độ và kết quả nổi bật</strong></div>
          <div className="student-journal-toolbar-actions">
            {data?.summary.canCreate && <button type="button" className="secondary-button small" disabled={busy} onClick={() => void create()}>{busy ? <CircleNotch className="spin" /> : <Plus />}Tạo tuần {data.summary.nextWeekNumber}</button>}
            <button type="button" className="student-refresh-button" aria-label="Làm mới nhật ký" disabled={loading || busy} onClick={() => void load()}>{loading ? <CircleNotch className="spin" /> : <ClockCounterClockwise />}</button>
          </div>
        </div>

        {!logs.length
          ? <div className="student-weekly-empty"><EmptyHint icon={FileText} title="Chưa có nhật ký tuần" text={data?.summary.canCreate ? "Tạo tuần đầu tiên để bắt đầu ghi nhận tiến độ thực tập." : "Nhật ký sẽ xuất hiện khi kỳ thực tập bắt đầu."} />{data?.summary.canCreate && <button type="button" className="primary-button" disabled={busy} onClick={() => void create()}><Plus />Tạo tuần {data.summary.nextWeekNumber}</button>}</div>
          : selected && <section className="weekly-log-detail student-weekly-detail" aria-label={`Nhật ký tuần ${selected.weekNumber}`}>
            <header className="student-weekly-detail-header">
              <div className="student-week-nav-buttons"><button type="button" aria-label="Mở tuần trước" disabled={!previousLog} onClick={() => previousLog && setSelectedId(previousLog.id)}><CaretLeft /></button><button type="button" aria-label="Mở tuần sau" disabled={!nextLog} onClick={() => nextLog && setSelectedId(nextLog.id)}><CaretRight /></button></div>
              <div className="student-weekly-state"><Status tone={selected.overdue ? "urgent" : selectedStatus[1]}>{selected.overdue ? "Quá hạn" : selectedStatus[0]}</Status><small>Phiên bản {selected.version} · Lần nộp {selected.currentSubmissionNo}</small></div>
            </header>
            {selected.status === "COMPANY_REVISION_REQUIRED" && selected.latestNote && <div className="weekly-revision-note"><Warning /><div><strong>Nội dung cần chỉnh sửa</strong><p>{selected.latestNote}</p></div></div>}
            <LogFields form={form} setForm={setForm} editable={editable} journey />
            <footer className="student-journal-footer">
              <div className="student-journal-help"><Question size={25} weight="duotone" /><span><strong>Cần hỗ trợ?</strong><small>Xem hướng dẫn hoặc liên hệ cán bộ phụ trách thực tập.</small></span></div>
              <div className="student-journal-tip"><Lightbulb size={23} weight="duotone" /><span><strong>Mẹo hoàn thành nhật ký hiệu quả</strong><small>Ghi chép ngắn gọn, cụ thể và tập trung vào kết quả.</small></span></div>
              <div className="weekly-log-actions student-weekly-actions">
                {editable && <button type="button" className="secondary-button" aria-label="Lưu nhật ký" disabled={busy} onClick={() => void save()}>{busy ? <CircleNotch className="spin" /> : <BookmarkSimple />}<span aria-hidden="true">Lưu nháp</span></button>}
                {selected.availableActions.includes("SUBMIT") && <button type="button" className="primary-button" disabled={busy} onClick={() => void submit()}><PaperPlaneTilt />Nộp nhật ký</button>}
              </div>
            </footer>
            <details className="student-log-history"><summary><ClockCounterClockwise />Lịch sử xử lý <span>{selected.history?.length || 0} cập nhật</span></summary><div><LogHistory history={selected.history} /></div></details>
          </section>}
      </section>
    </>;
  }

  return <>
    {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
    <Panel title="Nhật ký thực tập hằng tuần" action={<Status tone="info">{logs.length} tuần</Status>} className="weekly-log-panel">
      <div className="weekly-log-summary">
        <div><span>Tổng nhật ký</span><strong>{data?.summary.total || 0}</strong></div>
        <div><span>Đã xác nhận</span><strong>{data?.summary.confirmed || 0}</strong></div>
        <div><span>Chờ doanh nghiệp</span><strong>{data?.summary.awaitingCompany || 0}</strong></div>
        <div className={data?.summary.overdue ? "needs-attention" : ""}><span>Quá hạn</span><strong>{data?.summary.overdue || 0}</strong></div>
      </div>
      {role === "admin" && globalSummary && <div className="weekly-global-summary"><div><small>Toàn trường</small><strong>{globalSummary.startedPlacements} kỳ đang diễn ra · {globalSummary.totalLogs} nhật ký</strong></div><span><Warning />{overdueTotal ?? globalSummary.overdue} nhật ký quá hạn cần theo dõi</span></div>}
      {error && <p className="review-error weekly-log-error" role="alert"><Warning />{error}</p>}
      <div className="weekly-log-toolbar">
        <p>{role === "student" ? "Tạo và hoàn thành nhật ký theo đúng thứ tự tuần." : role === "company" ? "Kiểm tra nội dung trước khi xác nhận hoặc gửi góp ý." : "UIT theo dõi tiến độ; nội dung nhật ký do sinh viên và doanh nghiệp xác nhận."}</p>
        {role === "student" && data?.summary.canCreate && <button type="button" className="primary-button" disabled={busy} onClick={() => void create()}>{busy ? <CircleNotch className="spin" /> : <Plus />}Tạo tuần {data.summary.nextWeekNumber}</button>}
        <button type="button" className="secondary-button small" disabled={loading || busy} onClick={() => void load()}>{loading ? <CircleNotch className="spin" /> : <ClockCounterClockwise />}Làm mới</button>
      </div>
      {!logs.length ? <EmptyHint icon={FileText} title="Chưa có nhật ký tuần" text={role === "student" && data?.summary.canCreate ? "Tạo tuần đầu tiên để bắt đầu ghi nhận tiến độ thực tập." : "Nhật ký sẽ xuất hiện khi kỳ thực tập bắt đầu và sinh viên tạo tuần đầu tiên."} /> : <div className="weekly-log-workspace">
        <nav className="weekly-log-list" aria-label="Danh sách tuần thực tập">{orderedLogs.map((log) => { const copy = statusCopy[log.status] || [log.status, "neutral"]; return <button type="button" key={log.id} className={selected?.id === log.id ? "selected" : ""} onClick={() => setSelectedId(log.id)}><span className="week-number">T{log.weekNumber}</span><span><strong>Tuần {log.weekNumber}</strong><small>{formatDate(log.periodStart)} – {formatDate(log.periodEnd)}</small></span><Status tone={copy[1]}>{log.overdue ? "Quá hạn" : copy[0]}</Status></button>; })}</nav>
        {selected && <section className="weekly-log-detail" aria-label={`Nhật ký tuần ${selected.weekNumber}`}>
          <header><div><span className="weekly-eyebrow"><CalendarBlank />Tuần {selected.weekNumber} · Hạn {formatDate(selected.dueDate)}</span><h3>{formatDate(selected.periodStart)} – {formatDate(selected.periodEnd)}</h3></div><div className="weekly-log-state"><Status tone={selected.overdue ? "urgent" : selectedStatus[1]}>{selected.overdue ? "Quá hạn" : selectedStatus[0]}</Status><small>Phiên bản {selected.version} · Lần nộp {selected.currentSubmissionNo}</small></div></header>
          {selected.status === "COMPANY_REVISION_REQUIRED" && selected.latestNote && <div className="weekly-revision-note"><Warning /><div><strong>Nội dung cần chỉnh sửa</strong><p>{selected.latestNote}</p></div></div>}
          <LogFields form={form} setForm={setForm} editable={editable} />
          <div className="weekly-log-actions">
            {editable && <button type="button" className="secondary-button" disabled={busy} onClick={() => void save()}>{busy ? <CircleNotch className="spin" /> : <NotePencil />}Lưu nhật ký</button>}
            {role === "student" && selected.availableActions.includes("SUBMIT") && <button type="button" className="primary-button" disabled={busy} onClick={() => void submit()}><PaperPlaneTilt />Nộp nhật ký</button>}
            {role === "company" && selected.availableActions.includes("REQUEST_REVISION") && <button type="button" className="secondary-button danger-text" disabled={busy} onClick={() => { setError(""); setReviewMode("revision"); }}><NotePencil />Yêu cầu sửa</button>}
            {role === "company" && selected.availableActions.includes("CONFIRM") && <button type="button" className="primary-button" disabled={busy} onClick={() => { setError(""); setReviewMode("confirm"); }}><SealCheck />Xác nhận nhật ký</button>}
          </div>
          <div className="weekly-log-history-section"><h4>Lịch sử xử lý</h4><LogHistory history={selected.history} /></div>
        </section>}
      </div>}
    </Panel>
    {reviewMode && <ReviewModal mode={reviewMode} busy={busy} error={error} onClose={() => { if (!busy) { setReviewMode(""); setError(""); } }} onSubmit={(payload) => void review(payload)} />}
  </>;
}
