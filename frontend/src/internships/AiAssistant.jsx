import { useEffect, useState } from "react";
import { CheckCircle, CircleNotch, Info, Lightning, Sparkle, Warning, X } from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { Panel, Status } from "../shared/WorkspaceShell.jsx";
import "./ai-assistant.css";

const planFieldLabel = {
  objectives: "Mục tiêu",
  expectedTasks: "Công việc dự kiến",
  expectedSkills: "Kỹ năng dự kiến",
  general: "Chung",
};

const severityCopy = {
  HIGH: ["Quan trọng", "urgent"],
  MEDIUM: ["Nên sửa", "warning"],
  LOW: ["Gợi ý thêm", "neutral"],
};

const flagCopy = {
  TOO_SHORT: ["Nội dung quá ngắn", "warning"],
  REPEATED: ["Lặp lại tuần trước", "warning"],
  NEEDS_SUPPORT: ["Cần hỗ trợ", "urgent"],
};

const featureLabel = {
  PLAN_REVIEW: "Góp ý kế hoạch (AI1)",
  WEEKLY_LOG_SUMMARY: "Tóm tắt nhật ký (AI2)",
};

const roleBase = {
  company: "/company/internships",
  admin: "/uit/internship-supervision",
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

function formatTime(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "";
}

/** Calls an AI endpoint on demand and keeps the last answer. */
function useAiRequest() {
  const { authorizedRequest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState("");

  const run = async (path, body) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest(path, { method: "POST", body: JSON.stringify(body || {}) });
      setSuggestion(response.data);
    } catch (requestError) {
      setSuggestion(null);
      setError(requestError?.message || "Không thể kết nối đến hệ thống.");
    } finally {
      setBusy(false);
    }
  };

  return { busy, suggestion, error, run, dismiss: () => { setSuggestion(null); setError(""); } };
}

/** Frame shared by every AI result: clear label, disclaimer and a way to ignore it. */
function AiResultFrame({ suggestion, error, onDismiss, children }) {
  if (error) return <div className="ai-card ai-card-muted" role="alert"><Warning />{error}</div>;
  if (!suggestion) return null;
  if (!suggestion.available) return <div className="ai-card ai-card-muted" role="status"><Info /><span><strong>Chưa có gợi ý.</strong> {suggestion.message}</span></div>;
  return <section className="ai-card" aria-label="Gợi ý từ AI">
    <header className="ai-card-header">
      <span className="ai-badge"><Sparkle weight="fill" />Gợi ý từ AI</span>
      <small>{suggestion.status === "CACHED" ? "Kết quả đã lưu" : "Vừa tạo"} · {formatTime(suggestion.generatedAt)}</small>
      <button type="button" className="ai-dismiss" aria-label="Bỏ qua gợi ý" onClick={onDismiss}><X /></button>
    </header>
    {children}
    <p className="ai-disclaimer">Nội dung do AI tạo chỉ để tham khảo, có thể chưa chính xác và không được lưu vào hồ sơ. Mọi quyết định do người dùng đưa ra.</p>
  </section>;
}

/** AI1: student asks for feedback on the plan currently in the form (no need to save first). */
export function AiPlanReview({ placementId, form }) {
  const { busy, suggestion, error, run, dismiss } = useAiRequest();
  const hasContent = [form.objectives, form.expectedTasks, form.expectedSkills].some((value) => value?.trim());
  const result = suggestion?.result;

  return <div className="ai-assist">
    <div className="ai-assist-bar">
      <span><Sparkle weight="duotone" />Nhờ AI đối chiếu kế hoạch với mô tả công việc trước khi nộp. Bạn tự quyết định có sửa hay không.</span>
      <button type="button" className="secondary-button small ai-trigger" disabled={busy || !hasContent}
        title={hasContent ? undefined : "Nhập mục tiêu, công việc hoặc kỹ năng trước"}
        onClick={() => void run(`/student/internships/${placementId}/plan/ai-review`, {
          objectives: form.objectives, expectedTasks: form.expectedTasks, expectedSkills: form.expectedSkills,
        })}>
        {busy ? <><CircleNotch className="spin" />AI đang đọc...</> : <><Lightning />Nhờ AI góp ý</>}
      </button>
    </div>
    <AiResultFrame suggestion={suggestion} error={error} onDismiss={dismiss}>
      {result && <>
        <p className="ai-overview">{result.overall}</p>
        {result.strengths?.length > 0 && <div className="ai-block"><h4>Điểm đã tốt</h4><ul className="ai-list ai-list-good">{result.strengths.map((item, index) => <li key={index}><CheckCircle weight="fill" />{item}</li>)}</ul></div>}
        {result.issues?.length > 0
          ? <div className="ai-block"><h4>Điểm nên xem lại</h4><ol className="ai-issues">{result.issues.map((issue, index) => {
            const [label, tone] = severityCopy[issue.severity] || severityCopy.MEDIUM;
            return <li key={index}>
              <div className="ai-issue-head"><Status tone={tone}>{label}</Status><small>{planFieldLabel[issue.field] || "Chung"}</small></div>
              <p>{issue.comment}</p>
              {issue.suggestion && <p className="ai-suggestion"><strong>Gợi ý:</strong> {issue.suggestion}</p>}
            </li>;
          })}</ol></div>
          : <p className="ai-empty">AI không thấy điểm nào cần sửa thêm.</p>}
      </>}
    </AiResultFrame>
  </div>;
}

/** AI2: company/UIT reviewer asks for a summary of the submitted weekly logs. */
export function AiWeeklyLogSummary({ role, placementId, onSelectWeek }) {
  const { busy, suggestion, error, run, dismiss } = useAiRequest();
  const result = suggestion?.result;

  return <div className="ai-assist">
    <div className="ai-assist-bar">
      <span><Sparkle weight="duotone" />Tóm tắt các tuần đã nộp và đánh dấu tuần cần xem kỹ. AI không duyệt thay bạn.</span>
      <button type="button" className="secondary-button small ai-trigger" disabled={busy}
        onClick={() => void run(`${roleBase[role]}/${placementId}/weekly-logs/ai-summary`)}>
        {busy ? <><CircleNotch className="spin" />AI đang đọc...</> : <><Lightning />Tóm tắt bằng AI</>}
      </button>
    </div>
    <AiResultFrame suggestion={suggestion} error={error} onDismiss={dismiss}>
      {result && <>
        <p className="ai-overview">{result.overview}</p>
        {result.keyPoints?.length > 0 && <div className="ai-block"><h4>Ý chính ({result.weekCount} tuần)</h4><ul className="ai-list">{result.keyPoints.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        <div className="ai-block"><h4>Tuần cần xem kỹ</h4>
          {result.flags?.length > 0
            ? <ul className="ai-flags">{result.flags.map((flag, index) => {
              const [label, tone] = flagCopy[flag.type] || [flag.type, "neutral"];
              return <li key={index}>
                <button type="button" className="ai-week-link" onClick={() => onSelectWeek?.(flag.weekNumber)}>Tuần {flag.weekNumber}</button>
                <Status tone={tone}>{label}</Status>
                <span>{flag.detail}</span>
              </li>;
            })}</ul>
            : <p className="ai-empty">Không có tuần nào cần chú ý đặc biệt.</p>}
        </div>
      </>}
    </AiResultFrame>
  </div>;
}

/** UIT: turn AI on/off for the whole system and see usage over the last 30 days. */
export function AiSettingsPanel() {
  const { authorizedRequest } = useAuth();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const response = await authorizedRequest("/uit/ai/settings");
      setData(response.data);
    } catch (requestError) {
      setError(requestError?.message || "Không thể tải cấu hình AI.");
    }
  };

  useEffect(() => { void load(); }, []);

  const toggle = async () => {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest("/uit/ai/settings", { method: "PUT", body: JSON.stringify({ enabled: !data.enabled }) });
      setData(response.data);
    } catch (requestError) {
      setError(requestError?.message || "Không thể cập nhật cấu hình AI.");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Panel title="Trợ lý AI">{error
    ? <div className="portal-error" role="alert"><Warning />{error}<button type="button" className="secondary-button small" onClick={() => void load()}>Thử lại</button></div>
    : <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải cấu hình AI...</div>}</Panel>;

  const totals = data.usage.reduce((sum, row) => ({
    total: sum.total + row.total, success: sum.success + row.success, cached: sum.cached + row.cached, failed: sum.failed + row.failed,
  }), { total: 0, success: 0, cached: 0, failed: 0 });
  const active = data.enabled && data.configured;

  return <div className="ai-settings">
    <Panel title="Trạng thái trợ lý AI" action={<Status tone={active ? "success" : "neutral"}>{active ? "Đang hoạt động" : "Không hoạt động"}</Status>}>
      <div className="ai-settings-row">
        <div>
          <strong>Cho phép dùng AI trên toàn hệ thống</strong>
          <p>Khi tắt, sinh viên và người duyệt chỉ thấy “chưa có gợi ý”; quy trình thực tập vẫn chạy bình thường.</p>
          {data.updatedBy && <small>Cập nhật bởi {data.updatedBy} · {formatTime(data.updatedAt)}</small>}
        </div>
        <button type="button" role="switch" aria-checked={data.enabled} aria-label="Bật hoặc tắt trợ lý AI"
          className={`ai-switch ${data.enabled ? "on" : ""}`} disabled={busy} onClick={() => void toggle()}><span /></button>
      </div>
      {!data.configured && <p className="ai-card ai-card-muted"><Warning />Máy chủ chưa có GEMINI_API_KEY nên AI chưa thể chạy, dù công tắc đang bật.</p>}
      {error && <p className="form-error" role="alert"><Warning />{error}</p>}
      <dl className="ai-settings-facts">
        <div><dt>Mô hình</dt><dd>{data.model}</dd></div>
        <div><dt>Giới hạn mỗi người/ngày</dt><dd>{data.dailyLimitPerUser > 0 ? `${data.dailyLimitPerUser} lượt` : "Không giới hạn"}</dd></div>
        <div><dt>Chi phí</dt><dd>0 đ (gói miễn phí Gemini)</dd></div>
      </dl>
    </Panel>

    <Panel title={`Thống kê sử dụng ${data.usageWindowDays} ngày`} action={<Status tone="info">{totals.total} lượt</Status>}>
      <div className="weekly-log-summary ai-usage-summary">
        <div><span>Gọi AI thành công</span><strong>{totals.success}</strong></div>
        <div><span>Dùng kết quả đã lưu</span><strong>{totals.cached}</strong></div>
        <div className={totals.failed ? "needs-attention" : ""}><span>Lỗi</span><strong>{totals.failed}</strong></div>
      </div>
      {data.usage.length === 0
        ? <p className="ai-empty">Chưa có lượt dùng AI nào trong khoảng thời gian này.</p>
        : <div className="ai-usage-table-wrap"><table className="ai-usage-table">
          <thead><tr><th>Chức năng</th><th>Tổng</th><th>Thành công</th><th>Đã lưu</th><th>Lỗi</th><th>Bỏ qua</th><th>Độ trễ TB</th><th>Token vào/ra</th></tr></thead>
          <tbody>{data.usage.map((row) => <tr key={row.feature}>
            <td>{featureLabel[row.feature] || row.feature}</td><td>{row.total}</td><td>{row.success}</td><td>{row.cached}</td><td>{row.failed}</td><td>{row.skipped}</td>
            <td>{row.avgLatencyMs != null ? `${(row.avgLatencyMs / 1000).toFixed(1)} s` : "—"}</td>
            <td>{row.promptTokens.toLocaleString("vi-VN")} / {row.outputTokens.toLocaleString("vi-VN")}</td>
          </tr>)}</tbody>
        </table></div>}
      <p className="ai-disclaimer">Hệ thống chỉ ghi thời gian, người dùng, chức năng, độ trễ và số token cho mỗi lượt gọi; không lưu nội dung gửi cho AI.</p>
    </Panel>
  </div>;
}
