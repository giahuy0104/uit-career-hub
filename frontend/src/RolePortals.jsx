import { useMemo, useState } from "react";
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

const studentNavigation = [
  ["dashboard", "Tổng quan", House],
  ["jobs", "Việc làm", Briefcase],
  ["companies", "Doanh nghiệp", Buildings],
  ["applications", "Đơn ứng tuyển", FileText, 3],
  ["profile", "Hồ sơ & CV", User],
  ["interviews", "Lịch phỏng vấn", CalendarBlank, 1],
  ["notifications", "Thông báo", Bell, 2],
];

const adminNavigation = [
  ["admin-dashboard", "Tổng quan", House],
  ["admin-companies", "Doanh nghiệp đối tác", Buildings],
  ["admin-jobs", "Duyệt tin tuyển dụng", Briefcase, 6],
  ["admin-applications", "Duyệt hồ sơ sinh viên", UserCheck, 12],
  ["admin-placements", "Theo dõi kết quả", GraduationCap],
  ["admin-scheduler", "Nhắc việc & tác vụ", ClockCountdown, 2],
  ["admin-reports", "Báo cáo", ChartBar],
  ["admin-access", "Tài khoản & nhật ký", ShieldCheck],
];

const companyNavigation = [
  ["company-dashboard", "Tổng quan", House],
  ["company-profile", "Hồ sơ doanh nghiệp", Buildings],
  ["company-jobs", "Tin tuyển dụng", Briefcase, 2],
  ["company-candidates", "Ứng viên", Users, 14],
  ["company-interviews", "Lịch phỏng vấn", CalendarCheck, 3],
  ["company-notifications", "Thông báo", Bell, 4],
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
  { id: 1, name: "Nguyễn Minh Khoa", major: "Kỹ thuật phần mềm", gpa: "3.42", role: "Backend Intern", stage: "new", score: 86 },
  { id: 2, name: "Lê Thành Đạt", major: "Mạng máy tính", gpa: "3.36", role: "Backend Intern", stage: "new", score: 81 },
  { id: 3, name: "Trần Khánh Linh", major: "Hệ thống thông tin", gpa: "3.67", role: "Product Intern", stage: "screening", score: 90 },
  { id: 4, name: "Võ Minh Anh", major: "Khoa học máy tính", gpa: "3.51", role: "Backend Intern", stage: "interview", score: 88 },
  { id: 5, name: "Phạm Gia Huy", major: "Khoa học dữ liệu", gpa: "3.18", role: "Product Intern", stage: "result", score: 79 },
];

function Brand({ inverse = false }) {
  return <div className={`portal-brand ${inverse ? "inverse" : ""}`}><span><SealCheck size={27} weight="duotone" /></span><div><strong>UIT Career Hub</strong><small>Kết nối tri thức · Dẫn lối sự nghiệp</small></div></div>;
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

function WorkspaceShell({ role, route, navigate, children, title, description, actions }) {
  const identity = portalCopy[role];
  const navigation = role === "admin" ? adminNavigation : role === "company" ? companyNavigation : studentNavigation;
  return (
    <div className={`workspace-shell role-${role}`}>
      <aside className="workspace-sidebar">
        <Brand inverse />
        <div className="workspace-role"><small>KHÔNG GIAN LÀM VIỆC</small><strong>{identity.label}</strong></div>
        <nav>{navigation.map(([key, label, Icon, count]) => <button key={key} className={route === key ? "active" : ""} onClick={() => navigate(key)}><Icon size={20} /><span>{label}</span>{count ? <i>{count}</i> : null}</button>)}</nav>
        <div className="workspace-identity"><span>{identity.initials}</span><div><strong>{identity.name}</strong><small>{identity.meta}</small></div><button aria-label="Đăng xuất"><SignOut size={19} /></button></div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <div><span>UIT Career Hub</span><ArrowRight size={13} /><strong>{title}</strong></div>
          <div className="workspace-top-actions"><label><MagnifyingGlass size={18} /><input placeholder="Tìm nhanh..." /></label><button className="icon-button"><Bell size={20} /><i /></button><button className="workspace-avatar">{identity.initials}</button></div>
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

export function StudentExtraScreen({ route, navigate }) {
  const [profilePercent, setProfilePercent] = useState(85);
  const titles = {
    dashboard: ["Tổng quan", "Thông tin quan trọng và bước tiếp theo trong hành trình nghề nghiệp của bạn."],
    companies: ["Doanh nghiệp đối tác", "Khám phá các doanh nghiệp đã được UIT xác thực và đang hợp tác tuyển dụng."],
    profile: ["Hồ sơ & CV", "Quản lý hồ sơ dùng cho quy trình UIT kiểm duyệt và chuyển đến doanh nghiệp."],
    interviews: ["Lịch phỏng vấn", "Theo dõi lịch hẹn, hình thức và kết quả phỏng vấn của bạn."],
    notifications: ["Thông báo", "Các cập nhật từ UIT, doanh nghiệp và hệ thống."],
  };
  const [title, description] = titles[route] || titles.dashboard;
  return (
    <WorkspaceShell role="student" route={route} navigate={navigate} title={title} description={description} actions={route === "dashboard" ? <button className="primary-button" onClick={() => navigate("jobs")}><MagnifyingGlass size={18} />Tìm việc ngay</button> : null}>
      {route === "dashboard" && <StudentDashboard navigate={navigate} />}
      {route === "companies" && <CompaniesScreen />}
      {route === "profile" && <ProfileScreen percent={profilePercent} setPercent={setProfilePercent} />}
      {route === "interviews" && <InterviewsScreen />}
      {route === "notifications" && <StudentNotifications />}
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

function CompaniesScreen() {
  const [query, setQuery] = useState("");
  const companies = [
    ["VNG", "VNG Corporation", "Công nghệ sản phẩm", "7 vị trí", "TP. Hồ Chí Minh", "VNG"],
    ["FPT", "FPT Software", "Dịch vụ công nghệ", "12 vị trí", "Toàn quốc", "FPT"],
    ["M", "MoMo Technology", "Công nghệ tài chính", "5 vị trí", "TP. Hồ Chí Minh", "MOMO"],
    ["NT", "NashTech Vietnam", "Dịch vụ phần mềm", "4 vị trí", "TP.HCM · Đà Nẵng", "NASH"],
    ["KMS", "KMS Technology", "Sản phẩm & dịch vụ", "3 vị trí", "TP. Hồ Chí Minh", "KMS"],
    ["TIKI", "Tiki Corporation", "Thương mại điện tử", "2 vị trí", "TP. Hồ Chí Minh", "TIKI"],
  ].filter(company => company.join(" ").toLowerCase().includes(query.toLowerCase()));
  return <><div className="portal-toolbar"><label className="portal-search"><MagnifyingGlass size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên hoặc lĩnh vực doanh nghiệp" /></label><button className="secondary-button"><FunnelSimple size={18} />Lĩnh vực</button><button className="secondary-button"><MapPin size={18} />Địa điểm</button></div><div className="company-card-grid">{companies.map(([mark, name, field, jobs, location, tone]) => <article key={name} className="company-card"><div className={`company-logo ${tone.toLowerCase()}`}>{mark}</div><Status tone="success"><SealCheck size={14} weight="fill" /> Đối tác UIT</Status><h2>{name}</h2><p>{field}</p><div><span><Briefcase size={17} />{jobs} đang tuyển</span><span><MapPin size={17} />{location}</span></div><button className="secondary-button">Xem doanh nghiệp <ArrowRight size={16} /></button></article>)}</div></>;
}

function ProfileScreen({ percent, setPercent }) {
  const [uploaded, setUploaded] = useState(false);
  return <div className="profile-layout"><aside className="profile-summary-card"><div className="large-avatar">NK</div><h2>Nguyễn Minh Khoa</h2><p>20521067@student.uit.edu.vn</p><div className="profile-progress"><div><span style={{ width: `${uploaded ? 100 : percent}%` }} /></div><strong>{uploaded ? 100 : percent}% hoàn thiện</strong></div><ul><li className="done"><CheckCircle />Thông tin UIT</li><li className="done"><CheckCircle />CV ứng tuyển</li><li className={uploaded ? "done" : "current"}>{uploaded ? <CheckCircle /> : <Warning />}Bảng điểm</li><li className="done"><CheckCircle />Giấy xác nhận</li></ul></aside><div className="profile-content"><Panel title="Thông tin học tập" action={<button className="secondary-button small"><PencilSimple size={16} />Cập nhật bổ sung</button>}><div className="detail-grid"><div><small>Họ và tên</small><strong>Nguyễn Minh Khoa</strong></div><div><small>Mã số sinh viên</small><strong>20521067</strong></div><div><small>Khoa</small><strong>Công nghệ phần mềm</strong></div><div><small>Khóa</small><strong>2020</strong></div><div><small>GPA</small><strong>3.42 / 4.0</strong></div><div><small>Tình trạng</small><Status tone="success">Đang học</Status></div></div></Panel><Panel title="CV của tôi" action={<button className="primary-button small"><Plus size={16} />Thêm CV</button>}><div className="document-cards"><article><FileText size={28} /><div><strong>CV_Backend_NguyenMinhKhoa_2026.pdf</strong><small>Cập nhật 02/08/2026 · 412 KB</small></div><Status tone="info">Mặc định</Status><button><Eye size={18} /></button><button><DotsThree size={18} /></button></article><article><FileText size={28} /><div><strong>CV_NguyenMinhKhoa_2025.pdf</strong><small>Cập nhật 15/04/2025 · 398 KB</small></div><span /><button><Eye size={18} /></button><button><DotsThree size={18} /></button></article></div></Panel><Panel title="Tài liệu xác minh"><div className="document-cards"><article><CheckCircle size={27} className="green" /><div><strong>Giấy xác nhận sinh viên</strong><small>Còn hiệu lực đến 15/10/2026</small></div><Status tone="success">Đã xác minh</Status><button><Eye size={18} /></button></article><article><span className={uploaded ? "file-ok" : "file-missing"}>{uploaded ? <CheckCircle size={27} /> : <Warning size={27} />}</span><div><strong>Bảng điểm có xác nhận</strong><small>{uploaded ? "Đã tải lên 05/08/2026" : "Còn thiếu · bắt buộc khi ứng tuyển"}</small></div><Status tone={uploaded ? "success" : "urgent"}>{uploaded ? "Đã có" : "Cần bổ sung"}</Status><button className="upload-inline" onClick={() => { setUploaded(true); setPercent(100); }}>{uploaded ? "Thay đổi" : "Tải lên"}</button></article></div></Panel></div></div>;
}

function InterviewsScreen() {
  const [confirmed, setConfirmed] = useState(false);
  return <div className="portal-two-column wide-left"><div><Panel title="Sắp tới"><article className="interview-card"><div className="calendar-tile"><strong>07</strong><small>THÁNG 08</small></div><div className="interview-main"><Status tone={confirmed ? "success" : "urgent"}>{confirmed ? "Đã xác nhận" : "Cần xác nhận"}</Status><h2>Phỏng vấn Data Engineer Intern</h2><p>FPT Software · Vòng chuyên môn</p><div><span><Clock size={18} />09:30 – 10:15</span><span><MapPin size={18} />Google Meet</span><span><User size={18} />Anh Nguyễn Hoàng Nam</span></div></div><div className="interview-actions"><button className="primary-button" onClick={() => setConfirmed(true)}>{confirmed ? <><Check size={17} />Đã xác nhận</> : "Xác nhận tham gia"}</button><button className="secondary-button">Xem chi tiết</button></div></article></Panel><Panel title="Lịch sử phỏng vấn"><div className="simple-table interview-history"><div className="table-head"><span>Vị trí</span><span>Doanh nghiệp</span><span>Ngày phỏng vấn</span><span>Kết quả</span></div><div><strong>Frontend Intern</strong><span>KMS Technology</span><span>12/06/2026</span><Status tone="neutral">Không đạt</Status></div><div><strong>Software Engineer Intern</strong><span>Bosch Vietnam</span><span>04/05/2026</span><Status tone="success">Đạt vòng 1</Status></div></div></Panel></div><Panel title="Chuẩn bị phỏng vấn"><div className="preparation-list"><div><span>1</span><strong>Kiểm tra thiết bị và đường truyền</strong></div><div><span>2</span><strong>Chuẩn bị dự án Java/Spring Boot để trình bày</strong></div><div><span>3</span><strong>Tham gia trước giờ hẹn 10 phút</strong></div></div><button className="secondary-button full"><BookOpenText size={17} />Xem hướng dẫn từ UIT</button></Panel></div>;
}

function StudentNotifications() {
  const [read, setRead] = useState([]);
  const notes = [[1,"UIT đã tiếp nhận hồ sơ ứng tuyển","Đơn Backend Developer Intern tại VNG đang được kiểm tra.","10 phút trước","review"],[2,"Bạn có lịch phỏng vấn mới","FPT Software mời bạn phỏng vấn vào 09:30 ngày 07/08.","2 giờ trước","calendar"],[3,"Hồ sơ đã chuyển đến doanh nghiệp","MoMo đã nhận CV Product Intern của bạn.","Hôm qua","success"],[4,"Sắp hết hạn ứng tuyển","Vị trí Software Engineer Intern tại KMS còn 2 ngày.","Hôm qua","warning"]];
  return <Panel title="Tất cả thông báo" action={<button className="link-button" onClick={() => setRead(notes.map(n => n[0]))}>Đánh dấu tất cả đã đọc</button>}><div className="notification-list">{notes.map(([id,title,text,time,type]) => <button key={id} className={read.includes(id) ? "read" : ""} onClick={() => setRead([...new Set([...read,id])])}><span className={`notice-symbol ${type}`}>{type === "calendar" ? <CalendarCheck /> : type === "success" ? <CheckCircle /> : type === "warning" ? <Warning /> : <ShieldCheck />}</span><div><strong>{title}</strong><p>{text}</p><small>{time}</small></div>{!read.includes(id) && <i />}</button>)}</div></Panel>;
}

export function AdminPortal({ route, navigate }) {
  const [modal, setModal] = useState(null);
  const [selectedJob, setSelectedJob] = useState(reviewJobs[0]);
  const [selectedApplication, setSelectedApplication] = useState(reviewApplications[0]);
  const [jobStates, setJobStates] = useState({});
  const [applicationStates, setApplicationStates] = useState({});
  const titles = {
    "admin-dashboard": ["Tổng quan vận hành", "Theo dõi khối lượng xử lý, hạn cam kết và hoạt động tuyển dụng toàn trường."],
    "admin-companies": ["Doanh nghiệp đối tác", "Tạo hồ sơ, cấp tài khoản và quản lý trạng thái hợp tác với UIT."],
    "admin-jobs": ["Duyệt tin tuyển dụng", "Kiểm tra nội dung, nhóm ngành, yêu cầu và thời hạn trước khi công khai."],
    "admin-applications": ["Duyệt hồ sơ sinh viên", "Xác minh điều kiện và tài liệu trước khi chuyển hồ sơ đến doanh nghiệp."],
    "admin-placements": ["Theo dõi kết quả tuyển dụng", "Theo dõi từ phỏng vấn đến nhận việc, thực tập và hoàn thành."],
    "admin-scheduler": ["Nhắc việc & tác vụ hệ thống", "Giám sát tổng hợp hồ sơ tồn và các thông báo định kỳ mỗi ngày."],
    "admin-reports": ["Báo cáo & thống kê", "Tổng hợp hiệu quả tuyển dụng theo ngành, doanh nghiệp và thời gian."],
    "admin-access": ["Tài khoản & nhật ký", "Quản lý phân quyền và truy vết các thao tác quan trọng."],
  };
  const [title, description] = titles[route] || titles["admin-dashboard"];
  const action = route === "admin-companies" ? <button className="primary-button" onClick={() => setModal("company")}><UserPlus size={18} />Thêm doanh nghiệp</button> : route === "admin-reports" ? <button className="secondary-button"><DownloadSimple size={18} />Xuất báo cáo</button> : null;
  return <WorkspaceShell role="admin" route={route} navigate={navigate} title={title} description={description} actions={action}>
    {route === "admin-dashboard" && <AdminDashboard navigate={navigate} />}
    {route === "admin-companies" && <AdminCompanies onCreate={() => setModal("company")} />}
    {route === "admin-jobs" && <AdminJobReview selected={selectedJob} setSelected={setSelectedJob} states={jobStates} setStates={setJobStates} />}
    {route === "admin-applications" && <AdminApplicationReview selected={selectedApplication} setSelected={setSelectedApplication} states={applicationStates} setStates={setApplicationStates} />}
    {route === "admin-placements" && <AdminPlacements />}
    {route === "admin-scheduler" && <AdminScheduler />}
    {route === "admin-reports" && <AdminReports />}
    {route === "admin-access" && <AdminAccess />}
    {modal === "company" && <CompanyCreateModal close={() => setModal(null)} />}
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

function AdminPlacements() {
  return <><div className="metric-grid four"><MetricCard label="Đang phỏng vấn" value="23" helper="Tại 11 doanh nghiệp" Icon={CalendarCheck}/><MetricCard label="Đã nhận offer" value="14" helper="8 sinh viên đã xác nhận" Icon={PaperPlaneTilt} tone="green"/><MetricCard label="Đã bắt đầu" value="37" helper="Trong học kỳ hiện tại" Icon={SuitcaseSimple} tone="purple"/><MetricCard label="Cần cập nhật" value="8" helper="Quá 3 ngày chưa có kết quả" Icon={Warning} tone="amber"/></div><Panel title="Theo dõi kết quả" action={<div className="page-actions"><button className="secondary-button"><FunnelSimple/>Bộ lọc</button><button className="secondary-button"><DownloadSimple/>Xuất dữ liệu</button></div>}><div className="simple-table placement-table"><div className="table-head"><span>Sinh viên</span><span>Vị trí / Doanh nghiệp</span><span>Giai đoạn</span><span>Cập nhật cuối</span><span>Bắt đầu dự kiến</span><span/></div>{[["Nguyễn Minh Khoa","Backend Intern · VNG","Phỏng vấn","05/08/2026","01/10/2026","info"],["Trần Khánh Linh","Product Intern · MoMo","Đã nhận offer","04/08/2026","15/08/2026","success"],["Võ Minh Anh","Software Intern · FPT","Đã bắt đầu","01/08/2026","01/08/2026","purple"],["Phạm Gia Huy","Data Intern · NashTech","Chờ kết quả","30/07/2026","—","urgent"]].map(row=><button key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span><Status tone={row[5]}>{row[2]}</Status></span><span>{row[3]}</span><span>{row[4]}</span><ArrowRight/></button>)}</div></Panel></>;
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

export function CompanyPortal({ route, navigate }) {
  const [modal,setModal] = useState(null);
  const titles = {
    "company-dashboard": ["Tổng quan tuyển dụng", "Theo dõi tin tuyển dụng, ứng viên UIT chuyển đến và việc cần xử lý."],
    "company-profile": ["Hồ sơ doanh nghiệp", "Quản lý thông tin hiển thị với sinh viên và tài khoản tuyển dụng."],
    "company-jobs": ["Tin tuyển dụng", "Soạn, gửi UIT phê duyệt và theo dõi hiệu quả từng tin."],
    "company-candidates": ["Ứng viên", "Xử lý các hồ sơ đã được UIT kiểm duyệt và chuyển đến doanh nghiệp."],
    "company-interviews": ["Lịch phỏng vấn", "Tạo lịch, gửi lời mời và cập nhật kết quả phỏng vấn."],
    "company-notifications": ["Thông báo", "Các cập nhật từ UIT, ứng viên và hệ thống."],
  };
  const [title,description]=titles[route]||titles['company-dashboard'];
  const action=route==='company-jobs'?<button className="primary-button" onClick={()=>setModal('job')}><Plus/>Tạo tin tuyển dụng</button>:route==='company-interviews'?<button className="primary-button" onClick={()=>setModal('interview')}><Plus/>Tạo lịch phỏng vấn</button>:null;
  return <WorkspaceShell role="company" route={route} navigate={navigate} title={title} description={description} actions={action}>
    {route==='company-dashboard'&&<CompanyDashboard navigate={navigate}/>} {route==='company-profile'&&<CompanyProfile/>} {route==='company-jobs'&&<CompanyJobs onCreate={()=>setModal('job')}/>} {route==='company-candidates'&&<CompanyCandidates/>} {route==='company-interviews'&&<CompanyInterviews onCreate={()=>setModal('interview')}/>} {route==='company-notifications'&&<CompanyNotifications/>}
    {modal==='job'&&<SimpleCreateModal type="job" close={()=>setModal(null)}/>} {modal==='interview'&&<SimpleCreateModal type="interview" close={()=>setModal(null)}/>} 
  </WorkspaceShell>;
}

function CompanyDashboard({navigate}){
  return <><div className="metric-grid four"><MetricCard label="Tin đang tuyển" value="2" helper="1 tin chờ UIT duyệt" Icon={Briefcase}/><MetricCard label="Hồ sơ mới từ UIT" value="14" helper="6 hồ sơ nhận hôm nay" Icon={Users} tone="amber"/><MetricCard label="Phỏng vấn tuần này" value="7" helper="3 lịch cần cập nhật" Icon={CalendarCheck} tone="purple"/><MetricCard label="Ứng viên đã chọn" value="9" helper="Trong tháng 8/2026" Icon={UserCheck} tone="green"/></div><div className="portal-two-column wide-left"><Panel title="Ứng viên mới cần xử lý" action={<button className="link-button" onClick={()=>navigate('company-candidates')}>Xem tất cả <ArrowRight/></button>}><div className="candidate-quick-list">{candidates.slice(0,3).map(candidate=><button key={candidate.id} onClick={()=>navigate('company-candidates')}><span className="candidate-initials">{candidate.name.split(' ').slice(-2).map(x=>x[0]).join('')}</span><div><strong>{candidate.name}</strong><small>{candidate.role} · GPA {candidate.gpa}</small></div><Status tone="info">Phù hợp {candidate.score}%</Status><ArrowRight/></button>)}</div></Panel><Panel title="Hạn xử lý"><div className="sla-card urgent"><ClockCountdown/><div><strong>6 hồ sơ quá 48 giờ</strong><p>Hệ thống sẽ tiếp tục nhắc lúc 08:15 ngày mai.</p></div></div><div className="sla-card warning"><Warning/><div><strong>1 tin cần chỉnh sửa</strong><p>UIT đã phản hồi về yêu cầu thời gian làm việc.</p></div></div><button className="secondary-button full" onClick={()=>navigate('company-notifications')}>Xem tất cả việc cần làm</button></Panel></div><Panel title="Hiệu quả tin đang tuyển"><div className="simple-table company-job-summary"><div className="table-head"><span>Vị trí</span><span>Lượt xem</span><span>Ứng tuyển</span><span>UIT chuyển đến</span><span>Phỏng vấn</span><span/></div>{[["Backend Developer Intern",412,28,14,6],["Product Analyst Intern",278,16,9,3]].map(row=><button key={row[0]} onClick={()=>navigate('company-jobs')}><strong>{row[0]}</strong>{row.slice(1).map((value,index)=><span key={index}>{value}</span>)}<ArrowRight/></button>)}</div></Panel></>;
}

function CompanyProfile(){
  const [editing,setEditing]=useState(false);
  return <div className="company-profile-layout"><Panel title="Hồ sơ hiển thị" action={<button className="secondary-button small" onClick={()=>setEditing(!editing)}><PencilSimple/>{editing?'Lưu thay đổi':'Chỉnh sửa'}</button>}><div className="company-cover"><div className="company-logo vng large">VNG</div><div><h2>VNG Corporation</h2><p><SealCheck weight="fill"/>Đối tác UIT đã xác thực</p></div></div><div className="company-profile-fields"><label><span>Tên doanh nghiệp</span><input disabled={!editing} defaultValue="VNG Corporation"/></label><label><span>Website</span><input disabled={!editing} defaultValue="https://vng.com.vn"/></label><label className="full"><span>Giới thiệu</span><textarea disabled={!editing} defaultValue="VNG là doanh nghiệp công nghệ sản phẩm hàng đầu Việt Nam, phát triển các nền tảng phục vụ hàng triệu người dùng."/></label><label><span>Lĩnh vực</span><input disabled={!editing} defaultValue="Công nghệ sản phẩm"/></label><label><span>Quy mô</span><input disabled={!editing} defaultValue="1.000 – 5.000 nhân viên"/></label><label className="full"><span>Địa chỉ</span><input disabled={!editing} defaultValue="Z06, Đường số 13, Khu chế xuất Tân Thuận, Quận 7, TP.HCM"/></label></div></Panel><div><Panel title="Trạng thái hợp tác"><div className="partnership-state"><CheckCircle size={36}/><strong>Đang hoạt động</strong><p>Hồ sơ đã được UIT xác minh</p><small>Cập nhật lần cuối: 04/08/2026</small></div></Panel><Panel title="Tài khoản tuyển dụng" action={<button className="link-button"><Plus/>Mời thêm</button>}><div className="recruiter-list"><div><span>TH</span><div><strong>Lê Thu Hà</strong><small>Quản trị viên</small></div><Status tone="success">Hoạt động</Status></div><div><span>MN</span><div><strong>Nguyễn Hoàng Nam</strong><small>Nhà tuyển dụng</small></div><Status tone="success">Hoạt động</Status></div></div></Panel></div></div>;
}

function CompanyJobs({onCreate}){
  const [filter,setFilter]=useState('Tất cả');
  const rows=companyJobs.filter(job=>filter==='Tất cả'||job.status===filter);
  return <Panel title="Danh sách tin" action={<div className="segmented-filter">{['Tất cả','Đang tuyển','Chờ UIT duyệt','Đã đóng'].map(item=><button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>}><div className="simple-table company-jobs-table"><div className="table-head"><span>Vị trí</span><span>Loại hình</span><span>Hạn nộp</span><span>Ứng tuyển</span><span>UIT chuyển đến</span><span>Trạng thái</span><span/></div>{rows.map(job=><button key={job.id}><strong>{job.title}</strong><span>{job.type}</span><span>{job.deadline}</span><span>{job.applications}</span><span>{job.forwarded}</span><span><Status tone={job.status==='Đang tuyển'?'success':job.status==='Chờ UIT duyệt'?'warning':'neutral'}>{job.status}</Status></span><DotsThree/></button>)}</div>{!rows.length&&<EmptyHint title="Chưa có tin phù hợp" text="Hãy chọn trạng thái khác hoặc tạo tin mới."/>}</Panel>;
}

function CompanyCandidates(){
  const [items,setItems]=useState(candidates);
  const move=(id,next)=>setItems(currentItems=>currentItems.map(item=>item.id===id?{...item,stage:next}:item));
  const reject=(id)=>setItems(currentItems=>currentItems.map(item=>item.id===id?{...item,stage:'rejected'}:item));
  const columns=[['new','Mới từ UIT','screening'],['screening','Đang sàng lọc','interview'],['interview','Phỏng vấn','result'],['result','Kết quả',null]];
  return <><div className="portal-toolbar"><label className="portal-search"><MagnifyingGlass/><input placeholder="Tìm ứng viên, vị trí..."/></label><button className="secondary-button"><FunnelSimple/>Vị trí: Tất cả</button><button className="secondary-button"><ListBullets/>Danh sách</button></div><div className="candidate-board">{columns.map(([stage,label,next])=><section key={stage}><header><h2>{label}</h2><span>{items.filter(i=>i.stage===stage).length}</span></header><div>{items.filter(i=>i.stage===stage).map(candidate=><article key={candidate.id}><div className="candidate-card-heading"><span className="candidate-initials">{candidate.name.split(' ').slice(-2).map(x=>x[0]).join('')}</span><div><strong>{candidate.name}</strong><small>{candidate.major}</small></div><button><DotsThree/></button></div><p>{candidate.role}</p><div className="candidate-meta"><span>GPA <b>{candidate.gpa}</b></span><Status tone="info">Phù hợp {candidate.score}%</Status></div><div className="candidate-card-actions"><button><Eye/>Xem</button>{next&&<button className="reject" onClick={()=>reject(candidate.id)}>Không phù hợp</button>}{next&&<button className="primary" onClick={()=>move(candidate.id,next)}>Chuyển bước <ArrowRight/></button>}</div></article>)}</div></section>)}</div></>;
}

function CompanyInterviews({onCreate}){
  const [results,setResults]=useState({});
  return <div className="portal-two-column wide-left"><Panel title="Lịch tuần này"><div className="interview-agenda">{[["07","08","09:30","Nguyễn Minh Khoa","Backend Intern","Google Meet"],["08","08","14:00","Trần Khánh Linh","Product Intern","VNG Campus"],["09","08","10:15","Võ Minh Anh","Backend Intern","Google Meet"]].map((row,index)=><article key={row[3]}><div className="agenda-date"><strong>{row[0]}</strong><small>THÁNG {row[1]}</small></div><time>{row[2]}</time><div><strong>{row[3]}</strong><small>{row[4]} · {row[5]}</small></div><Status tone={index===0?'info':'neutral'}>{index===0?'Đã xác nhận':'Đã gửi lời mời'}</Status><button><DotsThree/></button></article>)}</div></Panel><div><Panel title="Kết quả cần cập nhật"><div className="result-list">{[[1,"Phạm Gia Huy","Product Intern","02/08/2026"],[2,"Lê Thành Đạt","Backend Intern","03/08/2026"]].map(row=><div key={row[0]}><span className="candidate-initials">{row[1].split(' ').slice(-2).map(x=>x[0]).join('')}</span><div><strong>{row[1]}</strong><small>{row[2]} · {row[3]}</small></div>{results[row[0]]?<Status tone={results[row[0]]==='Đạt'?'success':'neutral'}>{results[row[0]]}</Status>:<div className="result-buttons"><button onClick={()=>setResults({...results,[row[0]]:'Không đạt'})}>Không đạt</button><button onClick={()=>setResults({...results,[row[0]]:'Đạt'})}>Đạt</button></div>}</div>)}</div></Panel><button className="primary-button full" onClick={onCreate}><Plus/>Tạo lịch phỏng vấn</button></div></div>;
}

function CompanyNotifications(){
  const notes=[["UIT đã chuyển 6 hồ sơ mới","Vị trí Backend Developer Intern · Cần xử lý trước 07/08/2026","10 phút trước","info"],["Tin tuyển dụng cần chỉnh sửa","UIT yêu cầu làm rõ thời gian làm việc của vị trí QA Engineer Fresher.","2 giờ trước","warning"],["Sinh viên đã xác nhận lịch phỏng vấn","Nguyễn Minh Khoa đã xác nhận tham gia lúc 09:30 ngày 07/08.","Hôm qua","success"],["Nhắc xử lý hồ sơ tồn","Có 6 hồ sơ đã chờ phản hồi quá 48 giờ.","Hôm qua","urgent"]];
  return <Panel title="Thông báo doanh nghiệp" action={<button className="link-button">Đánh dấu tất cả đã đọc</button>}><div className="notification-list company-notices">{notes.map(row=><button key={row[0]}><span className={`notice-symbol ${row[3]}`}>{row[3]==='success'?<CheckCircle/>:row[3]==='warning'||row[3]==='urgent'?<Warning/>:<Bell/>}</span><div><strong>{row[0]}</strong><p>{row[1]}</p><small>{row[2]}</small></div><i/><ArrowRight/></button>)}</div></Panel>;
}

function SimpleCreateModal({type,close}){
  const [done,setDone]=useState(false); const isJob=type==='job';
  return <div className="modal-backdrop"><div className="modal portal-modal large"><button className="modal-close" onClick={close}><X/></button>{done?<div className="modal-success"><CheckCircle size={52} weight="fill"/><h2>{isJob?'Đã gửi tin đến UIT':'Đã gửi lời mời phỏng vấn'}</h2><p>{isJob?'Tin đang ở trạng thái chờ UIT kiểm duyệt.':'Ứng viên đã nhận được email và thông báo hệ thống.'}</p><button className="primary-button full" onClick={close}>Hoàn tất</button></div>:<><span className="modal-icon">{isJob?<Briefcase/>:<CalendarCheck/>}</span><h2>{isJob?'Tạo tin tuyển dụng':'Tạo lịch phỏng vấn'}</h2><p>{isJob?'Điền thông tin chính. UIT sẽ kiểm tra trước khi công khai.':'Chọn ứng viên và lịch hẹn phù hợp.'}</p><div className="modal-form two-cols">{isJob?<><label className="full"><span>Tên vị trí</span><input defaultValue="Mobile Developer Intern"/></label><label><span>Loại hình</span><select><option>Thực tập</option><option>Toàn thời gian</option></select></label><label><span>Hạn ứng tuyển</span><input type="date" defaultValue="2026-08-30"/></label><label className="full"><span>Nhóm ngành</span><input defaultValue="Kỹ thuật phần mềm, Khoa học máy tính"/></label><label className="full"><span>Mô tả ngắn</span><textarea defaultValue="Tham gia phát triển ứng dụng di động và làm việc cùng đội ngũ sản phẩm."/></label></>:<><label className="full"><span>Ứng viên</span><select><option>Nguyễn Minh Khoa · Backend Intern</option><option>Lê Thành Đạt · Backend Intern</option></select></label><label><span>Ngày</span><input type="date" defaultValue="2026-08-10"/></label><label><span>Giờ</span><input type="time" defaultValue="09:30"/></label><label className="full"><span>Hình thức / đường dẫn</span><input defaultValue="Google Meet · https://meet.google.com/..."/></label></>}</div><div className="modal-actions"><button className="secondary-button" onClick={close}>Hủy</button><button className="primary-button" onClick={()=>setDone(true)}><PaperPlaneTilt/>{isJob?'Gửi UIT kiểm duyệt':'Gửi lời mời'}</button></div></>}</div></div>;
}
