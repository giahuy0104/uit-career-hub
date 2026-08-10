import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle,
  CircleNotch,
  Clock,
  GraduationCap,
  MagnifyingGlass,
  PlayCircle,
  Warning,
  X,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { EmptyHint, MetricCard, Panel, Status, userInitials } from "../shared/WorkspaceShell.jsx";

const statusCopy = {
  HIRED: ["Đã xác nhận", "warning"],
  STARTED: ["Đang thực tập", "success"],
  COMPLETED: ["Đã hoàn thành", "neutral"],
};

function apiError(error) {
  return error?.payload?.error?.message || error?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
}

function EvaluationSummary({ title, evaluation }) {
  if (!evaluation) {
    return <article className="admin-evaluation-card empty"><strong>{title}</strong><span>Chưa gửi phiếu</span></article>;
  }
  return (
    <article className="admin-evaluation-card" data-testid={`admin-evaluation-${evaluation.respondentRole.toLowerCase()}`}>
      <header><strong>{title}</strong><span>{evaluation.overallRating}/5</span></header>
      <small>{evaluation.submittedBy.name} · {formatDate(evaluation.submittedAt)}</small>
      <p>{evaluation.strengths}</p>
      {evaluation.improvements && <p><b>Cần cải thiện:</b> {evaluation.improvements}</p>}
      <i>{evaluation.recommendation ? "Có khuyến nghị" : "Không khuyến nghị"}</i>
    </article>
  );
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function PlacementTransitionModal({ placement, action, busy, error, onClose, onSubmit }) {
  const [effectiveDate, setEffectiveDate] = useState(todayInVietnam());
  const [note, setNote] = useState("");
  const isStart = action === "start";
  const title = isStart ? "Ghi nhận bắt đầu thực tập" : "Xác nhận hoàn thành thực tập";
  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <div
        className="modal portal-modal placement-transition-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="placement-transition-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Đóng" disabled={busy} onClick={onClose}><X /></button>
        <span className="modal-icon">{isStart ? <PlayCircle /> : <GraduationCap />}</span>
        <h2 id="placement-transition-title">{title}</h2>
        <p>
          {placement.student.fullName} · <strong>{placement.job.title}</strong> tại {placement.job.company.name}.
        </p>
        <div className="modal-form">
          <label>
            <span>{isStart ? "Ngày bắt đầu thực tế" : "Ngày hoàn thành"} *</span>
            <input
              autoFocus
              type="date"
              max={todayInVietnam()}
              min={isStart ? undefined : placement.actualStartDate || undefined}
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </label>
          <label>
            <span>Ghi chú đối chiếu</span>
            <textarea
              value={note}
              maxLength={1000}
              placeholder={isStart
                ? "Ví dụ: Đã xác nhận ngày bắt đầu với sinh viên và doanh nghiệp..."
                : "Ví dụ: Đã đối chiếu xác nhận hoàn thành từ doanh nghiệp..."}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
        {error && <p className="form-error" role="alert"><Warning />{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" disabled={busy} onClick={onClose}>Hủy</button>
          <button
            className="primary-button"
            disabled={busy || !effectiveDate || (note.trim().length > 0 && note.trim().length < 5)}
            onClick={() => onSubmit({
              expectedVersion: placement.version,
              effectiveDate,
              ...(note.trim() ? { note: note.trim() } : {}),
            })}
          >
            {busy ? <CircleNotch className="spin" /> : <CheckCircle />}
            {isStart ? "Xác nhận bắt đầu" : "Xác nhận hoàn thành"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPlacementLifecycle() {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, HIRED: 0, STARTED: 0, COMPLETED: 0 });
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [message, setMessage] = useState("");
  const [transition, setTransition] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    const parameters = new URLSearchParams({ page: "1", pageSize: "100" });
    if (status) parameters.set("status", status);
    if (query) parameters.set("query", query);
    try {
      const response = await authorizedRequest(`/uit/placements?${parameters}`);
      setItems(response.data);
      setSummary(response.summary);
      setSelectedId((current) => response.data.some((item) => item.id === current)
        ? current
        : response.data[0]?.id || "");
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [authorizedRequest, query, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load({ quiet: true });
    window.addEventListener("uit:placement-updated", refresh);
    return () => window.removeEventListener("uit:placement-updated", refresh);
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0] || null,
    [items, selectedId],
  );

  const applyFilters = (event) => {
    event.preventDefault();
    setQuery(queryDraft.trim());
  };

  const submitTransition = async (payload) => {
    if (!selected || !transition) return;
    setBusy(true);
    setMutationError("");
    try {
      const response = await authorizedRequest(`/uit/placements/${selected.id}/${transition}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      setItems((current) => current.map((item) => item.id === response.data.id ? response.data : item));
      setTransition(null);
      setMessage(transition === "start"
        ? `Đã ghi nhận ${selected.student.fullName} bắt đầu thực tập.`
        : `Đã xác nhận ${selected.student.fullName} hoàn thành thực tập.`);
      window.setTimeout(() => setMessage(""), 4500);
      await load({ quiet: true });
    } catch (requestError) {
      setMutationError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="placement-lifecycle" aria-labelledby="placement-lifecycle-title">
      {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
      <div className="placement-section-heading">
        <div>
          <span>SAU TUYỂN DỤNG</span>
          <h2 id="placement-lifecycle-title">Vòng đời thực tập</h2>
          <p>Theo dõi actor và mốc thời gian từ đã nhận việc đến hoàn thành kỳ thực tập.</p>
        </div>
        <button className="secondary-button" onClick={() => void load()} disabled={loading || busy}>
          {loading ? <CircleNotch className="spin" /> : <ArrowRight />}Làm mới
        </button>
      </div>

      <div className="metric-grid four placement-lifecycle-metrics">
        <MetricCard label="Tổng kỳ thực tập" value={summary.total} helper="Được UIT xác nhận" Icon={GraduationCap} />
        <MetricCard label="Chờ bắt đầu" value={summary.HIRED} helper="Đã xác nhận nhận việc" Icon={Clock} tone="amber" />
        <MetricCard label="Đang thực tập" value={summary.STARTED} helper="Đã ghi nhận bắt đầu" Icon={PlayCircle} tone="green" />
        <MetricCard label="Đã hoàn thành" value={summary.COMPLETED} helper="Có lịch sử xác nhận" Icon={CalendarCheck} tone="purple" />
      </div>

      <Panel title="Danh sách kỳ thực tập" action={<Status tone="neutral">{items.length} kết quả</Status>}>
        <form className="placement-lifecycle-filters" onSubmit={applyFilters}>
          <label>
            <span className="sr-only">Tìm kỳ thực tập</span>
            <MagnifyingGlass />
            <input
              aria-label="Tìm kỳ thực tập"
              value={queryDraft}
              placeholder="MSSV, sinh viên, vị trí hoặc doanh nghiệp"
              onChange={(event) => setQueryDraft(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Trạng thái kỳ thực tập</span>
            <select aria-label="Trạng thái kỳ thực tập" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="HIRED">Đã xác nhận</option>
              <option value="STARTED">Đang thực tập</option>
              <option value="COMPLETED">Đã hoàn thành</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Áp dụng</button>
        </form>

        {loading ? (
          <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải vòng đời thực tập...</div>
        ) : error ? (
          <div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={() => void load()}>Thử lại</button></div>
        ) : !selected ? (
          <EmptyHint title="Chưa có kỳ thực tập phù hợp" text="Kỳ thực tập được tạo tự động khi UIT xác nhận nơi nhận việc." />
        ) : (
          <div className="placement-lifecycle-workspace">
            <div className="placement-lifecycle-list" aria-label="Danh sách kỳ thực tập">
              {items.map((item) => {
                const copy = statusCopy[item.status] || [item.status, "neutral"];
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === selected.id ? "selected" : ""}
                    onClick={() => { setSelectedId(item.id); setMutationError(""); }}
                  >
                    <span className="candidate-initials">{userInitials(item.student.fullName)}</span>
                    <span>
                      <strong>{item.student.fullName}</strong>
                      <small>{item.student.studentCode} · {item.job.title}</small>
                      <small>{item.job.company.name}</small>
                    </span>
                    <Status tone={copy[1]}>{copy[0]}</Status>
                  </button>
                );
              })}
            </div>

            <article className="placement-lifecycle-detail" data-testid="placement-lifecycle-detail">
              <header>
                <div>
                  <span>{selected.student.studentCode} · {selected.student.faculty}</span>
                  <h3>{selected.student.fullName}</h3>
                  <p>{selected.job.title} · {selected.job.company.name}</p>
                </div>
                <Status tone={statusCopy[selected.status]?.[1]}>{statusCopy[selected.status]?.[0]}</Status>
              </header>
              <div className="placement-date-grid">
                <span><small>Dự kiến bắt đầu</small><strong>{formatDate(selected.expectedStartDate)}</strong></span>
                <span><small>Bắt đầu thực tế</small><strong>{formatDate(selected.actualStartDate)}</strong></span>
                <span><small>Hoàn thành</small><strong>{formatDate(selected.completedDate)}</strong></span>
                <span><small>Phiên bản</small><strong>{selected.version}</strong></span>
              </div>
              <div className="placement-state-track" aria-label="Tiến độ kỳ thực tập">
                {["HIRED", "STARTED", "COMPLETED"].map((step, index) => {
                  const currentIndex = ["HIRED", "STARTED", "COMPLETED"].indexOf(selected.status);
                  const copy = statusCopy[step][0];
                  return <span key={step} className={index <= currentIndex ? "done" : ""}><i>{index < currentIndex ? "✓" : index + 1}</i>{copy}</span>;
                })}
              </div>
              <section className="placement-history">
                <h4>Lịch sử actor</h4>
                {selected.history.map((event) => (
                  <article key={`${event.toStatus}-${event.createdAt}`}>
                    <span><CheckCircle /></span>
                    <div>
                      <strong>{statusCopy[event.toStatus]?.[0] || event.toStatus}</strong>
                      <small>{formatDate(event.effectiveDate)} · {event.actorName}</small>
                      {event.note && <p>{event.note}</p>}
                    </div>
                  </article>
                ))}
              </section>
              <section className="admin-placement-evaluations">
                <h4>Phiếu đánh giá kỳ thực tập</h4>
                <div>
                  <EvaluationSummary title="Đánh giá doanh nghiệp" evaluation={selected.evaluations?.company} />
                  <EvaluationSummary title="Phản hồi sinh viên" evaluation={selected.evaluations?.student} />
                </div>
              </section>
              <div className="review-actions">
                {selected.availableActions.includes("START") && (
                  <button className="primary-button" disabled={busy} onClick={() => setTransition("start")}>
                    <PlayCircle />Ghi nhận bắt đầu
                  </button>
                )}
                {selected.availableActions.includes("COMPLETE") && (
                  <button className="primary-button" disabled={busy} onClick={() => setTransition("complete")}>
                    <GraduationCap />Ghi nhận hoàn thành
                  </button>
                )}
                {!selected.availableActions.length && <span className="placement-finished"><CheckCircle />Kỳ thực tập đã hoàn tất</span>}
              </div>
            </article>
          </div>
        )}
      </Panel>
      {transition && selected && (
        <PlacementTransitionModal
          placement={selected}
          action={transition}
          busy={busy}
          error={mutationError}
          onClose={() => { if (!busy) { setTransition(null); setMutationError(""); } }}
          onSubmit={(payload) => void submitTransition(payload)}
        />
      )}
    </section>
  );
}
