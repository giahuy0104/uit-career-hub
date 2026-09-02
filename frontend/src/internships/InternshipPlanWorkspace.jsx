import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarBlank,
  Check,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  ClockCounterClockwise,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  SealCheck,
  User,
  Warning,
  X,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { EmptyHint, MetricCard, Panel, Status, userInitials } from "../shared/WorkspaceShell.jsx";
import { WeeklyLogPanel } from "./WeeklyLogPanel.jsx";
import "./internship-plan.css";

const statusCopy = {
  NOT_CREATED: ["Chưa tạo kế hoạch", "neutral"],
  DRAFT: ["Bản nháp", "neutral"],
  PENDING_COMPANY_REVIEW: ["Chờ doanh nghiệp duyệt", "warning"],
  COMPANY_REVISION_REQUIRED: ["Doanh nghiệp yêu cầu sửa", "urgent"],
  PENDING_UIT_REVIEW: ["Chờ UIT duyệt", "warning"],
  UIT_REVISION_REQUIRED: ["UIT yêu cầu sửa", "urgent"],
  APPROVED: ["Đã phê duyệt", "success"],
  CANCELLED: ["Đã hủy", "neutral"],
};

const actionCopy = {
  SUBMIT: "Sinh viên đã nộp kế hoạch",
  COMPANY_CONFIRM: "Doanh nghiệp đã xác nhận",
  COMPANY_REQUEST_REVISION: "Doanh nghiệp yêu cầu chỉnh sửa",
  UIT_APPROVE: "UIT đã phê duyệt",
  UIT_REQUEST_REVISION: "UIT yêu cầu chỉnh sửa",
  CANCEL: "Kế hoạch đã hủy",
};

const roleEndpoints = {
  student: "/student/internships",
  company: "/company/internships",
  admin: "/uit/internship-supervision",
};

const emptyForm = {
  title: "",
  department: "",
  companySupervisorName: "",
  companySupervisorEmail: "",
  objectives: "",
  expectedTasks: "",
  expectedSkills: "",
  startDate: "",
  endDate: "",
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = withTime ? new Date(value) : new Date(`${value.slice(0, 10)}T00:00:00`);
  return (withTime ? dateTimeFormatter : dateFormatter).format(date);
}

function getError(error) {
  return error?.message || "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
}

function statusOf(item) {
  return item?.plan?.status || "NOT_CREATED";
}

function planToForm(item) {
  const plan = item?.plan;
  return {
    title: plan?.title || "",
    department: plan?.department || "",
    companySupervisorName: plan?.companySupervisorName || "",
    companySupervisorEmail: plan?.companySupervisorEmail || "",
    objectives: plan?.objectives || "",
    expectedTasks: plan?.expectedTasks || "",
    expectedSkills: plan?.expectedSkills || "",
    startDate: plan?.startDate || item?.placement?.expectedStartDate || "",
    endDate: plan?.endDate || "",
  };
}

function ReviewModal({ mode, role, busy, error, onClose, onSubmit }) {
  const revision = mode === "revision";
  const [reasonCode, setReasonCode] = useState("PLAN_CONTENT_INCOMPLETE");
  const [note, setNote] = useState("");
  const approveText = role === "admin" ? "Phê duyệt kế hoạch" : "Xác nhận kế hoạch";
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal portal-modal internship-review-modal" role="dialog" aria-modal="true" aria-labelledby="internship-review-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose}><X /></button>
        <span className={`modal-icon ${revision ? "" : "success"}`}>{revision ? <PencilSimple /> : <SealCheck />}</span>
        <h2 id="internship-review-title">{revision ? "Yêu cầu chỉnh sửa kế hoạch" : approveText}</h2>
        <p>{revision ? "Góp ý sẽ được gửi cho sinh viên và lưu trong lịch sử xử lý." : "Hành động này sẽ chuyển kế hoạch sang bước tiếp theo và không chỉnh sửa trực tiếp nội dung."}</p>
        {revision && <div className="modal-form">
          <label><span>Nhóm lý do *</span><select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="PLAN_CONTENT_INCOMPLETE">Nội dung chưa đầy đủ</option><option value="TIMELINE_NEEDS_ADJUSTMENT">Thời gian cần điều chỉnh</option><option value="SUPERVISOR_INFORMATION_INVALID">Thông tin người hướng dẫn chưa đúng</option><option value="LEARNING_OUTCOMES_NEED_DETAIL">Mục tiêu học tập cần cụ thể hơn</option><option value="OTHER">Lý do khác</option></select></label>
          <label><span>Góp ý chi tiết *</span><textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Nêu rõ nội dung sinh viên cần chỉnh sửa..." /></label>
        </div>}
        {error && <p className="form-error" role="alert"><Warning />{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Hủy</button><button type="button" className="primary-button" disabled={busy || (revision && note.trim().length < 5)} onClick={() => onSubmit(revision ? { reasonCode, note: note.trim() } : {})}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : revision ? <><PaperPlaneTilt />Gửi yêu cầu</> : <><Check />{approveText}</>}</button></div>
      </div>
    </div>
  );
}

function PlanFields({ item, form, setForm, editable }) {
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  if (editable) return <div className="internship-plan-form">
    <label className="full"><span>Tên kế hoạch / vị trí thực tập</span><input value={form.title} onChange={set("title")} maxLength={200} placeholder={item.placement.job.title} /></label>
    <label><span>Bộ phận thực tập</span><input value={form.department} onChange={set("department")} maxLength={200} placeholder="Ví dụ: Phòng Phát triển phần mềm" /></label>
    <label><span>Người hướng dẫn tại doanh nghiệp</span><input value={form.companySupervisorName} onChange={set("companySupervisorName")} maxLength={200} placeholder="Họ và tên" /></label>
    <label className="full"><span>Email người hướng dẫn</span><input type="email" value={form.companySupervisorEmail} onChange={set("companySupervisorEmail")} maxLength={320} placeholder="supervisor@company.com" /></label>
    <label><span>Ngày bắt đầu</span><input type="date" value={form.startDate} onChange={set("startDate")} /></label>
    <label><span>Ngày kết thúc</span><input type="date" value={form.endDate} min={form.startDate || undefined} onChange={set("endDate")} /></label>
    <label className="full"><span>Mục tiêu thực tập</span><textarea value={form.objectives} onChange={set("objectives")} maxLength={4000} placeholder="Kiến thức, năng lực và kết quả mong muốn đạt được..." /></label>
    <label className="full"><span>Công việc dự kiến</span><textarea value={form.expectedTasks} onChange={set("expectedTasks")} maxLength={6000} placeholder="Các đầu việc chính, sản phẩm bàn giao và phạm vi tham gia..." /></label>
    <label className="full"><span>Kỹ năng dự kiến phát triển</span><textarea value={form.expectedSkills} onChange={set("expectedSkills")} maxLength={4000} placeholder="Kỹ năng chuyên môn và kỹ năng làm việc..." /></label>
  </div>;

  const plan = item.plan;
  if (!plan) return <EmptyHint icon={ClipboardText} title="Sinh viên chưa tạo kế hoạch" text="Nội dung sẽ xuất hiện tại đây sau khi sinh viên lưu bản nháp đầu tiên." />;
  return <div className="internship-plan-readonly">
    <div className="wide"><small>Tên kế hoạch</small><strong>{plan.title || "—"}</strong></div>
    <div><small>Bộ phận</small><strong>{plan.department || "—"}</strong></div>
    <div><small>Người hướng dẫn</small><strong>{plan.companySupervisorName || "—"}</strong><span>{plan.companySupervisorEmail || ""}</span></div>
    <div><small>Thời gian</small><strong>{formatDate(plan.startDate)} – {formatDate(plan.endDate)}</strong></div>
    <div className="wide"><small>Mục tiêu</small><p>{plan.objectives || "—"}</p></div>
    <div className="wide"><small>Công việc dự kiến</small><p>{plan.expectedTasks || "—"}</p></div>
    <div className="wide"><small>Kỹ năng dự kiến</small><p>{plan.expectedSkills || "—"}</p></div>
  </div>;
}

function PlanHistory({ history = [] }) {
  return <Panel title="Lịch sử phê duyệt" action={<Status tone="neutral">{history.length} cập nhật</Status>} className="internship-history-panel">
    {history.length === 0 ? <EmptyHint icon={ClockCounterClockwise} title="Chưa có lịch sử duyệt" text="Lịch sử bắt đầu khi sinh viên nộp kế hoạch lần đầu." /> : <ol className="internship-history">{[...history].reverse().map((entry) => <li key={entry.id}><span><CheckCircle weight="fill" /></span><div><strong>{actionCopy[entry.action] || entry.action}</strong><p>{entry.actorName} · {formatDate(entry.createdAt, true)}</p>{entry.note && <blockquote>{entry.note}</blockquote>}</div></li>)}</ol>}
  </Panel>;
}

export function InternshipPlanWorkspace({ role, targetPlacementId }) {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(targetPlacementId || "");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewMode, setReviewMode] = useState("");
  const [form, setForm] = useState(emptyForm);

  const endpoint = roleEndpoints[role];
  const selected = items.find((item) => item.placement.id === selectedId) || items[0] || null;
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    if (!normalized) return items;
    return items.filter((item) => [item.placement.student.fullName, item.placement.student.studentCode, item.placement.job.title, item.placement.job.company.name]
      .some((value) => value?.toLocaleLowerCase("vi-VN").includes(normalized)));
  }, [items, query]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest(endpoint);
      setItems(response.data);
      setSelectedId((current) => response.data.some((item) => item.placement.id === current) ? current : response.data[0]?.placement.id || "");
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [endpoint]);
  useEffect(() => { if (targetPlacementId) setSelectedId(targetPlacementId); }, [targetPlacementId]);
  useEffect(() => { setForm(selected ? planToForm(selected) : emptyForm); setError(""); }, [selected?.placement.id, selected?.plan?.version]);

  const replaceItem = (next) => {
    setItems((current) => current.map((item) => item.placement.id === next.placement.id ? next : item));
    setSelectedId(next.placement.id);
  };

  const save = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedRequest(`/student/internships/${selected.placement.id}/plan`, {
        method: "PUT",
        body: JSON.stringify({ ...form, expectedVersion: selected.plan?.version || null }),
      });
      replaceItem(response.data);
      setMessage("Đã lưu bản nháp kế hoạch thực tập.");
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!selected?.plan || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedRequest(`/student/internships/${selected.placement.id}/plan/submit`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ expectedVersion: selected.plan.version }),
      });
      replaceItem(response.data);
      setMessage("Đã nộp kế hoạch đến bên phụ trách duyệt.");
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const review = async (payload) => {
    if (!selected?.plan || busy) return;
    const revision = reviewMode === "revision";
    const action = revision ? "request-revision" : role === "admin" ? "approve" : "confirm";
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authorizedRequest(`${endpoint}/${selected.placement.id}/plan/${action}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ expectedVersion: selected.plan.version, ...payload }),
      });
      replaceItem(response.data);
      setReviewMode("");
      setMessage(revision ? "Đã gửi yêu cầu chỉnh sửa cho sinh viên." : role === "admin" ? "Đã phê duyệt kế hoạch thực tập." : "Đã xác nhận và chuyển kế hoạch đến UIT.");
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const waitingCount = items.filter((item) => role === "company" ? statusOf(item) === "PENDING_COMPANY_REVIEW" : role === "admin" ? statusOf(item) === "PENDING_UIT_REVIEW" : ["NOT_CREATED", "DRAFT", "COMPANY_REVISION_REQUIRED", "UIT_REVISION_REQUIRED"].includes(statusOf(item))).length;
  const approvedCount = items.filter((item) => statusOf(item) === "APPROVED").length;
  const draftCount = items.filter((item) => ["NOT_CREATED", "DRAFT"].includes(statusOf(item))).length;

  if (loading) return <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải kế hoạch thực tập...</div>;
  if (error && !items.length) return <Panel title="Kế hoạch thực tập"><div className="portal-error" role="alert"><Warning />{error}<button type="button" className="secondary-button small" onClick={() => void load()}>Thử lại</button></div></Panel>;

  if (role === "student" && selected) {
    const selectedPlanStatus = statusCopy[statusOf(selected)];
    return <>
      {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
      {error && <p className="review-error internship-page-error" role="alert"><Warning />{error}</p>}
      <div className="student-internship-experience">
        <section className="student-internship-profile" aria-label="Thông tin kỳ thực tập">
          <span className="student-internship-avatar">{userInitials(selected.placement.student.fullName)}</span>
          <div className="student-internship-profile-copy">
            <h1>{selected.placement.student.fullName}</h1>
            <p>{selected.placement.job.title}</p>
            <small>{selected.placement.job.company.name}</small>
          </div>
          <div className="student-internship-profile-state">
            <Status tone="success"><span className="student-active-dot" />Đang thực tập</Status>
            <small>{selectedPlanStatus[0]}</small>
          </div>
        </section>

        {items.length > 1 && <label className="student-placement-switcher">
          <span>Kỳ thực tập</span>
          <select value={selected.placement.id} onChange={(event) => setSelectedId(event.target.value)}>
            {filteredItems.map((item) => <option key={item.placement.id} value={item.placement.id}>{item.placement.job.title} · {item.placement.job.company.name}</option>)}
          </select>
        </label>}

        <WeeklyLogPanel key={selected.placement.id} role={role} placementId={selected.placement.id} />

        <section className="student-plan-support" aria-labelledby="student-plan-heading">
          <div className="student-plan-support-heading"><span>01</span><div><p>Kế hoạch thực tập</p><h2 id="student-plan-heading">Thông tin nền tảng cho hành trình của bạn</h2><small>Kế hoạch vẫn được giữ đầy đủ bên dưới nhật ký để bạn có thể cập nhật khi cần.</small></div></div>
          <Panel title="Nội dung kế hoạch" action={<Status tone={selectedPlanStatus[1]}>{selectedPlanStatus[0]}</Status>} className="internship-detail-panel">
            <div className="internship-heading"><span className="large-avatar small">{userInitials(selected.placement.student.fullName)}</span><div><h2>{selected.placement.student.fullName}</h2><p>{selected.placement.student.studentCode} · {selected.placement.job.title}</p><small>{selected.placement.job.company.name}</small></div>{selected.plan && <span className="version-label">Phiên bản {selected.plan.version} · Lần nộp {selected.plan.currentSubmissionNo}</span>}</div>
            {selected.plan?.latestNote && ["COMPANY_REVISION_REQUIRED", "UIT_REVISION_REQUIRED"].includes(selected.plan.status) && <div className="internship-revision-note"><Warning /><div><strong>Nội dung cần chỉnh sửa</strong><p>{selected.plan.latestNote}</p></div></div>}
            <PlanFields item={selected} form={form} setForm={setForm} editable={selected.availableActions.includes("SAVE")} />
            {error && <p className="form-error" role="alert"><Warning />{error}</p>}
            <div className="review-actions internship-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}><ClockCounterClockwise />Làm mới</button>{selected.availableActions.includes("SAVE") && <button type="button" className="secondary-button" disabled={busy} onClick={() => void save()}>{busy ? <CircleNotch className="spin" /> : <PencilSimple />}Lưu bản nháp</button>}{selected.availableActions.includes("SUBMIT") && <button type="button" className="primary-button" disabled={busy || !selected.plan} onClick={() => void submit()}><PaperPlaneTilt />Nộp kế hoạch</button>}</div>
          </Panel>
          <PlanHistory history={selected.plan?.history} />
        </section>
      </div>
      {reviewMode && <ReviewModal mode={reviewMode} role={role} busy={busy} error={error} onClose={() => { if (!busy) { setReviewMode(""); setError(""); } }} onSubmit={(payload) => void review(payload)} />}
    </>;
  }

  return <>
    {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
    <div className="metric-grid three internship-metrics"><MetricCard label="Tổng kỳ thực tập" value={items.length} helper="Placement thuộc phạm vi tài khoản" Icon={ClipboardText} /><MetricCard label={role === "student" ? "Cần bạn hoàn thiện" : "Đang chờ bạn duyệt"} value={waitingCount} helper="Ưu tiên xử lý trong hàng chờ" Icon={CalendarBlank} tone="amber" /><MetricCard label="Đã phê duyệt" value={approvedCount} helper={draftCount ? `${draftCount} kế hoạch chưa nộp` : "Không còn bản nháp tồn"} Icon={SealCheck} tone="green" /></div>
    {error && <p className="review-error internship-page-error" role="alert"><Warning />{error}</p>}
    {!items.length ? <Panel title="Kế hoạch thực tập"><EmptyHint icon={ClipboardText} title="Chưa có kỳ thực tập" text="Kế hoạch được mở sau khi UIT xác nhận sinh viên đã nhận việc." /></Panel> : <div className="internship-workspace">
      <Panel title={role === "student" ? "Kỳ thực tập của tôi" : "Danh sách theo dõi"} action={<Status tone="info">{filteredItems.length} hồ sơ</Status>} className="internship-list-panel">
        <label className="internship-search"><MagnifyingGlass /><input aria-label="Tìm kỳ thực tập" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sinh viên, vị trí, doanh nghiệp..." /></label>
        <div className="internship-list">{filteredItems.map((item) => { const status = statusCopy[statusOf(item)]; return <button type="button" key={item.placement.id} className={selected?.placement.id === item.placement.id ? "selected" : ""} onClick={() => setSelectedId(item.placement.id)}><span className="candidate-initials">{userInitials(role === "student" ? item.placement.job.company.name : item.placement.student.fullName)}</span><span><strong>{role === "student" ? item.placement.job.title : item.placement.student.fullName}</strong><small>{role === "student" ? item.placement.job.company.name : `${item.placement.student.studentCode} · ${item.placement.job.title}`}</small></span><Status tone={status[1]}>{status[0]}</Status><ArrowRight /></button>; })}</div>
      </Panel>
      {selected && <div className="internship-detail-column"><Panel title="Nội dung kế hoạch" action={<Status tone={statusCopy[statusOf(selected)][1]}>{statusCopy[statusOf(selected)][0]}</Status>} className="internship-detail-panel">
        <div className="internship-heading"><span className="large-avatar small">{userInitials(selected.placement.student.fullName)}</span><div><h2>{selected.placement.student.fullName}</h2><p>{selected.placement.student.studentCode} · {selected.placement.job.title}</p><small>{selected.placement.job.company.name}</small></div>{selected.plan && <span className="version-label">Phiên bản {selected.plan.version} · Lần nộp {selected.plan.currentSubmissionNo}</span>}</div>
        {selected.plan?.latestNote && ["COMPANY_REVISION_REQUIRED", "UIT_REVISION_REQUIRED"].includes(selected.plan.status) && <div className="internship-revision-note"><Warning /><div><strong>Nội dung cần chỉnh sửa</strong><p>{selected.plan.latestNote}</p></div></div>}
        <PlanFields item={selected} form={form} setForm={setForm} editable={role === "student" && selected.availableActions.includes("SAVE")} />
        {error && <p className="form-error" role="alert"><Warning />{error}</p>}
        <div className="review-actions internship-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}><ClockCounterClockwise />Làm mới</button>{role === "student" && selected.availableActions.includes("SAVE") && <button type="button" className="secondary-button" disabled={busy} onClick={() => void save()}>{busy ? <CircleNotch className="spin" /> : <PencilSimple />}Lưu bản nháp</button>}{role === "student" && selected.availableActions.includes("SUBMIT") && <button type="button" className="primary-button" disabled={busy || !selected.plan} onClick={() => void submit()}><PaperPlaneTilt />Nộp kế hoạch</button>}{selected.availableActions.includes("REQUEST_REVISION") && <button type="button" className="secondary-button danger-text" disabled={busy} onClick={() => { setError(""); setReviewMode("revision"); }}><PencilSimple />Yêu cầu sửa</button>}{(selected.availableActions.includes("CONFIRM") || selected.availableActions.includes("APPROVE")) && <button type="button" className="primary-button" disabled={busy} onClick={() => { setError(""); setReviewMode("approve"); }}><SealCheck />{role === "admin" ? "Phê duyệt" : "Xác nhận"}</button>}</div>
      </Panel><WeeklyLogPanel key={selected.placement.id} role={role} placementId={selected.placement.id} /><PlanHistory history={selected.plan?.history} /></div>}
    </div>}
    {reviewMode && <ReviewModal mode={reviewMode} role={role} busy={busy} error={error} onClose={() => { if (!busy) { setReviewMode(""); setError(""); } }} onSubmit={(payload) => void review(payload)} />}
  </>;
}
