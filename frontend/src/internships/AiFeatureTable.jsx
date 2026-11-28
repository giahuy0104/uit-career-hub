import { useState } from "react";
import { CircleNotch, Warning } from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { modelLabel } from "../shared/ml-copy.js";

export const featureNames = {
  PLAN_REVIEW: "Góp ý kế hoạch",
  WEEKLY_LOG_SUMMARY: "Tóm tắt nhật ký",
  JOB_MATCH: "Giải thích việc phù hợp",
  JOB_RANKER: "Xếp hạng việc làm",
  INTERNSHIP_RISK: "Cảnh báo sớm thực tập",
};

const number = (value, digits = 2) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: digits });
const share = (part, total) => (total ? `${Math.round((100 * part) / total)}%` : "—");

/** UIT: one row per AI feature with its own switch, quota, usage, user ratings and model quality. */
export function AiFeatureTable({ features, masterOn, onChange }) {
  return <div className="ai-feature-list">
    {!masterOn && <p className="ai-feature-note"><Warning />Công tắc chung đang tắt nên mọi chức năng đều tạm dừng.</p>}
    {features.map((row) => <AiFeatureRow key={row.feature} row={row} onChange={onChange} />)}
  </div>;
}

function AiFeatureRow({ row, onChange }) {
  const { authorizedRequest } = useAuth();
  const [limit, setLimit] = useState(row.dailyLimitPerUser ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const llm = row.kind === "LLM";
  const votes = row.feedback.helpful + row.feedback.notHelpful;
  const limitChanged = String(limit) !== String(row.dailyLimitPerUser ?? "");

  const save = async (enabled, nextLimit) => {
    setBusy(true);
    setError("");
    try {
      const body = { enabled, dailyLimitPerUser: nextLimit === "" ? null : Number(nextLimit) };
      const response = await authorizedRequest(`/uit/ai/features/${row.feature}`, { method: "PUT", body: JSON.stringify(body) });
      onChange(response.data);
    } catch (requestError) {
      setError(requestError?.message || "Không lưu được.");
    } finally {
      setBusy(false);
    }
  };

  return <article className="ai-feature-row">
    <header>
      <div>
        <strong>{featureNames[row.feature] || row.feature}</strong>
        <span className={`ai-kind ${llm ? "llm" : "model"}`}>{llm ? "Gemini" : "Học máy"}</span>
      </div>
      <button type="button" role="switch" aria-checked={row.enabled} aria-label={`Bật hoặc tắt ${featureNames[row.feature]}`}
        className={`ai-mini-switch ${row.enabled ? "on" : ""}`} disabled={busy} onClick={() => void save(!row.enabled, limit)}>
        <i aria-hidden="true"><span /></i>{busy ? <CircleNotch className="spin" /> : row.enabled ? "Bật" : "Tắt"}
      </button>
    </header>
    <dl>
      {llm && <div><dt>Lượt gọi 30 ngày</dt><dd>{row.usage ? `${row.usage.total} (${share(row.usage.success, row.usage.total)} thành công)` : "0"}</dd></div>}
      {row.model && <div><dt>Mô hình</dt><dd>{modelLabel(row.model)}</dd></div>}
      {row.model?.test?.["ndcg@5"] != null && <div><dt>Kiểm tra offline</dt><dd>NDCG@5 {number(row.model.test["ndcg@5"], 3)}</dd></div>}
      {row.model?.test?.auc != null && <div><dt>Kiểm tra offline</dt><dd>AUC {number(row.model.test.auc, 3)}</dd></div>}
      {row.online && <div><dt>Thực tế 30 ngày</dt><dd>{row.online.impressions} lượt hiện · {share(row.online.clicks, row.online.impressions)} bấm · {share(row.online.applications, row.online.impressions)} ứng tuyển</dd></div>}
      <div><dt>Người dùng đánh giá hữu ích</dt><dd>{votes ? `${share(row.feedback.helpful, votes)} trên ${votes} lượt` : "Chưa có đánh giá"}</dd></div>
    </dl>
    {llm && <div className="ai-feature-limit">
      <label><span>Hạn mức riêng mỗi người/ngày</span>
        <input type="number" min="1" max="1000" inputMode="numeric" placeholder="Không giới hạn riêng" value={limit}
          onChange={(event) => setLimit(event.target.value)} disabled={busy} /></label>
      {limitChanged && <button type="button" className="secondary-button small" disabled={busy} onClick={() => void save(row.enabled, limit)}>Lưu hạn mức</button>}
    </div>}
    {error && <p className="form-error" role="alert"><Warning />{error}</p>}
  </article>;
}
