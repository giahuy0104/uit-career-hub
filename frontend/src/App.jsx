import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpenText,
  Briefcase,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  FilePdf,
  FileText,
  FunnelSimple,
  House,
  Info,
  ListChecks,
  MagnifyingGlass,
  MapPin,
  SealCheck,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Trash,
  UploadSimple,
  User,
  UserCircle,
  X,
  Warning,
} from "@phosphor-icons/react";
import { AdminPortal, CompanyPortal, StudentExtraScreen } from "./RolePortals";
import { useAuth } from "./auth/AuthContext.jsx";
import { CompanyActivationScreen } from "./auth/CompanyActivationScreen.jsx";
import { LoginScreen, SessionLoadingScreen } from "./auth/LoginScreen.jsx";
import { useNotifications } from "./notifications/NotificationContext.jsx";

const jobs = [
  {
    id: "vng-backend",
    role: "Thực tập sinh Backend",
    company: "VNG Corporation",
    mark: "VNG",
    markClass: "mark-vng",
    type: "Thực tập",
    location: "TP. Hồ Chí Minh",
    mode: "Hybrid",
    deadline: "18/08/2026",
    days: "13 ngày nữa",
    skills: ["Java", "Spring Boot", "PostgreSQL"],
    summary: "Tham gia phát triển API và các hệ thống backend có quy mô lớn cùng đội ngũ kỹ sư VNG.",
  },
  {
    id: "fpt-java",
    role: "Thực tập sinh Lập trình viên",
    company: "FPT Software",
    mark: "FPT",
    markClass: "mark-fpt",
    type: "Thực tập",
    location: "Hà Nội",
    mode: "Hybrid",
    deadline: "15/08/2026",
    days: "10 ngày nữa",
    skills: ["Java", "SQL", "Git"],
    summary: "Tham gia chương trình đào tạo lập trình viên trẻ và dự án chuyển đổi số cho khách hàng toàn cầu.",
  },
  {
    id: "momo-software",
    role: "Nhân viên Kỹ thuật phần mềm",
    company: "MoMo Technology",
    mark: "M",
    markClass: "mark-momo",
    type: "Toàn thời gian",
    location: "TP. Hồ Chí Minh",
    mode: "Onsite",
    deadline: "22/08/2026",
    days: "17 ngày nữa",
    skills: ["React", "TypeScript", "Testing"],
    summary: "Xây dựng trải nghiệm thanh toán số an toàn, ổn định và dễ sử dụng cho hàng triệu người dùng.",
  },
  {
    id: "nashtech-fresher",
    role: "Developer Fresher",
    company: "NashTech Vietnam",
    mark: "NT",
    markClass: "mark-nash",
    type: "Toàn thời gian",
    location: "Đà Nẵng",
    mode: "Hybrid",
    deadline: "25/08/2026",
    days: "20 ngày nữa",
    skills: [".NET", "C#", "Azure"],
    summary: "Bắt đầu lộ trình kỹ sư phần mềm với dự án quốc tế và chương trình mentoring cho fresher.",
  },
];

const otherApplications = [
  { role: "Thực tập sinh Data Engineer", company: "FPT Software", date: "28/07/2026", status: "UIT kiểm duyệt", tone: "pending", next: "Chờ UIT kiểm tra hồ sơ" },
  { role: "Thực tập sinh DevOps", company: "MoMo", date: "25/07/2026", status: "Đã chuyển DN", tone: "success", next: "Chờ phản hồi từ DN" },
  { role: "Thực tập sinh Frontend", company: "Tiki", date: "22/07/2026", status: "Đã nộp", tone: "neutral", next: "Chờ UIT tiếp nhận" },
];

function AppLogo({ compact = false }) {
  return (
    <button className={`brand ${compact ? "brand-compact" : ""}`} onClick={() => window.dispatchEvent(new CustomEvent("navigate-home"))}>
      <span className="brand-symbol"><SealCheck size={compact ? 26 : 34} weight="duotone" /></span>
      <span><strong>UIT Career Hub</strong><small>Kết nối tri thức · Dẫn lối sự nghiệp</small></span>
    </button>
  );
}

function getInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "UIT";
}

function StudentIdentity({ inverse = false, user }) {
  const name = user?.displayName || "Sinh viên UIT";
  const meta = user?.organization ? `MSSV ${user.organization}` : user?.email;
  return (
    <button className={`student-identity ${inverse ? "inverse" : ""}`}>
      <span className="avatar">{getInitials(name)}</span>
      <span><strong>{name}</strong><small>{meta}</small></span>
      <CaretDown size={16} />
    </button>
  );
}

function TopHeader({ route, navigate, user, onLogout }) {
  const { unreadCount } = useNotifications();
  return (
    <header className="top-header">
      <AppLogo />
      <nav className="top-nav" aria-label="Điều hướng chính">
        <button className={route === "jobs" ? "active" : ""} onClick={() => navigate("jobs")}><Briefcase size={19} />Việc làm</button>
        <button className={route === "companies" ? "active" : ""} onClick={() => navigate("companies")}><Buildings size={19} />Doanh nghiệp</button>
        <button className={route === "applications" ? "active" : ""} onClick={() => navigate("applications")}><FileText size={19} />Đơn ứng tuyển</button>
        <button className={route === "notifications" ? "active" : ""} onClick={() => navigate("notifications")}><Bell size={19} />Thông báo{unreadCount > 0 && <span className="notification-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
      </nav>
      <div className="top-session"><StudentIdentity user={user} /><button className="top-signout" title="Đăng xuất" onClick={onLogout}><SignOut size={20} /></button></div>
    </header>
  );
}

function CompanyMark({ job, size = "md" }) {
  return <span className={`company-mark ${job.markClass} ${size}`}>{job.mark}</span>;
}

function JobsScreen({ navigate, user, onLogout }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("vng-backend");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [internOnly, setInternOnly] = useState(false);
  const selected = jobs.find((job) => job.id === selectedId) || jobs[0];
  const filtered = useMemo(() => jobs.filter((job) => {
    const haystack = `${job.role} ${job.company} ${job.skills.join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (!internOnly || job.type === "Thực tập");
  }), [query, internOnly]);

  return (
    <div className="screen jobs-screen">
      <TopHeader route="jobs" navigate={navigate} user={user} onLogout={onLogout} />
      <div className="jobs-layout">
        <main className="jobs-list-pane">
          <div className="page-heading-row">
            <div><p className="eyebrow">CẬP NHẬT 05/08/2026</p><h1>Cơ hội dành cho bạn</h1><p>Chỉ hiển thị tin từ doanh nghiệp đối tác đã được UIT xác thực.</p></div>
            <button className="saved-link"><BookOpenText size={19} />Việc đã lưu <span>4</span></button>
          </div>
          <div className="search-row">
            <label className="search-field"><MagnifyingGlass size={22} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm vị trí, công ty hoặc kỹ năng" /></label>
            <button className={`secondary-button ${filtersOpen ? "selected" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><FunnelSimple size={20} />Bộ lọc</button>
          </div>
          {filtersOpen && (
            <div className="filter-strip">
              <span><SlidersHorizontal size={18} />Lọc nhanh</span>
              <button className={internOnly ? "chip selected" : "chip"} onClick={() => setInternOnly(!internOnly)}>Chỉ thực tập</button>
              <button className="chip">Hybrid</button><button className="chip">TP. Hồ Chí Minh</button>
              <button className="text-button" onClick={() => setInternOnly(false)}>Xóa lọc</button>
            </div>
          )}
          <section className="job-group" aria-label="Danh sách việc làm">
            <div className="job-table-header"><span>Cơ hội</span><span>Loại hình</span><span>Địa điểm</span><span>Hạn nộp</span><span>Xác thực</span></div>
            {filtered.length ? filtered.map((job) => (
              <button key={job.id} className={`job-row ${selectedId === job.id ? "selected" : ""}`} onClick={() => setSelectedId(job.id)}>
                <span className="job-title-cell"><CompanyMark job={job} /><span><strong>{job.role}</strong><small>{job.company}</small></span></span>
                <span><span className={`type-pill ${job.type === "Thực tập" ? "intern" : "fulltime"}`}>{job.type}</span></span>
                <span className="muted-cell"><MapPin size={17} /><span>{job.location}<small>{job.mode}</small></span></span>
                <span>{job.deadline}<small>{job.days}</small></span>
                <span className="verified"><ShieldCheck size={18} weight="fill" />Đối tác UIT</span>
              </button>
            )) : <div className="empty-state"><MagnifyingGlass size={32} /><strong>Không tìm thấy cơ hội phù hợp</strong><span>Hãy thử từ khóa hoặc bộ lọc khác.</span></div>}
          </section>
        </main>
        <aside className="job-detail-pane">
          <div className="detail-company"><CompanyMark job={selected} size="lg" /><span className="verified-tag"><SealCheck size={15} weight="fill" />Đối tác UIT</span></div>
          <h2>{selected.role}</h2><p className="company-name">{selected.company}</p>
          <div className="meta-line"><span><MapPin size={17} />{selected.location}</span><span><Buildings size={17} />{selected.mode}</span><span><Briefcase size={17} />{selected.type}</span></div>
          <section className="detail-section"><h3>Mô tả công việc</h3><p>{selected.summary}</p><ul><li>Tham gia phát triển và bảo trì các hệ thống sản phẩm.</li><li>Thiết kế API, viết tài liệu và phối hợp kiểm thử.</li><li>Làm việc cùng mentor và cập nhật tiến độ theo sprint.</li></ul></section>
          <section className="detail-section"><h3>Yêu cầu chính</h3><ul><li>Sinh viên năm 3, 4 hoặc mới tốt nghiệp ngành CNTT.</li><li>Nắm vững cấu trúc dữ liệu, giải thuật và lập trình hướng đối tượng.</li><li>Chủ động, có trách nhiệm và sẵn sàng học hỏi.</li></ul></section>
          <section className="detail-section"><h3>Kỹ năng</h3><div className="skill-list">{selected.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
          <div className="readiness-box"><span className="progress-ring">85%</span><span><strong>Hồ sơ đã hoàn thiện 85%</strong><small>Cần bổ sung bảng điểm</small></span><button onClick={() => navigate("apply")}>Cập nhật hồ sơ <CaretRight size={15} /></button></div>
          <button className="primary-button full" onClick={() => navigate("apply")}>Ứng tuyển</button>
          <p className="privacy-note"><ShieldCheck size={19} />CV của bạn chỉ được gửi đến doanh nghiệp sau khi UIT xác minh đơn ứng tuyển.</p>
        </aside>
      </div>
    </div>
  );
}

function Sidebar({ navigate, user, onLogout }) {
  const { unreadCount } = useNotifications();
  const items = [
    ["Tổng quan", House, "dashboard"], ["Việc làm", Briefcase, "jobs"], ["Đơn ứng tuyển", FileText, "applications"], ["Hồ sơ & CV", User, "profile"], ["Lịch phỏng vấn", CalendarBlank, "interviews"], ["Thông báo", Bell, "notifications"],
  ];
  return <aside className="sidebar"><AppLogo compact /><nav>{items.map(([label, Icon, destination]) => <button key={label} className={label === "Đơn ứng tuyển" ? "active" : ""} onClick={() => destination && navigate(destination)}><Icon size={21} />{label}{label === "Thông báo" && unreadCount > 0 && <span className="side-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>)}</nav><div className="sidebar-user"><StudentIdentity inverse user={user} /><button title="Đăng xuất" onClick={onLogout}><SignOut size={20} /></button></div></aside>;
}

function ApplicationsScreen({ navigate, user, onLogout }) {
  const [statusFilter, setStatusFilter] = useState("Tất cả trạng thái");
  const [modal, setModal] = useState(null);
  const [withdrawn, setWithdrawn] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  return (
    <div className="screen applications-screen">
      <Sidebar navigate={navigate} user={user} onLogout={onLogout} />
      <main className="applications-content">
        <header className="applications-header"><div><h1>Đơn ứng tuyển của tôi</h1><p>Theo dõi người đang xử lý và bước tiếp theo của từng đơn.</p></div><div className="applications-tools"><label className="search-field compact"><MagnifyingGlass size={20} /><input placeholder="Tìm vị trí, công ty..." /></label><label className="select-control"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>Tất cả trạng thái</option><option>UIT kiểm duyệt</option><option>Đã chuyển doanh nghiệp</option><option>Mời phỏng vấn</option></select><CaretDown size={15} /></label></div></header>
        <section className="active-application">
          <div className="application-title"><CompanyMark job={jobs[0]} size="lg" /><span><h2>Thực tập sinh Backend</h2><p>VNG Corporation</p><small><CalendarBlank size={15} />Đã nộp: 04/08/2026</small></span><span className={`status-pill ${withdrawn ? "neutral" : "pending"}`}>{withdrawn ? "ĐÃ RÚT" : "ĐANG XỬ LÝ"}</span></div>
          <div className="journey">
            {["Đã nộp", "UIT kiểm duyệt", "Đã chuyển doanh nghiệp", "Phỏng vấn", "Kết quả"].map((label, index) => <div className={`journey-step ${index === 0 ? "done" : index === 1 && !withdrawn ? "current" : ""}`} key={label}><span>{index === 0 ? <Check size={18} /> : index + 1}</span><strong>{label}</strong><small>{index === 0 ? "04/08/2026" : index === 1 && !withdrawn ? "Đang thực hiện" : "Chưa bắt đầu"}</small></div>)}
          </div>
          <div className="owner-action"><div className="owner-block"><span className="owner-icon"><UserCircle size={31} /></span><span><strong>{withdrawn ? "Đơn ứng tuyển đã được rút" : "Đang chờ Bộ phận phụ trách UIT kiểm tra hồ sơ"}</strong><p>{withdrawn ? "Hệ thống đã dừng quy trình và lưu lịch sử thao tác." : "Hồ sơ của bạn đang được kiểm tra theo quy trình của UIT."}</p>{!withdrawn && <small>Dự kiến trước <b>06/08/2026</b></small>}</span></div><div className="owner-buttons"><button className="primary-button" onClick={() => setModal("profile")}><FileText size={19} />Xem hồ sơ đã nộp</button>{!withdrawn && <button className="secondary-button danger" onClick={() => setModal("withdraw")}><Trash size={18} />Rút đơn</button>}</div></div>
          <p className="info-banner"><Info size={22} />Doanh nghiệp chưa thể xem CV và hồ sơ của bạn cho đến khi UIT phê duyệt và chuyển hồ sơ.</p>
        </section>
        <div className="applications-lower">
          <section className="application-table-section"><h3>Các đơn ứng tuyển khác</h3><div className="application-table"><div className="application-table-head"><span>Vị trí ứng tuyển</span><span>Công ty</span><span>Ngày nộp</span><span>Trạng thái hiện tại</span><span>Bước tiếp theo</span></div>{otherApplications.filter((item) => statusFilter === "Tất cả trạng thái" || item.status.includes(statusFilter.replace("Đã chuyển doanh nghiệp", "Đã chuyển"))).map((item) => <button className="application-row" key={item.role}><strong>{item.role}</strong><span>{item.company}</span><span>{item.date}</span><span><i className={`status-tag ${item.tone}`}>{item.status}</i></span><span>{item.next}<CaretRight size={15} /></span></button>)}</div></section>
          <aside className="notification-panel"><div className="panel-title"><h3>Thông báo mới</h3><button>Xem tất cả</button></div><div className="interview-notification"><span className="notification-icon"><CalendarBlank size={24} /></span><div><strong>Lịch phỏng vấn sắp tới</strong><p>Thực tập sinh Data Engineer tại FPT Software</p><small><CalendarBlank size={15} />Thứ Sáu, 07/08/2026</small><small><Clock size={15} />09:30 – 10:15 · Google Meet</small><button>Xem chi tiết <CaretRight size={14} /></button></div></div></aside>
        </div>
      </main>
      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}><X size={20} /></button>{modal === "profile" ? <><span className="modal-icon"><FileText size={26} /></span><h2>Hồ sơ đã nộp</h2><p>CV_Backend_NguyenMinhKhoa_2026.pdf</p><div className="modal-list"><span><CheckCircle size={18} />Tài khoản sinh viên đang hoạt động</span><span><CheckCircle size={18} />CV đã chọn</span><span><Warning size={18} />Bảng điểm đang chờ bổ sung</span></div><button className="primary-button full" onClick={() => setModal(null)}>Đóng</button></> : <><span className="modal-icon danger"><Warning size={26} /></span><h2>Rút đơn ứng tuyển?</h2><p>UIT và doanh nghiệp sẽ dừng xử lý đơn này. Lý do và lịch sử thao tác sẽ được lưu lại.</p><label className="withdraw-reason"><span>Lý do rút đơn <b>*</b></span><textarea value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} placeholder="Ví dụ: Đã nhận việc ở vị trí khác" maxLength={300} /></label><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>Giữ lại đơn</button><button className="primary-button danger-fill" disabled={!withdrawReason.trim()} onClick={() => { setWithdrawn(true); setModal(null); }}>Xác nhận rút</button></div></>}</div></div>}
    </div>
  );
}

function ApplyScreen({ navigate, user, onLogout }) {
  const [step, setStep] = useState(1);
  const [cv, setCv] = useState("backend");
  const [transcript, setTranscript] = useState(false);
  const [consent, setConsent] = useState(true);
  const [saved, setSaved] = useState(false);
  const ready = transcript && consent;
  const next = () => { if (step === 1 && ready) setStep(2); else if (step === 2) navigate("applications"); };
  return (
    <div className="screen apply-screen">
      <TopHeader route="jobs" navigate={navigate} user={user} onLogout={onLogout} />
      <div className="apply-breadcrumb"><button onClick={() => navigate("jobs")}><ArrowLeft size={17} />Việc làm</button><CaretRight size={14} /><span>VNG</span><CaretRight size={14} /><span>Ứng tuyển</span></div>
      <div className="apply-layout">
        <main className="apply-main">
          <h1>Ứng tuyển Thực tập sinh Backend</h1>
          <div className="apply-steps">{["Hồ sơ & tài liệu", "Kiểm tra & xác nhận"].map((label, index) => <button key={label} className={`${step === index + 1 ? "current" : ""} ${step > index + 1 ? "done" : ""}`} onClick={() => index + 1 < step && setStep(index + 1)}><span>{step > index + 1 ? <Check size={17} /> : index + 1}</span>{label}</button>)}</div>
          {step === 1 && <div className="form-content">
            <p className="info-banner slim"><Info size={20} />Vui lòng hoàn thiện hồ sơ để UIT kiểm tra trước khi chia sẻ với nhà tuyển dụng.</p>
            <section className="form-section"><h2>Thông tin sinh viên <small>được lấy từ hệ thống UIT</small></h2><div className="identity-grid"><span><UserCircle size={27} /><span><small>Họ và tên</small><strong>Nguyễn Minh Khoa</strong><em>MSSV 20521067</em></span></span><span><BookOpenText size={27} /><span><small>Khoa / Ngành</small><strong>Khoa Công nghệ phần mềm</strong><em>Khóa 2020</em></span></span><span><FileText size={27} /><span><small>Email UIT</small><strong>20521067@student.uit.edu.vn</strong><em>0901 234 567</em></span></span></div></section>
            <section className="form-section"><h2>Chọn CV ứng tuyển</h2><p>UIT sẽ dùng CV đã chọn khi chuyển hồ sơ sau khi xác minh.</p><div className="cv-list"><label className={cv === "backend" ? "selected" : ""}><input type="radio" name="cv" checked={cv === "backend"} onChange={() => setCv("backend")} /><FilePdf size={24} weight="fill" /><span><strong>CV_Backend_NguyenMinhKhoa_2026.pdf</strong><small>Cập nhật 02/08/2026 · 412 KB</small></span><i>Đã chọn</i></label><label className={cv === "general" ? "selected" : ""}><input type="radio" name="cv" checked={cv === "general"} onChange={() => setCv("general")} /><FilePdf size={24} weight="fill" /><span><strong>CV_NguyenMinhKhoa_2025.pdf</strong><small>Cập nhật 15/04/2025 · 398 KB</small></span><button>Xem trước</button></label></div><button className="text-button"><UploadSimple size={17} />Tải lên CV khác</button></section>
            <section className="form-section"><h2>Hồ sơ & tài liệu bắt buộc</h2><div className="document-list"><div><CheckCircle size={22} weight="fill" /><FileText size={20} /><span><strong>Giấy xác nhận sinh viên</strong><small>Còn hiệu lực đến 15/10/2026</small></span><i className="success">Đã có</i></div><div className={transcript ? "" : "missing"}>{transcript ? <CheckCircle size={22} weight="fill" /> : <Warning size={22} weight="fill" />}<FileText size={20} /><span><strong>Bảng điểm có xác nhận</strong><small>{transcript ? "Đã tải lên 05/08/2026" : "Chưa tải lên"}</small></span><button onClick={() => setTranscript(!transcript)}>{transcript ? "Thay đổi" : "Tải lên"}</button></div><div><CheckCircle size={22} weight="fill" /><FileText size={20} /><span><strong>CCCD</strong><small>Đã xác thực</small></span><i className="success">Đã có</i></div></div>{!transcript && <p className="warning-banner"><Warning size={19} weight="fill" />Bạn còn thiếu Bảng điểm có xác nhận. Vui lòng tải lên để tiếp tục.</p>}</section>
            <section className="form-section two-column-fields"><div><h2>Kỹ năng phù hợp</h2><div className="skill-list"><span>Java</span><span>Spring Boot</span><span>PostgreSQL</span><span>Git</span></div></div><label><span>Thời gian có thể bắt đầu</span><input type="date" defaultValue="2026-10-01" /></label></section>
            <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><ShieldCheck size={25} /><span>Tôi đồng ý để UIT kiểm tra hồ sơ. CV và thông tin cá nhân chỉ được chia sẻ với VNG sau khi UIT xác nhận tôi đủ điều kiện tham gia.</span></label>
          </div>}
          {step === 2 && <div className="form-content confirmation-step"><button className="back-link" onClick={() => setStep(1)}><ArrowLeft size={16} />Quay lại hồ sơ</button><span className="confirmation-icon"><ListChecks size={36} /></span><h2>Kiểm tra trước khi gửi</h2><p>Đơn sẽ được chuyển đến Bộ phận phụ trách UIT để xác minh trước khi doanh nghiệp nhận CV.</p><div className="confirm-list"><span><CheckCircle size={20} />Tài khoản sinh viên UIT đang hoạt động</span><span><CheckCircle size={20} />Đã chọn {cv === "backend" ? "CV Backend 2026" : "CV tổng quát 2025"}</span><span><CheckCircle size={20} />Đã có bảng điểm và giấy xác nhận</span><span><CheckCircle size={20} />Đã đồng ý phạm vi chia sẻ dữ liệu</span></div></div>}
          <footer className="apply-footer"><button className="secondary-button" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2200); }}><FileText size={18} />Lưu nháp</button><button className="primary-button" disabled={step === 1 && !ready} onClick={next}>{step === 2 ? "Gửi đơn ứng tuyển" : "Tiếp tục"}<ArrowRight size={18} /></button></footer>
        </main>
        <aside className="apply-summary"><div className="summary-company"><CompanyMark job={jobs[0]} size="lg" /><span><strong>VNG</strong><small><SealCheck size={15} weight="fill" />Đối tác đã xác thực</small></span></div><h2>Thực tập sinh Backend</h2><div className="summary-meta"><span><MapPin size={18} />Hybrid · TP. Hồ Chí Minh</span><span><CalendarBlank size={18} />Hạn ứng tuyển: 18/08/2026</span><span><User size={18} />Số lượng tuyển: 10</span></div><section><h3>Yêu cầu kỹ năng</h3><div className="skill-list"><span>Java</span><span>Spring Boot</span><span>PostgreSQL</span><span>Git</span></div></section><section><h3>UIT sẽ kiểm tra</h3><ul className="verify-list"><li className="done"><CheckCircle size={21} /><span><strong>Tài khoản sinh viên đang hoạt động</strong><small>Xác minh bạn là sinh viên UIT hợp lệ</small></span></li><li className={transcript ? "done" : "pending"}>{transcript ? <CheckCircle size={21} /> : <CircleNotch size={21} />}<span><strong>Hồ sơ & tài liệu bắt buộc</strong><small>Kiểm tra đầy đủ và hợp lệ</small></span></li><li><Clock size={21} /><span><strong>Điều kiện tham gia vòng tuyển dụng</strong><small>Kiểm tra theo quy định của UIT và doanh nghiệp</small></span></li></ul></section><p className="privacy-note boxed"><Info size={20} />Chỉ khi hồ sơ được UIT xác minh thành công, CV và thông tin của bạn mới được chia sẻ với VNG.</p><div className="support-block"><strong>Cần hỗ trợ?</strong><span>careers@uit.edu.vn</span><span>(028) 372 52002 · Nhánh 3</span></div></aside>
      </div>
      {saved && <div className="toast"><CheckCircle size={21} weight="fill" />Đã lưu bản nháp</div>}
    </div>
  );
}

const opportunityLabels = {
  INTERNSHIP: "Thực tập",
  PART_TIME: "Bán thời gian",
  FULL_TIME: "Toàn thời gian",
  FRESHER: "Fresher",
};

const workModeLabels = { ONSITE: "Tại văn phòng", REMOTE: "Từ xa", HYBRID: "Hybrid" };

const applicationStatusLabels = {
  UIT_REVIEWING: "UIT đang kiểm duyệt",
  NEEDS_SUPPLEMENT: "Cần bổ sung hồ sơ",
  FORWARDED_TO_COMPANY: "Đã chuyển doanh nghiệp",
  COMPANY_REVIEWING: "Doanh nghiệp đang xem",
  INTERVIEW_INVITED: "Mời phỏng vấn",
  NOT_SUITABLE: "Không phù hợp",
  INTERVIEW_FAILED: "Chưa đạt phỏng vấn",
  OFFER_PENDING_STUDENT: "Chờ phản hồi offer",
  ACCEPTED_PENDING_UIT_CONFIRMATION: "Chờ UIT xác nhận",
  HIRED: "Đã nhận việc",
  OFFER_DECLINED: "Đã từ chối offer",
  UIT_REJECTED: "UIT từ chối",
  WITHDRAWN: "Đã rút đơn",
};

const applicationDocumentTypeLabels = {
  CV: "CV ứng tuyển",
  TRANSCRIPT: "Bảng điểm",
  STUDENT_CONFIRMATION: "Giấy xác nhận sinh viên",
  OTHER: "Tài liệu khác",
};

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatBytes(value) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function LiveCompanyMark({ company, size = "md" }) {
  return <span className={`company-mark ${size}`}>{(company?.code || company?.name || "DN").slice(0, 3).toUpperCase()}</span>;
}

function LiveJobsScreen({ navigate, user, onLogout }) {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [internOnly, setInternOnly] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingJobs(true);
    Promise.all([
      authorizedRequest("/jobs?page=1&pageSize=100"),
      authorizedRequest("/applications?page=1&pageSize=100"),
    ]).then(([jobResponse, applicationResponse]) => {
      if (!active) return;
      setItems(jobResponse.data);
      setApplications(applicationResponse.data);
      setSelectedId((current) => current || jobResponse.data[0]?.id || null);
      setLoadError("");
    }).catch((error) => {
      if (active) setLoadError(error.message);
    }).finally(() => {
      if (active) setLoadingJobs(false);
    });
    return () => { active = false; };
  }, [authorizedRequest]);

  const appliedJobIds = useMemo(() => new Set(applications.map((application) => application.job.id)), [applications]);
  const filtered = useMemo(() => items.filter((job) => {
    const haystack = `${job.title} ${job.company.name} ${job.skills.map((skill) => skill.name).join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (!internOnly || job.opportunityType === "INTERNSHIP");
  }), [items, query, internOnly]);
  const selected = items.find((job) => job.id === selectedId) || filtered[0] || items[0];

  return (
    <div className="screen jobs-screen">
      <TopHeader route="jobs" navigate={navigate} user={user} onLogout={onLogout} />
      <div className="jobs-layout">
        <main className="jobs-list-pane">
          <div className="page-heading-row">
            <div><p className="eyebrow">TIN ĐÃ ĐƯỢC UIT DUYỆT</p><h1>Cơ hội dành cho bạn</h1><p>Chỉ hiển thị tin còn hạn từ doanh nghiệp đối tác đang hoạt động.</p></div>
            <button className="saved-link" onClick={() => navigate("applications")}><FileText size={19} />Đơn đã nộp <span>{applications.length}</span></button>
          </div>
          <div className="search-row">
            <label className="search-field"><MagnifyingGlass size={22} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm vị trí, công ty hoặc kỹ năng" /></label>
            <button className={`secondary-button ${filtersOpen ? "selected" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><FunnelSimple size={20} />Bộ lọc</button>
          </div>
          {filtersOpen && <div className="filter-strip"><span><SlidersHorizontal size={18} />Lọc nhanh</span><button className={internOnly ? "chip selected" : "chip"} onClick={() => setInternOnly(!internOnly)}>Chỉ thực tập</button><button className="text-button" onClick={() => setInternOnly(false)}>Xóa lọc</button></div>}
          <section className="job-group" aria-label="Danh sách việc làm">
            <div className="job-table-header"><span>Cơ hội</span><span>Loại hình</span><span>Địa điểm</span><span>Hạn nộp</span><span>Xác thực</span></div>
            {loadingJobs ? <div className="portal-loading"><CircleNotch className="spin" size={22} />Đang tải tin tuyển dụng...</div> : loadError ? <div className="portal-error"><Warning size={21} />{loadError}</div> : filtered.length ? filtered.map((job) => (
              <button key={job.id} className={`job-row ${selected?.id === job.id ? "selected" : ""}`} onClick={() => setSelectedId(job.id)}>
                <span className="job-title-cell"><LiveCompanyMark company={job.company} /><span><strong>{job.title}</strong><small>{job.company.name}</small></span></span>
                <span><span className={`type-pill ${job.opportunityType === "INTERNSHIP" ? "intern" : "fulltime"}`}>{opportunityLabels[job.opportunityType]}</span></span>
                <span className="muted-cell"><MapPin size={17} /><span>{job.location}<small>{workModeLabels[job.workMode]}</small></span></span>
                <span>{formatDate(job.deadline)}<small>{appliedJobIds.has(job.id) ? "Đã ứng tuyển" : `${job.positions} vị trí`}</small></span>
                <span className="verified"><ShieldCheck size={18} weight="fill" />Đối tác UIT</span>
              </button>
            )) : <div className="empty-state"><MagnifyingGlass size={32} /><strong>Không tìm thấy cơ hội phù hợp</strong><span>Hãy thử từ khóa hoặc bộ lọc khác.</span></div>}
          </section>
        </main>
        <aside className="job-detail-pane">
          {selected ? <>
            <div className="detail-company"><LiveCompanyMark company={selected.company} size="lg" /><span className="verified-tag"><SealCheck size={15} weight="fill" />Đối tác UIT</span></div>
            <h2>{selected.title}</h2><p className="company-name">{selected.company.name}</p>
            <div className="meta-line"><span><MapPin size={17} />{selected.location}</span><span><Buildings size={17} />{workModeLabels[selected.workMode]}</span><span><Briefcase size={17} />{opportunityLabels[selected.opportunityType]}</span></div>
            <section className="detail-section"><h3>Mô tả công việc</h3><p className="preserve-lines">{selected.description}</p></section>
            <section className="detail-section"><h3>Yêu cầu</h3><p className="preserve-lines">{selected.requirements}</p></section>
            {selected.benefits && <section className="detail-section"><h3>Quyền lợi</h3><p className="preserve-lines">{selected.benefits}</p></section>}
            <section className="detail-section"><h3>Kỹ năng</h3><div className="skill-list">{selected.skills.length ? selected.skills.map((skill) => <span key={skill.id}>{skill.name}</span>) : <small>Doanh nghiệp chưa gắn kỹ năng.</small>}</div></section>
            <div className="readiness-box"><span className="progress-ring"><ShieldCheck size={24} /></span><span><strong>Tin đã được UIT kiểm duyệt</strong><small>Hạn nộp {formatDate(selected.deadline)}</small></span></div>
            <button className="primary-button full" disabled={appliedJobIds.has(selected.id)} onClick={() => navigate("apply", { job: selected })}>{appliedJobIds.has(selected.id) ? "Đã ứng tuyển" : "Ứng tuyển"}</button>
            <p className="privacy-note"><ShieldCheck size={19} />CV chỉ được gửi đến doanh nghiệp sau khi UIT kiểm tra và chuyển hồ sơ.</p>
          </> : <div className="portal-loading">Chọn một tin để xem chi tiết.</div>}
        </aside>
      </div>
    </div>
  );
}

function applicationStage(status) {
  if (["UIT_REVIEWING", "NEEDS_SUPPLEMENT", "UIT_REJECTED"].includes(status)) return 1;
  if (["FORWARDED_TO_COMPANY", "COMPANY_REVIEWING", "NOT_SUITABLE"].includes(status)) return 2;
  if (["INTERVIEW_INVITED", "INTERVIEW_FAILED"].includes(status)) return 3;
  if (["OFFER_PENDING_STUDENT", "ACCEPTED_PENDING_UIT_CONFIRMATION", "HIRED", "OFFER_DECLINED"].includes(status)) return 4;
  return 0;
}

function LiveApplicationsScreen({ navigate, user, onLogout, targetApplicationId = null }) {
  const { authorizedRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [offerDecision, setOfferDecision] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [withdrawalAction, setWithdrawalAction] = useState("");
  const [withdrawalReasonCode, setWithdrawalReasonCode] = useState("STUDENT_CHANGED_PLAN");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalBusy, setWithdrawalBusy] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [supplementDocuments, setSupplementDocuments] = useState([]);
  const [selectedSupplementIds, setSelectedSupplementIds] = useState([]);
  const [supplementLoading, setSupplementLoading] = useState(false);
  const [supplementBusy, setSupplementBusy] = useState(false);
  const [supplementError, setSupplementError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingApplications(true);
    authorizedRequest("/applications?page=1&pageSize=100").then((response) => {
      if (!active) return;
      setItems(response.data);
      setSelectedId((current) => response.data.some((application) => application.id === targetApplicationId)
        ? targetApplicationId
        : current || response.data[0]?.id || null);
      setLoadError("");
    }).catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoadingApplications(false); });
    return () => { active = false; };
  }, [authorizedRequest, targetApplicationId]);

  const filtered = useMemo(() => items.filter((application) => {
    const matchesQuery = `${application.job.title} ${application.job.company.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!statusFilter || application.status === statusFilter);
  }), [items, query, statusFilter]);
  const selected = items.find((application) => application.id === selectedId) || filtered[0] || items[0];
  const stage = selected ? applicationStage(selected.status) : 0;
  const terminal = selected && ["NOT_SUITABLE", "INTERVIEW_FAILED", "OFFER_DECLINED", "UIT_REJECTED", "WITHDRAWN"].includes(selected.status);
  const supplementRequest = selected?.timeline.slice().reverse().find((event) => event.toStatus === "NEEDS_SUPPLEMENT");
  const requiredSupplementTypes = supplementRequest?.metadata?.requiredDocumentTypes || [];
  const journeyLabels = ["Đã nộp", "UIT kiểm duyệt", "Doanh nghiệp xử lý", "Phỏng vấn", "Kết quả"];
  const openOfferDecision = (decision) => {
    setOfferDecision(decision);
    setOfferNote("");
    setOfferError("");
  };
  const openWithdrawal = (action) => {
    setWithdrawalAction(action);
    setWithdrawalReasonCode(action === "CANCEL_INTERVIEW" ? "STUDENT_SCHEDULE_CONFLICT" : "STUDENT_CHANGED_PLAN");
    setWithdrawalNote("");
    setWithdrawalError("");
  };
  const submitWithdrawal = async () => {
    if (!selected || !withdrawalAction) return;
    setWithdrawalBusy(true);
    setWithdrawalError("");
    try {
      const endpoint = withdrawalAction === "CANCEL_INTERVIEW" ? "cancel-interview" : "withdraw";
      const response = await authorizedRequest(`/applications/${selected.id}/${endpoint}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ reasonCode: withdrawalReasonCode, note: withdrawalNote.trim() }),
      });
      setItems(current => current.map(application => application.id === response.data.id ? response.data : application));
      setMessage(withdrawalAction === "CANCEL_INTERVIEW"
        ? "Đã hủy tham gia phỏng vấn, lưu lý do và thông báo cho UIT cùng doanh nghiệp."
        : "Đã rút đơn, lưu lý do và thông báo cho đơn vị đang xử lý.");
      setWithdrawalAction("");
      setWithdrawalNote("");
    } catch (error) {
      setWithdrawalError(error.message);
    } finally {
      setWithdrawalBusy(false);
    }
  };
  const openSupplement = async () => {
    if (!selected) return;
    setSupplementOpen(true);
    setSupplementLoading(true);
    setSupplementError("");
    setSupplementDocuments([]);
    setSelectedSupplementIds([]);
    try {
      const response = await authorizedRequest("/students/me/documents");
      const submittedIds = new Set(selected.documents.map((document) => document.sourceDocumentId).filter(Boolean));
      const available = response.data.filter((document) =>
        document.verificationStatus === "VERIFIED" && !submittedIds.has(document.id));
      setSupplementDocuments(available);
      setSelectedSupplementIds(available
        .filter((document) => requiredSupplementTypes.includes(document.documentType))
        .map((document) => document.id));
    } catch (error) {
      setSupplementError(error.message);
    } finally {
      setSupplementLoading(false);
    }
  };
  const selectedSupplementTypes = new Set(supplementDocuments
    .filter((document) => selectedSupplementIds.includes(document.id))
    .map((document) => document.documentType));
  const missingSupplementTypes = requiredSupplementTypes.filter((documentType) =>
    !selectedSupplementTypes.has(documentType));
  const submitSupplement = async () => {
    if (!selected || !selectedSupplementIds.length || missingSupplementTypes.length) return;
    setSupplementBusy(true);
    setSupplementError("");
    try {
      const response = await authorizedRequest(`/applications/${selected.id}/resubmit`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          documents: selectedSupplementIds.map((documentId) => ({ documentId })),
          consentToShare: true,
        }),
      });
      setItems(current => current.map(application => application.id === response.data.id ? response.data : application));
      setSupplementOpen(false);
      setMessage("Đã gửi tài liệu bổ sung. Hồ sơ đã quay lại hàng đợi kiểm duyệt của UIT.");
    } catch (error) {
      setSupplementError(error.message);
    } finally {
      setSupplementBusy(false);
    }
  };
  const respondToOffer = async () => {
    if (!selected || !offerDecision) return;
    setOfferBusy(true);
    setOfferError("");
    try {
      const response = await authorizedRequest(`/applications/${selected.id}/offer/${offerDecision}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        ...(offerDecision === "decline" ? { body: JSON.stringify({ reasonCode: "STUDENT_DECLINED_OFFER", note: offerNote.trim() }) } : {}),
      });
      setItems(current => current.map(application => application.id === response.data.id ? response.data : application));
      setMessage(offerDecision === "accept" ? "Bạn đã nhận offer. UIT sẽ xác nhận nơi thực tập ở bước tiếp theo." : "Đã ghi nhận từ chối offer và lưu lý do trong lịch sử.");
      setOfferDecision("");
      setOfferNote("");
    } catch (error) {
      setOfferError(error.message);
    } finally {
      setOfferBusy(false);
    }
  };

  return (
    <div className="screen applications-screen">
      <Sidebar navigate={navigate} user={user} onLogout={onLogout} />
      <main className="applications-content">
        {message && <div className="toast"><CheckCircle weight="fill" />{message}</div>}
        <header className="applications-header"><div><h1>Đơn ứng tuyển của tôi</h1><p>Theo dõi người đang xử lý và lịch sử của từng đơn.</p></div><div className="applications-tools"><label className="search-field compact"><MagnifyingGlass size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm vị trí, công ty..." /></label><label className="select-control"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(applicationStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><CaretDown size={15} /></label></div></header>
        {loadingApplications ? <div className="portal-loading"><CircleNotch className="spin" size={22} />Đang tải đơn ứng tuyển...</div> : loadError ? <div className="portal-error"><Warning size={21} />{loadError}</div> : !items.length ? <div className="active-application empty-state"><FileText size={36} /><strong>Bạn chưa có đơn ứng tuyển</strong><span>Hãy chọn một cơ hội phù hợp để bắt đầu.</span><button className="primary-button" onClick={() => navigate("jobs")}>Xem việc làm</button></div> : selected && <>
          <section className="active-application">
            <div className="application-title"><LiveCompanyMark company={selected.job.company} size="lg" /><span><h2>{selected.job.title}</h2><p>{selected.job.company.name}</p><small><CalendarBlank size={15} />Đã nộp: {formatDate(selected.submittedAt)}</small></span><span className={`status-pill ${terminal ? "neutral" : "pending"}`}>{applicationStatusLabels[selected.status]}</span></div>
            <div className="journey">{journeyLabels.map((label, index) => <div className={`journey-step ${index < stage ? "done" : index === stage && !terminal ? "current" : ""}`} key={label}><span>{index < stage ? <Check size={18} /> : index + 1}</span><strong>{label}</strong><small>{index === 0 ? formatDate(selected.submittedAt) : index === stage && !terminal ? "Đang thực hiện" : index < stage ? "Đã hoàn tất" : "Chưa bắt đầu"}</small></div>)}</div>
            <div className="owner-action"><div className="owner-block"><span className="owner-icon"><UserCircle size={31} /></span><span><strong>{applicationStatusLabels[selected.status]}</strong><p>{selected.status === "UIT_REVIEWING" ? "Bộ phận phụ trách UIT đang kiểm tra tư cách và tài liệu đã nộp." : selected.status === "NEEDS_SUPPLEMENT" ? "UIT đã ghi rõ tài liệu còn thiếu. Hãy bổ sung trước hạn để hồ sơ được kiểm duyệt lại." : selected.status === "OFFER_PENDING_STUDENT" ? "Doanh nghiệp đang chờ quyết định của bạn. Hãy kiểm tra ngày bắt đầu trước khi phản hồi." : selected.status === "ACCEPTED_PENDING_UIT_CONFIRMATION" ? "Bạn đã nhận offer. UIT đang đối chiếu thông tin trước khi xác nhận nơi thực tập." : selected.status === "HIRED" ? "UIT đã xác nhận nơi thực tập. Các đơn khác còn hoạt động đã được hệ thống đóng và lưu lịch sử." : terminal ? "Quy trình của đơn này đã dừng. Lịch sử vẫn được lưu trong hệ thống." : "Đơn đang được xử lý theo quy trình tuyển dụng của nhà trường."}</p></span></div><div className="owner-buttons"><button className="secondary-button" onClick={() => setDocumentsOpen(true)}><FileText size={19} />Xem hồ sơ</button>{selected.availableActions.includes("WITHDRAW") && <button className="secondary-button danger" onClick={() => openWithdrawal("WITHDRAW")}><Trash size={18} />Rút đơn</button>}{selected.availableActions.includes("CANCEL_INTERVIEW") && <button className="secondary-button danger" onClick={() => openWithdrawal("CANCEL_INTERVIEW")}><X size={18} />Hủy tham gia PV</button>}{selected.availableActions.includes("RESUBMIT") && <button className="primary-button" onClick={() => void openSupplement()}><UploadSimple size={18} />Bổ sung hồ sơ</button>}{selected.status === "OFFER_PENDING_STUDENT" && <><button className="secondary-button danger" onClick={() => openOfferDecision("decline")}><X size={18} />Từ chối</button><button className="primary-button" onClick={() => openOfferDecision("accept")}><CheckCircle size={19} />Nhận offer</button></>}</div></div>
            {selected.status === "OFFER_PENDING_STUDENT" && selected.recruitmentResult && <div className="offer-summary"><span className="offer-summary-icon"><Briefcase size={25} /></span><span><small>LỜI MỜI NHẬN VIỆC</small><strong>Ngày bắt đầu dự kiến: {formatDate(selected.recruitmentResult.startDate)}</strong><p>{selected.recruitmentResult.offerStorageKey ? "Doanh nghiệp đã đính kèm tài liệu offer." : "Offer được xác nhận trực tiếp trên hệ thống."}</p></span><i className="status-tag pending">Chờ bạn phản hồi</i></div>}
            {selected.status === "NEEDS_SUPPLEMENT" && supplementRequest && <div className="supplement-request-card"><Warning size={24} /><span><small>YÊU CẦU BỔ SUNG TỪ UIT</small><strong>{supplementRequest.note}</strong><p>Cần nộp: {requiredSupplementTypes.map((type) => applicationDocumentTypeLabels[type] || type).join(", ")} · Hạn {formatDate(supplementRequest.metadata.dueAt)}</p></span><button className="primary-button" onClick={() => void openSupplement()}><UploadSimple size={18} />Chọn tài liệu</button></div>}
            {selected.status === "UIT_REVIEWING" && <p className="info-banner"><Info size={22} />Doanh nghiệp chưa thể xem CV cho đến khi UIT phê duyệt và chuyển hồ sơ.</p>}
            <section className="student-application-history"><h3>Lịch sử xử lý</h3><div>{selected.timeline.slice().reverse().slice(0, 6).map((event, index) => <article key={`${event.createdAt}-${index}`}><span className="history-dot"><Check size={12} /></span><div><strong>{applicationStatusLabels[event.toStatus] || event.toStatus}</strong><small>{formatDate(event.createdAt)} · {event.actorType}</small>{event.note && <p>{event.note}</p>}</div></article>)}</div></section>
          </section>
          <section className="application-table-section live-applications-table"><h3>Tất cả đơn ứng tuyển ({filtered.length})</h3><div className="application-table"><div className="application-table-head"><span>Vị trí ứng tuyển</span><span>Công ty</span><span>Ngày nộp</span><span>Trạng thái hiện tại</span><span>Bước tiếp theo</span></div>{filtered.map((application) => <button className={`application-row ${application.id === selected.id ? "selected" : ""}`} key={application.id} onClick={() => setSelectedId(application.id)}><strong>{application.job.title}</strong><span>{application.job.company.name}</span><span>{formatDate(application.submittedAt)}</span><span><i className="status-tag pending">{applicationStatusLabels[application.status]}</i></span><span>Xem chi tiết <CaretRight size={15} /></span></button>)}</div></section>
        </>}
      </main>
      {documentsOpen && selected && <div className="modal-backdrop" onMouseDown={() => setDocumentsOpen(false)}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setDocumentsOpen(false)}><X size={20} /></button><span className="modal-icon"><FileText size={26} /></span><h2>Hồ sơ đã nộp</h2><p>Đây là bản chụp tài liệu tại thời điểm gửi đơn.</p><div className="modal-list">{selected.documents.map((document) => <span key={document.id}><CheckCircle size={18} />{document.fileName} · {formatBytes(document.fileSizeBytes)}</span>)}</div><button className="primary-button full" onClick={() => setDocumentsOpen(false)}>Đóng</button></div></div>}
      {supplementOpen && selected && <div className="modal-backdrop" onMouseDown={() => !supplementBusy && setSupplementOpen(false)}><div className="modal supplement-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" disabled={supplementBusy} onClick={() => setSupplementOpen(false)}><X size={20} /></button><span className="modal-icon"><UploadSimple size={26} /></span><h2>Bổ sung hồ sơ</h2><p>Chọn phiên bản tài liệu mới đã được xác minh. Tài liệu cũ vẫn được giữ lại trong snapshot để UIT đối chiếu.</p><div className="supplement-requirements"><strong>UIT yêu cầu</strong><span>{requiredSupplementTypes.map((type) => applicationDocumentTypeLabels[type] || type).join(", ")}</span><small>Hạn nộp: {formatDate(supplementRequest?.metadata?.dueAt)}</small></div>{supplementLoading ? <div className="portal-loading"><CircleNotch className="spin" />Đang tải tài liệu...</div> : <div className="supplement-document-list">{supplementDocuments.length ? supplementDocuments.map((document) => { const checked = selectedSupplementIds.includes(document.id); const requested = requiredSupplementTypes.includes(document.documentType); return <label className={`supplement-document ${checked ? "selected" : ""}`} key={document.id}><input type="checkbox" checked={checked} onChange={() => setSelectedSupplementIds((current) => checked ? current.filter((id) => id !== document.id) : [...current, document.id])} /><FileText size={21} /><span><strong>{document.fileName}</strong><small>{applicationDocumentTypeLabels[document.documentType] || document.documentType} · Phiên bản {document.version} · {formatBytes(document.fileSizeBytes)}</small></span>{requested && <i>Bắt buộc</i>}</label>; }) : <div className="supplement-empty"><Warning size={24} /><strong>Chưa có tài liệu mới phù hợp</strong><span>Hãy cập nhật và xác minh tài liệu trong hồ sơ sinh viên trước khi nộp lại.</span></div>}</div>}{missingSupplementTypes.length > 0 && !supplementLoading && <p className="form-error"><Warning size={18} />Còn thiếu: {missingSupplementTypes.map((type) => applicationDocumentTypeLabels[type] || type).join(", ")}.</p>}{supplementError && <p className="form-error"><Warning size={18} />{supplementError}</p>}<p className="supplement-consent"><ShieldCheck size={18} />Khi nộp lại, bạn đồng ý chia sẻ các tài liệu đã chọn với UIT và doanh nghiệp sau khi hồ sơ được duyệt.</p><div className="modal-actions"><button className="secondary-button" disabled={supplementBusy} onClick={() => setSupplementOpen(false)}>Để sau</button><button className="primary-button" disabled={supplementLoading || supplementBusy || !selectedSupplementIds.length || missingSupplementTypes.length > 0} onClick={() => void submitSupplement()}>{supplementBusy ? <CircleNotch className="spin" size={18} /> : <UploadSimple size={18} />}Nộp hồ sơ bổ sung</button></div></div></div>}
      {withdrawalAction && selected && <div className="modal-backdrop" onMouseDown={() => !withdrawalBusy && setWithdrawalAction("")}><div className="modal withdrawal-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" disabled={withdrawalBusy} onClick={() => setWithdrawalAction("")}><X size={20} /></button><span className="modal-icon danger"><Warning size={26} /></span><h2>{withdrawalAction === "CANCEL_INTERVIEW" ? "Hủy tham gia phỏng vấn?" : "Rút đơn ứng tuyển?"}</h2><p>{withdrawalAction === "CANCEL_INTERVIEW" ? <>Lịch phỏng vấn với <strong>{selected.job.company.name}</strong> sẽ được hủy và đơn chuyển sang Đã rút.</> : <>UIT và doanh nghiệp sẽ dừng xử lý đơn vị trí <strong>{selected.job.title}</strong>.</>} Lý do và thao tác được lưu trong lịch sử.</p><div className="withdrawal-form"><label><span>Nhóm lý do *</span><select value={withdrawalReasonCode} onChange={(event) => setWithdrawalReasonCode(event.target.value)}>{withdrawalAction === "CANCEL_INTERVIEW" && <option value="STUDENT_SCHEDULE_CONFLICT">Trùng lịch học hoặc lịch cá nhân</option>}<option value="STUDENT_CHANGED_PLAN">Thay đổi kế hoạch cá nhân</option><option value="STUDENT_ACCEPTED_OTHER_OPPORTUNITY">Đã chọn cơ hội khác</option><option value="STUDENT_OTHER_REASON">Lý do khác</option></select></label><label><span>Lý do chi tiết *</span><textarea value={withdrawalNote} onChange={(event) => setWithdrawalNote(event.target.value)} placeholder="Mô tả ngắn gọn để UIT và doanh nghiệp nắm được lý do..." maxLength={2000} /></label></div>{withdrawalError && <p className="form-error"><Warning size={18} />{withdrawalError}</p>}<div className="modal-actions"><button className="secondary-button" disabled={withdrawalBusy} onClick={() => setWithdrawalAction("")}>Giữ lại đơn</button><button className="primary-button danger-fill" disabled={withdrawalBusy || withdrawalNote.trim().length < 5} onClick={() => void submitWithdrawal()}>{withdrawalBusy ? <CircleNotch className="spin" size={18} /> : <Trash size={18} />}{withdrawalAction === "CANCEL_INTERVIEW" ? "Xác nhận hủy tham gia" : "Xác nhận rút đơn"}</button></div></div></div>}
      {offerDecision && selected && <div className="modal-backdrop" onMouseDown={() => !offerBusy && setOfferDecision("")}><div className="modal offer-decision-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" disabled={offerBusy} onClick={() => setOfferDecision("")}><X size={20} /></button><span className={`modal-icon ${offerDecision === "decline" ? "danger" : ""}`}>{offerDecision === "accept" ? <CheckCircle size={26} /> : <Warning size={26} />}</span><h2>{offerDecision === "accept" ? "Xác nhận nhận offer" : "Từ chối offer"}</h2><p>{offerDecision === "accept" ? <>Bạn chọn <strong>{selected.job.company.name}</strong> cho vị trí <strong>{selected.job.title}</strong>. UIT sẽ xác nhận trước khi đóng các đơn còn lại.</> : <>Lý do từ chối sẽ được lưu trong lịch sử và gửi đến doanh nghiệp.</>}</p>{offerDecision === "decline" && <label className="offer-decline-note"><span>Lý do *</span><textarea value={offerNote} onChange={(event) => setOfferNote(event.target.value)} placeholder="Ví dụ: Tôi đã chọn một cơ hội phù hợp hơn..." maxLength={2000} /></label>}{offerError && <p className="form-error"><Warning size={18} />{offerError}</p>}<div className="modal-actions"><button className="secondary-button" disabled={offerBusy} onClick={() => setOfferDecision("")}>Hủy</button><button className={offerDecision === "accept" ? "primary-button" : "secondary-button danger"} disabled={offerBusy || (offerDecision === "decline" && offerNote.trim().length < 5)} onClick={() => void respondToOffer()}>{offerBusy ? <CircleNotch className="spin" size={18} /> : offerDecision === "accept" ? <CheckCircle size={18} /> : <X size={18} />}{offerDecision === "accept" ? "Xác nhận nhận offer" : "Xác nhận từ chối"}</button></div></div></div>}
    </div>
  );
}

function LiveApplyScreen({ job, navigate, user, onLogout }) {
  const { authorizedRequest } = useAuth();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedCv, setSelectedCv] = useState("");
  const [selectedSupport, setSelectedSupport] = useState([]);
  const [consent, setConsent] = useState(false);
  const [loadingForm, setLoadingForm] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [commandId] = useState(() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-0000-4000-8000-000000000000`);

  useEffect(() => {
    if (!job) { setLoadingForm(false); return undefined; }
    let active = true;
    Promise.all([authorizedRequest("/students/me"), authorizedRequest("/students/me/documents")])
      .then(([profileResponse, documentResponse]) => {
        if (!active) return;
        setProfile(profileResponse.data);
        setDocuments(documentResponse.data);
        const verified = documentResponse.data.filter((document) => document.verificationStatus === "VERIFIED");
        const defaultCv = verified.find((document) => document.documentType === "CV" && document.isDefault) || verified.find((document) => document.documentType === "CV");
        setSelectedCv(defaultCv?.id || "");
        setSelectedSupport(verified.filter((document) => document.documentType !== "CV").map((document) => document.id));
      }).catch((error) => setFormError(error.message)).finally(() => { if (active) setLoadingForm(false); });
    return () => { active = false; };
  }, [authorizedRequest, job]);

  if (!job) return <div className="screen apply-screen"><TopHeader route="jobs" navigate={navigate} user={user} onLogout={onLogout} /><div className="empty-state apply-empty"><Briefcase size={38} /><strong>Chưa chọn tin tuyển dụng</strong><span>Quay lại danh sách và chọn “Ứng tuyển” tại một tin còn hạn.</span><button className="primary-button" onClick={() => navigate("jobs")}>Quay lại việc làm</button></div></div>;

  const verifiedCvs = documents.filter((document) => document.documentType === "CV" && document.verificationStatus === "VERIFIED");
  const supportDocuments = documents.filter((document) => document.documentType !== "CV");
  const ready = Boolean(profile && selectedCv && consent);
  const submitApplication = async () => {
    setSubmitting(true);
    setFormError("");
    try {
      await authorizedRequest("/applications", {
        method: "POST",
        headers: { "Idempotency-Key": commandId },
        body: JSON.stringify({ jobId: job.id, documents: [selectedCv, ...selectedSupport].map((documentId) => ({ documentId })), consentToShare: true }),
      });
      navigate("applications");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen apply-screen">
      <TopHeader route="jobs" navigate={navigate} user={user} onLogout={onLogout} />
      <div className="apply-breadcrumb"><button onClick={() => navigate("jobs")}><ArrowLeft size={17} />Việc làm</button><CaretRight size={14} /><span>{job.company.code}</span><CaretRight size={14} /><span>Ứng tuyển</span></div>
      <div className="apply-layout">
        <main className="apply-main">
          <h1>Ứng tuyển {job.title}</h1>
          <div className="apply-steps">{["Hồ sơ & tài liệu", "Kiểm tra & xác nhận"].map((label, index) => <button key={label} className={`${step === index + 1 ? "current" : ""} ${step > index + 1 ? "done" : ""}`} onClick={() => index + 1 < step && setStep(index + 1)}><span>{step > index + 1 ? <Check size={17} /> : index + 1}</span>{label}</button>)}</div>
          {loadingForm ? <div className="portal-loading"><CircleNotch className="spin" size={22} />Đang tải hồ sơ...</div> : step === 1 ? <div className="form-content">
            <p className="info-banner slim"><Info size={20} />Thông tin bên dưới được lấy từ hồ sơ UIT. Chỉ tài liệu đã xác minh mới có thể gửi.</p>
            {profile && <section className="form-section"><h2>Thông tin sinh viên <small>được lấy từ hệ thống UIT</small></h2><div className="identity-grid"><span><UserCircle size={27} /><span><small>Họ và tên</small><strong>{profile.fullName}</strong><em>MSSV {profile.studentCode}</em></span></span><span><BookOpenText size={27} /><span><small>Khoa / Ngành</small><strong>{profile.faculty}</strong><em>{profile.major} · Khóa {profile.cohort}</em></span></span><span><FileText size={27} /><span><small>Email UIT</small><strong>{profile.email}</strong><em>Trạng thái: {profile.academicStatus}</em></span></span></div></section>}
            <section className="form-section"><h2>Chọn CV ứng tuyển</h2><p>Phải chọn một CV đã được UIT xác minh.</p><div className="cv-list">{verifiedCvs.length ? verifiedCvs.map((document) => <label className={selectedCv === document.id ? "selected" : ""} key={document.id}><input type="radio" name="cv" checked={selectedCv === document.id} onChange={() => setSelectedCv(document.id)} /><FilePdf size={24} weight="fill" /><span><strong>{document.fileName}</strong><small>Phiên bản {document.version} · {formatBytes(document.fileSizeBytes)}</small></span>{selectedCv === document.id && <i>Đã chọn</i>}</label>) : <div className="portal-error"><Warning size={20} />Chưa có CV đã xác minh. Vui lòng liên hệ UIT để cập nhật hồ sơ.</div>}</div></section>
            <section className="form-section"><h2>Tài liệu hỗ trợ <small>không bắt buộc</small></h2><div className="document-list">{supportDocuments.map((document) => { const verified = document.verificationStatus === "VERIFIED"; const checked = selectedSupport.includes(document.id); return <label className={!verified ? "missing document-choice" : "document-choice"} key={document.id}><input type="checkbox" disabled={!verified} checked={checked} onChange={() => setSelectedSupport((current) => checked ? current.filter((id) => id !== document.id) : [...current, document.id])} />{verified ? <CheckCircle size={22} weight="fill" /> : <Warning size={22} weight="fill" />}<FileText size={20} /><span><strong>{document.fileName}</strong><small>{verified ? `Đã xác minh · ${formatBytes(document.fileSizeBytes)}` : "Chưa được xác minh"}</small></span></label>; })}</div></section>
            <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><ShieldCheck size={25} /><span>Tôi đồng ý để UIT kiểm tra hồ sơ và chuyển các tài liệu đã chọn cho {job.company.name} nếu hồ sơ đủ điều kiện.</span></label>
          </div> : <div className="form-content confirmation-step"><button className="back-link" onClick={() => setStep(1)}><ArrowLeft size={16} />Quay lại hồ sơ</button><span className="confirmation-icon"><ListChecks size={36} /></span><h2>Kiểm tra trước khi gửi</h2><p>Đơn sẽ chuyển sang trạng thái “UIT đang kiểm duyệt”. Doanh nghiệp chưa nhận CV ở bước này.</p><div className="confirm-list"><span><CheckCircle size={20} />Tài khoản {profile?.studentCode} đang hoạt động</span><span><CheckCircle size={20} />Đã chọn {documents.find((document) => document.id === selectedCv)?.fileName}</span><span><CheckCircle size={20} />Có {selectedSupport.length} tài liệu hỗ trợ</span><span><CheckCircle size={20} />Đã đồng ý phạm vi chia sẻ dữ liệu</span></div></div>}
          {formError && <p className="form-error"><Warning size={18} />{formError}</p>}
          <footer className="apply-footer"><button className="secondary-button" onClick={() => navigate("jobs")}><ArrowLeft size={18} />Hủy</button><button className="primary-button" disabled={submitting || (step === 1 && !ready)} onClick={() => step === 1 ? setStep(2) : void submitApplication()}>{submitting ? <><CircleNotch className="spin" size={18} />Đang gửi...</> : <>{step === 2 ? "Gửi đơn ứng tuyển" : "Tiếp tục"}<ArrowRight size={18} /></>}</button></footer>
        </main>
        <aside className="apply-summary"><div className="summary-company"><LiveCompanyMark company={job.company} size="lg" /><span><strong>{job.company.name}</strong><small><SealCheck size={15} weight="fill" />Đối tác đã xác thực</small></span></div><h2>{job.title}</h2><div className="summary-meta"><span><MapPin size={18} />{workModeLabels[job.workMode]} · {job.location}</span><span><CalendarBlank size={18} />Hạn ứng tuyển: {formatDate(job.deadline)}</span><span><User size={18} />Số lượng tuyển: {job.positions}</span></div><section><h3>Yêu cầu kỹ năng</h3><div className="skill-list">{job.skills.map((skill) => <span key={skill.id}>{skill.name}</span>)}</div></section><p className="privacy-note boxed"><Info size={20} />UIT kiểm tra hồ sơ trước; chỉ hồ sơ đạt mới được chuyển cho doanh nghiệp.</p></aside>
      </div>
    </div>
  );
}

export function App() {
  const { user, loading, login, logout, activateCompanyAccount } = useAuth();
  const [route, setRoute] = useState("jobs");
  const [selectedJob, setSelectedJob] = useState(null);
  const [navigationPayload, setNavigationPayload] = useState(null);
  const role = user?.role === "UIT_ADMIN" ? "admin" : user?.role === "COMPANY" ? "company" : "student";
  const navigate = (destination, payload = null) => { if (payload?.job) setSelectedJob(payload.job); setNavigationPayload(payload); setRoute(destination); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => {
    if (!user) return;
    setNavigationPayload(null);
    setRoute(role === "admin" ? "admin-dashboard" : role === "company" ? "company-dashboard" : "jobs");
  }, [user?.id, role]);

  if (loading) return <SessionLoadingScreen />;
  const activationToken = new URLSearchParams(window.location.search).get("activationToken");
  if (activationToken) return <CompanyActivationScreen token={activationToken} activate={activateCompanyAccount} onDone={() => { const url = new URL(window.location.href); url.searchParams.delete("activationToken"); window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`); window.location.reload(); }} />;
  if (!user) return <LoginScreen onLogin={login} />;

  let content;
  if (role === "admin") content = <AdminPortal route={route} navigate={navigate} navigationPayload={navigationPayload} user={user} onLogout={logout} />;
  else if (role === "company") content = <CompanyPortal route={route} navigate={navigate} navigationPayload={navigationPayload} user={user} onLogout={logout} />;
  else if (route === "applications") content = <LiveApplicationsScreen navigate={navigate} targetApplicationId={navigationPayload?.notification?.resourceId} user={user} onLogout={logout} />;
  else if (route === "apply") content = <LiveApplyScreen job={selectedJob} navigate={navigate} user={user} onLogout={logout} />;
  else if (["dashboard", "companies", "profile", "interviews", "notifications"].includes(route)) content = <StudentExtraScreen route={route} navigate={navigate} user={user} onLogout={logout} />;
  else content = <LiveJobsScreen navigate={navigate} user={user} onLogout={logout} />;
  return content;
}
