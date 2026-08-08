import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpenText,
  Briefcase,
  Buildings,
  CalendarBlank,
  CalendarCheck,
  CaretDown,
  ChartBar,
  Check,
  CheckCircle,
  ClipboardText,
  Clock,
  ClockCountdown,
  CircleNotch,
  Database,
  DotsThree,
  DownloadSimple,
  Envelope,
  Eye,
  FileText,
  FunnelSimple,
  Gear,
  GraduationCap,
  House,
  Info,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  Megaphone,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  SealCheck,
  ShieldCheck,
  SignOut,
  SuitcaseSimple,
  TrendUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useAuth } from "./auth/AuthContext.jsx";
import {
  AdminCompanyManagement,
  CompanyCreatePartnerModal,
  CompanyProfileManagement,
} from "./companies/CompanyManagement.jsx";
import { NotificationInbox } from "./notifications/NotificationInbox.jsx";
import { useNotifications } from "./notifications/NotificationContext.jsx";
import {
  LiveAdminDashboard,
  LiveCompanyDashboard,
  LiveStudentDashboard,
} from "./dashboard/LiveDashboards.jsx";

const jobStatusCopy = {
  DRAFT: ["Bản nháp", "neutral"],
  PENDING_UIT_REVIEW: ["Chờ UIT duyệt", "warning"],
  REVISION_REQUIRED: ["Cần chỉnh sửa", "urgent"],
  RECRUITING: ["Đang tuyển", "success"],
  PAUSED: ["Tạm dừng", "neutral"],
  EXPIRED: ["Hết hạn", "neutral"],
  REJECTED: ["Đã từ chối", "urgent"],
  CLOSED: ["Đã đóng", "neutral"],
};

const opportunityCopy = {
  INTERNSHIP: "Thực tập",
  PART_TIME: "Bán thời gian",
  FULL_TIME: "Toàn thời gian",
  FRESHER: "Fresher",
};

const workModeCopy = { ONSITE: "Tại văn phòng", REMOTE: "Từ xa", HYBRID: "Kết hợp" };
const dateFormatter = new Intl.DateTimeFormat("vi-VN");

function formatDate(value) {
  if (!value) return "—";
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatSubmitted(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getApiError(error) {
  return error?.message || "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
}

const studentNavigation = [
  ["dashboard", "Tổng quan", House],
  ["jobs", "Việc làm", Briefcase],
  ["companies", "Doanh nghiệp", Buildings],
  ["applications", "Đơn ứng tuyển", FileText],
  ["profile", "Hồ sơ & CV", User],
  ["interviews", "Lịch phỏng vấn", CalendarBlank],
  ["notifications", "Thông báo", Bell],
];

const adminNavigation = [
  ["admin-dashboard", "Tổng quan", House],
  ["admin-companies", "Doanh nghiệp đối tác", Buildings],
  ["admin-jobs", "Duyệt tin tuyển dụng", Briefcase],
  ["admin-applications", "Duyệt hồ sơ sinh viên", UserCheck],
  ["admin-placements", "Theo dõi kết quả", GraduationCap],
  ["admin-scheduler", "Nhắc việc & tác vụ", ClockCountdown],
  ["admin-notifications", "Thông báo", Bell],
  ["admin-reports", "Báo cáo", ChartBar],
  ["admin-access", "Tài khoản & nhật ký", ShieldCheck],
];

const companyNavigation = [
  ["company-dashboard", "Tổng quan", House],
  ["company-profile", "Hồ sơ doanh nghiệp", Buildings],
  ["company-jobs", "Tin tuyển dụng", Briefcase],
  ["company-candidates", "Ứng viên", Users],
  ["company-interviews", "Lịch phỏng vấn", CalendarCheck],
  ["company-notifications", "Thông báo", Bell],
];

const portalCopy = {
  student: { label: "Sinh viên", name: "Nguyễn Minh Khoa", meta: "MSSV 20521067 · K24", initials: "NK" },
  admin: { label: "Bộ phận phụ trách UIT", name: "Trần Hoàng Anh", meta: "Phòng Quan hệ Doanh nghiệp", initials: "HA" },
  company: { label: "Doanh nghiệp đối tác", name: "Lê Thu Hà", meta: "VNG Corporation · Recruiter", initials: "TH" },
};

const reviewJobs = [
  { id: 1, role: "Backend Developer Intern", company: "VNG Corporation", major: "Kỹ thuật phần mềm", deadline: "18/08/2026", submitted: "2 giờ trước", status: "Chờ duyệt" },
  { id: 2, role: "Data Engineer Intern", company: "FPT Software", major: "Khoa học dữ liệu", deadline: "22/08/2026", submitted: "5 giờ trước", status: "Chờ duyệt" },
  { id: 3, role: "Frontend Fresher", company: "NashTech Vietnam", major: "Hệ thống thông tin", deadline: "25/08/2026", submitted: "Hôm qua", status: "Cần xem lại" },
];

const reviewApplications = [
  { id: 1, student: "Nguyễn Minh Khoa", mssv: "20521067", role: "Backend Developer Intern", company: "VNG", gpa: "3.42/4", submitted: "04/08/2026", issue: "Đủ hồ sơ" },
  { id: 2, student: "Phạm Gia Huy", mssv: "21520881", role: "Data Engineer Intern", company: "FPT Software", gpa: "3.18/4", submitted: "04/08/2026", issue: "Thiếu bảng điểm" },
  { id: 3, student: "Trần Khánh Linh", mssv: "21520943", role: "Product Intern", company: "MoMo", gpa: "3.67/4", submitted: "03/08/2026", issue: "Đủ hồ sơ" },
];

const companyJobs = [
  { id: 1, title: "Backend Developer Intern", type: "Thực tập", applications: 28, forwarded: 14, status: "Đang tuyển", deadline: "18/08/2026" },
  { id: 2, title: "Product Analyst Intern", type: "Thực tập", applications: 16, forwarded: 9, status: "Đang tuyển", deadline: "24/08/2026" },
  { id: 3, title: "QA Engineer Fresher", type: "Toàn thời gian", applications: 0, forwarded: 0, status: "Chờ UIT duyệt", deadline: "30/08/2026" },
  { id: 4, title: "DevOps Intern", type: "Thực tập", applications: 41, forwarded: 31, status: "Đã đóng", deadline: "30/07/2026" },
];

const candidates = [
  { id: 1, name: "Nguyễn Minh Khoa", major: "Kỹ thuật phần mềm", gpa: "3.42", role: "Backend Intern", stage: "new" },
  { id: 2, name: "Lê Thành Đạt", major: "Mạng máy tính", gpa: "3.36", role: "Backend Intern", stage: "new" },
  { id: 3, name: "Trần Khánh Linh", major: "Hệ thống thông tin", gpa: "3.67", role: "Product Intern", stage: "screening" },
  { id: 4, name: "Võ Minh Anh", major: "Khoa học máy tính", gpa: "3.51", role: "Backend Intern", stage: "interview" },
  { id: 5, name: "Phạm Gia Huy", major: "Khoa học dữ liệu", gpa: "3.18", role: "Product Intern", stage: "result" },
];

function Brand({ inverse = false }) {
  return <div className={`portal-brand ${inverse ? "inverse" : ""}`}><span><SealCheck size={27} weight="duotone" /></span><div><strong>UIT Career Hub</strong><small>Kết nối tri thức · Dẫn lối sự nghiệp</small></div></div>;
}

function userInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "UIT";
}

export function PrototypeRoleSwitcher({ role, onChange }) {
  return (
    <div className="prototype-switcher" aria-label="Chuyển vai trò trong prototype">
      <small>CHẾ ĐỘ XEM MẪU</small>
      <div>
        {[['student', 'Sinh viên'], ['admin', 'UIT Admin'], ['company', 'Doanh nghiệp']].map(([value, label]) => (
          <button key={value} className={role === value ? "active" : ""} onClick={() => onChange(value)}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function WorkspaceShell({ role, route, navigate, children, title, description, actions, user, onLogout }) {
  const { unreadCount } = useNotifications();
  const fallbackIdentity = portalCopy[role];
  const identity = {
    ...fallbackIdentity,
    name: user?.displayName || fallbackIdentity.name,
    meta: user?.organization || user?.email || fallbackIdentity.meta,
    initials: userInitials(user?.displayName || fallbackIdentity.name),
  };
  const navigation = role === "admin" ? adminNavigation : role === "company" ? companyNavigation : studentNavigation;
  const notificationKey = role === "admin" ? "admin-notifications" : role === "company" ? "company-notifications" : "notifications";
  return (
    <div className={`workspace-shell role-${role}`}>
      <aside className="workspace-sidebar">
        <Brand inverse />
        <div className="workspace-role"><small>KHÔNG GIAN LÀM VIỆC</small><strong>{identity.label}</strong></div>
        <nav>{navigation.map(([key, label, Icon, count]) => { const displayCount = key === notificationKey ? unreadCount : count; return <button key={key} className={route === key ? "active" : ""} onClick={() => navigate(key)}><Icon size={20} /><span>{label}</span>{displayCount ? <i>{displayCount > 99 ? "99+" : displayCount}</i> : null}</button>; })}</nav>
        <div className="workspace-identity"><span>{identity.initials}</span><div><strong>{identity.name}</strong><small>{identity.meta}</small></div><button aria-label="Đăng xuất" onClick={onLogout}><SignOut size={19} /></button></div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <div><span>UIT Career Hub</span><ArrowRight size={13} /><strong>{title}</strong></div>
          <div className="workspace-top-actions"><label><MagnifyingGlass size={18} /><input placeholder="Tìm nhanh..." /></label><button className="icon-button notification-bell" aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`} onClick={() => navigate(notificationKey)}><Bell size={20} />{unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}</button><button className="workspace-avatar">{identity.initials}</button></div>
        </header>
        <section className="workspace-page-header"><div><p className="eyebrow">{identity.label.toUpperCase()}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</section>
        <div className="workspace-page">{children}</div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, helper, Icon, tone = "blue" }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon"><Icon size={22} weight="duotone" /></span><div><small>{label}</small><strong>{value}</strong><p>{helper}</p></div></article>;
}

function Status({ children, tone = "neutral" }) {
  return <span className={`portal-status ${tone}`}>{children}</span>;
}

function Panel({ title, action, children, className = "" }) {
  return <section className={`portal-panel ${className}`}><header><h2>{title}</h2>{action}</header>{children}</section>;
}

function EmptyHint({ icon: Icon = Info, title, text }) {
  return <div className="empty-hint"><Icon size={30} /><strong>{title}</strong><p>{text}</p></div>;
}

export function StudentExtraScreen({ route, navigate, user, onLogout }) {
  const titles = {
    dashboard: ["Tổng quan", "Thông tin quan trọng và bước tiếp theo trong hành trình nghề nghiệp của bạn."],
    companies: ["Doanh nghiệp đối tác", "Khám phá các doanh nghiệp đã được UIT xác thực và đang hợp tác tuyển dụng."],
    profile: ["Hồ sơ & CV", "Quản lý hồ sơ dùng cho quy trình UIT kiểm duyệt và chuyển đến doanh nghiệp."],
    interviews: ["Lịch phỏng vấn", "Theo dõi lịch hẹn, hình thức và kết quả phỏng vấn của bạn."],
    notifications: ["Thông báo", "Các cập nhật từ UIT, doanh nghiệp và hệ thống."],
  };
  const [title, description] = titles[route] || titles.dashboard;
  return (
    <WorkspaceShell role="student" route={route} navigate={navigate} title={title} description={description} user={user} onLogout={onLogout} actions={route === "dashboard" ? <button className="primary-button" onClick={() => navigate("jobs")}><MagnifyingGlass size={18} />Tìm việc ngay</button> : null}>
      {route === "dashboard" && <LiveStudentDashboard navigate={navigate} />}
      {route === "companies" && <CompaniesScreen navigate={navigate} />}
      {route === "profile" && <ProfileScreen />}
      {route === "interviews" && <LiveInterviewsScreen />}
      {route === "notifications" && <StudentNotifications navigate={navigate} />}
    </WorkspaceShell>
  );
}

function StudentDashboard({ navigate }) {
  return <>
    <div className="metric-grid four"><MetricCard label="Hồ sơ hoàn thiện" value="85%" helper="Còn thiếu bảng điểm" Icon={User} /><MetricCard label="Đơn đang xử lý" value="3" helper="1 đơn chờ UIT duyệt" Icon={FileText} tone="amber" /><MetricCard label="Lịch phỏng vấn" value="1" helper="07/08 · FPT Software" Icon={CalendarCheck} tone="green" /><MetricCard label="Việc đã lưu" value="4" helper="2 việc sắp hết hạn" Icon={BookOpenText} tone="purple" /></div>
    <div className="portal-two-column wide-left">
      <Panel title="Việc bạn cần làm" action={<button className="link-button">Xem tất cả</button>}>
        <div className="todo-list"><button onClick={() => navigate("profile")}><span className="todo-warning"><Warning size={20} /></span><div><strong>Bổ sung bảng điểm có xác nhận</strong><small>Cần hoàn tất trước khi UIT duyệt hồ sơ VNG</small></div><Status tone="urgent">Trước 06/08</Status><ArrowRight size={18} /></button><button onClick={() => navigate("interviews")}><span className="todo-blue"><CalendarCheck size={20} /></span><div><strong>Xác nhận lịch phỏng vấn FPT Software</strong><small>Google Meet · 09:30 ngày 07/08/2026</small></div><Status tone="info">Chờ xác nhận</Status><ArrowRight size={18} /></button><button><span className="todo-green"><CheckCircle size={20} /></span><div><strong>Hồ sơ MoMo đã được chuyển doanh nghiệp</strong><small>Bạn chưa cần thực hiện thêm thao tác</small></div><Status tone="success">Hoàn tất</Status><ArrowRight size={18} /></button></div>
      </Panel>
      <Panel title="Tiến trình gần nhất">
        <div className="mini-timeline"><div className="done"><span><Check /></span><div><strong>Đã nộp hồ sơ VNG</strong><small>04/08/2026 · 14:20</small></div></div><div className="current"><span>2</span><div><strong>UIT đang kiểm duyệt</strong><small>Dự kiến hoàn tất trước 06/08</small></div></div><div><span>3</span><div><strong>Chuyển đến doanh nghiệp</strong><small>Chưa bắt đầu</small></div></div></div>
      </Panel>
    </div>
    <Panel title="Cơ hội phù hợp với hồ sơ" action={<button className="link-button" onClick={() => navigate("jobs")}>Xem tất cả <ArrowRight size={15} /></button>}>
      <div className="simple-table opportunities"><div className="table-head"><span>Vị trí</span><span>Doanh nghiệp</span><span>Phù hợp</span><span>Hạn nộp</span><span /></div>{[["Backend Developer Intern","VNG Corporation","92%","18/08/2026"],["Software Engineer Intern","FPT Software","87%","22/08/2026"],["Frontend Fresher","NashTech Vietnam","81%","25/08/2026"]].map(row => <button key={row[0]} onClick={() => navigate("jobs")}><strong>{row[0]}</strong><span>{row[1]}</span><span><Status tone="success">{row[2]}</Status></span><span>{row[3]}</span><ArrowRight size={17} /></button>)}</div>
    </Panel>
  </>;
}

function CompanyDirectoryModal({ company, onClose, onViewJobs }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal company-directory-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose}><X /></button><div className="company-directory-heading"><div className="company-logo directory-logo">{company.code.slice(0, 3)}</div><div><Status tone="success"><SealCheck size={14} weight="fill" />Đối tác UIT</Status><h2>{company.name}</h2><p>{company.code} · {company.industry || "Chưa cập nhật lĩnh vực"}</p></div></div><p className="company-directory-description">{company.description || "Doanh nghiệp chưa cập nhật phần giới thiệu."}</p><div className="company-directory-details"><div><small>Lĩnh vực</small><strong>{company.industry || "Chưa cập nhật"}</strong></div><div><small>Quy mô</small><strong>{company.companySize || "Chưa cập nhật"}</strong></div><div><small>Địa chỉ</small><strong>{company.address || "Chưa cập nhật"}</strong></div><div><small>Cơ hội đang tuyển</small><strong>{company.recruitingJobCount} tin còn hạn</strong></div></div><div className="modal-actions split-actions">{company.website ? <a className="secondary-button" href={company.website} target="_blank" rel="noreferrer">Website doanh nghiệp <ArrowRight /></a> : <span />}<button className="primary-button" disabled={!company.recruitingJobCount} onClick={onViewJobs}><Briefcase />{company.recruitingJobCount ? `Xem ${company.recruitingJobCount} cơ hội` : "Chưa có tin đang tuyển"}</button></div></div></div>;
}

function CompaniesScreen({ navigate }) {
  const { authorizedRequest } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [recruitingOnly, setRecruitingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    authorizedRequest("/companies?page=1&pageSize=100")
      .then(response => { if (!ignore) setCompanies(response.data); })
      .catch(requestError => { if (!ignore) setError(getApiError(requestError)); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [authorizedRequest, refreshKey]);

  const industries = useMemo(() => [...new Set(companies.map(company => company.industry).filter(Boolean))].sort((left, right) => left.localeCompare(right, "vi")), [companies]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return companies.filter(company => {
      const matchesQuery = !normalizedQuery || `${company.name} ${company.code} ${company.industry || ""} ${company.address || ""}`.toLocaleLowerCase("vi").includes(normalizedQuery);
      return matchesQuery && (!industry || company.industry === industry) && (!recruitingOnly || company.recruitingJobCount > 0);
    });
  }, [companies, query, industry, recruitingOnly]);

  const openCompany = async company => {
    setBusyId(company.id);
    setError("");
    try {
      const response = await authorizedRequest(`/companies/${company.id}`);
      setSelected(response.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyId("");
    }
  };

  if (loading) return <div className="portal-loading"><CircleNotch className="spin" />Đang tải doanh nghiệp đối tác...</div>;
  return <><div className="portal-toolbar company-directory-toolbar"><label className="portal-search"><MagnifyingGlass size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, mã, lĩnh vực hoặc địa chỉ" /></label><label className="directory-filter"><FunnelSimple size={18} /><span>Lĩnh vực</span><select value={industry} onChange={event => setIndustry(event.target.value)}><option value="">Tất cả</option>{industries.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="directory-check"><input type="checkbox" checked={recruitingOnly} onChange={event => setRecruitingOnly(event.target.checked)} /><Briefcase />Đang tuyển</label></div>{error && <p className="review-error"><Warning />{error}<button className="link-button" onClick={() => setRefreshKey(value => value + 1)}>Thử lại</button></p>}<div className="directory-result-line"><span>{filtered.length} doanh nghiệp đối tác phù hợp</span>{(query || industry || recruitingOnly) && <button className="link-button" onClick={() => { setQuery(""); setIndustry(""); setRecruitingOnly(false); }}>Xóa bộ lọc</button>}</div><div className="company-card-grid live-company-directory">{filtered.length ? filtered.map(company => <article key={company.id} className="company-card"><div className="company-logo directory-logo">{company.code.slice(0, 3)}</div><Status tone="success"><SealCheck size={14} weight="fill" /> Đối tác UIT</Status><h2>{company.name}</h2><p>{company.industry || "Chưa cập nhật lĩnh vực"}</p><div><span><Briefcase size={17} />{company.recruitingJobCount} tin đang tuyển</span><span><MapPin size={17} />{company.address || "Chưa cập nhật địa chỉ"}</span></div><button className="secondary-button" disabled={busyId === company.id} onClick={() => void openCompany(company)}>{busyId === company.id ? <CircleNotch className="spin" /> : null}Xem doanh nghiệp <ArrowRight size={16} /></button></article>) : <div className="directory-empty"><Buildings size={38} /><strong>Không tìm thấy doanh nghiệp phù hợp</strong><span>Hãy thử từ khóa hoặc bộ lọc khác.</span></div>}</div>{selected && <CompanyDirectoryModal company={selected} onClose={() => setSelected(null)} onViewJobs={() => navigate("jobs", { companyId: selected.id, companyName: selected.name })} />}</>;
}

const profileDocumentCopy = {
  CV: "CV ứng tuyển",
  TRANSCRIPT: "Bảng điểm có xác nhận",
  STUDENT_CONFIRMATION: "Giấy xác nhận sinh viên",
  OTHER: "Tài liệu khác",
};

const documentVerificationCopy = {
  VERIFIED: ["Đã xác minh", "success"],
  PENDING: ["Chờ xác minh", "warning"],
  REJECTED: ["Bị từ chối", "urgent"],
};

const academicStatusCopy = {
  ACTIVE: ["Đang học", "success"],
  SUSPENDED: ["Tạm đình chỉ", "warning"],
  GRADUATED: ["Đã tốt nghiệp", "info"],
  INACTIVE: ["Không hoạt động", "neutral"],
};

function formatDocumentSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProfilePhoneModal({ profile, busy, error, onClose, onSave }) {
  const [phone, setPhone] = useState(profile.phone || "");
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal profile-phone-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button><span className="modal-icon"><User /></span><h2>Cập nhật thông tin bổ sung</h2><p>Thông tin học tập do UIT quản lý. Sinh viên chỉ có thể bổ sung số điện thoại liên hệ ở giai đoạn hiện tại.</p><div className="modal-form"><label><span>Số điện thoại</span><input autoFocus value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} placeholder="Ví dụ: 0912 345 678" /></label></div>{error && <p className="form-error"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className="primary-button" onClick={() => onSave(phone.trim() || null)} disabled={busy}>{busy ? <><CircleNotch className="spin" />Đang lưu</> : "Lưu thay đổi"}</button></div></div></div>;
}

function ProfileDocumentCard({ document, busy, onSetDefault }) {
  const verification = documentVerificationCopy[document.verificationStatus] || [document.verificationStatus, "neutral"];
  const canSetDefault = document.documentType === "CV" && document.verificationStatus === "VERIFIED" && !document.isDefault;
  return <article><FileText size={28} className={document.verificationStatus === "VERIFIED" ? "green" : ""} /><div><strong>{document.fileName}</strong><small>{profileDocumentCopy[document.documentType] || document.documentType} · Phiên bản {document.version} · {formatDocumentSize(document.fileSizeBytes)} · {formatSubmitted(document.createdAt)}</small></div>{document.isDefault ? <Status tone="info">Mặc định</Status> : <Status tone={verification[1]}>{verification[0]}</Status>}{canSetDefault ? <button className="document-default-button" disabled={busy} onClick={() => onSetDefault(document)}>{busy ? <CircleNotch className="spin" /> : <Check />}Đặt mặc định</button> : null}</article>;
}

function MissingProfileDocument({ type }) {
  return <article className="missing-document"><Warning size={27} /><div><strong>{profileDocumentCopy[type]}</strong><small>Chưa có tài liệu trong hồ sơ</small></div><Status tone="urgent">Cần bổ sung</Status></article>;
}

function ProfileScreen() {
  const { authorizedRequest } = useAuth();
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    Promise.all([
      authorizedRequest("/students/me"),
      authorizedRequest("/students/me/documents"),
    ])
      .then(([profileResponse, documentResponse]) => {
        if (!ignore) {
          setProfile(profileResponse.data);
          setDocuments(documentResponse.data);
        }
      })
      .catch(requestError => { if (!ignore) setError(getApiError(requestError)); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [authorizedRequest, refreshKey]);

  const verifiedTypes = new Set(documents.filter(document => document.verificationStatus === "VERIFIED").map(document => document.documentType));
  const hasDefaultCv = documents.some(document => document.documentType === "CV" && document.isDefault && document.verificationStatus === "VERIFIED");
  const completion = profile
    ? 25 + (profile.phone ? 10 : 0) + (profile.gpa !== null ? 10 : 0) + (hasDefaultCv ? 30 : 0) + (verifiedTypes.has("TRANSCRIPT") ? 15 : 0) + (verifiedTypes.has("STUDENT_CONFIRMATION") ? 10 : 0)
    : 0;
  const cvDocuments = documents.filter(document => document.documentType === "CV");
  const verificationDocuments = documents.filter(document => document.documentType !== "CV");
  const academicStatus = academicStatusCopy[profile?.academicStatus] || [profile?.academicStatus || "—", "neutral"];

  const savePhone = async phone => {
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest("/students/me", {
        method: "PATCH",
        body: JSON.stringify({ phone }),
      });
      setProfile(response.data);
      setEditing(false);
      setMessage("Đã cập nhật số điện thoại và ghi nhận lịch sử thay đổi.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const setDefaultCv = async document => {
    setBusyDocumentId(document.id);
    setError("");
    setMessage("");
    try {
      const response = await authorizedRequest(`/students/me/documents/${document.id}/default`, { method: "POST" });
      setDocuments(response.data);
      setMessage(`Đã chọn “${document.fileName}” làm CV mặc định.`);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyDocumentId("");
    }
  };

  if (loading) return <div className="portal-loading"><CircleNotch className="spin" />Đang tải hồ sơ sinh viên...</div>;
  if (!profile) return <div className="portal-error"><Warning />{error || "Không tìm thấy hồ sơ sinh viên."}<button className="secondary-button small" onClick={() => setRefreshKey(value => value + 1)}>Thử lại</button></div>;
  return <>{message && <div className="toast"><CheckCircle weight="fill" />{message}</div>}{error && !editing && <p className="review-error"><Warning />{error}</p>}<div className="profile-layout"><aside className="profile-summary-card"><div className="large-avatar">{userInitials(profile.fullName)}</div><h2>{profile.fullName}</h2><p>{profile.email}</p><div className="profile-progress"><div><span style={{ width: `${completion}%` }} /></div><strong>{completion}% hoàn thiện</strong></div><ul><li className="done"><CheckCircle />Thông tin UIT</li><li className={profile.phone ? "done" : "current"}>{profile.phone ? <CheckCircle /> : <Warning />}Số điện thoại</li><li className={hasDefaultCv ? "done" : "current"}>{hasDefaultCv ? <CheckCircle /> : <Warning />}CV mặc định đã xác minh</li><li className={verifiedTypes.has("TRANSCRIPT") ? "done" : "current"}>{verifiedTypes.has("TRANSCRIPT") ? <CheckCircle /> : <Warning />}Bảng điểm</li><li className={verifiedTypes.has("STUDENT_CONFIRMATION") ? "done" : "current"}>{verifiedTypes.has("STUDENT_CONFIRMATION") ? <CheckCircle /> : <Warning />}Giấy xác nhận</li></ul></aside><div className="profile-content"><Panel title="Thông tin học tập" action={<button className="secondary-button small" onClick={() => { setError(""); setEditing(true); }}><PencilSimple size={16} />Cập nhật bổ sung</button>}><div className="detail-grid"><div><small>Họ và tên</small><strong>{profile.fullName}</strong></div><div><small>Mã số sinh viên</small><strong>{profile.studentCode}</strong></div><div><small>Khoa</small><strong>{profile.faculty}</strong></div><div><small>Ngành</small><strong>{profile.major}</strong></div><div><small>Khóa</small><strong>{profile.cohort}</strong></div><div><small>GPA</small><strong>{profile.gpa === null ? "Chưa cập nhật" : `${profile.gpa} / 4.0`}</strong></div><div><small>Số điện thoại</small><strong>{profile.phone || "Chưa bổ sung"}</strong></div><div><small>Email UIT</small><strong>{profile.email}</strong></div><div><small>Tình trạng</small><Status tone={academicStatus[1]}>{academicStatus[0]}</Status></div></div></Panel><Panel title={`CV của tôi (${cvDocuments.length})`} action={<button className="secondary-button small" disabled title="Cần tích hợp Object Storage trước khi mở chức năng tải tệp"><Plus size={16} />Thêm CV · phase sau</button>}><div className="document-cards">{cvDocuments.length ? cvDocuments.map(document => <ProfileDocumentCard key={document.id} document={document} busy={busyDocumentId === document.id} onSetDefault={item => void setDefaultCv(item)} />) : <EmptyHint icon={FileText} title="Chưa có CV" text="Chức năng tải tệp sẽ được mở sau khi tích hợp Object Storage." />}</div></Panel><Panel title="Tài liệu xác minh"><div className="document-cards">{verificationDocuments.map(document => <ProfileDocumentCard key={document.id} document={document} busy={false} onSetDefault={() => undefined} />)}{!documents.some(document => document.documentType === "TRANSCRIPT") && <MissingProfileDocument type="TRANSCRIPT" />}{!documents.some(document => document.documentType === "STUDENT_CONFIRMATION") && <MissingProfileDocument type="STUDENT_CONFIRMATION" />}</div><div className="profile-storage-note"><Database size={18} /><span><strong>Upload file chưa mở ở phase hiện tại</strong><small>Cần kết nối Object Storage và cơ chế URL ký trước; giao diện không giả lập việc tải tệp thành công.</small></span><button className="secondary-button small" onClick={() => setRefreshKey(value => value + 1)}><ListBullets />Tải lại dữ liệu</button></div></Panel></div></div>{editing && <ProfilePhoneModal profile={profile} busy={busy} error={error} onClose={() => { if (!busy) { setEditing(false); setError(""); } }} onSave={phone => void savePhone(phone)} />}</>;
}

const activeInterviewStatuses = new Set(["PENDING_STUDENT_CONFIRMATION", "CONFIRMED", "RESCHEDULE_REQUESTED"]);
const interviewStatusCopy = {
  PENDING_STUDENT_CONFIRMATION: ["Cần xác nhận", "urgent"],
  CONFIRMED: ["Đã xác nhận", "success"],
  RESCHEDULE_REQUESTED: ["Đang đổi lịch", "warning"],
  CANCELLED: ["Đã hủy", "urgent"],
  COMPLETED: ["Đã hoàn tất", "neutral"],
  NO_SHOW: ["Vắng mặt", "urgent"],
};
const interviewModeCopy = { ONLINE: "Trực tuyến", ONSITE: "Tại văn phòng", PHONE: "Điện thoại" };

function interviewTiming(value) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat("vi-VN", { day: "2-digit" }).format(date),
    month: `THÁNG ${new Intl.DateTimeFormat("vi-VN", { month: "2-digit" }).format(date)}`,
    time: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date),
    date: new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(date),
  };
}

function isUpcomingInterview(interview) {
  return activeInterviewStatuses.has(interview.status) && new Date(interview.scheduledAt).getTime() >= Date.now();
}

function interviewPlace(interview) {
  if (interview.mode === "ONLINE") return interview.meetingUrl ? "Liên kết họp trực tuyến" : "Trực tuyến";
  if (interview.mode === "PHONE") return "Phỏng vấn qua điện thoại";
  return interview.location || "Doanh nghiệp sẽ cập nhật địa điểm";
}

function InterviewCancelModal({ interview, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button><span className="modal-icon danger"><Warning /></span><h2>Hủy tham gia phỏng vấn</h2><p>Đơn ứng tuyển <strong>{interview.job.title}</strong> sẽ được chuyển sang trạng thái đã rút. Lý do được gửi đến doanh nghiệp và lưu trong lịch sử.</p><div className="modal-form"><label><span>Lý do hủy *</span><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder="Ví dụ: Tôi đã nhận một cơ hội khác và không thể tham gia lịch phỏng vấn này." /></label></div>{error && <p className="form-error"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Quay lại</button><button className="primary-button danger-fill" disabled={busy || note.trim().length < 5} onClick={() => onSubmit(note.trim())}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : "Xác nhận hủy"}</button></div></div></div>;
}

function LiveInterviewsScreen() {
  const { authorizedRequest } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    authorizedRequest("/students/me/interviews?page=1&pageSize=100&scope=all")
      .then(response => { if (!ignore) setInterviews(response.data); })
      .catch(requestError => { if (!ignore) setError(getApiError(requestError)); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [authorizedRequest, refreshKey]);

  const upcoming = interviews.filter(isUpcomingInterview);
  const history = interviews.filter(interview => !isUpcomingInterview(interview));

  const confirm = async interview => {
    setBusyId(interview.id);
    setError("");
    setMessage("");
    try {
      const response = await authorizedRequest(`/students/me/interviews/${interview.id}/confirm`, { method: "POST" });
      setInterviews(items => items.map(item => item.id === interview.id ? response.data : item));
      setMessage("Đã xác nhận tham gia phỏng vấn. Doanh nghiệp đã nhận được thông báo.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyId("");
    }
  };

  const cancel = async note => {
    const interview = cancelTarget;
    setBusyId(interview.id);
    setError("");
    try {
      await authorizedRequest(`/applications/${interview.applicationId}/cancel-interview`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ reasonCode: "STUDENT_CANCELLED_INTERVIEW", note }),
      });
      setCancelTarget(null);
      setMessage("Đã hủy tham gia và ghi nhận lý do trong lịch sử đơn ứng tuyển.");
      setRefreshKey(value => value + 1);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyId("");
    }
  };

  if (loading) return <div className="portal-loading"><CircleNotch className="spin" />Đang tải lịch phỏng vấn...</div>;
  return <><>{message && <div className="toast"><CheckCircle weight="fill" />{message}</div>}</>{error && !cancelTarget && <p className="review-error"><Warning />{error}</p>}<div className="portal-two-column wide-left"><div><Panel title={`Sắp tới (${upcoming.length})`}><div className="live-interview-list">{upcoming.length === 0 ? <EmptyHint icon={CalendarBlank} title="Chưa có lịch sắp tới" text="Lời mời mới từ doanh nghiệp sẽ xuất hiện tại đây." /> : upcoming.map(interview => { const timing = interviewTiming(interview.scheduledAt); const status = interviewStatusCopy[interview.status] || [interview.status, "neutral"]; const busy = busyId === interview.id; return <article className="interview-card" key={interview.id}><div className="calendar-tile"><strong>{timing.day}</strong><small>{timing.month}</small></div><div className="interview-main"><Status tone={status[1]}>{status[0]}</Status><h2>Phỏng vấn {interview.job.title}</h2><p>{interview.job.company.name} · {interviewModeCopy[interview.mode] || interview.mode}</p><div><span><Clock size={18} />{timing.time} · {timing.date}</span><span><MapPin size={18} />{interviewPlace(interview)}</span><span><User size={18} />{interview.interviewerName || "Nhà tuyển dụng"}</span></div></div><div className="interview-actions">{interview.status === "PENDING_STUDENT_CONFIRMATION" ? <button className="primary-button" disabled={busy} onClick={() => void confirm(interview)}>{busy ? <CircleNotch className="spin" /> : <Check size={17} />}Xác nhận tham gia</button> : interview.meetingUrl ? <a className="primary-button" href={interview.meetingUrl} target="_blank" rel="noreferrer"><ArrowRight size={17} />Mở liên kết họp</a> : <button className="primary-button" disabled><Check size={17} />Đã xác nhận</button>}<button className="secondary-button" disabled={busy} onClick={() => { setError(""); setCancelTarget(interview); }}>Không thể tham gia</button></div></article>; })}</div></Panel><Panel title="Lịch sử phỏng vấn"><div className="simple-table interview-history"><div className="table-head"><span>Vị trí</span><span>Doanh nghiệp</span><span>Ngày phỏng vấn</span><span>Kết quả</span></div>{history.length === 0 ? <EmptyHint icon={CalendarCheck} title="Chưa có lịch sử" text="Các lịch đã hoàn tất hoặc bị hủy sẽ được lưu tại đây." /> : history.map(interview => { const result = interview.recruitmentResult?.outcome === "PASS" ? ["Đạt", "success"] : interview.recruitmentResult?.outcome === "FAIL" ? ["Không đạt", "neutral"] : interview.status === "CANCELLED" ? ["Đã hủy", "urgent"] : [interviewStatusCopy[interview.status]?.[0] || "Chờ kết quả", "neutral"]; return <div key={interview.id}><strong>{interview.job.title}</strong><span>{interview.job.company.name}</span><span>{interviewTiming(interview.scheduledAt).date}</span><Status tone={result[1]}>{result[0]}</Status></div>; })}</div></Panel></div><Panel title="Chuẩn bị phỏng vấn"><div className="preparation-list"><div><span>1</span><strong>Kiểm tra thiết bị, đường truyền hoặc tuyến đường đến địa điểm</strong></div><div><span>2</span><strong>Đọc lại mô tả công việc và chuẩn bị dự án nổi bật để trình bày</strong></div><div><span>3</span><strong>Tham gia trước giờ hẹn 10 phút và dùng đúng email UIT</strong></div></div><button className="secondary-button full"><BookOpenText size={17} />Xem hướng dẫn từ UIT</button></Panel></div>{cancelTarget && <InterviewCancelModal interview={cancelTarget} busy={busyId === cancelTarget.id} error={error} onClose={() => { if (!busyId) { setCancelTarget(null); setError(""); } }} onSubmit={note => void cancel(note)} />}</>;
}

function StudentNotifications({ navigate }) {
  return <NotificationInbox role="student" onOpen={(notification, destination) => navigate(destination, { notification })} />;
}

export function AdminPortal({ route, navigate, navigationPayload, user, onLogout }) {
  const [modal, setModal] = useState(null);
  const [companiesVersion, setCompaniesVersion] = useState(0);
  const titles = {
    "admin-dashboard": ["Tổng quan vận hành", "Theo dõi khối lượng xử lý, hạn cam kết và hoạt động tuyển dụng toàn trường."],
    "admin-companies": ["Doanh nghiệp đối tác", "Tạo hồ sơ, cấp tài khoản và quản lý trạng thái hợp tác với UIT."],
    "admin-jobs": ["Duyệt tin tuyển dụng", "Kiểm tra nội dung, nhóm ngành, yêu cầu và thời hạn trước khi công khai."],
    "admin-applications": ["Duyệt hồ sơ sinh viên", "Xác minh điều kiện và tài liệu trước khi chuyển hồ sơ đến doanh nghiệp."],
    "admin-placements": ["Theo dõi kết quả tuyển dụng", "Theo dõi từ phỏng vấn đến nhận việc, thực tập và hoàn thành."],
    "admin-scheduler": ["Nhắc việc & tác vụ hệ thống", "Giám sát tổng hợp hồ sơ tồn và các thông báo định kỳ mỗi ngày."],
    "admin-notifications": ["Thông báo", "Các yêu cầu mới và thay đổi trạng thái cần bộ phận UIT theo dõi."],
    "admin-reports": ["Báo cáo & thống kê", "Tổng hợp hiệu quả tuyển dụng theo ngành, doanh nghiệp và thời gian."],
    "admin-access": ["Tài khoản & nhật ký", "Quản lý phân quyền và truy vết các thao tác quan trọng."],
  };
  const [title, description] = titles[route] || titles["admin-dashboard"];
  const action = route === "admin-companies" ? <button className="primary-button" onClick={() => setModal("company")}><UserPlus size={18} />Thêm doanh nghiệp</button> : route === "admin-reports" ? <button className="secondary-button"><DownloadSimple size={18} />Xuất báo cáo</button> : null;
  return <WorkspaceShell role="admin" route={route} navigate={navigate} title={title} description={description} actions={action} user={user} onLogout={onLogout}>
    {route === "admin-dashboard" && <LiveAdminDashboard navigate={navigate} />}
    {route === "admin-companies" && <AdminCompanyManagement refreshKey={companiesVersion} onCreate={() => setModal("company")} />}
    {route === "admin-jobs" && <LiveAdminJobReview targetJobId={navigationPayload?.notification?.resourceId} />}
    {route === "admin-applications" && <LiveAdminApplicationReview targetApplicationId={navigationPayload?.notification?.resourceId} />}
    {route === "admin-placements" && <AdminPlacements targetApplicationId={navigationPayload?.notification?.resourceId} />}
    {route === "admin-scheduler" && <AdminScheduler />}
    {route === "admin-notifications" && <NotificationInbox role="admin" onOpen={(notification, destination) => navigate(destination, { notification })} />}
    {route === "admin-reports" && <AdminReports />}
    {route === "admin-access" && <AdminAccess />}
    {modal === "company" && <CompanyCreatePartnerModal close={() => setModal(null)} onComplete={() => setCompaniesVersion(value => value + 1)} />}
  </WorkspaceShell>;
}

function AdminDashboard({ navigate }) {
  return <><div className="metric-grid four"><MetricCard label="Tin chờ duyệt" value="6" helper="2 tin gần quá hạn" Icon={Briefcase} tone="amber" /><MetricCard label="Hồ sơ chờ UIT" value="12" helper="4 hồ sơ quá 24 giờ" Icon={UserCheck} tone="red" /><MetricCard label="Chờ doanh nghiệp" value="21" helper="Tại 8 doanh nghiệp" Icon={Clock} tone="purple" /><MetricCard label="Đã nhận việc tháng này" value="37" helper="Tăng 18% so tháng 7" Icon={TrendUp} tone="green" /></div><div className="portal-two-column wide-left"><Panel title="Hàng đợi cần xử lý" action={<button className="link-button" onClick={() => navigate("admin-applications")}>Mở hàng đợi <ArrowRight size={14} /></button>}><div className="admin-queue"><button onClick={() => navigate("admin-applications")}><span className="queue-number urgent">12</span><div><strong>Hồ sơ sinh viên chờ kiểm duyệt</strong><small>Hồ sơ cũ nhất đã chờ 31 giờ</small></div><Status tone="urgent">4 quá hạn</Status><ArrowRight /></button><button onClick={() => navigate("admin-jobs")}><span className="queue-number amber">6</span><div><strong>Tin tuyển dụng chờ phê duyệt</strong><small>3 doanh nghiệp đang chờ phản hồi</small></div><Status tone="warning">Cần xử lý hôm nay</Status><ArrowRight /></button><button onClick={() => navigate("admin-placements")}><span className="queue-number blue">8</span><div><strong>Kết quả phỏng vấn cần cập nhật</strong><small>Thiếu kết quả từ 5 doanh nghiệp</small></div><Status tone="info">Theo dõi</Status><ArrowRight /></button></div></Panel><Panel title="Mức xử lý hôm nay"><div className="donut-summary"><div className="donut"><span>74%</span></div><strong>29 / 39 yêu cầu</strong><p>đã xử lý trong thời hạn</p></div><div className="mini-bars"><span><i style={{width:'82%'}} />Tin tuyển dụng <b>82%</b></span><span><i style={{width:'68%'}} />Hồ sơ sinh viên <b>68%</b></span><span><i style={{width:'76%'}} />Kết quả tuyển dụng <b>76%</b></span></div></Panel></div><div className="portal-two-column"><Panel title="Ứng tuyển theo trạng thái"><div className="funnel-bars">{[["Chờ UIT duyệt",12,18],["Đã chuyển doanh nghiệp",46,69],["Mời phỏng vấn",23,35],["Đạt / nhận việc",14,21]].map(([label,value,width]) => <div key={label}><span>{label}</span><div><i style={{width:`${width}%`}} /></div><strong>{value}</strong></div>)}</div></Panel><Panel title="Doanh nghiệp hoạt động"><div className="rank-list">{[["FPT Software",48,"12 vị trí"],["VNG Corporation",36,"7 vị trí"],["MoMo Technology",29,"5 vị trí"],["NashTech Vietnam",21,"4 vị trí"]].map(([name,count,meta],index)=><div key={name}><span>{index+1}</span><div><strong>{name}</strong><small>{meta}</small></div><b>{count} hồ sơ</b></div>)}</div></Panel></div></>;
}

function AdminCompanies({ onCreate }) {
  const [query, setQuery] = useState("");
  const rows = [["VNG Corporation","Công nghệ sản phẩm","7","3","Đang hoạt động","04/08/2026"],["FPT Software","Dịch vụ công nghệ","12","4","Đang hoạt động","05/08/2026"],["MoMo Technology","Công nghệ tài chính","5","2","Đang hoạt động","03/08/2026"],["NashTech Vietnam","Dịch vụ phần mềm","4","2","Đang hoạt động","01/08/2026"],["Tiki Corporation","Thương mại điện tử","2","1","Tạm ngưng","22/07/2026"]].filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase()));
  return <Panel title="Danh sách đối tác" action={<span className="panel-count">48 doanh nghiệp</span>}><div className="portal-toolbar inside"><label className="portal-search"><MagnifyingGlass size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên doanh nghiệp..."/></label><button className="secondary-button"><FunnelSimple/>Trạng thái</button><button className="secondary-button"><SuitcaseSimple/>Lĩnh vực</button></div><div className="simple-table admin-company-table"><div className="table-head"><span>Doanh nghiệp</span><span>Lĩnh vực</span><span>Tin đang tuyển</span><span>Tài khoản</span><span>Trạng thái</span><span>Cập nhật</span><span/></div>{rows.map(row=><button key={row[0]}><strong><span className="mini-company-mark">{row[0].split(' ').map(x=>x[0]).join('').slice(0,3)}</span>{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><span><Status tone={row[4]==='Đang hoạt động'?'success':'neutral'}>{row[4]}</Status></span><span>{row[5]}</span><DotsThree size={18}/></button>)}</div><div className="table-footer"><span>Hiển thị 1–5 trong 48 doanh nghiệp</span><div><button disabled>Trước</button><button className="active">1</button><button>2</button><button>3</button><button>Sau</button></div></div></Panel>;
}

function CompanyCreateModal({ close }) {
  const [created, setCreated] = useState(false);
  return <div className="modal-backdrop"><div className="modal portal-modal"><button className="modal-close" onClick={close}><X/></button>{created ? <div className="modal-success"><CheckCircle size={52} weight="fill"/><h2>Đã tạo hồ sơ doanh nghiệp</h2><p>Email mời thiết lập tài khoản đã được gửi đến người phụ trách.</p><button className="primary-button full" onClick={close}>Hoàn tất</button></div> : <><span className="modal-icon"><Buildings/></span><h2>Thêm doanh nghiệp đối tác</h2><p>Tạo hồ sơ và tài khoản quản trị đầu tiên cho doanh nghiệp.</p><div className="modal-form"><label><span>Tên doanh nghiệp</span><input defaultValue="KMS Technology"/></label><label><span>Mã số thuế</span><input placeholder="Nhập mã số thuế"/></label><label><span>Email người phụ trách</span><input defaultValue="recruitment@kms-technology.com"/></label><label><span>Nhóm ngành</span><select defaultValue="technology"><option value="technology">Công nghệ thông tin</option><option>Thương mại điện tử</option></select></label></div><div className="modal-actions"><button className="secondary-button" onClick={close}>Hủy</button><button className="primary-button" onClick={()=>setCreated(true)}><PaperPlaneTilt/>Tạo và gửi lời mời</button></div></>}</div></div>;
}

function ReviewReasonModal({ mode, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  const isRevision = mode === "request-revision";
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><span className={`modal-icon ${isRevision ? "" : "danger"}`}>{isRevision ? <PencilSimple /> : <Warning />}</span><h2>{isRevision ? "Yêu cầu doanh nghiệp chỉnh sửa" : "Từ chối tin tuyển dụng"}</h2><p>Lý do sẽ được gửi đến doanh nghiệp, lưu trong lịch sử và không thể chỉnh sửa sau khi xác nhận.</p><div className="modal-form"><label><span>Lý do chi tiết *</span><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder={isRevision ? "Ví dụ: Vui lòng bổ sung thời gian làm việc và quyền lợi..." : "Ví dụ: Nội dung không phù hợp quy định của nhà trường..."} maxLength={2000} /></label></div>{error && <p className="form-error"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className={`primary-button ${isRevision ? "" : "danger-fill"}`} disabled={busy || note.trim().length < 5} onClick={() => onSubmit(note.trim())}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : isRevision ? <><PaperPlaneTilt />Gửi yêu cầu</> : "Xác nhận từ chối"}</button></div></div></div>;
}

function ApplicationDecisionModal({ mode, application, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  const [requiredDocumentTypes, setRequiredDocumentTypes] = useState(["TRANSCRIPT"]);
  const defaultDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const isSupplement = mode === "request-supplement";
  const isReject = mode === "reject";
  const documentTypes = [
    ["CV", "CV ứng tuyển"],
    ["TRANSCRIPT", "Bảng điểm"],
    ["STUDENT_CONFIRMATION", "Giấy xác nhận sinh viên"],
    ["OTHER", "Tài liệu khác"],
  ];
  const toggleDocument = value => setRequiredDocumentTypes(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const canSubmit = mode === "forward" || (note.trim().length >= 5 && (!isSupplement || requiredDocumentTypes.length > 0));
  const submit = () => {
    if (mode === "forward") return onSubmit({});
    if (isReject) return onSubmit({ reasonCode: "UIT_ELIGIBILITY_NOT_MET", note: note.trim() });
    return onSubmit({
      reasonCode: "MISSING_REQUIRED_DOCUMENTS",
      note: note.trim(),
      requiredDocumentTypes,
      dueAt: `${dueDate}T17:00:00+07:00`,
    });
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal application-decision-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><span className={`modal-icon ${isReject ? "danger" : ""}`}>{mode === "forward" ? <PaperPlaneTilt /> : isSupplement ? <FileText /> : <Warning />}</span><h2>{mode === "forward" ? "Chuyển hồ sơ đến doanh nghiệp?" : isSupplement ? "Yêu cầu sinh viên bổ sung" : "Từ chối hồ sơ ứng tuyển"}</h2><p>{mode === "forward" ? <>CV và tài liệu của <strong>{application.student.fullName}</strong> sẽ được chuyển đúng đến <strong>{application.job.company.name}</strong>.</> : "Lý do sẽ được gửi cho sinh viên và lưu vào lịch sử xử lý."}</p>{isSupplement && <><div className="document-type-options"><span>Tài liệu cần bổ sung *</span>{documentTypes.map(([value, label]) => <label key={value}><input type="checkbox" checked={requiredDocumentTypes.includes(value)} onChange={() => toggleDocument(value)} />{label}</label>)}</div><div className="modal-form"><label><span>Hạn bổ sung *</span><input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={event => setDueDate(event.target.value)} /></label></div></>}{mode !== "forward" && <div className="modal-form"><label><span>Lý do chi tiết *</span><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder={isSupplement ? "Ví dụ: Vui lòng bổ sung bảng điểm có xác nhận..." : "Ví dụ: Sinh viên chưa đáp ứng điều kiện tham gia..."} maxLength={2000} /></label></div>}{error && <p className="form-error"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className={`primary-button ${isReject ? "danger-fill" : ""}`} disabled={busy || !canSubmit} onClick={submit}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : mode === "forward" ? <><PaperPlaneTilt />Xác nhận chuyển</> : isSupplement ? <><PaperPlaneTilt />Gửi yêu cầu</> : "Xác nhận từ chối"}</button></div></div></div>;
}

function LiveAdminJobReview({ targetJobId = null }) {
  const { authorizedRequest } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reasonMode, setReasonMode] = useState(null);
  const selected = jobs.find(job => job.id === selectedId) || jobs[0] || null;

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest("/uit/jobs/review-queue?page=1&pageSize=100");
      setJobs(response.data);
      setSelectedId(current => response.data.some(job => job.id === targetJobId)
        ? targetJobId
        : response.data.some(job => job.id === current) ? current : response.data[0]?.id ?? null);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, [authorizedRequest, targetJobId]);

  const decide = async (mode, note = "") => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const options = {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        ...(mode === "approve" ? {} : { body: JSON.stringify({ reasonCode: mode === "reject" ? "UIT_REJECTED" : "UIT_REVISION_REQUIRED", note }) }),
      };
      await authorizedRequest(`/uit/jobs/${selected.id}/${mode}`, options);
      setJobs(current => current.filter(job => job.id !== selected.id));
      setReasonMode(null);
      setMessage(mode === "approve" ? "Tin đã được phê duyệt và công khai." : mode === "reject" ? "Tin đã được từ chối và doanh nghiệp đã nhận thông báo." : "Yêu cầu chỉnh sửa đã được gửi đến doanh nghiệp.");
      window.setTimeout(() => setMessage(""), 3500);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Panel title="Hàng đợi duyệt tin"><div className="portal-loading"><CircleNotch className="spin" />Đang tải tin chờ duyệt...</div></Panel>;
  if (error && !selected) return <Panel title="Hàng đợi duyệt tin"><div className="portal-error"><Warning />{error}<button className="secondary-button small" onClick={loadQueue}>Thử lại</button></div></Panel>;
  if (!selected) return <Panel title="Hàng đợi duyệt tin" action={<Status tone="success">0 cần xử lý</Status>}><EmptyHint title="Đã xử lý hết hàng đợi" text="Hiện không có tin tuyển dụng nào đang chờ UIT phê duyệt." />{message && <div className="inline-success"><CheckCircle />{message}</div>}</Panel>;

  const categories = selected.categories.length ? selected.categories.map(item => item.name) : ["Doanh nghiệp chưa chọn nhóm ngành"];
  const skills = selected.skills.length ? selected.skills.map(item => item.name) : [];
  return <><div className="review-workspace"><Panel title="Hàng đợi" action={<Status tone="warning">{jobs.length} cần xử lý</Status>} className="review-list-panel"><div className="review-filter"><button className="active">Cũ nhất trước</button><button onClick={loadQueue}>Làm mới</button></div><div className="review-list">{jobs.map(job => <button key={job.id} className={selected.id === job.id ? "selected" : ""} onClick={() => { setSelectedId(job.id); setError(""); }}><div><strong>{job.title}</strong><small>{job.company.name}</small></div><Status tone="warning">Chờ duyệt</Status><p><span>{job.categories[0]?.name || opportunityCopy[job.opportunityType]}</span><span>Hạn {formatDate(job.deadline)}</span></p><small>Gửi {formatSubmitted(job.submittedAt)}</small></button>)}</div></Panel><Panel title="Nội dung tin tuyển dụng" action={<span className="version-label">Phiên bản {selected.version}</span>} className="review-detail-panel"><div className="review-detail-heading"><div className="company-logo vng">{selected.company.code.slice(0, 3)}</div><div><h2>{selected.title}</h2><p>{selected.company.name} · Đối tác UIT đã xác thực</p></div><Status tone="warning">Chờ UIT duyệt</Status></div><div className="review-checks"><span className="done"><CheckCircle />Doanh nghiệp hợp lệ</span><span className="done"><CheckCircle />Thông tin bắt buộc đầy đủ</span><span className="warning"><Warning />UIT cần rà soát nội dung</span></div><div className="review-content-grid"><section><h3>Thông tin chung</h3><dl><div><dt>Loại hình</dt><dd>{opportunityCopy[selected.opportunityType]} · {workModeCopy[selected.workMode]}</dd></div><div><dt>Địa điểm</dt><dd>{selected.location}</dd></div><div><dt>Số lượng</dt><dd>{selected.positions} vị trí</dd></div><div><dt>Hạn ứng tuyển</dt><dd>{formatDate(selected.deadline)}</dd></div></dl></section><section><h3>Nhóm ngành & kỹ năng</h3><div className="tag-list">{[...categories, ...skills].map(item => <span key={item}>{item}</span>)}</div></section><section className="full"><h3>Mô tả công việc</h3><p className="preserve-lines">{selected.description}</p></section><section className="full"><h3>Yêu cầu ứng viên</h3><p className="preserve-lines">{selected.requirements}</p></section>{selected.benefits && <section className="full"><h3>Quyền lợi</h3><p className="preserve-lines">{selected.benefits}</p></section>}</div>{error && <p className="review-error"><Warning />{error}</p>}<div className="review-actions"><button className="secondary-button danger" disabled={busy} onClick={() => setReasonMode("reject")}>Từ chối</button><button className="secondary-button" disabled={busy} onClick={() => setReasonMode("request-revision")}><PencilSimple />Yêu cầu chỉnh sửa</button><button className="primary-button" disabled={busy} onClick={() => { if (window.confirm(`Phê duyệt và công khai tin “${selected.title}”?`)) void decide("approve"); }}>{busy ? <CircleNotch className="spin" /> : <Check />}Phê duyệt & công khai</button></div></Panel></div>{message && <div className="toast"><CheckCircle weight="fill" />{message}</div>}{reasonMode && <ReviewReasonModal mode={reasonMode} busy={busy} error={error} onClose={() => { if (!busy) { setReasonMode(null); setError(""); } }} onSubmit={note => void decide(reasonMode, note)} />}</>;
}

function LiveAdminApplicationReview({ targetApplicationId = null }) {
  const { authorizedRequest } = useAuth();
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [decisionMode, setDecisionMode] = useState(null);
  const selected = applications.find(application => application.id === selectedId) || applications[0] || null;

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest("/uit/applications/review-queue?page=1&pageSize=100");
      setApplications(response.data);
      setSelectedId(current => response.data.some(application => application.id === targetApplicationId)
        ? targetApplicationId
        : response.data.some(application => application.id === current) ? current : response.data[0]?.id ?? null);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, [authorizedRequest, targetApplicationId]);

  const decide = async payload => {
    if (!selected || !decisionMode || busy) return;
    setBusy(true);
    setError("");
    try {
      await authorizedRequest(`/uit/applications/${selected.id}/${decisionMode}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        ...(decisionMode === "forward" ? {} : { body: JSON.stringify(payload) }),
      });
      setApplications(current => current.filter(application => application.id !== selected.id));
      setDecisionMode(null);
      setMessage(decisionMode === "forward" ? "Hồ sơ đã được chuyển đến đúng doanh nghiệp." : decisionMode === "reject" ? "Hồ sơ đã bị từ chối và sinh viên đã nhận thông báo." : "Yêu cầu bổ sung đã được gửi đến sinh viên.");
      window.setTimeout(() => setMessage(""), 3500);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Panel title="Hồ sơ chờ xử lý"><div className="portal-loading"><CircleNotch className="spin" />Đang tải hồ sơ chờ kiểm duyệt...</div></Panel>;
  if (error && !selected) return <Panel title="Hồ sơ chờ xử lý"><div className="portal-error"><Warning />{error}<button className="secondary-button small" onClick={loadQueue}>Thử lại</button></div></Panel>;
  if (!selected) return <Panel title="Hồ sơ chờ xử lý" action={<Status tone="success">0 cần xử lý</Status>}><EmptyHint title="Đã xử lý hết hàng đợi" text="Hiện không có hồ sơ sinh viên nào đang chờ UIT kiểm duyệt." />{message && <div className="inline-success"><CheckCircle />{message}</div>}</Panel>;

  const initials = selected.student.fullName.split(" ").filter(Boolean).slice(-2).map(part => part[0]).join("").toUpperCase();
  const hasCv = selected.documents.some(document => document.documentType === "CV");
  return <><div className="review-workspace"><Panel title="Hồ sơ chờ xử lý" action={<Status tone="urgent">{applications.length} hồ sơ</Status>} className="review-list-panel"><div className="review-filter"><button className="active">Cũ nhất trước</button><button onClick={loadQueue}>Làm mới</button></div><div className="review-list application-review-list">{applications.map(application => { const itemInitials = application.student.fullName.split(" ").filter(Boolean).slice(-2).map(part => part[0]).join("").toUpperCase(); return <button key={application.id} className={selected.id === application.id ? "selected" : ""} onClick={() => { setSelectedId(application.id); setError(""); }}><div className="candidate-initials">{itemInitials}</div><div><strong>{application.student.fullName}</strong><small>{application.student.studentCode} · {application.job.title}</small><p>{application.job.company.name} · Nộp {formatDate(application.submittedAt)}</p></div><Status tone="warning">Chờ UIT</Status></button>; })}</div></Panel><Panel title="Hồ sơ ứng tuyển" action={<Status tone="warning">UIT đang kiểm duyệt</Status>} className="review-detail-panel"><div className="student-review-heading"><div className="large-avatar small">{initials}</div><div><h2>{selected.student.fullName}</h2><p>MSSV {selected.student.studentCode} · {selected.student.faculty}</p><span>Ứng tuyển <strong>{selected.job.title}</strong> tại {selected.job.company.name}</span></div><span className="version-label">Phiên bản {selected.version}</span></div><div className="eligibility-grid"><article><small>Tình trạng sinh viên</small><strong><CheckCircle />{selected.student.academicStatus === "ACTIVE" ? "Đang hoạt động" : selected.student.academicStatus}</strong></article><article><small>GPA tích lũy</small><strong>{selected.student.gpa ?? "—"} / 4.0</strong></article><article><small>Khóa / Ngành</small><strong>{selected.student.cohort} · {selected.student.major}</strong></article><article><small>Email UIT</small><strong>{selected.student.email}</strong></article></div><section className="document-verification"><h3>Kiểm tra tài liệu đã nộp ({selected.documents.length})</h3>{selected.documents.map(document => <div key={document.id}><span><CheckCircle /><div><strong>{document.fileName}</strong><small>{document.documentType} · Phiên bản {document.sourceVersion} · {Math.max(1, Math.round(document.fileSizeBytes / 1024))} KB</small></div></span><Status tone="success">Đã xác minh</Status></div>)}</section><div className="review-checks"><span className="done"><CheckCircle />Tài khoản sinh viên hợp lệ</span><span className={hasCv ? "done" : "warning"}>{hasCv ? <CheckCircle /> : <Warning />}{hasCv ? "Có CV ứng tuyển" : "Thiếu CV"}</span><span className="done"><CheckCircle />Đã đồng ý chia sẻ dữ liệu</span></div>{error && <p className="review-error"><Warning />{error}</p>}<div className="review-actions"><button className="secondary-button danger" disabled={busy} onClick={() => setDecisionMode("reject")}>Từ chối</button><button className="secondary-button" disabled={busy} onClick={() => setDecisionMode("request-supplement")}><FileText />Yêu cầu bổ sung</button><button className="primary-button" disabled={busy || !hasCv || selected.student.academicStatus !== "ACTIVE"} onClick={() => setDecisionMode("forward")}><PaperPlaneTilt />Duyệt & chuyển doanh nghiệp</button></div></Panel></div>{message && <div className="toast"><CheckCircle weight="fill" />{message}</div>}{decisionMode && <ApplicationDecisionModal mode={decisionMode} application={selected} busy={busy} error={error} onClose={() => { if (!busy) { setDecisionMode(null); setError(""); } }} onSubmit={payload => void decide(payload)} />}</>;
}

function AdminJobReview({ selected, setSelected, states, setStates }) {
  const state = states[selected.id] || selected.status;
  const update = value => setStates({...states,[selected.id]:value});
  return <div className="review-workspace"><Panel title="Hàng đợi" action={<Status tone="warning">6 cần xử lý</Status>} className="review-list-panel"><div className="review-filter"><button className="active">Tất cả</button><button>Mới nhất</button><button>Gần hết hạn</button></div><div className="review-list">{reviewJobs.map(job=><button key={job.id} className={selected.id===job.id?'selected':''} onClick={()=>setSelected(job)}><div><strong>{job.role}</strong><small>{job.company}</small></div><Status tone={(states[job.id]||job.status)==='Đã duyệt'?'success':(states[job.id]||job.status)==='Yêu cầu chỉnh sửa'?'urgent':'warning'}>{states[job.id]||job.status}</Status><p><span>{job.major}</span><span>Hạn {job.deadline}</span></p><small>Gửi {job.submitted}</small></button>)}</div></Panel><Panel title="Nội dung tin tuyển dụng" action={<button className="icon-button"><DotsThree/></button>} className="review-detail-panel"><div className="review-detail-heading"><div className="company-logo vng">VNG</div><div><h2>{selected.role}</h2><p>{selected.company} · Đối tác UIT đã xác thực</p></div><Status tone={state==='Đã duyệt'?'success':state==='Yêu cầu chỉnh sửa'?'urgent':'warning'}>{state}</Status></div><div className="review-checks"><span className="done"><CheckCircle/>Doanh nghiệp hợp lệ</span><span className="done"><CheckCircle/>Thuộc nhóm ngành được phép</span><span className="warning"><Warning/>Cần rà soát thời gian làm việc</span></div><div className="review-content-grid"><section><h3>Thông tin chung</h3><dl><div><dt>Loại hình</dt><dd>Thực tập · Hybrid</dd></div><div><dt>Địa điểm</dt><dd>Quận 7, TP. Hồ Chí Minh</dd></div><div><dt>Số lượng</dt><dd>10 sinh viên</dd></div><div><dt>Hạn ứng tuyển</dt><dd>{selected.deadline}</dd></div></dl></section><section><h3>Nhóm ngành phù hợp</h3><div className="tag-list"><span>Kỹ thuật phần mềm</span><span>Khoa học máy tính</span><span>Hệ thống thông tin</span></div></section><section className="full"><h3>Mô tả công việc</h3><ul><li>Phát triển và bảo trì REST API cho hệ thống sản phẩm.</li><li>Phối hợp với frontend, QA và mentor trong quy trình Scrum.</li><li>Viết unit test, tài liệu kỹ thuật và báo cáo tiến độ.</li></ul></section><section className="full"><h3>Yêu cầu</h3><ul><li>Sinh viên năm 3, 4 ngành CNTT; GPA từ 2.8/4.</li><li>Có nền tảng Java, Spring Boot, cơ sở dữ liệu quan hệ.</li><li>Làm việc tối thiểu 4 ngày/tuần trong 3 tháng.</li></ul></section></div><div className="review-actions"><button className="secondary-button danger" onClick={()=>update('Từ chối')}>Từ chối</button><button className="secondary-button" onClick={()=>update('Yêu cầu chỉnh sửa')}><PencilSimple/>Yêu cầu chỉnh sửa</button><button className="primary-button" onClick={()=>update('Đã duyệt')}><Check/>Phê duyệt & công khai</button></div></Panel></div>;
}

function AdminApplicationReview({ selected, setSelected, states, setStates }) {
  const state = states[selected.id] || "Chờ UIT duyệt";
  const update = value => setStates({...states,[selected.id]:value});
  return <div className="review-workspace"><Panel title="Hồ sơ chờ xử lý" action={<Status tone="urgent">12 hồ sơ</Status>} className="review-list-panel"><div className="review-filter"><button className="active">Mới nhất</button><button>Quá 24 giờ</button><button>Thiếu hồ sơ</button></div><div className="review-list application-review-list">{reviewApplications.map(item=><button key={item.id} className={selected.id===item.id?'selected':''} onClick={()=>setSelected(item)}><div className="candidate-initials">{item.student.split(' ').slice(-2).map(x=>x[0]).join('')}</div><div><strong>{item.student}</strong><small>{item.mssv} · {item.role}</small><p>{item.company} · Nộp {item.submitted}</p></div><Status tone={item.issue==='Đủ hồ sơ'?'success':'urgent'}>{states[item.id]||item.issue}</Status></button>)}</div></Panel><Panel title="Hồ sơ ứng tuyển" action={<Status tone={state==='Đã chuyển doanh nghiệp'?'success':state==='Cần bổ sung'?'urgent':'warning'}>{state}</Status>} className="review-detail-panel"><div className="student-review-heading"><div className="large-avatar small">{selected.student.split(' ').slice(-2).map(x=>x[0]).join('')}</div><div><h2>{selected.student}</h2><p>MSSV {selected.mssv} · Khoa Công nghệ phần mềm</p><span>Ứng tuyển <strong>{selected.role}</strong> tại {selected.company}</span></div><button className="secondary-button"><FileText/>Xem CV</button></div><div className="eligibility-grid"><article><small>Tình trạng sinh viên</small><strong><CheckCircle/>Đang học</strong></article><article><small>GPA tích lũy</small><strong>{selected.gpa}</strong></article><article><small>Số tín chỉ</small><strong>118 / 145</strong></article><article><small>Kỷ luật</small><strong><CheckCircle/>Không vi phạm</strong></article></div><section className="document-verification"><h3>Kiểm tra tài liệu</h3><div><span><CheckCircle/><div><strong>CV ứng tuyển</strong><small>CV_Backend_2026.pdf</small></div></span><Status tone="success">Hợp lệ</Status><button><Eye/></button></div><div><span><CheckCircle/><div><strong>Giấy xác nhận sinh viên</strong><small>Hiệu lực đến 15/10/2026</small></div></span><Status tone="success">Hợp lệ</Status><button><Eye/></button></div><div><span className={selected.issue==='Đủ hồ sơ'?'':'warn'}>{selected.issue==='Đủ hồ sơ'?<CheckCircle/>:<Warning/>}<div><strong>Bảng điểm có xác nhận</strong><small>{selected.issue==='Đủ hồ sơ'?'Cập nhật 02/08/2026':'Chưa tải lên'}</small></div></span><Status tone={selected.issue==='Đủ hồ sơ'?'success':'urgent'}>{selected.issue==='Đủ hồ sơ'?'Hợp lệ':'Còn thiếu'}</Status><button><Eye/></button></div></section><label className="review-note"><span>Ghi chú nội bộ</span><textarea placeholder="Nhập ghi chú cho bộ phận UIT..."/></label><div className="review-actions"><button className="secondary-button" onClick={()=>update('Cần bổ sung')}><PaperPlaneTilt/>Yêu cầu bổ sung</button><button className="primary-button" disabled={selected.issue!=='Đủ hồ sơ'} onClick={()=>update('Đã chuyển doanh nghiệp')}><Check/>Duyệt & chuyển doanh nghiệp</button></div></Panel></div>;
}

function PlacementConfirmationModal({ application, busy, error, close, submit }) {
  const [startDate, setStartDate] = useState(application.recruitmentResult?.startDate || "");
  const [note, setNote] = useState("");
  return <div className="modal-backdrop" onMouseDown={() => !busy && close()}><div className="modal portal-modal placement-confirm-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" disabled={busy} onClick={close}><X /></button><span className="modal-icon"><GraduationCap /></span><h2>Xác nhận nơi thực tập</h2><p>Xác nhận <strong>{application.student.fullName}</strong> nhận vị trí <strong>{application.job.title}</strong> tại {application.job.company.name}.</p><div className="placement-impact"><Warning /><span><strong>Thao tác ảnh hưởng nhiều đơn</strong><small>Các đơn khác còn hoạt động của sinh viên sẽ tự chuyển sang Đã rút với lý do “Đã chọn nơi thực tập khác”. Lịch phỏng vấn liên quan cũng được hủy.</small></span></div><div className="modal-form"><label><span>Ngày bắt đầu chính thức *</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label><span>Ghi chú xác nhận</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: Đã đối chiếu offer và xác nhận với sinh viên..." maxLength={500} /></label></div>{error && <p className="form-error"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={close}>Hủy</button><button className="primary-button" disabled={busy || !startDate} onClick={() => submit({ startDate, ...(note.trim() ? { note: note.trim() } : {}) })}>{busy ? <CircleNotch className="spin" /> : <CheckCircle />}Xác nhận & đóng đơn khác</button></div></div></div>;
}

function AdminPlacements({ targetApplicationId = null }) {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest("/uit/applications/placement-queue?page=1&pageSize=100");
      setItems(response.data);
      setSelectedId(current => response.data.some(item => item.id === targetApplicationId)
        ? targetApplicationId
        : response.data.some(item => item.id === current) ? current : response.data[0]?.id || "");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [authorizedRequest, targetApplicationId]);
  const selected = items.find(item => item.id === selectedId) || items[0];
  const startSoon = items.filter(item => {
    const date = item.recruitmentResult?.startDate;
    if (!date) return false;
    const days = (new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 30;
  }).length;
  const overdue = items.filter(item => Date.now() - new Date(item.lastTransitionAt).getTime() > 3 * 86_400_000).length;
  const companies = new Set(items.map(item => item.job.company.id)).size;
  const confirm = async payload => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest(`/uit/applications/${selected.id}/confirm-placement`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(payload) });
      const closedCount = response.data.autoWithdrawnApplicationIds.length;
      setItems(current => current.filter(item => item.id !== selected.id));
      setConfirming(false);
      setMessage(`Đã xác nhận ${selected.student.fullName} nhận việc${closedCount ? ` và tự đóng ${closedCount} đơn khác` : ""}.`);
      window.setTimeout(() => setMessage(""), 4500);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return <>{message && <div className="toast"><CheckCircle weight="fill" />{message}</div>}<div className="metric-grid four"><MetricCard label="Chờ UIT xác nhận" value={items.length} helper="Sinh viên đã nhận offer" Icon={UserCheck} tone="green"/><MetricCard label="Bắt đầu trong 30 ngày" value={startSoon} helper="Cần hoàn tất đối chiếu" Icon={CalendarCheck}/><MetricCard label="Doanh nghiệp liên quan" value={companies} helper="Đối tác đang chờ phản hồi" Icon={Buildings} tone="purple"/><MetricCard label="Chờ quá 3 ngày" value={overdue} helper="Cần ưu tiên xử lý" Icon={Warning} tone="amber"/></div>{loading ? <Panel title="Xác nhận nơi thực tập"><div className="portal-loading"><CircleNotch className="spin" />Đang tải hàng đợi xác nhận...</div></Panel> : error && !selected ? <Panel title="Xác nhận nơi thực tập"><div className="portal-error"><Warning />{error}<button className="secondary-button small" onClick={() => void load()}>Thử lại</button></div></Panel> : !selected ? <Panel title="Xác nhận nơi thực tập" action={<Status tone="success">0 cần xử lý</Status>}><EmptyHint title="Đã xử lý hết hàng đợi" text="Hiện không có sinh viên đã nhận offer đang chờ UIT xác nhận." /></Panel> : <div className="review-workspace placement-workspace"><Panel title="Chờ xác nhận" action={<Status tone="warning">{items.length} sinh viên</Status>} className="review-list-panel"><div className="review-filter"><button className="active">Chờ lâu nhất</button><button onClick={() => void load()}>Làm mới</button></div><div className="review-list application-review-list">{items.map(item => <button key={item.id} className={selected.id === item.id ? "selected" : ""} onClick={() => { setSelectedId(item.id); setError(""); }}><div className="candidate-initials">{userInitials(item.student.fullName)}</div><div><strong>{item.student.fullName}</strong><small>{item.student.studentCode} · {item.job.title}</small><p>{item.job.company.name} · Nhận offer {formatSubmitted(item.lastTransitionAt)}</p></div><Status tone="success">Đã nhận offer</Status></button>)}</div></Panel><Panel title="Đối chiếu placement" action={<Status tone="success">Chờ UIT xác nhận</Status>} className="review-detail-panel"><div className="student-review-heading"><div className="large-avatar small">{userInitials(selected.student.fullName)}</div><div><h2>{selected.student.fullName}</h2><p>MSSV {selected.student.studentCode} · {selected.student.faculty}</p><span>Đã nhận offer <strong>{selected.job.title}</strong> tại {selected.job.company.name}</span></div><span className="version-label">Phiên bản {selected.version}</span></div><div className="eligibility-grid placement-offer-grid"><article><small>Quyết định sinh viên</small><strong><CheckCircle />Đã nhận offer</strong></article><article><small>Ngày bắt đầu đề xuất</small><strong>{formatDate(selected.recruitmentResult?.startDate)}</strong></article><article><small>Doanh nghiệp</small><strong>{selected.job.company.name}</strong></article><article><small>Email sinh viên</small><strong>{selected.student.email}</strong></article></div><div className="placement-confirmation-card"><ShieldCheck /><span><strong>Đủ điều kiện xác nhận</strong><small>Offer có kết quả PASS và sinh viên đã phản hồi ACCEPTED. Sau khi xác nhận, đơn này thành Đã nhận việc.</small></span></div><div className="placement-impact inline"><Info /><span><strong>Quy tắc nhiều đơn</strong><small>Chỉ bước xác nhận của UIT mới đóng các đơn khác. Mỗi đơn tự đóng đều có history, lý do và thông báo đến doanh nghiệp liên quan.</small></span></div>{error && <p className="review-error"><Warning />{error}</p>}<div className="review-actions"><button className="secondary-button" onClick={() => void load()} disabled={busy}>Làm mới dữ liệu</button><button className="primary-button" onClick={() => setConfirming(true)} disabled={busy}><GraduationCap />Xác nhận nơi thực tập</button></div></Panel></div>}{confirming && selected && <PlacementConfirmationModal application={selected} busy={busy} error={error} close={() => { if (!busy) { setConfirming(false); setError(""); } }} submit={payload => void confirm(payload)} />}</>;
}

function AdminScheduler() {
  const [enabled, setEnabled] = useState({uit:true,company:true,deadline:true});
  const toggle = key => setEnabled({...enabled,[key]:!enabled[key]});
  return <div className="portal-two-column wide-left"><div><Panel title="Tác vụ định kỳ"><div className="scheduler-list"><article><span className="scheduler-icon"><Database/></span><div><strong>Tổng hợp hồ sơ chưa xử lý tại UIT</strong><small>Chạy mỗi ngày lúc 08:00 · Gửi email và thông báo hệ thống</small><p>Lần gần nhất: 05/08/2026 08:00 · 12 hồ sơ</p></div><Status tone="success">Thành công</Status><label className="switch"><input type="checkbox" checked={enabled.uit} onChange={()=>toggle('uit')}/><span/></label></article><article><span className="scheduler-icon"><Buildings/></span><div><strong>Tổng hợp hồ sơ chưa xử lý tại doanh nghiệp</strong><small>Chạy mỗi ngày lúc 08:15 · Gửi cho từng doanh nghiệp có hồ sơ tồn</small><p>Lần gần nhất: 05/08/2026 08:15 · 21 hồ sơ / 8 doanh nghiệp</p></div><Status tone="success">Thành công</Status><label className="switch"><input type="checkbox" checked={enabled.company} onChange={()=>toggle('company')}/><span/></label></article><article><span className="scheduler-icon"><ClockCountdown/></span><div><strong>Cảnh báo tin tuyển dụng sắp hết hạn</strong><small>Chạy mỗi ngày lúc 09:00 · Cảnh báo trước 3 ngày</small><p>Lần gần nhất: 05/08/2026 09:00 · 7 tin được nhắc</p></div><Status tone="success">Thành công</Status><label className="switch"><input type="checkbox" checked={enabled.deadline} onChange={()=>toggle('deadline')}/><span/></label></article></div></Panel><Panel title="Lịch sử thực thi"><div className="simple-table scheduler-history"><div className="table-head"><span>Tác vụ</span><span>Bắt đầu</span><span>Thời gian</span><span>Kết quả</span></div><div><strong>UIT_PENDING_DAILY</strong><span>05/08 · 08:00</span><span>4.2 giây</span><Status tone="success">Thành công</Status></div><div><strong>COMPANY_PENDING_DAILY</strong><span>05/08 · 08:15</span><span>7.8 giây</span><Status tone="success">Thành công</Status></div><div><strong>JOB_DEADLINE_REMINDER</strong><span>05/08 · 09:00</span><span>3.1 giây</span><Status tone="success">Thành công</Status></div></div></Panel></div><div><Panel title="Kênh thông báo"><div className="channel-list"><div><Envelope/><span><strong>Email</strong><small>SMTP UIT · đang hoạt động</small></span><Status tone="success">Sẵn sàng</Status></div><div><Bell/><span><strong>Firebase Cloud Messaging</strong><small>Web push · đang hoạt động</small></span><Status tone="success">Sẵn sàng</Status></div></div></Panel><Panel title="Ngưỡng cảnh báo"><div className="threshold-form"><label><span>UIT chưa xử lý sau</span><div><input defaultValue="24"/><small>giờ</small></div></label><label><span>Doanh nghiệp chưa xử lý sau</span><div><input defaultValue="48"/><small>giờ</small></div></label><button className="primary-button full"><Check/>Lưu cấu hình</button></div></Panel></div></div>;
}

function AdminReports() {
  return <><div className="report-filter"><label><CalendarBlank/><span>01/07/2026 – 05/08/2026</span><CaretDown/></label><label><Buildings/><span>Tất cả doanh nghiệp</span><CaretDown/></label><label><GraduationCap/><span>Tất cả nhóm ngành</span><CaretDown/></label><button className="primary-button">Áp dụng</button></div><div className="metric-grid four"><MetricCard label="Lượt ứng tuyển" value="486" helper="+21% so kỳ trước" Icon={FileText}/><MetricCard label="Được chuyển DN" value="352" helper="72,4% hồ sơ" Icon={PaperPlaneTilt} tone="purple"/><MetricCard label="Được phỏng vấn" value="138" helper="39,2% hồ sơ đã chuyển" Icon={CalendarCheck} tone="amber"/><MetricCard label="Nhận việc" value="67" helper="48,6% sau phỏng vấn" Icon={TrendUp} tone="green"/></div><div className="portal-two-column"><Panel title="Xu hướng ứng tuyển"><div className="chart-placeholder"><div className="chart-y"><span>120</span><span>90</span><span>60</span><span>30</span><span>0</span></div><div className="chart-bars">{[42,58,53,76,69,91,84,105].map((height,index)=><span key={index}><i style={{height:`${height}%`}}/><small>T{index+1}</small></span>)}</div></div></Panel><Panel title="Tỷ lệ theo nhóm ngành"><div className="major-breakdown">{[["Kỹ thuật phần mềm",34,"#0968e8"],["Hệ thống thông tin",24,"#7a5af8"],["Khoa học máy tính",19,"#16a36a"],["Mạng máy tính",13,"#f39a2b"],["Khác",10,"#a8b2c0"]].map(([label,value,color])=><div key={label}><span><i style={{background:color}}/>{label}</span><div><i style={{width:`${value}%`,background:color}}/></div><strong>{value}%</strong></div>)}</div></Panel></div><Panel title="Hiệu quả doanh nghiệp đối tác"><div className="simple-table report-table"><div className="table-head"><span>Doanh nghiệp</span><span>Tin đăng</span><span>Hồ sơ nhận</span><span>Phỏng vấn</span><span>Nhận việc</span><span>Tỷ lệ phản hồi</span></div>{[["FPT Software",12,84,31,18,"94%"],["VNG Corporation",7,61,24,12,"91%"],["MoMo Technology",5,48,19,9,"88%"],["NashTech Vietnam",4,36,14,7,"86%"]].map(row=><div key={row[0]}><strong>{row[0]}</strong>{row.slice(1).map((value,index)=><span key={index}>{value}</span>)}</div>)}</div></Panel></>;
}

function AdminAccess() {
  const [tab,setTab] = useState('accounts');
  return <><div className="portal-tabs"><button className={tab==='accounts'?'active':''} onClick={()=>setTab('accounts')}>Tài khoản & phân quyền</button><button className={tab==='audit'?'active':''} onClick={()=>setTab('audit')}>Nhật ký thao tác</button></div>{tab==='accounts'?<Panel title="Tài khoản quản trị" action={<button className="primary-button small"><UserPlus/>Thêm tài khoản</button>}><div className="simple-table account-table"><div className="table-head"><span>Người dùng</span><span>Vai trò</span><span>Phạm vi</span><span>Đăng nhập gần nhất</span><span>Trạng thái</span><span/></div>{[["Trần Hoàng Anh","Quản trị viên","Toàn hệ thống","05/08 · 14:28"],["Nguyễn Thu Trang","Chuyên viên kiểm duyệt","Tin & hồ sơ","05/08 · 13:55"],["Lê Minh Đức","Chuyên viên báo cáo","Chỉ xem báo cáo","04/08 · 16:40"]].map(row=><button key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><Status tone="success">Hoạt động</Status><DotsThree/></button>)}</div></Panel>:<Panel title="Nhật ký thao tác" action={<button className="secondary-button small"><DownloadSimple/>Xuất nhật ký</button>}><div className="audit-list">{[["14:28","Trần Hoàng Anh","Phê duyệt tin Backend Developer Intern","VNG Corporation","success"],["14:12","Nguyễn Thu Trang","Chuyển hồ sơ 20521067 đến doanh nghiệp","VNG Corporation","info"],["13:48","Trần Hoàng Anh","Cập nhật tài khoản doanh nghiệp","FPT Software","neutral"],["11:20","Hệ thống","Gửi tổng hợp hồ sơ chưa xử lý","8 doanh nghiệp","purple"]].map(row=><div key={row[0]+row[2]}><span className={`audit-dot ${row[4]}`}/><time>{row[0]}<small>05/08/2026</small></time><div><strong>{row[2]}</strong><p>{row[1]} · {row[3]}</p></div><button><Eye/></button></div>)}</div></Panel>}</>;
}

export function CompanyPortal({ route, navigate, navigationPayload, user, onLogout }) {
  const [modal,setModal] = useState(null);
  const [jobsVersion, setJobsVersion] = useState(0);
  const titles = {
    "company-dashboard": ["Tổng quan tuyển dụng", "Theo dõi tin tuyển dụng, ứng viên UIT chuyển đến và việc cần xử lý."],
    "company-profile": ["Hồ sơ doanh nghiệp", "Quản lý thông tin hiển thị với sinh viên và tài khoản tuyển dụng."],
    "company-jobs": ["Tin tuyển dụng", "Soạn, gửi UIT phê duyệt và theo dõi hiệu quả từng tin."],
    "company-candidates": ["Ứng viên", "Xử lý các hồ sơ đã được UIT kiểm duyệt và chuyển đến doanh nghiệp."],
    "company-interviews": ["Lịch phỏng vấn", "Tạo lịch, gửi lời mời và cập nhật kết quả phỏng vấn."],
    "company-notifications": ["Thông báo", "Các cập nhật từ UIT, ứng viên và hệ thống."],
  };
  const [title,description]=titles[route]||titles['company-dashboard'];
  const pageAction = route === 'company-interviews'
    ? <button className="primary-button" onClick={() => navigate('company-candidates')}><Users />Mở danh sách ứng viên</button>
    : undefined;
  const action = route === 'company-jobs' ? <button className="primary-button" onClick={() => setModal('job')}><Plus />Tạo tin tuyển dụng</button> : null;
  return <WorkspaceShell role="company" route={route} navigate={navigate} title={title} description={description} actions={pageAction || action} user={user} onLogout={onLogout}>
    {route==='company-dashboard'&&<LiveCompanyDashboard navigate={navigate}/>} {route==='company-profile'&&<CompanyProfileManagement/>} {route==='company-jobs'&&<LiveCompanyJobs refreshKey={jobsVersion} onCreate={()=>setModal({ type: 'job', job: null })} onEdit={job=>setModal({ type: 'job', job })}/>} {route==='company-candidates'&&<CompanyCandidates targetApplicationId={navigationPayload?.notification?.resourceId}/>} {route==='company-interviews'&&<LiveCompanyInterviews navigate={navigate}/>} {route==='company-notifications'&&<CompanyNotifications navigate={navigate}/>}
    {modal?.type === 'job' && <JobPostModal job={modal.job} close={() => setModal(null)} onComplete={() => { setJobsVersion(value => value + 1); setModal(null); }} />}
    {modal === 'job' && <JobPostModal close={() => setModal(null)} onComplete={() => { setJobsVersion(value => value + 1); setModal(null); }} />}
  </WorkspaceShell>;
}

function CompanyDashboard({navigate}){
  return <><div className="metric-grid four"><MetricCard label="Tin đang tuyển" value="2" helper="1 tin chờ UIT duyệt" Icon={Briefcase}/><MetricCard label="Hồ sơ mới từ UIT" value="14" helper="6 hồ sơ nhận hôm nay" Icon={Users} tone="amber"/><MetricCard label="Phỏng vấn tuần này" value="7" helper="3 lịch cần cập nhật" Icon={CalendarCheck} tone="purple"/><MetricCard label="Ứng viên đã chọn" value="9" helper="Trong tháng 8/2026" Icon={UserCheck} tone="green"/></div><div className="portal-two-column wide-left"><Panel title="Ứng viên mới cần xử lý" action={<button className="link-button" onClick={()=>navigate('company-candidates')}>Xem tất cả <ArrowRight/></button>}><div className="candidate-quick-list">{candidates.slice(0,3).map(candidate=><button key={candidate.id} onClick={()=>navigate('company-candidates')}><span className="candidate-initials">{candidate.name.split(' ').slice(-2).map(x=>x[0]).join('')}</span><div><strong>{candidate.name}</strong><small>{candidate.role} · GPA {candidate.gpa}</small></div><Status tone="info">Hồ sơ mới</Status><ArrowRight/></button>)}</div></Panel><Panel title="Hạn xử lý"><div className="sla-card urgent"><ClockCountdown/><div><strong>6 hồ sơ quá 48 giờ</strong><p>Hệ thống sẽ tiếp tục nhắc lúc 08:15 ngày mai.</p></div></div><div className="sla-card warning"><Warning/><div><strong>1 tin cần chỉnh sửa</strong><p>UIT đã phản hồi về yêu cầu thời gian làm việc.</p></div></div><button className="secondary-button full" onClick={()=>navigate('company-notifications')}>Xem tất cả việc cần làm</button></Panel></div><Panel title="Hiệu quả tin đang tuyển"><div className="simple-table company-job-summary"><div className="table-head"><span>Vị trí</span><span>Lượt xem</span><span>Ứng tuyển</span><span>UIT chuyển đến</span><span>Phỏng vấn</span><span/></div>{[["Backend Developer Intern",412,28,14,6],["Product Analyst Intern",278,16,9,3]].map(row=><button key={row[0]} onClick={()=>navigate('company-jobs')}><strong>{row[0]}</strong>{row.slice(1).map((value,index)=><span key={index}>{value}</span>)}<ArrowRight/></button>)}</div></Panel></>;
}

function CompanyProfile(){
  const [editing,setEditing]=useState(false);
  return <div className="company-profile-layout"><Panel title="Hồ sơ hiển thị" action={<button className="secondary-button small" onClick={()=>setEditing(!editing)}><PencilSimple/>{editing?'Lưu thay đổi':'Chỉnh sửa'}</button>}><div className="company-cover"><div className="company-logo vng large">VNG</div><div><h2>VNG Corporation</h2><p><SealCheck weight="fill"/>Đối tác UIT đã xác thực</p></div></div><div className="company-profile-fields"><label><span>Tên doanh nghiệp</span><input disabled={!editing} defaultValue="VNG Corporation"/></label><label><span>Website</span><input disabled={!editing} defaultValue="https://vng.com.vn"/></label><label className="full"><span>Giới thiệu</span><textarea disabled={!editing} defaultValue="VNG là doanh nghiệp công nghệ sản phẩm hàng đầu Việt Nam, phát triển các nền tảng phục vụ hàng triệu người dùng."/></label><label><span>Lĩnh vực</span><input disabled={!editing} defaultValue="Công nghệ sản phẩm"/></label><label><span>Quy mô</span><input disabled={!editing} defaultValue="1.000 – 5.000 nhân viên"/></label><label className="full"><span>Địa chỉ</span><input disabled={!editing} defaultValue="Z06, Đường số 13, Khu chế xuất Tân Thuận, Quận 7, TP.HCM"/></label></div></Panel><div><Panel title="Trạng thái hợp tác"><div className="partnership-state"><CheckCircle size={36}/><strong>Đang hoạt động</strong><p>Hồ sơ đã được UIT xác minh</p><small>Cập nhật lần cuối: 04/08/2026</small></div></Panel><Panel title="Tài khoản tuyển dụng" action={<button className="link-button"><Plus/>Mời thêm</button>}><div className="recruiter-list"><div><span>TH</span><div><strong>Lê Thu Hà</strong><small>Quản trị viên</small></div><Status tone="success">Hoạt động</Status></div><div><span>MN</span><div><strong>Nguyễn Hoàng Nam</strong><small>Nhà tuyển dụng</small></div><Status tone="success">Hoạt động</Status></div></div></Panel></div></div>;
}

function LiveCompanyJobs({ onCreate, onEdit, refreshKey }) {
  const { authorizedRequest } = useAuth();
  const [filter, setFilter] = useState("ALL");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest("/companies/me/jobs?page=1&pageSize=100");
      setJobs(response.data);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadJobs(); }, [authorizedRequest, refreshKey]);
  const filters = [
    ["ALL", "Tất cả"],
    ["DRAFT", "Bản nháp"],
    ["PENDING_UIT_REVIEW", "Chờ UIT duyệt"],
    ["REVISION_REQUIRED", "Cần chỉnh sửa"],
    ["RECRUITING", "Đang tuyển"],
    ["REJECTED", "Đã từ chối"],
  ];
  const rows = filter === "ALL" ? jobs : jobs.filter(job => job.status === filter);

  return <Panel title="Danh sách tin" action={<div className="segmented-filter job-filters">{filters.map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>}>{loading ? <div className="portal-loading"><CircleNotch className="spin" />Đang tải danh sách tin...</div> : error ? <div className="portal-error"><Warning />{error}<button className="secondary-button small" onClick={loadJobs}>Thử lại</button></div> : <><div className="simple-table company-jobs-table live-job-table"><div className="table-head"><span>Vị trí</span><span>Loại hình</span><span>Hạn nộp</span><span>Số lượng</span><span>Hình thức</span><span>Trạng thái</span><span /></div>{rows.map(job => { const [label, tone] = jobStatusCopy[job.status] || [job.status, "neutral"]; const editable = ["DRAFT", "REVISION_REQUIRED"].includes(job.status); return <button key={job.id} onClick={() => editable && onEdit(job)} className={editable ? "editable-row" : ""}><strong>{job.title}{job.latestReview?.note && job.status === "REVISION_REQUIRED" ? <small className="revision-note">UIT: {job.latestReview.note}</small> : null}</strong><span>{opportunityCopy[job.opportunityType]}</span><span>{formatDate(job.deadline)}</span><span>{job.positions}</span><span>{workModeCopy[job.workMode]}</span><span><Status tone={tone}>{label}</Status></span>{editable ? <PencilSimple /> : <DotsThree />}</button>; })}</div>{!rows.length && <EmptyHint title="Chưa có tin phù hợp" text={jobs.length ? "Hãy chọn trạng thái khác." : "Tạo tin đầu tiên để bắt đầu quy trình kiểm duyệt với UIT."} />}{!jobs.length && <div className="empty-action"><button className="primary-button" onClick={onCreate}><Plus />Tạo tin tuyển dụng</button></div>}</>}</Panel>;
}

function defaultDeadline() {
  const value = new Date();
  value.setDate(value.getDate() + 30);
  return value.toISOString().slice(0, 10);
}

function JobPostModal({ job = null, close, onComplete }) {
  const { authorizedRequest } = useAuth();
  const [form, setForm] = useState(() => ({
    title: job?.title || "",
    opportunityType: job?.opportunityType || "INTERNSHIP",
    workMode: job?.workMode || "HYBRID",
    location: job?.location || "",
    positions: job?.positions || 1,
    deadline: job?.deadline || defaultDeadline(),
    description: job?.description || "",
    requirements: job?.requirements || "",
    benefits: job?.benefits || "",
    categoryIds: job?.categories?.map(item => item.id) || [],
    skillIds: job?.skills?.map(item => item.id) || [],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const save = async (shouldSubmit) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        positions: Number(form.positions),
        benefits: form.benefits.trim() || null,
        ...(job ? { expectedVersion: job.version } : {}),
      };
      const response = await authorizedRequest(job ? `/companies/me/jobs/${job.id}` : "/companies/me/jobs", {
        method: job ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      if (shouldSubmit) {
        await authorizedRequest(`/companies/me/jobs/${response.data.id}/submit`, {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        });
      }
      onComplete();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const valid = form.title.trim().length >= 5 && form.location.trim().length >= 2 && form.description.trim().length >= 20 && form.requirements.trim().length >= 10 && Number(form.positions) > 0 && form.deadline;
  const isRevision = job?.status === "REVISION_REQUIRED";
  return <div className="modal-backdrop" onMouseDown={() => !busy && close()}><div className="modal portal-modal job-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" disabled={busy} onClick={close}><X /></button><span className="modal-icon"><Briefcase /></span><h2>{job ? "Chỉnh sửa tin tuyển dụng" : "Tạo tin tuyển dụng"}</h2><p>{isRevision ? "Cập nhật nội dung theo phản hồi của UIT rồi gửi lại để kiểm duyệt." : "Lưu bản nháp để hoàn thiện sau hoặc gửi ngay đến UIT khi nội dung đã đầy đủ."}</p>{isRevision && job.latestReview?.note && <p className="revision-callout"><Warning /><span><strong>Phản hồi từ UIT</strong>{job.latestReview.note}</span></p>}<div className="modal-form two-cols job-form"><label className="full"><span>Tên vị trí *</span><input value={form.title} onChange={event => update("title", event.target.value)} placeholder="Ví dụ: Thực tập sinh Backend" maxLength={180} /></label><label><span>Loại cơ hội *</span><select value={form.opportunityType} onChange={event => update("opportunityType", event.target.value)}><option value="INTERNSHIP">Thực tập</option><option value="FRESHER">Fresher</option><option value="FULL_TIME">Toàn thời gian</option><option value="PART_TIME">Bán thời gian</option></select></label><label><span>Hình thức làm việc *</span><select value={form.workMode} onChange={event => update("workMode", event.target.value)}><option value="ONSITE">Tại văn phòng</option><option value="HYBRID">Kết hợp</option><option value="REMOTE">Từ xa</option></select></label><label className="full"><span>Địa điểm *</span><input value={form.location} onChange={event => update("location", event.target.value)} placeholder="Quận/Thành phố hoặc địa chỉ làm việc" maxLength={255} /></label><label><span>Số lượng tuyển *</span><input type="number" min="1" max="1000" value={form.positions} onChange={event => update("positions", event.target.value)} /></label><label><span>Hạn ứng tuyển *</span><input type="date" value={form.deadline} onChange={event => update("deadline", event.target.value)} /></label><label className="full"><span>Mô tả công việc *</span><textarea value={form.description} onChange={event => update("description", event.target.value)} placeholder="Nhiệm vụ, phạm vi công việc và cách phối hợp..." maxLength={20000} /></label><label className="full"><span>Yêu cầu ứng viên *</span><textarea value={form.requirements} onChange={event => update("requirements", event.target.value)} placeholder="Kiến thức, kỹ năng, thời gian có thể làm việc..." maxLength={20000} /></label><label className="full"><span>Quyền lợi</span><textarea value={form.benefits} onChange={event => update("benefits", event.target.value)} placeholder="Trợ cấp, mentor, môi trường và cơ hội phát triển..." maxLength={10000} /></label></div>{error && <p className="form-error"><Warning />{error}</p>}<div className="modal-actions split-actions"><button className="secondary-button" disabled={busy} onClick={close}>Hủy</button><span /><button className="secondary-button" disabled={busy || !valid} onClick={() => void save(false)}>{busy ? <CircleNotch className="spin" /> : <FileText />}Lưu bản nháp</button><button className="primary-button" disabled={busy || !valid} onClick={() => void save(true)}>{busy ? <CircleNotch className="spin" /> : <PaperPlaneTilt />}Lưu & gửi UIT duyệt</button></div></div></div>;
}

function CompanyJobs({onCreate}){
  const [filter,setFilter]=useState('Tất cả');
  const rows=companyJobs.filter(job=>filter==='Tất cả'||job.status===filter);
  return <Panel title="Danh sách tin" action={<div className="segmented-filter">{['Tất cả','Đang tuyển','Chờ UIT duyệt','Đã đóng'].map(item=><button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>}><div className="simple-table company-jobs-table"><div className="table-head"><span>Vị trí</span><span>Loại hình</span><span>Hạn nộp</span><span>Ứng tuyển</span><span>UIT chuyển đến</span><span>Trạng thái</span><span/></div>{rows.map(job=><button key={job.id}><strong>{job.title}</strong><span>{job.type}</span><span>{job.deadline}</span><span>{job.applications}</span><span>{job.forwarded}</span><span><Status tone={job.status==='Đang tuyển'?'success':job.status==='Chờ UIT duyệt'?'warning':'neutral'}>{job.status}</Status></span><DotsThree/></button>)}</div>{!rows.length&&<EmptyHint title="Chưa có tin phù hợp" text="Hãy chọn trạng thái khác hoặc tạo tin mới."/>}</Panel>;
}

const companyCandidateStatusCopy = {
  UIT_REVIEWING: ["UIT đang kiểm duyệt", "warning"],
  NEEDS_SUPPLEMENT: ["Cần bổ sung hồ sơ", "urgent"],
  FORWARDED_TO_COMPANY: ["Mới từ UIT", "info"],
  COMPANY_REVIEWING: ["Đang sàng lọc", "warning"],
  INTERVIEW_INVITED: ["Đã mời phỏng vấn", "info"],
  NOT_SUITABLE: ["Không phù hợp", "urgent"],
  INTERVIEW_FAILED: ["Chưa đạt phỏng vấn", "neutral"],
  OFFER_PENDING_STUDENT: ["Chờ phản hồi offer", "success"],
  ACCEPTED_PENDING_UIT_CONFIRMATION: ["Chờ UIT xác nhận", "success"],
  HIRED: ["Đã nhận việc", "success"],
  OFFER_DECLINED: ["Từ chối offer", "neutral"],
  WITHDRAWN: ["Đã rút", "neutral"],
};

function companyCandidateStage(status) {
  if (status === "FORWARDED_TO_COMPANY") return "new";
  if (status === "COMPANY_REVIEWING") return "screening";
  if (status === "INTERVIEW_INVITED") return "interview";
  return "result";
}

function CompanyCandidateDetailModal({ application, close }) {
  const status = companyCandidateStatusCopy[application.status] || [application.status, "neutral"];
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal portal-modal candidate-detail-modal" onMouseDown={event => event.stopPropagation()}>
        <button className="modal-close" onClick={close}><X /></button>
        <div className="candidate-modal-heading">
          <span className="large-avatar small">{userInitials(application.student.fullName)}</span>
          <div><h2>{application.student.fullName}</h2><p>{application.student.studentCode} · {application.student.major}</p></div>
          <Status tone={status[1]}>{status[0]}</Status>
        </div>
        <div className="eligibility-grid candidate-detail-grid">
          <article><small>Vị trí</small><strong>{application.job.title}</strong></article>
          <article><small>GPA</small><strong>{application.student.gpa ?? "—"} / 4.0</strong></article>
          <article><small>Email UIT</small><strong>{application.student.email}</strong></article>
          <article><small>Nhận từ UIT</small><strong>{formatSubmitted(application.submittedAt)}</strong></article>
        </div>
        <section className="candidate-documents">
          <h3>Hồ sơ được UIT chuyển ({application.documents.length})</h3>
          {application.documents.map(document => <div key={document.id}><FileText /><span><strong>{document.fileName}</strong><small>{document.documentType} · Phiên bản {document.sourceVersion} · {Math.max(1, Math.round(document.fileSizeBytes / 1024))} KB</small></span><Status tone="success">Đã xác minh</Status></div>)}
        </section>
        <section className="candidate-timeline">
          <h3>Lịch sử xử lý</h3>
          {application.timeline.map((event, index) => {
            const copy = companyCandidateStatusCopy[event.toStatus]?.[0] || event.toStatus;
            return <div key={`${event.createdAt}-${index}`}><span /><div><strong>{copy}</strong><small>{formatSubmitted(event.createdAt)} · {event.actorType}</small>{event.note && <p>{event.note}</p>}</div></div>;
          })}
        </section>
        <button className="primary-button full" onClick={close}>Đóng</button>
      </div>
    </div>
  );
}

function CompanyCandidateDecisionModal({ mode, application, busy, error, close, submit, interviewerName }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState("09:30");
  const [interviewMode, setInterviewMode] = useState("ONLINE");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [interviewer, setInterviewer] = useState(interviewerName || "");
  const [offerStorageKey, setOfferStorageKey] = useState("");
  const isInterview = mode === "interview";
  const isPass = mode === "result-pass";
  const isFail = mode === "result-fail";
  const isDanger = mode === "reject" || isFail;
  const valid = isInterview
    ? Boolean(date && time && interviewer.trim().length >= 2 && (
        interviewMode === "PHONE" || (interviewMode === "ONLINE" ? meetingUrl.trim() : location.trim().length >= 3)
      ))
    : isPass ? Boolean(date) : note.trim().length >= 5;
  const send = () => {
    if (mode === "reject") {
      submit({ reasonCode: "COMPANY_NOT_SUITABLE", note: note.trim() });
      return;
    }
    if (isFail) {
      submit({ outcome: "FAIL", reasonCode: "INTERVIEW_SKILL_GAP", note: note.trim() });
      return;
    }
    if (isPass) {
      submit({
        outcome: "PASS",
        startDate: date,
        ...(offerStorageKey.trim() ? { offerStorageKey: offerStorageKey.trim() } : {}),
        ...(note.trim() ? { internalNote: note.trim() } : {}),
      });
      return;
    }
    submit({
      scheduledAt: `${date}T${time}:00+07:00`,
      timeZone: "Asia/Ho_Chi_Minh",
      mode: interviewMode,
      interviewerName: interviewer.trim(),
      ...(interviewMode === "ONLINE" ? { meetingUrl: meetingUrl.trim() } : {}),
      ...(interviewMode === "ONSITE" ? { location: location.trim() } : {}),
    });
  };
  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && close()}>
      <div className="modal portal-modal candidate-decision-modal" onMouseDown={event => event.stopPropagation()}>
        <button className="modal-close" disabled={busy} onClick={close}><X /></button>
        <span className={`modal-icon ${isDanger ? "danger" : ""}`}>{isDanger ? <Warning /> : isPass ? <CheckCircle /> : <CalendarCheck />}</span>
        <h2>{mode === "reject" ? "Chọn Không phù hợp" : isFail ? "Ghi nhận chưa đạt phỏng vấn" : isPass ? "Gửi offer cho ứng viên" : "Mời ứng viên phỏng vấn"}</h2>
        <p>{isInterview ? `Tạo lịch cho ${application.student.fullName} · ${application.job.title}.` : isPass ? `Xác nhận đạt và gửi offer cho ${application.student.fullName}.` : `Lý do sẽ được lưu và thông báo cho ${application.student.fullName}.`}</p>
        {isInterview ? (
          <div className="modal-form two-cols interview-form">
            <label><span>Ngày *</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
            <label><span>Giờ *</span><input type="time" value={time} onChange={event => setTime(event.target.value)} /></label>
            <label><span>Hình thức *</span><select value={interviewMode} onChange={event => setInterviewMode(event.target.value)}><option value="ONLINE">Trực tuyến</option><option value="ONSITE">Tại văn phòng</option><option value="PHONE">Điện thoại</option></select></label>
            <label><span>Người phỏng vấn *</span><input value={interviewer} onChange={event => setInterviewer(event.target.value)} placeholder="Họ tên người phỏng vấn" /></label>
            {interviewMode === "ONLINE" && <label className="full"><span>Đường dẫn tham gia *</span><input value={meetingUrl} onChange={event => setMeetingUrl(event.target.value)} placeholder="https://meet.google.com/..." /></label>}
            {interviewMode === "ONSITE" && <label className="full"><span>Địa điểm *</span><input value={location} onChange={event => setLocation(event.target.value)} placeholder="Văn phòng, tầng, phòng..." /></label>}
          </div>
        ) : isPass ? (
          <div className="modal-form two-cols interview-form">
            <label><span>Ngày bắt đầu dự kiến *</span><input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={event => setDate(event.target.value)} /></label>
            <label><span>Đường dẫn / mã tệp offer</span><input value={offerStorageKey} onChange={event => setOfferStorageKey(event.target.value)} placeholder="offers/offer.pdf hoặc https://..." /></label>
            <label className="full"><span>Ghi chú nội bộ</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Thông tin chỉ doanh nghiệp lưu nội bộ..." maxLength={2000} /></label>
          </div>
        ) : (
          <label className="review-note"><span>Lý do chi tiết *</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Nêu lý do ngắn gọn, chuyên nghiệp..." maxLength={2000} /></label>
        )}
        {error && <p className="form-error"><Warning />{error}</p>}
        <div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={close}>Hủy</button><button className={isDanger ? "secondary-button danger" : "primary-button"} disabled={busy || !valid} onClick={send}>{busy ? <CircleNotch className="spin" /> : isDanger ? <X /> : <PaperPlaneTilt />}{mode === "reject" ? "Xác nhận không phù hợp" : isFail ? "Xác nhận chưa đạt" : isPass ? "Gửi offer" : "Gửi lời mời"}</button></div>
      </div>
    </div>
  );
}

function CompanyCandidates({ targetApplicationId = null }) {
  const { authorizedRequest, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [jobId, setJobId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState(null);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest("/companies/me/candidates?page=1&pageSize=100");
      setItems(response.data);
      const target = response.data.find((application) => application.id === targetApplicationId);
      if (target) setDetail(target);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [authorizedRequest, targetApplicationId]);
  const jobs = useMemo(() => Array.from(new Map(items.map(item => [item.job.id, item.job.title])).entries()), [items]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter(item => (!jobId || item.job.id === jobId) && (!keyword || `${item.student.fullName} ${item.student.studentCode} ${item.job.title}`.toLowerCase().includes(keyword)));
  }, [items, jobId, search]);
  const replace = application => setItems(current => current.map(item => item.id === application.id ? application : item));
  const startReview = async application => {
    setBusyId(application.id);
    setError("");
    try {
      const response = await authorizedRequest(`/companies/me/applications/${application.id}/start-review`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
      replace(response.data);
      setMessage("Hồ sơ đã chuyển sang đang sàng lọc.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyId("");
    }
  };
  const decide = async payload => {
    const application = decision.application;
    setBusyId(application.id);
    setError("");
    try {
      if (decision.mode === "reject") {
        const response = await authorizedRequest(`/companies/me/applications/${application.id}/reject`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(payload) });
        replace(response.data);
        setMessage("Đã ghi nhận ứng viên không phù hợp.");
      } else if (decision.mode === "interview") {
        await authorizedRequest(`/companies/me/applications/${application.id}/interviews`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(payload) });
        await load();
        setMessage("Đã tạo lịch và gửi lời mời phỏng vấn.");
      } else {
        const response = await authorizedRequest(`/companies/me/applications/${application.id}/results`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(payload) });
        replace(response.data);
        setMessage(decision.mode === "result-pass" ? "Đã gửi offer và chờ sinh viên phản hồi." : "Đã ghi nhận kết quả chưa đạt.");
      }
      setDecision(null);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyId("");
    }
  };
  const columns = [{ key: "new", label: "Mới từ UIT" }, { key: "screening", label: "Đang sàng lọc" }, { key: "interview", label: "Phỏng vấn" }, { key: "result", label: "Kết quả" }];
  return (
    <>
      {message && <div className="toast"><CheckCircle weight="fill" />{message}</div>}
      <div className="portal-toolbar">
        <label className="portal-search"><MagnifyingGlass /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm ứng viên, MSSV, vị trí..." /></label>
        <label className="candidate-job-filter"><FunnelSimple /><select value={jobId} onChange={event => setJobId(event.target.value)}><option value="">Vị trí: Tất cả</option>{jobs.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? <CircleNotch className="spin" /> : <ListBullets />}Làm mới</button>
      </div>
      {error && !decision && <p className="review-error"><Warning />{error}</p>}
      {loading ? <div className="loading-state"><CircleNotch className="spin" />Đang tải hồ sơ ứng viên...</div> : (
        <div className="candidate-board live-candidate-board">
          {columns.map(column => {
            const candidatesInStage = filtered.filter(item => companyCandidateStage(item.status) === column.key);
            return <section key={column.key}><header><h2>{column.label}</h2><span>{candidatesInStage.length}</span></header><div>{!candidatesInStage.length && <p className="candidate-empty">Chưa có hồ sơ</p>}{candidatesInStage.map(application => {
              const status = companyCandidateStatusCopy[application.status] || [application.status, "neutral"];
              const busy = busyId === application.id;
              return <article key={application.id}><div className="candidate-card-heading"><span className="candidate-initials">{userInitials(application.student.fullName)}</span><div><strong>{application.student.fullName}</strong><small>{application.student.studentCode} · {application.student.major}</small></div></div><p>{application.job.title}</p><div className="candidate-meta"><span>GPA <b>{application.student.gpa ?? "—"}</b></span><Status tone={status[1]}>{status[0]}</Status></div><small className="candidate-received">Cập nhật {formatSubmitted(application.lastTransitionAt)}</small><div className={`candidate-card-actions ${application.status === "INTERVIEW_INVITED" ? "result-actions" : ""}`}><button onClick={() => setDetail(application)}><Eye />Xem</button>{application.status === "FORWARDED_TO_COMPANY" && <button className="primary wide" disabled={busy} onClick={() => void startReview(application)}>{busy ? <CircleNotch className="spin" /> : <ArrowRight />}Bắt đầu xem</button>}{application.status === "COMPANY_REVIEWING" && <><button className="reject" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "reject", application }); }}>Không phù hợp</button><button className="primary" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "interview", application }); }}><CalendarCheck />Mời PV</button></>}{application.status === "INTERVIEW_INVITED" && <><button className="reject" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "result-fail", application }); }}>Không đạt</button><button className="primary" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "result-pass", application }); }}><CheckCircle />Đạt & offer</button></>}</div></article>;
            })}</div></section>;
          })}
        </div>
      )}
      {detail && <CompanyCandidateDetailModal application={detail} close={() => setDetail(null)} />}
      {decision && <CompanyCandidateDecisionModal mode={decision.mode} application={decision.application} interviewerName={user?.displayName} busy={busyId === decision.application.id} error={error} close={() => { if (!busyId) { setDecision(null); setError(""); } }} submit={payload => void decide(payload)} />}
    </>
  );
}

function LiveCompanyInterviews({ navigate }) {
  const { authorizedRequest } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    authorizedRequest("/companies/me/interviews?page=1&pageSize=100&scope=all")
      .then(response => { if (!ignore) setInterviews(response.data); })
      .catch(requestError => { if (!ignore) setError(getApiError(requestError)); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [authorizedRequest, refreshKey]);

  const upcoming = interviews.filter(isUpcomingInterview);
  const awaitingResults = interviews.filter(interview => (
    interview.applicationStatus === "INTERVIEW_INVITED"
    && !interview.recruitmentResult
    && interview.status !== "CANCELLED"
    && new Date(interview.scheduledAt).getTime() < Date.now()
  ));

  if (loading) return <div className="portal-loading"><CircleNotch className="spin" />Đang tải lịch phỏng vấn...</div>;
  return <><div className="portal-toolbar"><span className="panel-count">{interviews.length} lịch phỏng vấn</span><button className="secondary-button" onClick={() => setRefreshKey(value => value + 1)}><ListBullets />Làm mới</button></div>{error && <p className="review-error"><Warning />{error}</p>}<div className="portal-two-column wide-left"><Panel title={`Lịch sắp tới (${upcoming.length})`}><div className="interview-agenda">{upcoming.length === 0 ? <EmptyHint icon={CalendarBlank} title="Chưa có lịch sắp tới" text="Mở bảng ứng viên để tạo lịch từ hồ sơ đang sàng lọc." /> : upcoming.map(interview => { const timing = interviewTiming(interview.scheduledAt); const status = interviewStatusCopy[interview.status] || [interview.status, "neutral"]; return <article key={interview.id}><div className="agenda-date"><strong>{timing.day}</strong><small>{timing.month}</small></div><time>{timing.time}</time><div><strong>{interview.student.fullName}</strong><small>{interview.job.title} · {interviewPlace(interview)}</small></div><Status tone={status[1]}>{status[0]}</Status><button className="agenda-action" aria-label={`Mở hồ sơ ${interview.student.fullName}`} onClick={() => navigate("company-candidates", { notification: { resourceId: interview.applicationId } })}><ArrowRight /></button></article>; })}</div></Panel><div><Panel title={`Kết quả cần cập nhật (${awaitingResults.length})`}><div className="result-list">{awaitingResults.length === 0 ? <EmptyHint icon={CheckCircle} title="Không có kết quả tồn" text="Các buổi đã qua cần xử lý sẽ xuất hiện tại đây." /> : awaitingResults.map(interview => <div key={interview.id}><span className="candidate-initials">{userInitials(interview.student.fullName)}</span><div><strong>{interview.student.fullName}</strong><small>{interview.job.title} · {interviewTiming(interview.scheduledAt).date}</small></div><button className="secondary-button small" onClick={() => navigate("company-candidates", { notification: { resourceId: interview.applicationId } })}>Cập nhật</button></div>)}</div></Panel><button className="primary-button full" onClick={() => navigate("company-candidates")}><Users />Tạo lịch từ hồ sơ ứng viên</button></div></div></>;
}

function CompanyNotifications({ navigate }){
  return <NotificationInbox role="company" onOpen={(notification, destination) => navigate(destination, { notification })} />;
}
