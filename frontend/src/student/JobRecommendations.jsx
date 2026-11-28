import { useEffect, useState } from "react";
import { CircleNotch, Lightning, Sparkle, Warning } from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { AiResultFrame, useAiRequest } from "../internships/AiAssistant.jsx";
import { describeFactor, jobFactorCopy, modelLabel } from "../shared/ml-copy.js";
import { logJobEvent } from "./job-events.js";
import "./job-match.css";

const criterionLabels = {
  REQUIRED_SKILLS: "Kỹ năng bắt buộc",
  OPTIONAL_SKILLS: "Kỹ năng thêm",
  CATEGORY: "Nhóm ngành",
  OPPORTUNITY_TYPE: "Loại cơ hội",
};

const points = (value) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

/** AI3: ranking computed by the system; the AI only adds an explanation when asked. */
export function JobRecommendations({ selectedId, onSelect, onEditSkills }) {
  const { authorizedRequest } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const items = data?.items || [];
  const { busy, suggestion, stale, error: aiError, run, dismiss } = useAiRequest(items.map((item) => item.job.id).join());

  useEffect(() => {
    let ignore = false;
    setError("");
    authorizedRequest("/students/me/job-recommendations")
      .then((response) => {
        if (ignore) return;
        setData(response.data);
        const modelVersion = response.data.model?.version;
        response.data.items.forEach((item, position) => logJobEvent(authorizedRequest,
          { jobId: item.job.id, type: "IMPRESSION", source: "RECOMMENDATIONS", position, modelVersion }));
      })
      .catch((requestError) => { if (!ignore) setError(requestError?.message || "Không thể tải gợi ý việc làm."); });
    return () => { ignore = true; };
  }, [authorizedRequest, reload]);

  const explained = suggestion?.result?.items || [];
  const titleOf = (jobId) => items.find((item) => item.job.id === jobId)?.job.title;
  const byModel = data?.ranking === "MODEL";
  const open = (jobId, position) => {
    logJobEvent(authorizedRequest, { jobId, type: "RECOMMENDATION_CLICK", source: "RECOMMENDATIONS", position, modelVersion: data?.model?.version });
    onSelect(jobId);
  };

  return <section className="job-match" aria-label="Việc phù hợp với bạn">
    <header>
      <div><h2><Sparkle weight="duotone" />Phù hợp với bạn</h2><p>{byModel
        ? <>Xếp bởi mô hình học máy ({modelLabel(data.model)}), học từ kỹ năng, mong muốn và hành vi ứng tuyển.</>
        : "Xếp theo kỹ năng và mong muốn bạn đã chọn."}</p></div>
      <button type="button" className="secondary-button small" onClick={onEditSkills}>Sửa kỹ năng</button>
    </header>
    {error
      ? <div className="portal-error" role="alert"><Warning />{error}<button type="button" className="secondary-button small" onClick={() => setReload((value) => value + 1)}>Thử lại</button></div>
      : !data
        ? <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tìm việc phù hợp...</div>
        : data.needsSkills
          ? <div className="job-match-empty"><strong>Bạn chưa chọn kỹ năng</strong><p>Chọn kỹ năng trong hồ sơ để nhận gợi ý việc làm.</p><button type="button" className="primary-button small" onClick={onEditSkills}>Chọn kỹ năng</button></div>
          : items.length === 0
            ? <div className="job-match-empty"><strong>Chưa có tin phù hợp</strong><p>Các tin đang tuyển chưa trùng kỹ năng nào của bạn, hoặc bạn đã ứng tuyển rồi.</p></div>
            : <>
              <ol className="job-match-list">{items.map(({ job, score, ruleScore, factors, criteria, matchedSkills, missingSkills, optionalSkills }, position) => <li key={job.id}>
                <button type="button" aria-pressed={selectedId === job.id} className={selectedId === job.id ? "selected" : ""} onClick={() => open(job.id, position)}>
                  <span className="job-match-score"><strong>{score}</strong><small>/100</small></span>
                  <span className="job-match-body">
                    <strong>{job.title}</strong><small>{job.company.name}</small>
                    <span className="job-match-tags">
                      {matchedSkills.map((name) => <i key={name} className="have">{name}</i>)}
                      {missingSkills.map((name) => <i key={name} className="miss">Thiếu {name}</i>)}
                      {optionalSkills.map((name) => <i key={name}>Nên có {name}</i>)}
                    </span>
                    {byModel && factors.length > 0 && <span className="job-match-why">{factors.map((factor) => describeFactor(jobFactorCopy, factor)).join(" · ")}</span>}
                  </span>
                </button>
                <details><summary>Cách tính điểm</summary>{byModel && <p className="job-match-model">Mô hình dự đoán mức phù hợp <strong>{score}/100</strong>. Công thức cũ cho <strong>{ruleScore}/100</strong>, gồm:</p>}<ul>{criteria.map((item) => <li key={item.key}>{criterionLabels[item.key] || item.key}<span>{points(item.earned)} / {item.weight}</span></li>)}</ul></details>
              </li>)}</ol>
              <div className="ai-assist">
                <div className="ai-assist-bar">
                  <span><Sparkle weight="duotone" />Nhờ AI giải thích vì sao hợp và nên chuẩn bị gì cho {Math.min(5, items.length)} tin đầu. AI không đổi thứ tự.</span>
                  <button type="button" className="secondary-button small ai-trigger" disabled={busy} onClick={() => void run("/students/me/job-recommendations/ai-explanation")}>
                    {busy ? <><CircleNotch className="spin" />AI đang đọc...</> : <><Lightning />Nhờ AI giải thích</>}
                  </button>
                </div>
                <AiResultFrame suggestion={suggestion} stale={stale} error={aiError} onDismiss={dismiss}
                  staleText="Danh sách gợi ý đã đổi sau lần giải thích này. Bấm “Nhờ AI giải thích” để cập nhật.">
                  <ul className="job-match-explain">{explained.filter((item) => titleOf(item.jobId)).map((item) => <li key={item.jobId}>
                    <button type="button" className="text-button" onClick={() => open(item.jobId, items.findIndex((entry) => entry.job.id === item.jobId))}>{titleOf(item.jobId)}</button>
                    <p>{item.why}</p>
                    {item.prepare && <p><strong>Nên chuẩn bị:</strong> {item.prepare}</p>}
                  </li>)}</ul>
                </AiResultFrame>
              </div>
            </>}
  </section>;
}
