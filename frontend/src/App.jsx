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
import { LoginScreen, SessionLoadingScreen } from "./auth/LoginScreen.jsx";

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
  return (
    <header className="top-header">
      <AppLogo />
      <nav className="top-nav" aria-label="Điều hướng chính">
        <button className={route === "jobs" ? "active" : ""} onClick={() => navigate("jobs")}><Briefcase size={19} />Việc làm</button>
        <button className={route === "companies" ? "active" : ""} onClick={() => navigate("companies")}><Buildings size={19} />Doanh nghiệp</button>
        <button className={route === "applications" ? "active" : ""} onClick={() => navigate("applications")}><FileText size={19} />Đơn ứng tuyển</button>
        <button className={route === "notifications" ? "active" : ""} onClick={() => navigate("notifications")}><Bell size={19} />Thông báo<span className="notification-dot">3</span></button>
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
  const items = [
    ["Tổng quan", House, "dashboard"], ["Việc làm", Briefcase, "jobs"], ["Đơn ứng tuyển", FileText, "applications"], ["Hồ sơ & CV", User, "profile"], ["Lịch phỏng vấn", CalendarBlank, "interviews"], ["Thông báo", Bell, "notifications"],
  ];
  return <aside className="sidebar"><AppLogo compact /><nav>{items.map(([label, Icon, destination]) => <button key={label} className={label === "Đơn ứng tuyển" ? "active" : ""} onClick={() => destination && navigate(destination)}><Icon size={21} />{label}{label === "Thông báo" && <span className="side-count">2</span>}</button>)}</nav><div className="sidebar-user"><StudentIdentity inverse user={user} /><button title="Đăng xuất" onClick={onLogout}><SignOut size={20} /></button></div></aside>;
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

export function App() {
  const { user, loading, login, logout } = useAuth();
  const [route, setRoute] = useState("jobs");
  const role = user?.role === "UIT_ADMIN" ? "admin" : user?.role === "COMPANY" ? "company" : "student";
  const navigate = (destination) => { setRoute(destination); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => {
    if (!user) return;
    setRoute(role === "admin" ? "admin-dashboard" : role === "company" ? "company-dashboard" : "jobs");
  }, [user?.id, role]);

  if (loading) return <SessionLoadingScreen />;
  if (!user) return <LoginScreen onLogin={login} />;

  let content;
  if (role === "admin") content = <AdminPortal route={route} navigate={navigate} user={user} onLogout={logout} />;
  else if (role === "company") content = <CompanyPortal route={route} navigate={navigate} user={user} onLogout={logout} />;
  else if (route === "applications") content = <ApplicationsScreen navigate={navigate} user={user} onLogout={logout} />;
  else if (route === "apply") content = <ApplyScreen navigate={navigate} user={user} onLogout={logout} />;
  else if (["dashboard", "companies", "profile", "interviews", "notifications"].includes(route)) content = <StudentExtraScreen route={route} navigate={navigate} user={user} onLogout={logout} />;
  else content = <JobsScreen navigate={navigate} user={user} onLogout={logout} />;
  return content;
}
