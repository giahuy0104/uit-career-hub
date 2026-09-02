import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  ClockCountdown,
  FileText,
  TrendUp,
  User,
  UserCheck,
  Users,
  Warning,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import "./student-dashboard.css";

const applicationStatusCopy = {
  UIT_REVIEWING: "UIT đang kiểm duyệt",
  NEEDS_SUPPLEMENT: "Cần bổ sung hồ sơ",
  FORWARDED_TO_COMPANY: "Đã chuyển doanh nghiệp",
  COMPANY_REVIEWING: "Doanh nghiệp đang xem",
  INTERVIEW_INVITED: "Đã mời phỏng vấn",
  OFFER_PENDING_STUDENT: "Chờ phản hồi offer",
  ACCEPTED_PENDING_UIT_CONFIRMATION: "Chờ UIT xác nhận",
  HIRED: "Đã nhận việc",
  NOT_SUITABLE: "Không phù hợp",
  INTERVIEW_FAILED: "Phỏng vấn chưa đạt",
  OFFER_DECLINED: "Đã từ chối offer",
  UIT_REJECTED: "UIT từ chối",
  WITHDRAWN: "Đã rút đơn",
};

const workModeCopy = { ONSITE: "Tại văn phòng", REMOTE: "Từ xa", HYBRID: "Kết hợp" };

function formatDate(value, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function MetricCard({ label, value, helper, Icon, tone = "blue" }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon"><Icon size={22} weight="duotone" /></span><div><small>{label}</small><strong>{value}</strong><p>{helper}</p></div></article>;
}

function StudentMetric({ label, value, helper, Icon, tone }) {
  return (
    <article className={`student-metric student-metric--${tone}`}>
      <div className="student-metric__label">
        <span className="student-metric__icon" aria-hidden="true"><Icon size={20} weight="duotone" /></span>
        <small>{label}</small>
      </div>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function Panel({ title, action, children }) {
  return <section className="portal-panel"><header><h2>{title}</h2>{action}</header>{children}</section>;
}

function Status({ tone = "neutral", children }) {
  return <span className={`portal-status ${tone}`}>{children}</span>;
}

function Empty({ title, text }) {
  return <div className="empty-hint"><CheckCircle size={30} /><strong>{title}</strong><p>{text}</p></div>;
}

function useLiveDashboard(path) {
  const { authorizedRequest } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest(path);
      setData(response.data);
    } catch (requestError) {
      setError(requestError.message || "Không thể tải số liệu dashboard.");
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest, path]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

function DashboardState({ loading, error, reload }) {
  if (loading) return <Panel title="Đang tổng hợp dữ liệu"><div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải số liệu mới nhất...</div></Panel>;
  if (error) return <Panel title="Chưa tải được dashboard"><div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={reload}>Thử lại</button></div></Panel>;
  return null;
}

export function LiveStudentDashboard({ navigate }) {
  const state = useLiveDashboard("/students/me/dashboard");
  const data = state.data;
  if (!data) return <DashboardState {...state} />;

  const profileHelper = data.profile.missingItems.length
    ? `Thiếu ${data.profile.missingItems[0].toLowerCase()}`
    : "Hồ sơ đã sẵn sàng";
  const latest = data.latestApplication;
  const profileCompletion = Math.max(0, Math.min(100, Number(data.metrics.profileCompleteness) || 0));

  return <div className="student-dashboard">
    <section className="student-dashboard__metrics" aria-label="Chỉ số tổng quan">
      <article className="student-profile-metric">
        <div className="student-profile-metric__heading">
          <span className="student-profile-metric__icon" aria-hidden="true"><User size={22} weight="duotone" /></span>
          <div><small>Hồ sơ hoàn thiện</small><strong>{data.metrics.profileCompleteness}%</strong></div>
        </div>
        <div
          className="student-profile-metric__progress"
          role="progressbar"
          aria-label="Mức độ hoàn thiện hồ sơ"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={profileCompletion}
        >
          <span style={{ "--student-profile-progress": `${profileCompletion}%` }} />
        </div>
        <p>{profileHelper}</p>
      </article>
      <StudentMetric label="Đơn đang xử lý" value={data.metrics.activeApplications} helper="Theo dữ liệu hiện tại" Icon={FileText} tone="amber" />
      <StudentMetric label="Lịch phỏng vấn sắp tới" value={data.metrics.upcomingInterviews} helper="Lịch chưa kết thúc" Icon={CalendarCheck} tone="purple" />
      <StudentMetric label="Offer cần phản hồi" value={data.metrics.pendingOffers} helper={data.metrics.pendingOffers ? "Cần quyết định sớm" : "Chưa có offer chờ xử lý"} Icon={UserCheck} tone="green" />
    </section>
    <div className="student-dashboard__focus-grid">
      <div className="student-dashboard__tasks">
        <Panel title="Việc bạn cần làm" action={<button type="button" className="link-button" onClick={() => navigate("applications")}>Xem đơn <ArrowRight size={15} aria-hidden="true" /></button>}>
        {data.tasks.length ? <div className="todo-list student-dashboard__task-list">{data.tasks.map((task) => {
          const isInterview = task.type === "UPCOMING_INTERVIEW";
          const isOffer = task.type === "RESPOND_OFFER";
          const destination = isInterview ? "interviews" : isOffer ? "applications" : "profile";
          const Icon = isInterview ? CalendarCheck : isOffer ? UserCheck : Warning;
          return <button type="button" key={`${task.type}-${task.applicationId}-${task.dueAt || "none"}`} onClick={() => navigate(destination)}><span className={isOffer ? "todo-green" : isInterview ? "todo-blue" : "todo-warning"} aria-hidden="true"><Icon size={20} weight="duotone" /></span><div><strong>{task.title}</strong><small>{task.description}</small></div><Status tone={isOffer ? "success" : isInterview ? "info" : "urgent"}>{task.dueAt ? formatDate(task.dueAt, true) : isOffer ? "Cần phản hồi" : "Cần bổ sung"}</Status><ArrowRight className="student-dashboard__row-arrow" size={18} aria-hidden="true" /></button>;
        })}</div> : <Empty title="Không có việc cần xử lý" text="Hệ thống sẽ hiển thị tại đây khi có yêu cầu mới." />}
        </Panel>
      </div>
      <div className="student-dashboard__journey">
        <Panel title="Tiến trình gần nhất">
          {latest ? <div className="mini-timeline student-dashboard__timeline"><div className="done"><span><Check aria-hidden="true" /></span><div><strong>Đã nộp hồ sơ</strong><small>{latest.jobTitle} · {latest.companyName}</small></div></div><div className="current"><span>2</span><div><strong>{applicationStatusCopy[latest.status] || latest.status}</strong><small>Cập nhật {formatDate(latest.lastTransitionAt, true)}</small></div></div><div><span>3</span><div><strong>Bước tiếp theo</strong><small>Hệ thống sẽ thông báo khi trạng thái thay đổi</small></div></div></div> : <Empty title="Chưa có đơn ứng tuyển" text="Hãy chọn cơ hội phù hợp để bắt đầu." />}
        </Panel>
      </div>
    </div>
    <div className="student-dashboard__opportunity-panel">
      <Panel title="Cơ hội đang tuyển chưa ứng tuyển" action={<button type="button" className="link-button" onClick={() => navigate("jobs")}>Xem tất cả <ArrowRight size={15} aria-hidden="true" /></button>}>
        {data.opportunities.length ? <div className="simple-table opportunities student-dashboard__opportunities"><div className="table-head"><span>Vị trí</span><span>Doanh nghiệp</span><span>Hình thức</span><span>Hạn nộp</span><span /></div>{data.opportunities.map((job) => <button type="button" key={job.jobId} onClick={() => navigate("jobs")}><span className="student-opportunity__position"><span className="student-opportunity__icon" aria-hidden="true"><Briefcase size={18} weight="duotone" /></span><strong>{job.title}</strong></span><span className="student-opportunity__company">{job.companyName}</span><span className="student-opportunity__mode"><Status tone="info">{workModeCopy[job.workMode] || job.workMode}</Status></span><time className="student-opportunity__deadline" dateTime={job.deadline}>{formatDate(job.deadline)}</time><ArrowRight className="student-opportunity__arrow" size={18} aria-hidden="true" /></button>)}</div> : <Empty title="Bạn đã xem hết cơ hội hiện tại" text="Quay lại sau khi doanh nghiệp đăng tin mới." />}
      </Panel>
    </div>
  </div>;
}

export function LiveAdminDashboard({ navigate }) {
  const state = useLiveDashboard("/uit/dashboard");
  const data = state.data;
  const funnel = useMemo(() => {
    if (!data) return [];
    const labels = {
      UIT_REVIEW: "UIT kiểm duyệt",
      COMPANY_REVIEW: "Doanh nghiệp xử lý",
      INTERVIEW: "Mời phỏng vấn",
      OFFER_OR_HIRED: "Offer / nhận việc",
      CLOSED: "Đã kết thúc",
    };
    const maximum = Math.max(1, ...data.applicationFunnel.map((item) => item.count));
    return data.applicationFunnel.map((item) => ({ ...item, label: labels[item.status] || item.status, width: Math.max(4, Math.round((item.count / maximum) * 100)) }));
  }, [data]);
  if (!data) return <DashboardState {...state} />;

  const queue = data.queues;
  return <>
    <div className="metric-grid four">
      <MetricCard label="Tin chờ duyệt" value={data.metrics.pendingJobReviews} helper={`${queue.jobReviews.overdue} tin quá 24 giờ`} Icon={Briefcase} tone="amber" />
      <MetricCard label="Hồ sơ chờ UIT" value={data.metrics.pendingUitApplications} helper={`${queue.uitApplications.overdue} hồ sơ quá 24 giờ`} Icon={UserCheck} tone="red" />
      <MetricCard label="Chờ doanh nghiệp" value={data.metrics.awaitingCompany} helper="Đang sàng lọc hoặc phỏng vấn" Icon={Clock} tone="purple" />
      <MetricCard label="Đã nhận việc tháng này" value={data.metrics.hiresThisMonth} helper="Đã được UIT xác nhận" Icon={TrendUp} tone="green" />
    </div>
    <div className="portal-two-column wide-left">
      <Panel title="Hàng đợi cần xử lý" action={<button className="link-button" onClick={() => navigate("admin-applications")}>Mở hàng đợi <ArrowRight size={14} /></button>}>
        <div className="admin-queue">
          <button onClick={() => navigate("admin-applications")}><span className="queue-number urgent">{queue.uitApplications.total}</span><div><strong>Hồ sơ sinh viên chờ kiểm duyệt</strong><small>{queue.uitApplications.oldestWaitingHours === null ? "Chưa có hồ sơ chờ" : `Hồ sơ cũ nhất đã chờ ${queue.uitApplications.oldestWaitingHours} giờ`}</small></div><Status tone={queue.uitApplications.overdue ? "urgent" : "success"}>{queue.uitApplications.overdue ? `${queue.uitApplications.overdue} quá hạn` : "Đúng hạn"}</Status><ArrowRight /></button>
          <button onClick={() => navigate("admin-jobs")}><span className="queue-number amber">{queue.jobReviews.total}</span><div><strong>Tin tuyển dụng chờ phê duyệt</strong><small>{queue.jobReviews.companyCount} doanh nghiệp đang chờ phản hồi</small></div><Status tone={queue.jobReviews.overdue ? "warning" : "success"}>{queue.jobReviews.overdue ? `${queue.jobReviews.overdue} quá hạn` : "Đúng hạn"}</Status><ArrowRight /></button>
          <button onClick={() => navigate("admin-placements")}><span className="queue-number blue">{queue.placementConfirmations.total}</span><div><strong>Hồ sơ chờ xác nhận nơi làm việc</strong><small>{queue.placementConfirmations.oldestWaitingHours === null ? "Chưa có hồ sơ chờ" : `Hồ sơ cũ nhất đã chờ ${queue.placementConfirmations.oldestWaitingHours} giờ`}</small></div><Status tone="info">Xác nhận</Status><ArrowRight /></button>
        </div>
      </Panel>
      <Panel title="Mức xử lý hiện tại">
        <div className="donut-summary"><div className="donut" style={{ background: `conic-gradient(var(--blue) 0 ${data.handledToday.completionRate}%, #e5eaf0 ${data.handledToday.completionRate}% 100%)` }}><span>{data.handledToday.completionRate}%</span></div><strong>{data.handledToday.completed} thao tác đã xử lý hôm nay</strong><p>{data.handledToday.incoming} yêu cầu mới phát sinh hôm nay</p></div>
        <div className="mini-bars"><span><i style={{ width: `${Math.min(100, data.handledToday.completionRate)}%` }} />Tiến độ xử lý <b>{data.handledToday.completionRate}%</b></span></div>
      </Panel>
    </div>
    <div className="portal-two-column">
      <Panel title="Ứng tuyển theo trạng thái"><div className="funnel-bars">{funnel.map((item) => <div key={item.status}><span>{item.label}</span><div><i style={{ width: `${item.width}%` }} /></div><strong>{item.count}</strong></div>)}</div></Panel>
      <Panel title="Doanh nghiệp hoạt động"><div className="rank-list">{data.topCompanies.length ? data.topCompanies.map((company, index) => <div key={company.companyId}><span>{index + 1}</span><div><strong>{company.companyName}</strong><small>{company.recruitingJobs} vị trí đang tuyển</small></div><b>{company.applications} hồ sơ</b></div>) : <Empty title="Chưa có dữ liệu" text="Số liệu sẽ xuất hiện khi có tin và đơn ứng tuyển." />}</div></Panel>
    </div>
  </>;
}

export function LiveCompanyDashboard({ navigate }) {
  const state = useLiveDashboard("/companies/me/dashboard");
  const data = state.data;
  if (!data) return <DashboardState {...state} />;

  return <>
    <div className="metric-grid four">
      <MetricCard label="Tin đang tuyển" value={data.metrics.recruitingJobs} helper={`${data.metrics.pendingJobReviews} tin chờ UIT duyệt`} Icon={Briefcase} />
      <MetricCard label="Hồ sơ mới từ UIT" value={data.metrics.newCandidates} helper="Chưa bắt đầu sàng lọc" Icon={Users} tone="amber" />
      <MetricCard label="Phỏng vấn tuần này" value={data.metrics.interviewsThisWeek} helper="Theo lịch hiện tại" Icon={CalendarCheck} tone="purple" />
      <MetricCard label="Ứng viên đã nhận" value={data.metrics.hiresThisMonth} helper="Đã xác nhận trong tháng" Icon={UserCheck} tone="green" />
    </div>
    <div className="portal-two-column wide-left">
      <Panel title="Ứng viên cần xử lý" action={<button className="link-button" onClick={() => navigate("company-candidates")}>Xem tất cả <ArrowRight /></button>}>
        {data.recentCandidates.length ? <div className="candidate-quick-list">{data.recentCandidates.map((candidate) => <button key={candidate.applicationId} onClick={() => navigate("company-candidates")}><span className="candidate-initials">{candidate.studentName.split(" ").slice(-2).map((part) => part[0]).join("")}</span><div><strong>{candidate.studentName}</strong><small>{candidate.jobTitle} · GPA {candidate.gpa ?? "—"}</small></div><Status tone={candidate.status === "FORWARDED_TO_COMPANY" ? "info" : "warning"}>{applicationStatusCopy[candidate.status] || candidate.status}</Status><ArrowRight /></button>)}</div> : <Empty title="Không có ứng viên chờ xử lý" text="Hồ sơ mới do UIT chuyển sẽ xuất hiện tại đây." />}
      </Panel>
      <Panel title="Hạn xử lý">
        <div className={`sla-card ${data.actionQueue.overdueCandidates ? "urgent" : "success"}`}><ClockCountdown /><div><strong>{data.actionQueue.overdueCandidates} hồ sơ quá 48 giờ</strong><p>{data.actionQueue.overdueCandidates ? "Cần ưu tiên xử lý để không ảnh hưởng ứng viên." : "Các hồ sơ đang nằm trong thời hạn xử lý."}</p></div></div>
        <div className={`sla-card ${data.actionQueue.revisionRequiredJobs ? "warning" : "success"}`}><Warning /><div><strong>{data.actionQueue.revisionRequiredJobs} tin cần chỉnh sửa</strong><p>{data.actionQueue.revisionRequiredJobs ? "UIT đã gửi yêu cầu cập nhật nội dung." : "Không có yêu cầu chỉnh sửa đang chờ."}</p></div></div>
        <button className="secondary-button full" onClick={() => navigate("company-notifications")}>Xem tất cả việc cần làm</button>
      </Panel>
    </div>
    <Panel title="Hiệu quả tin đang tuyển">
      {data.jobPerformance.length ? <div className="simple-table company-job-summary"><div className="table-head"><span>Vị trí</span><span>Ứng tuyển</span><span>UIT chuyển đến</span><span>Phỏng vấn</span><span>Nhận việc</span><span /></div>{data.jobPerformance.map((job) => <button key={job.jobId} onClick={() => navigate("company-jobs")}><strong>{job.title}</strong><span>{job.applications}</span><span>{job.forwarded}</span><span>{job.interviews}</span><span>{job.hires}</span><ArrowRight /></button>)}</div> : <Empty title="Chưa có tin đang tuyển" text="Tin được UIT duyệt sẽ có số liệu tại đây." />}
    </Panel>
  </>;
}
