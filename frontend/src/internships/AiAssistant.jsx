import { useEffect, useState } from "react";
import { Check, CheckCircle, CircleNotch, Info, Lightning, Sparkle, Warning, X } from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { Panel, Status } from "../shared/WorkspaceShell.jsx";
import { AiFeedback } from "../shared/AiFeedback.jsx";
import { AiFeatureTable } from "./AiFeatureTable.jsx";
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
  JOB_MATCH: "Giải thích việc phù hợp (AI3)",
  JOB_RANKER: "Xếp hạng việc làm (học máy)",
  INTERNSHIP_RISK: "Cảnh báo sớm thực tập (học máy)",
};

const roleBase = {
  company: "/company/internships",
  admin: "/uit/internship-supervision",
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

function formatTime(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "";
}

/**
 * Calls an AI endpoint on demand and keeps the last answer, together with the input it was made
 * from. When `inputKey` no longer matches that input the answer is marked stale, so nobody mistakes
 * it for feedback on the current content.
 */
export function useAiRequest(inputKey) {
  const { authorizedRequest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [answeredKey, setAnsweredKey] = useState(null);
  const [error, setError] = useState("");

  const run = async (path, body) => {
    if (busy) return;
    const requestKey = inputKey;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest(path, { method: "POST", body: JSON.stringify(body || {}) });
      setSuggestion(response.data);
      setAnsweredKey(requestKey);
    } catch (requestError) {
      setSuggestion(null);
      setError(requestError?.message || "Không thể kết nối đến hệ thống.");
    } finally {
      setBusy(false);
    }
  };

  const stale = Boolean(suggestion) && answeredKey !== inputKey;
  return { busy, suggestion, stale, error, run, dismiss: () => { setSuggestion(null); setError(""); } };
}

/** Frame shared by every AI result: clear label, disclaimer and a way to ignore it. */
export function AiResultFrame({ suggestion, stale, staleText, error, onDismiss, children }) {
  if (error) return <div className="ai-card ai-card-muted" role="alert"><Warning />{error}</div>;
  if (!suggestion) return null;
  // A "no suggestion" notice about old input is just noise once the input changed.
  if (!suggestion.available) return stale ? null : <div className="ai-card ai-card-muted" role="status"><Info /><span><strong>Chưa có gợi ý.</strong> {suggestion.message}</span></div>;
  return <section className={`ai-card ${stale ? "ai-card-stale" : ""}`} aria-label="Gợi ý từ AI">
    {stale && <p className="ai-stale-note" role="status"><Warning />{staleText}</p>}
    <header className="ai-card-header">
      <span className="ai-badge"><Sparkle weight="fill" />Gợi ý từ AI</span>
      <small>{suggestion.status === "CACHED" ? "Kết quả đã lưu" : "Vừa tạo"} · {formatTime(suggestion.generatedAt)}</small>
      <button type="button" className="ai-dismiss" aria-label="Bỏ qua gợi ý" onClick={onDismiss}><X /></button>
    </header>
    {children}
    {!stale && <AiFeedback feature={suggestion.feature} subjectId={suggestion.suggestionId} />}
    <p className="ai-disclaimer">Nội dung do AI tạo chỉ để tham khảo, có thể chưa chính xác và không được lưu vào hồ sơ. Mọi quyết định do người dùng đưa ra.</p>
  </section>;
}

/** AI1: student asks for feedback on the plan currently in the form (no need to save first). */
export function AiPlanReview({ placementId, form }) {
  const planKey = JSON.stringify([form.objectives, form.expectedTasks, form.expectedSkills].map((value) => value?.trim() || ""));
  const { busy, suggestion, stale, error, run, dismiss } = useAiRequest(planKey);
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
    <AiResultFrame suggestion={suggestion} stale={stale} error={error} onDismiss={dismiss}
      staleText="Kế hoạch đã thay đổi sau lần góp ý này. Bấm “Nhờ AI góp ý” để nhận góp ý cho nội dung mới.">
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

/**
 * AI2: company/UIT reviewer asks for a summary of the weekly logs as last submitted.
 * `logsKey` changes whenever a log is submitted again or reviewed, which marks an older summary stale.
 */
export function AiWeeklyLogSummary({ role, placementId, logsKey, onSelectWeek }) {
  const { busy, suggestion, stale, error, run, dismiss } = useAiRequest(logsKey);
  const result = suggestion?.result;

  return <div className="ai-assist">
    <div className="ai-assist-bar">
      <span><Sparkle weight="duotone" />Tóm tắt nội dung lần nộp gần nhất của các tuần và đánh dấu tuần cần xem kỹ. Phần sinh viên đang sửa nhưng chưa nộp lại không được tính. AI không duyệt thay bạn.</span>
      <button type="button" className="secondary-button small ai-trigger" disabled={busy}
        onClick={() => void run(`${roleBase[role]}/${placementId}/weekly-logs/ai-summary`)}>
        {busy ? <><CircleNotch className="spin" />AI đang đọc...</> : <><Lightning />Tóm tắt bằng AI</>}
      </button>
    </div>
    <AiResultFrame suggestion={suggestion} stale={stale} error={error} onDismiss={dismiss}
      staleText="Nhật ký đã có thay đổi (nộp lại hoặc được xử lý) sau lần tóm tắt này. Bấm “Tóm tắt bằng AI” để cập nhật.">
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

  const active = data.enabled && data.configured;
  const total = data.usage.reduce((sum, row) => sum + row.total, 0);
  const skipped = data.usage.reduce((sum, row) => sum + row.skipped, 0);
  const hero = !data.enabled
    ? ["Trợ lý AI đang tắt", "Bật công tắc để sinh viên và người duyệt dùng được gợi ý AI."]
    : data.configured
      ? ["Trợ lý AI đang bật", "Sinh viên, doanh nghiệp và UIT có thể dùng gợi ý AI."]
      : ["Còn một bước để AI chạy", "Thêm khóa Gemini trên máy chủ rồi khởi động lại backend."];
  const steps = [
    { label: "Khóa API", done: data.configured, text: data.configured ? "Đã cấu hình trên máy chủ" : "Thiếu GEMINI_API_KEY trên máy chủ" },
    { label: "Công tắc nhà trường", done: data.enabled, text: data.enabled ? "Đang bật" : "Đang tắt" },
    { label: "Người dùng", done: active, text: active ? "Có thể nhận gợi ý AI" : "Thấy “chưa có gợi ý”" },
  ];

  return <div className="ai-settings">
    <div className="ai-settings-main">
      <section className="ai-ready" aria-label="Mức sẵn sàng của trợ lý AI">
        <div className="ai-ready-top">
          <div><h2>{hero[0]}</h2><p>{hero[1]}</p></div>
          <button type="button" role="switch" aria-checked={data.enabled} aria-label="Bật hoặc tắt trợ lý AI"
            className={`ai-switch ${data.enabled ? "on" : ""}`} disabled={busy} onClick={() => void toggle()}>
            <i aria-hidden="true"><span /></i>{busy ? "Đang lưu..." : data.enabled ? "Đang bật" : "Đang tắt"}
          </button>
        </div>
        {error && <p className="form-error" role="alert"><Warning />{error}</p>}
        <ol className="ai-steps">{steps.map((step) => <li key={step.label} className={step.done ? "done" : ""}>
          <i aria-hidden="true">{step.done ? <Check weight="bold" /> : <Warning weight="bold" />}</i>
          <div><strong>{step.label}</strong><span>{step.text}</span></div>
        </li>)}</ol>
      </section>

      <section className="ai-settings-card" aria-label="Thống kê sử dụng">
        <header><h2>Sử dụng trong {data.usageWindowDays} ngày</h2><span>{total} lượt</span></header>
        {total === skipped
          ? <div className="ai-usage-empty"><Sparkle weight="duotone" /><strong>Chưa có lượt gọi AI nào được xử lý</strong>
            <p>{skipped > 0
              ? `Đã có ${skipped} lượt bấm nhưng bị bỏ qua vì AI đang tắt, thiếu khóa hoặc hết lượt trong ngày.`
              : "Thống kê sẽ hiện ở đây sau lượt dùng đầu tiên."}</p></div>
          : data.usage.map((row) => <AiUsageRow key={row.feature} row={row} />)}
      </section>

      {data.features?.length > 0 && <section className="ai-settings-card" aria-label="Từng chức năng AI">
        <header><h2>Từng chức năng</h2><span>Bật/tắt, hạn mức, chất lượng</span></header>
        <AiFeatureTable features={data.features} masterOn={data.enabled} onChange={setData} />
      </section>}
    </div>

    <aside className="ai-settings-side" aria-label="Cấu hình và quyền riêng tư">
      <section className="ai-settings-card">
        <header><h2>Cấu hình</h2></header>
        <dl className="ai-settings-facts">
          <div><dt>Mô hình</dt><dd>{data.model}</dd></div>
          <div><dt>Mỗi người</dt><dd>{data.dailyLimitPerUser > 0 ? `${data.dailyLimitPerUser} lượt/ngày` : "Không giới hạn"}</dd></div>
          <div><dt>Chi phí</dt><dd>0 đ (gói miễn phí)</dd></div>
          {data.updatedBy && <div><dt>Cập nhật</dt><dd>{data.updatedBy}<br />{formatTime(data.updatedAt)}</dd></div>}
        </dl>
      </section>
      <section className="ai-settings-card">
        <header><h2>Quyền riêng tư</h2></header>
        <p>Hệ thống chỉ ghi thời gian, người dùng, chức năng, độ trễ và số token cho mỗi lượt gọi; không lưu nội dung gửi cho AI.</p>
        <p>Khi AI tắt, quy trình thực tập vẫn chạy bình thường.</p>
      </section>
    </aside>
  </div>;
}

const usageParts = [["success", "Thành công"], ["cached", "Dùng kết quả đã lưu"], ["failed", "Lỗi"], ["skipped", "Bỏ qua"]];

function AiUsageRow({ row }) {
  return <div className="ai-usage-row">
    <div className="ai-usage-head"><strong>{featureLabel[row.feature] || row.feature}</strong>
      <span>{row.total} lượt{row.avgLatencyMs != null && `, trung bình ${(row.avgLatencyMs / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giây`}</span></div>
    <div className="ai-usage-bar" role="img" aria-label={usageParts.map(([key, label]) => `${label}: ${row[key]}`).join(", ")}>
      {usageParts.filter(([key]) => row[key] > 0).map(([key]) => <i key={key} className={key} style={{ flexGrow: row[key] }} />)}
    </div>
    <ul className="ai-usage-legend">{usageParts.map(([key, label]) => <li key={key}><i aria-hidden="true" className={key} />{label}<strong>{row[key]}</strong></li>)}</ul>
    <small>Token vào / ra: {row.promptTokens.toLocaleString("vi-VN")} / {row.outputTokens.toLocaleString("vi-VN")}</small>
  </div>;
}
