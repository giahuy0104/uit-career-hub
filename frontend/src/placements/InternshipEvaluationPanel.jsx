import { useEffect, useState } from "react";
import {
  CheckCircle,
  CircleNotch,
  Info,
  PaperPlaneTilt,
  ShieldCheck,
  Star,
  Warning,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";

const ratingOptions = [1, 2, 3, 4, 5];
const initialForm = {
  workQualityRating: 3,
  collaborationRating: 3,
  professionalismRating: 3,
  overallRating: 3,
  recommendation: true,
  strengths: "",
  improvements: "",
};

function apiError(error) {
  return error?.payload?.error?.message || error?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function EvaluationCard({ title, evaluation, privateCopy = false }) {
  if (!evaluation) return null;
  const ratings = [
    ["Chất lượng", evaluation.workQualityRating],
    ["Phối hợp", evaluation.collaborationRating],
    ["Chuyên nghiệp", evaluation.professionalismRating],
    ["Tổng thể", evaluation.overallRating],
  ];
  return (
    <article className="internship-evaluation-result" data-testid={`evaluation-${evaluation.respondentRole.toLowerCase()}-result`}>
      <header>
        <span><CheckCircle weight="fill" /></span>
        <div><strong>{title}</strong><small>{evaluation.submittedBy.name} · {formatDate(evaluation.submittedAt)}</small></div>
        <i>{evaluation.recommendation ? "Khuyến nghị" : "Không khuyến nghị"}</i>
      </header>
      <div className="internship-rating-summary">
        {ratings.map(([label, rating]) => <span key={label}><small>{label}</small><strong>{rating}/5</strong></span>)}
      </div>
      <div className="internship-evaluation-copy"><small>Điểm nổi bật</small><p>{evaluation.strengths}</p></div>
      {evaluation.improvements && <div className="internship-evaluation-copy"><small>Điểm cần cải thiện</small><p>{evaluation.improvements}</p></div>}
      {privateCopy && <p className="internship-evaluation-privacy"><ShieldCheck />Phản hồi này chỉ hiển thị cho bạn và UIT.</p>}
    </article>
  );
}

export function InternshipEvaluationPanel({ role, applicationId }) {
  const { authorizedRequest } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initialForm);
  const endpoint = role === "company"
    ? `/companies/me/applications/${applicationId}/internship-evaluations`
    : `/applications/${applicationId}/internship-evaluations`;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest(endpoint);
      setData(response.data);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [authorizedRequest, endpoint]);

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    if (busy || form.strengths.trim().length < 10 || (form.improvements.trim() && form.improvements.trim().length < 5)) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await authorizedRequest(endpoint, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          ...form,
          strengths: form.strengths.trim(),
          ...(form.improvements.trim() ? { improvements: form.improvements.trim() } : {}),
        }),
      });
      setData(response.data);
      setSuccess(role === "company" ? "Đã gửi đánh giá kỳ thực tập." : "Đã gửi phản hồi riêng cho UIT.");
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const ownEvaluation = role === "company" ? data?.companyEvaluation : data?.studentEvaluation;
  const labels = role === "company"
    ? {
      title: "Đánh giá kỳ thực tập",
      description: "Ghi nhận kết quả làm việc của sinh viên sau khi UIT xác nhận hoàn thành.",
      workQuality: "Chất lượng công việc",
      collaboration: "Khả năng phối hợp",
      professionalism: "Tác phong chuyên nghiệp",
      recommendation: "Sẵn sàng giới thiệu sinh viên cho cơ hội phù hợp khác",
      strengths: "Điểm mạnh của sinh viên",
      improvements: "Điểm sinh viên cần cải thiện",
    }
    : {
      title: "Phản hồi kỳ thực tập",
      description: "Chia sẻ trải nghiệm để UIT cải thiện chất lượng doanh nghiệp đối tác.",
      workQuality: "Chất lượng công việc được giao",
      collaboration: "Mức độ hỗ trợ và phối hợp",
      professionalism: "Môi trường chuyên nghiệp",
      recommendation: "Sẵn sàng giới thiệu doanh nghiệp cho sinh viên khác",
      strengths: "Điểm tích cực của kỳ thực tập",
      improvements: "Điểm doanh nghiệp cần cải thiện",
    };

  return (
    <section className="internship-evaluation-panel" data-testid={`${role}-internship-evaluation`}>
      <header><span><Star weight="duotone" /></span><div><h3>{labels.title}</h3><p>{labels.description}</p></div></header>
      {success && <div className="internship-evaluation-success" role="status"><CheckCircle weight="fill" />{success}</div>}
      {loading ? (
        <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải phiếu đánh giá...</div>
      ) : error && !data ? (
        <div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={() => void load()}>Thử lại</button></div>
      ) : data ? (
        <>
          <div className="internship-evaluation-status">
            <Info />
            <span><strong>Trạng thái: {data.placement.status === "COMPLETED" ? "Đã hoàn thành thực tập" : data.placement.status === "STARTED" ? "Đang thực tập" : "Chờ bắt đầu"}</strong><small>{data.placement.completedDate ? `UIT xác nhận hoàn thành ngày ${formatDate(`${data.placement.completedDate}T00:00:00`)}` : "Phiếu mở sau khi UIT xác nhận hoàn thành."}</small></span>
          </div>
          {role === "student" && <EvaluationCard title="Đánh giá từ doanh nghiệp" evaluation={data.companyEvaluation} />}
          {ownEvaluation ? (
            <EvaluationCard
              title={role === "company" ? "Đánh giá đã gửi" : "Phản hồi bạn đã gửi"}
              evaluation={ownEvaluation}
              privateCopy={role === "student"}
            />
          ) : data.canSubmit ? (
            <form className="internship-evaluation-form" onSubmit={submit}>
              <div className="internship-rating-grid">
                {[
                  ["workQualityRating", labels.workQuality],
                  ["collaborationRating", labels.collaboration],
                  ["professionalismRating", labels.professionalism],
                  ["overallRating", "Đánh giá tổng thể"],
                ].map(([key, label]) => (
                  <label key={key}><span>{label} *</span><select data-testid={`rating-${key}`} value={form[key]} onChange={event => update(key, Number(event.target.value))}>{ratingOptions.map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
                ))}
              </div>
              <label className="internship-recommendation"><input type="checkbox" checked={form.recommendation} onChange={event => update("recommendation", event.target.checked)} /><span>{labels.recommendation}</span></label>
              <label><span>{labels.strengths} *</span><textarea data-testid="evaluation-strengths" value={form.strengths} onChange={event => update("strengths", event.target.value)} minLength={10} maxLength={2000} placeholder="Mô tả cụ thể, tối thiểu 10 ký tự..." /></label>
              <label><span>{labels.improvements}</span><textarea data-testid="evaluation-improvements" value={form.improvements} onChange={event => update("improvements", event.target.value)} minLength={5} maxLength={2000} placeholder="Không bắt buộc..." /></label>
              {role === "student" && <p className="internship-evaluation-privacy"><ShieldCheck />Doanh nghiệp chỉ biết bạn đã gửi phản hồi; nội dung chỉ hiển thị cho bạn và UIT.</p>}
              {error && <p className="form-error" role="alert"><Warning />{error}</p>}
              <button data-testid="submit-internship-evaluation" className="primary-button" type="submit" disabled={busy || form.strengths.trim().length < 10 || (form.improvements.trim().length > 0 && form.improvements.trim().length < 5)}>{busy ? <CircleNotch className="spin" /> : <PaperPlaneTilt />}Gửi phiếu</button>
              <small className="internship-evaluation-immutable">Phiếu được lưu bất biến sau khi gửi để bảo toàn kết quả đối chiếu.</small>
            </form>
          ) : (
            <div className="internship-evaluation-locked"><Info />Phiếu sẽ mở khi kỳ thực tập hoàn thành.</div>
          )}
          {role === "company" && data.studentEvaluationSubmitted && <div className="internship-feedback-received"><CheckCircle />Sinh viên đã gửi phản hồi riêng cho UIT.</div>}
        </>
      ) : null}
    </section>
  );
}
