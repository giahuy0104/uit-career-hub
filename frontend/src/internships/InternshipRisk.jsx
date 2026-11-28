import { ChartLineUp, Info } from "@phosphor-icons/react";

import { Status } from "../shared/WorkspaceShell.jsx";
import { AiFeedback } from "../shared/AiFeedback.jsx";
import { describeFactor, modelLabel, riskFactorCopy } from "../shared/ml-copy.js";

export const riskCopy = {
  HIGH: ["Nguy cơ cao", "urgent"],
  MEDIUM: ["Cần theo dõi", "warning"],
  LOW: ["Ổn định", "success"],
  INSUFFICIENT_DATA: ["Chưa đủ dữ liệu", "neutral"],
};

export function RiskBadge({ assessment }) {
  if (!assessment) return null;
  const [label, tone] = riskCopy[assessment.level] || riskCopy.INSUFFICIENT_DATA;
  return <Status tone={tone}>{label}</Status>;
}

/** UIT early warning for one placement: probability, the reasons behind it and what it is based on. */
export function RiskCard({ assessment, model }) {
  if (!assessment) return null;
  const [label, tone] = riskCopy[assessment.level] || riskCopy.INSUFFICIENT_DATA;
  const scored = assessment.level !== "INSUFFICIENT_DATA";
  return <section className={`risk-card ${assessment.level.toLowerCase()}`} aria-label="Cảnh báo sớm">
    <header>
      <span className="risk-card-icon"><ChartLineUp weight="duotone" /></span>
      <div><h3>Cảnh báo sớm</h3><small>{modelLabel(model)}</small></div>
      <Status tone={tone}>{label}</Status>
    </header>
    {scored ? <>
      <div className="risk-meter" role="img" aria-label={`Khả năng kết thúc không tốt ${Math.round(assessment.probability * 100)}%`}>
        <span style={{ width: `${Math.round(assessment.probability * 100)}%` }} />
      </div>
      <p className="risk-probability"><strong>{Math.round(assessment.probability * 100)}%</strong> khả năng kỳ thực tập kết thúc không tốt, dựa trên {assessment.submittedWeeks}/{assessment.dueWeeks} tuần nhật ký.</p>
      {assessment.factors.length > 0 && <ul className="risk-factors">{assessment.factors.map((factor) => <li key={factor.feature}>{describeFactor(riskFactorCopy, factor)}</li>)}</ul>}
    </> : <p className="risk-probability">Cần ít nhất 2 tuần nhật ký đã nộp để đánh giá (hiện có {assessment.submittedWeeks}).</p>}
    {scored && <AiFeedback feature="INTERNSHIP_RISK" subjectId={assessment.placementId} modelVersion={model?.version} question="Đánh giá này có đúng với thực tế không?" />}
    <p className="risk-note"><Info />Chỉ để ưu tiên theo dõi, không thay cho đánh giá của UIT và doanh nghiệp.</p>
  </section>;
}
