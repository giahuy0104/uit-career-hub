import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Briefcase,
  Buildings,
  CalendarBlank,
  CalendarCheck,
  Check,
  CheckCircle,
  ClipboardText,
  Clock,
  CircleNotch,
  Database,
  DotsThree,
  DownloadSimple,
  Eye,
  FileText,
  FunnelSimple,
  GraduationCap,
  Info,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  SealCheck,
  ShieldCheck,
  Trash,
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
import { AdminReports } from "./reports/AdminReports.jsx";
import { AdminPlacementLifecycle } from "./placements/AdminPlacementLifecycle.jsx";
import { InternshipEvaluationPanel } from "./placements/InternshipEvaluationPanel.jsx";
import { AdminTaxonomyManagement } from "./taxonomy/TaxonomyManagement.jsx";
import {
  LiveAdminDashboard,
  LiveCompanyDashboard,
  LiveStudentDashboard,
} from "./dashboard/LiveDashboards.jsx";
import {
  EmptyHint,
  MetricCard,
  Panel,
  Status,
  userInitials,
  WorkspaceShell,
} from "./shared/WorkspaceShell.jsx";

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

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} byte`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getApiError(error) {
  return error?.message || "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
}


function OfferDocumentCard({ document, startDate, busy, error, onOpen, compact = false }) {
  if (!document) return null;
  return (
    <div className={`offer-review-card ${compact ? "compact" : ""}`} data-testid="offer-document-card">
      <span className="offer-review-icon"><FileText /></span>
      <span className="offer-review-copy">
        <small>PDF OFFER ĐƯỢC BẢO VỆ</small>
        <strong>{document.fileName}</strong>
        <p>{formatBytes(document.fileSizeBytes)}{startDate ? ` · Bắt đầu ${formatDate(startDate)}` : ""}</p>
      </span>
      <button
        type="button"
        className="secondary-button offer-review-open"
        disabled={busy}
        onClick={onOpen}
        aria-label={`Mở PDF offer ${document.fileName}`}
      >
        {busy ? <CircleNotch className="spin" /> : <DownloadSimple />}
        Mở PDF offer
      </button>
      {error && <p className="review-error offer-review-error" role="alert"><Warning />{error}</p>}
    </div>
  );
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

function CompanyDirectoryModal({ company, onClose, onViewJobs }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal company-directory-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose}><X /></button><div className="company-directory-heading"><div className="company-logo directory-logo">{company.code.slice(0, 3)}</div><div><Status tone="success"><SealCheck size={14} weight="fill" />Đối tác UIT</Status><h2>{company.name}</h2><p>{company.code} · {company.industry || "Chưa cập nhật lĩnh vực"}</p></div></div><p className="company-directory-description">{company.description || "Doanh nghiệp chưa cập nhật phần giới thiệu."}</p><div className="company-directory-details"><div><small>Lĩnh vực</small><strong>{company.industry || "Chưa cập nhật"}</strong></div><div><small>Quy mô</small><strong>{company.companySize || "Chưa cập nhật"}</strong></div><div><small>Địa chỉ</small><strong>{company.address || "Chưa cập nhật"}</strong></div><div><small>Cơ hội đang tuyển</small><strong>{company.recruitingJobCount} tin còn hạn</strong></div></div><div className="modal-actions split-actions">{company.website ? <a className="secondary-button" href={company.website} target="_blank" rel="noreferrer">Website doanh nghiệp <ArrowRight /></a> : <span />}<button className="primary-button" disabled={!company.recruitingJobCount} onClick={onViewJobs}><Briefcase />{company.recruitingJobCount ? `Xem ${company.recruitingJobCount} cơ hội` : "Chưa có tin đang tuyển"}</button></div></div></div>;
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

  if (loading) return <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải doanh nghiệp đối tác...</div>;
  return <><div className="portal-toolbar company-directory-toolbar"><label className="portal-search"><MagnifyingGlass size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, mã, lĩnh vực hoặc địa chỉ" /></label><label className="directory-filter"><FunnelSimple size={18} /><span>Lĩnh vực</span><select value={industry} onChange={event => setIndustry(event.target.value)}><option value="">Tất cả</option>{industries.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="directory-check"><input type="checkbox" checked={recruitingOnly} onChange={event => setRecruitingOnly(event.target.checked)} /><Briefcase />Đang tuyển</label></div>{error && <p className="review-error" role="alert"><Warning />{error}<button className="link-button" onClick={() => setRefreshKey(value => value + 1)}>Thử lại</button></p>}<div className="directory-result-line"><span>{filtered.length} doanh nghiệp đối tác phù hợp</span>{(query || industry || recruitingOnly) && <button className="link-button" onClick={() => { setQuery(""); setIndustry(""); setRecruitingOnly(false); }}>Xóa bộ lọc</button>}</div><div className="company-card-grid live-company-directory">{filtered.length ? filtered.map(company => <article key={company.id} className="company-card"><div className="company-logo directory-logo">{company.code.slice(0, 3)}</div><Status tone="success"><SealCheck size={14} weight="fill" /> Đối tác UIT</Status><h2>{company.name}</h2><p>{company.industry || "Chưa cập nhật lĩnh vực"}</p><div><span><Briefcase size={17} />{company.recruitingJobCount} tin đang tuyển</span><span><MapPin size={17} />{company.address || "Chưa cập nhật địa chỉ"}</span></div><button className="secondary-button" disabled={busyId === company.id} onClick={() => void openCompany(company)}>{busyId === company.id ? <CircleNotch className="spin" /> : null}Xem doanh nghiệp <ArrowRight size={16} /></button></article>) : <div className="directory-empty"><Buildings size={38} /><strong>Không tìm thấy doanh nghiệp phù hợp</strong><span>Hãy thử từ khóa hoặc bộ lọc khác.</span></div>}</div>{selected && <CompanyDirectoryModal company={selected} onClose={() => setSelected(null)} onViewJobs={() => navigate("jobs", { companyId: selected.id, companyName: selected.name })} />}</>;
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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal profile-phone-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button><span className="modal-icon"><User /></span><h2>Cập nhật thông tin bổ sung</h2><p>Thông tin học tập do UIT quản lý. Sinh viên chỉ có thể bổ sung số điện thoại liên hệ ở giai đoạn hiện tại.</p><div className="modal-form"><label><span>Số điện thoại</span><input autoFocus value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} placeholder="Ví dụ: 0912 345 678" /></label></div>{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className="primary-button" onClick={() => onSave(phone.trim() || null)} disabled={busy}>{busy ? <><CircleNotch className="spin" />Đang lưu</> : "Lưu thay đổi"}</button></div></div></div>;
}

function ProfileDocumentUploadModal({ initialType, busy, error, onClose, onUpload }) {
  const [documentType, setDocumentType] = useState(initialType);
  const [file, setFile] = useState(null);
  const localError = file && (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf"))
    ? "Chỉ chấp nhận tệp PDF."
    : file?.size > 10 * 1024 * 1024
      ? "Tệp không được vượt quá 10 MB."
      : "";
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal profile-upload-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button><span className="modal-icon"><FileText /></span><h2>Tải tài liệu lên hồ sơ</h2><p>Tệp được tải trực tiếp vào Cloudflare R2 private. Hệ thống chỉ lưu hồ sơ sau khi kiểm tra đúng định dạng và dung lượng.</p><div className="modal-form"><label><span>Loại tài liệu</span><select value={documentType} onChange={event => setDocumentType(event.target.value)} disabled={busy}>{Object.entries(profileDocumentCopy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="profile-file-picker"><span>Tệp PDF · tối đa 10 MB</span><input type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] || null)} disabled={busy} /><small>{file ? `${file.name} · ${formatDocumentSize(file.size)}` : "Chưa chọn tệp"}</small></label></div>{(localError || error) && <p className="form-error" role="alert"><Warning />{localError || error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className="primary-button" disabled={busy || !file || Boolean(localError)} onClick={() => onUpload({ documentType, file })}>{busy ? <><CircleNotch className="spin" />Đang tải lên</> : "Tải lên R2"}</button></div></div></div>;
}

function ProfileDocumentDeleteModal({ document, busy, error, onClose, onConfirm }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal profile-document-delete-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button><span className="modal-icon danger"><Trash /></span><h2>Xóa tài liệu?</h2><p>Tệp <strong>{document.fileName}</strong> sẽ bị xóa vĩnh viễn khỏi hồ sơ và Cloudflare R2.</p><div className="profile-delete-warning"><Warning /><span>Tài liệu đã dùng trong đơn ứng tuyển không thể xóa để bảo toàn lịch sử hồ sơ.</span></div>{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Giữ lại</button><button className="primary-button danger-fill" onClick={onConfirm} disabled={busy}>{busy ? <><CircleNotch className="spin" />Đang xóa</> : <><Trash />Xóa vĩnh viễn</>}</button></div></div></div>;
}

function ProfileDocumentCard({ document, busy, onSetDefault, onDownload, onDelete }) {
  const verification = documentVerificationCopy[document.verificationStatus] || [document.verificationStatus, "neutral"];
  const canSetDefault = document.documentType === "CV" && document.verificationStatus === "VERIFIED" && !document.isDefault;
  return <article><FileText size={28} className={document.verificationStatus === "VERIFIED" ? "green" : ""} /><div><strong>{document.fileName}</strong><small>{profileDocumentCopy[document.documentType] || document.documentType} · Phiên bản {document.version} · {formatDocumentSize(document.fileSizeBytes)} · {formatSubmitted(document.createdAt)}</small></div>{document.isDefault ? <Status tone="info">Mặc định</Status> : <Status tone={verification[1]}>{verification[0]}</Status>}<div className="document-card-actions"><button className="document-download-button" title="Tải xuống" aria-label={`Tải xuống ${document.fileName}`} disabled={busy} onClick={() => onDownload(document)}>{busy ? <CircleNotch className="spin" /> : <DownloadSimple />}</button>{canSetDefault ? <button className="document-default-button" disabled={busy} onClick={() => onSetDefault(document)}>{busy ? <CircleNotch className="spin" /> : <Check />}Đặt mặc định</button> : null}<button className="document-delete-button" title={document.isDefault ? "Chọn CV khác làm mặc định trước khi xóa" : "Xóa tài liệu"} aria-label={`Xóa ${document.fileName}`} disabled={busy || document.isDefault} onClick={() => onDelete(document)}><Trash /></button></div></article>;
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadInitialType, setUploadInitialType] = useState("CV");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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

  const openUpload = documentType => {
    setUploadInitialType(documentType);
    setUploadError("");
    setMessage("");
    setUploadOpen(true);
  };

  const uploadDocument = async ({ documentType, file }) => {
    setUploadBusy(true);
    setUploadError("");
    try {
      const intentResponse = await authorizedRequest("/students/me/documents/uploads", {
        method: "POST",
        body: JSON.stringify({
          documentType,
          fileName: file.name,
          mimeType: "application/pdf",
          fileSizeBytes: file.size,
        }),
      });
      const intent = intentResponse.data;
      const uploadResponse = await fetch(intent.uploadUrl, {
        method: intent.method,
        headers: intent.headers,
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`R2 từ chối tệp tải lên (${uploadResponse.status}).`);
      }
      const completed = await authorizedRequest(`/students/me/documents/uploads/${intent.uploadId}/complete`, {
        method: "POST",
      });
      setDocuments(completed.data);
      setUploadOpen(false);
      setMessage(`Đã tải “${file.name}” lên hồ sơ và chuyển sang trạng thái chờ UIT xác minh.`);
    } catch (requestError) {
      setUploadError(getApiError(requestError));
    } finally {
      setUploadBusy(false);
    }
  };

  const downloadDocument = async document => {
    setBusyDocumentId(document.id);
    setError("");
    try {
      const response = await authorizedRequest(`/students/me/documents/${document.id}/download`, { method: "POST" });
      window.location.assign(response.data.downloadUrl);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyDocumentId("");
    }
  };

  const openDeleteDocument = document => {
    setDeleteError("");
    setMessage("");
    setDocumentToDelete(document);
  };

  const deleteDocument = async () => {
    if (!documentToDelete) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const response = await authorizedRequest(`/students/me/documents/${documentToDelete.id}`, { method: "DELETE" });
      setDocuments(response.data);
      setDocumentToDelete(null);
      setMessage(`Đã xóa “${documentToDelete.fileName}” khỏi hồ sơ và Cloudflare R2.`);
    } catch (requestError) {
      setDeleteError(getApiError(requestError));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) return <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải hồ sơ sinh viên...</div>;
  if (!profile) return <div className="portal-error" role="alert"><Warning />{error || "Không tìm thấy hồ sơ sinh viên."}<button className="secondary-button small" onClick={() => setRefreshKey(value => value + 1)}>Thử lại</button></div>;
  return <>{message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}{error && !editing && <p className="review-error" role="alert"><Warning />{error}</p>}<div className="profile-layout"><aside className="profile-summary-card"><div className="large-avatar">{userInitials(profile.fullName)}</div><h2>{profile.fullName}</h2><p>{profile.email}</p><div className="profile-progress"><div><span style={{ width: `${completion}%` }} /></div><strong>{completion}% hoàn thiện</strong></div><ul><li className="done"><CheckCircle />Thông tin UIT</li><li className={profile.phone ? "done" : "current"}>{profile.phone ? <CheckCircle /> : <Warning />}Số điện thoại</li><li className={hasDefaultCv ? "done" : "current"}>{hasDefaultCv ? <CheckCircle /> : <Warning />}CV mặc định đã xác minh</li><li className={verifiedTypes.has("TRANSCRIPT") ? "done" : "current"}>{verifiedTypes.has("TRANSCRIPT") ? <CheckCircle /> : <Warning />}Bảng điểm</li><li className={verifiedTypes.has("STUDENT_CONFIRMATION") ? "done" : "current"}>{verifiedTypes.has("STUDENT_CONFIRMATION") ? <CheckCircle /> : <Warning />}Giấy xác nhận</li></ul></aside><div className="profile-content"><Panel title="Thông tin học tập" action={<button className="secondary-button small" onClick={() => { setError(""); setEditing(true); }}><PencilSimple size={16} />Cập nhật bổ sung</button>}><div className="detail-grid"><div><small>Họ và tên</small><strong>{profile.fullName}</strong></div><div><small>Mã số sinh viên</small><strong>{profile.studentCode}</strong></div><div><small>Khoa</small><strong>{profile.faculty}</strong></div><div><small>Ngành</small><strong>{profile.major}</strong></div><div><small>Khóa</small><strong>{profile.cohort}</strong></div><div><small>GPA</small><strong>{profile.gpa === null ? "Chưa cập nhật" : `${profile.gpa} / 4.0`}</strong></div><div><small>Số điện thoại</small><strong>{profile.phone || "Chưa bổ sung"}</strong></div><div><small>Email UIT</small><strong>{profile.email}</strong></div><div><small>Tình trạng</small><Status tone={academicStatus[1]}>{academicStatus[0]}</Status></div></div></Panel><Panel title={`CV của tôi (${cvDocuments.length})`} action={<button className="secondary-button small" onClick={() => openUpload("CV")}><Plus size={16} />Thêm CV</button>}><div className="document-cards">{cvDocuments.length ? cvDocuments.map(document => <ProfileDocumentCard key={document.id} document={document} busy={busyDocumentId === document.id} onSetDefault={item => void setDefaultCv(item)} onDownload={item => void downloadDocument(item)} onDelete={openDeleteDocument} />) : <EmptyHint icon={FileText} title="Chưa có CV" text="Tải CV PDF để UIT kiểm tra trước khi dùng ứng tuyển." />}</div></Panel><Panel title="Tài liệu xác minh" action={<button className="secondary-button small" onClick={() => openUpload("TRANSCRIPT")}><Plus size={16} />Thêm tài liệu</button>}><div className="document-cards">{verificationDocuments.map(document => <ProfileDocumentCard key={document.id} document={document} busy={busyDocumentId === document.id} onSetDefault={() => undefined} onDownload={item => void downloadDocument(item)} onDelete={openDeleteDocument} />)}{!documents.some(document => document.documentType === "TRANSCRIPT") && <MissingProfileDocument type="TRANSCRIPT" />}{!documents.some(document => document.documentType === "STUDENT_CONFIRMATION") && <MissingProfileDocument type="STUDENT_CONFIRMATION" />}</div><div className="profile-storage-note"><Database size={18} /><span><strong>Lưu trữ riêng tư trên Cloudflare R2</strong><small>Upload và tải xuống dùng URL ký trước có thời hạn; khóa R2 không bao giờ được gửi xuống trình duyệt.</small></span><button className="secondary-button small" onClick={() => setRefreshKey(value => value + 1)}><ListBullets />Tải lại dữ liệu</button></div></Panel></div></div>{editing && <ProfilePhoneModal profile={profile} busy={busy} error={error} onClose={() => { if (!busy) { setEditing(false); setError(""); } }} onSave={phone => void savePhone(phone)} />}{uploadOpen && <ProfileDocumentUploadModal key={uploadInitialType} initialType={uploadInitialType} busy={uploadBusy} error={uploadError} onClose={() => { if (!uploadBusy) { setUploadOpen(false); setUploadError(""); } }} onUpload={payload => void uploadDocument(payload)} />}{documentToDelete && <ProfileDocumentDeleteModal document={documentToDelete} busy={deleteBusy} error={deleteError} onClose={() => { if (!deleteBusy) { setDocumentToDelete(null); setDeleteError(""); } }} onConfirm={() => void deleteDocument()} />}</>;
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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button><span className="modal-icon danger"><Warning /></span><h2>Hủy tham gia phỏng vấn</h2><p>Đơn ứng tuyển <strong>{interview.job.title}</strong> sẽ được chuyển sang trạng thái đã rút. Lý do được gửi đến doanh nghiệp và lưu trong lịch sử.</p><div className="modal-form"><label><span>Lý do hủy *</span><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder="Ví dụ: Tôi đã nhận một cơ hội khác và không thể tham gia lịch phỏng vấn này." /></label></div>{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Quay lại</button><button className="primary-button danger-fill" disabled={busy || note.trim().length < 5} onClick={() => onSubmit(note.trim())}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : "Xác nhận hủy"}</button></div></div></div>;
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

  if (loading) return <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải lịch phỏng vấn...</div>;
  return <><>{message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}</>{error && !cancelTarget && <p className="review-error" role="alert"><Warning />{error}</p>}<div className="portal-two-column wide-left"><div><Panel title={`Sắp tới (${upcoming.length})`}><div className="live-interview-list">{upcoming.length === 0 ? <EmptyHint icon={CalendarBlank} title="Chưa có lịch sắp tới" text="Lời mời mới từ doanh nghiệp sẽ xuất hiện tại đây." /> : upcoming.map(interview => { const timing = interviewTiming(interview.scheduledAt); const status = interviewStatusCopy[interview.status] || [interview.status, "neutral"]; const busy = busyId === interview.id; return <article className="interview-card" key={interview.id}><div className="calendar-tile"><strong>{timing.day}</strong><small>{timing.month}</small></div><div className="interview-main"><Status tone={status[1]}>{status[0]}</Status><h2>Phỏng vấn {interview.job.title}</h2><p>{interview.job.company.name} · {interviewModeCopy[interview.mode] || interview.mode}</p><div><span><Clock size={18} />{timing.time} · {timing.date}</span><span><MapPin size={18} />{interviewPlace(interview)}</span><span><User size={18} />{interview.interviewerName || "Nhà tuyển dụng"}</span></div></div><div className="interview-actions">{interview.status === "PENDING_STUDENT_CONFIRMATION" ? <button className="primary-button" disabled={busy} onClick={() => void confirm(interview)}>{busy ? <CircleNotch className="spin" /> : <Check size={17} />}Xác nhận tham gia</button> : interview.meetingUrl ? <a className="primary-button" href={interview.meetingUrl} target="_blank" rel="noreferrer"><ArrowRight size={17} />Mở liên kết họp</a> : <button className="primary-button" disabled><Check size={17} />Đã xác nhận</button>}<button className="secondary-button" disabled={busy} onClick={() => { setError(""); setCancelTarget(interview); }}>Không thể tham gia</button></div></article>; })}</div></Panel><Panel title="Lịch sử phỏng vấn"><div className="simple-table interview-history"><div className="table-head"><span>Vị trí</span><span>Doanh nghiệp</span><span>Ngày phỏng vấn</span><span>Kết quả</span></div>{history.length === 0 ? <EmptyHint icon={CalendarCheck} title="Chưa có lịch sử" text="Các lịch đã hoàn tất hoặc bị hủy sẽ được lưu tại đây." /> : history.map(interview => { const result = interview.recruitmentResult?.outcome === "PASS" ? ["Đạt", "success"] : interview.recruitmentResult?.outcome === "FAIL" ? ["Không đạt", "neutral"] : interview.status === "CANCELLED" ? ["Đã hủy", "urgent"] : [interviewStatusCopy[interview.status]?.[0] || "Chờ kết quả", "neutral"]; return <div key={interview.id}><strong>{interview.job.title}</strong><span>{interview.job.company.name}</span><span>{interviewTiming(interview.scheduledAt).date}</span><Status tone={result[1]}>{result[0]}</Status></div>; })}</div></Panel></div><Panel title="Chuẩn bị phỏng vấn"><div className="preparation-list"><div><span>1</span><strong>Kiểm tra thiết bị, đường truyền hoặc tuyến đường đến địa điểm</strong></div><div><span>2</span><strong>Đọc lại mô tả công việc và chuẩn bị dự án nổi bật để trình bày</strong></div><div><span>3</span><strong>Tham gia trước giờ hẹn 10 phút và dùng đúng email UIT</strong></div></div><button className="secondary-button full"><BookOpenText size={17} />Xem hướng dẫn từ UIT</button></Panel></div>{cancelTarget && <InterviewCancelModal interview={cancelTarget} busy={busyId === cancelTarget.id} error={error} onClose={() => { if (!busyId) { setCancelTarget(null); setError(""); } }} onSubmit={note => void cancel(note)} />}</>;
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
    "admin-taxonomy": ["Danh mục ngành nghề & kỹ năng", "Chuẩn hóa dữ liệu dùng cho tin tuyển dụng và giữ nguyên liên kết với dữ liệu lịch sử."],
    "admin-reports": ["Báo cáo tuyển dụng", "Lọc, đối chiếu và xuất dữ liệu hồ sơ theo khoa, ngành, doanh nghiệp và kỳ tuyển dụng."],
    "admin-jobs": ["Duyệt tin tuyển dụng", "Kiểm tra nội dung, nhóm ngành, yêu cầu và thời hạn trước khi công khai."],
    "admin-documents": ["Xác minh tài liệu sinh viên", "Kiểm tra tài liệu PDF mới tải lên trước khi sinh viên dùng trong hồ sơ ứng tuyển."],
    "admin-applications": ["Duyệt hồ sơ sinh viên", "Xác minh điều kiện và tài liệu trước khi chuyển hồ sơ đến doanh nghiệp."],
    "admin-placements": ["Theo dõi kết quả tuyển dụng", "Theo dõi từ phỏng vấn đến nhận việc, thực tập và hoàn thành."],
    "admin-notifications": ["Thông báo", "Các yêu cầu mới và thay đổi trạng thái cần bộ phận UIT theo dõi."],
  };
  const activeRoute = titles[route] ? route : "admin-dashboard";
  const [title, description] = titles[activeRoute];
  const action = activeRoute === "admin-companies" ? <button className="primary-button" onClick={() => setModal("company")}><UserPlus size={18} />Thêm doanh nghiệp</button> : null;
  return <WorkspaceShell role="admin" route={activeRoute} navigate={navigate} title={title} description={description} actions={action} user={user} onLogout={onLogout}>
    {activeRoute === "admin-dashboard" && <LiveAdminDashboard navigate={navigate} />}
    {activeRoute === "admin-companies" && <AdminCompanyManagement refreshKey={companiesVersion} onCreate={() => setModal("company")} />}
    {activeRoute === "admin-taxonomy" && <AdminTaxonomyManagement />}
    {activeRoute === "admin-reports" && <AdminReports />}
    {activeRoute === "admin-jobs" && <LiveAdminJobReview targetJobId={navigationPayload?.notification?.resourceId} />}
    {activeRoute === "admin-documents" && <AdminStudentDocumentReview targetDocumentId={navigationPayload?.notification?.resourceId} />}
    {activeRoute === "admin-applications" && <LiveAdminApplicationReview targetApplicationId={navigationPayload?.notification?.resourceId} />}
    {activeRoute === "admin-placements" && <><AdminPlacements targetApplicationId={navigationPayload?.notification?.resourceId} /><AdminPlacementLifecycle /></>}
    {activeRoute === "admin-notifications" && <NotificationInbox role="admin" onOpen={(notification, destination) => navigate(destination, { notification })} />}
    {modal === "company" && <CompanyCreatePartnerModal close={() => setModal(null)} onComplete={() => setCompaniesVersion(value => value + 1)} />}
  </WorkspaceShell>;
}

function ReviewReasonModal({ mode, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  const isRevision = mode === "request-revision";
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose}><X /></button><span className={`modal-icon ${isRevision ? "" : "danger"}`}>{isRevision ? <PencilSimple /> : <Warning />}</span><h2>{isRevision ? "Yêu cầu doanh nghiệp chỉnh sửa" : "Từ chối tin tuyển dụng"}</h2><p>Lý do sẽ được gửi đến doanh nghiệp, lưu trong lịch sử và không thể chỉnh sửa sau khi xác nhận.</p><div className="modal-form"><label><span>Lý do chi tiết *</span><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder={isRevision ? "Ví dụ: Vui lòng bổ sung thời gian làm việc và quyền lợi..." : "Ví dụ: Nội dung không phù hợp quy định của nhà trường..."} maxLength={2000} /></label></div>{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className={`primary-button ${isRevision ? "" : "danger-fill"}`} disabled={busy || note.trim().length < 5} onClick={() => onSubmit(note.trim())}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : isRevision ? <><PaperPlaneTilt />Gửi yêu cầu</> : "Xác nhận từ chối"}</button></div></div></div>;
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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal application-decision-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose}><X /></button><span className={`modal-icon ${isReject ? "danger" : ""}`}>{mode === "forward" ? <PaperPlaneTilt /> : isSupplement ? <FileText /> : <Warning />}</span><h2>{mode === "forward" ? "Chuyển hồ sơ đến doanh nghiệp?" : isSupplement ? "Yêu cầu sinh viên bổ sung" : "Từ chối hồ sơ ứng tuyển"}</h2><p>{mode === "forward" ? <>CV và tài liệu của <strong>{application.student.fullName}</strong> sẽ được chuyển đúng đến <strong>{application.job.company.name}</strong>.</> : "Lý do sẽ được gửi cho sinh viên và lưu vào lịch sử xử lý."}</p>{isSupplement && <><div className="document-type-options"><span>Tài liệu cần bổ sung *</span>{documentTypes.map(([value, label]) => <label key={value}><input type="checkbox" checked={requiredDocumentTypes.includes(value)} onChange={() => toggleDocument(value)} />{label}</label>)}</div><div className="modal-form"><label><span>Hạn bổ sung *</span><input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={event => setDueDate(event.target.value)} /></label></div></>}{mode !== "forward" && <div className="modal-form"><label><span>Lý do chi tiết *</span><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder={isSupplement ? "Ví dụ: Vui lòng bổ sung bảng điểm có xác nhận..." : "Ví dụ: Sinh viên chưa đáp ứng điều kiện tham gia..."} maxLength={2000} /></label></div>}{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className={`primary-button ${isReject ? "danger-fill" : ""}`} disabled={busy || !canSubmit} onClick={submit}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : mode === "forward" ? <><PaperPlaneTilt />Xác nhận chuyển</> : isSupplement ? <><PaperPlaneTilt />Gửi yêu cầu</> : "Xác nhận từ chối"}</button></div></div></div>;
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

  if (loading) return <Panel title="Hàng đợi duyệt tin"><div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải tin chờ duyệt...</div></Panel>;
  if (error && !selected) return <Panel title="Hàng đợi duyệt tin"><div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={loadQueue}>Thử lại</button></div></Panel>;
  if (!selected) return <Panel title="Hàng đợi duyệt tin" action={<Status tone="success">0 cần xử lý</Status>}><EmptyHint title="Đã xử lý hết hàng đợi" text="Hiện không có tin tuyển dụng nào đang chờ UIT phê duyệt." />{message && <div className="inline-success"><CheckCircle />{message}</div>}</Panel>;

  const categories = selected.categories.length ? selected.categories.map(item => item.name) : ["Doanh nghiệp chưa chọn nhóm ngành"];
  const skills = selected.skills.length ? selected.skills.map(item => item.name) : [];
  return <><div className="review-workspace"><Panel title="Hàng đợi" action={<Status tone="warning">{jobs.length} cần xử lý</Status>} className="review-list-panel"><div className="review-filter"><button className="active">Cũ nhất trước</button><button onClick={loadQueue}>Làm mới</button></div><div className="review-list">{jobs.map(job => <button key={job.id} className={selected.id === job.id ? "selected" : ""} onClick={() => { setSelectedId(job.id); setError(""); }}><div><strong>{job.title}</strong><small>{job.company.name}</small></div><Status tone="warning">Chờ duyệt</Status><p><span>{job.categories[0]?.name || opportunityCopy[job.opportunityType]}</span><span>Hạn {formatDate(job.deadline)}</span></p><small>Gửi {formatSubmitted(job.submittedAt)}</small></button>)}</div></Panel><Panel title="Nội dung tin tuyển dụng" action={<span className="version-label">Phiên bản {selected.version}</span>} className="review-detail-panel"><div className="review-detail-heading"><div className="company-logo vng">{selected.company.code.slice(0, 3)}</div><div><h2>{selected.title}</h2><p>{selected.company.name} · Đối tác UIT đã xác thực</p></div><Status tone="warning">Chờ UIT duyệt</Status></div><div className="review-checks"><span className="done"><CheckCircle />Doanh nghiệp hợp lệ</span><span className="done"><CheckCircle />Thông tin bắt buộc đầy đủ</span><span className="warning"><Warning />UIT cần rà soát nội dung</span></div><div className="review-content-grid"><section><h3>Thông tin chung</h3><dl><div><dt>Loại hình</dt><dd>{opportunityCopy[selected.opportunityType]} · {workModeCopy[selected.workMode]}</dd></div><div><dt>Địa điểm</dt><dd>{selected.location}</dd></div><div><dt>Số lượng</dt><dd>{selected.positions} vị trí</dd></div><div><dt>Hạn ứng tuyển</dt><dd>{formatDate(selected.deadline)}</dd></div></dl></section><section><h3>Nhóm ngành & kỹ năng</h3><div className="tag-list">{[...categories, ...skills].map(item => <span key={item}>{item}</span>)}</div></section><section className="full"><h3>Mô tả công việc</h3><p className="preserve-lines">{selected.description}</p></section><section className="full"><h3>Yêu cầu ứng viên</h3><p className="preserve-lines">{selected.requirements}</p></section>{selected.benefits && <section className="full"><h3>Quyền lợi</h3><p className="preserve-lines">{selected.benefits}</p></section>}</div>{error && <p className="review-error" role="alert"><Warning />{error}</p>}<div className="review-actions"><button className="secondary-button danger" disabled={busy} onClick={() => setReasonMode("reject")}>Từ chối</button><button className="secondary-button" disabled={busy} onClick={() => setReasonMode("request-revision")}><PencilSimple />Yêu cầu chỉnh sửa</button><button className="primary-button" disabled={busy} onClick={() => { if (window.confirm(`Phê duyệt và công khai tin “${selected.title}”?`)) void decide("approve"); }}>{busy ? <CircleNotch className="spin" /> : <Check />}Phê duyệt & công khai</button></div></Panel></div>{message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}{reasonMode && <ReviewReasonModal mode={reasonMode} busy={busy} error={error} onClose={() => { if (!busy) { setReasonMode(null); setError(""); } }} onSubmit={note => void decide(reasonMode, note)} />}</>;
}

function StudentDocumentReviewModal({ document, decision, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  const isReject = decision === "REJECT";
  const canSubmit = !isReject || note.trim().length >= 5;
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal portal-modal student-document-review-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button><span className={`modal-icon ${isReject ? "danger" : ""}`}>{isReject ? <Warning /> : <SealCheck />}</span><h2>{isReject ? "Từ chối tài liệu?" : "Xác minh tài liệu?"}</h2><p>{isReject ? <>Lý do sẽ được gửi đến <strong>{document.student.fullName}</strong> và lưu trong nhật ký hệ thống.</> : <>Xác nhận <strong>{document.fileName}</strong> hợp lệ để sinh viên có thể dùng khi ứng tuyển.</>}</p><div className="modal-form"><label><span>{isReject ? "Lý do từ chối *" : "Ghi chú nội bộ (không bắt buộc)"}</span><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder={isReject ? "Ví dụ: Tệp bị mờ, thiếu trang hoặc thông tin không khớp..." : "Ví dụ: Đã đối chiếu thông tin trên tài liệu..."} /></label></div>{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button><button className={`primary-button ${isReject ? "danger-fill" : ""}`} disabled={busy || !canSubmit} onClick={() => onSubmit(note.trim())}>{busy ? <><CircleNotch className="spin" />Đang xử lý</> : isReject ? "Xác nhận từ chối" : <><SealCheck />Xác minh tài liệu</>}</button></div></div></div>;
}

function AdminStudentDocumentReview({ targetDocumentId = null }) {
  const { authorizedRequest } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [meta, setMeta] = useState({ totalItems: 0 });
  const [status, setStatus] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [decision, setDecision] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = documents.find(document => document.id === selectedId) || documents[0] || null;

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const search = appliedQuery ? `&query=${encodeURIComponent(appliedQuery)}` : "";
      const response = await authorizedRequest(`/uit/student-documents?status=${status}&page=1&pageSize=100${search}`);
      setDocuments(response.data);
      setMeta(response.meta);
      setSelectedId(current => response.data.some(document => document.id === targetDocumentId)
        ? targetDocumentId
        : response.data.some(document => document.id === current) ? current : response.data[0]?.id ?? null);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, authorizedRequest, status, targetDocumentId]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  const applySearch = event => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery === appliedQuery) void loadDocuments();
    else setAppliedQuery(nextQuery);
  };

  const downloadDocument = async document => {
    setBusyAction(`download:${document.id}`);
    setError("");
    try {
      const response = await authorizedRequest(`/uit/student-documents/${document.id}/download`, { method: "POST" });
      window.location.assign(response.data.downloadUrl);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyAction("");
    }
  };

  const submitDecision = async note => {
    if (!selected || !decision || busyAction) return;
    setBusyAction(`review:${selected.id}`);
    setError("");
    try {
      const response = await authorizedRequest(`/uit/student-documents/${selected.id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
      });
      setDocuments(current => status === "PENDING"
        ? current.filter(document => document.id !== selected.id)
        : current.map(document => document.id === selected.id ? response.data : document));
      setMeta(current => status === "PENDING"
        ? { ...current, totalItems: Math.max(0, current.totalItems - 1) }
        : current);
      setDecision(null);
      setMessage(decision === "VERIFY"
        ? "Tài liệu đã được xác minh. Sinh viên đã nhận thông báo."
        : "Tài liệu đã bị từ chối và lý do đã được gửi cho sinh viên.");
      window.setTimeout(() => setMessage(""), 3500);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyAction("");
    }
  };

  const filters = [
    ["PENDING", "Chờ xác minh"],
    ["VERIFIED", "Đã xác minh"],
    ["REJECTED", "Đã từ chối"],
  ];
  const statusCopy = documentVerificationCopy[status] || [status, "neutral"];

  return <>{message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}<Panel title="Bộ lọc tài liệu" action={<span className="panel-count">{meta.totalItems} tài liệu</span>}><div className="document-review-toolbar"><form className="portal-search" onSubmit={applySearch}><MagnifyingGlass size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên sinh viên, MSSV hoặc tên tệp..." /><button type="submit" aria-label="Tìm kiếm"><ArrowRight /></button></form><div className="document-status-filters" role="group" aria-label="Lọc trạng thái tài liệu">{filters.map(([value, label]) => <button key={value} aria-pressed={status === value} className={status === value ? "active" : ""} onClick={() => { setStatus(value); setSelectedId(null); }}>{label}</button>)}</div><button className="secondary-button small" onClick={() => void loadDocuments()}><ListBullets />Làm mới</button></div></Panel>{loading ? <Panel title="Hàng đợi xác minh"><div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải tài liệu...</div></Panel> : error && !selected ? <Panel title="Hàng đợi xác minh"><div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={() => void loadDocuments()}>Thử lại</button></div></Panel> : !selected ? <Panel title="Hàng đợi xác minh" action={<Status tone={statusCopy[1]}>0 tài liệu</Status>}><EmptyHint icon={ClipboardText} title={status === "PENDING" ? "Đã xử lý hết hàng đợi" : "Không có tài liệu trong bộ lọc"} text={appliedQuery ? "Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm." : "Tài liệu phù hợp sẽ xuất hiện tại đây."} /></Panel> : <div className="review-workspace document-review-workspace"><Panel title="Danh sách tài liệu" action={<Status tone={statusCopy[1]}>{documents.length} hiển thị</Status>} className="review-list-panel"><div className="review-list application-review-list document-review-list">{documents.map(document => { const verification = documentVerificationCopy[document.verificationStatus] || [document.verificationStatus, "neutral"]; return <button key={document.id} className={selected.id === document.id ? "selected" : ""} onClick={() => { setSelectedId(document.id); setError(""); }}><div className="candidate-initials">{userInitials(document.student.fullName)}</div><div><strong>{document.student.fullName}</strong><small>{document.student.studentCode} · {profileDocumentCopy[document.documentType] || document.documentType}</small><p>{document.fileName} · {formatSubmitted(document.createdAt)}</p></div><Status tone={verification[1]}>{verification[0]}</Status></button>; })}</div></Panel><Panel title="Chi tiết tài liệu" action={<Status tone={(documentVerificationCopy[selected.verificationStatus] || ["", "neutral"])[1]}>{(documentVerificationCopy[selected.verificationStatus] || [selected.verificationStatus])[0]}</Status>} className="review-detail-panel"><div className="student-review-heading"><div className="large-avatar small">{userInitials(selected.student.fullName)}</div><div><h2>{selected.student.fullName}</h2><p>MSSV {selected.student.studentCode} · {selected.student.faculty}</p><span>{selected.student.major} · {selected.student.email}</span></div><span className="version-label">Phiên bản {selected.version}</span></div><section className="document-inspection-card"><FileText /><div><small>{profileDocumentCopy[selected.documentType] || selected.documentType}</small><strong>{selected.fileName}</strong><span>PDF · {formatDocumentSize(selected.fileSizeBytes)} · Tải lên {formatSubmitted(selected.createdAt)}</span></div><button className="secondary-button" disabled={Boolean(busyAction)} onClick={() => void downloadDocument(selected)}>{busyAction === `download:${selected.id}` ? <CircleNotch className="spin" /> : <DownloadSimple />}Mở bản PDF</button></section><div className="review-checks"><span className="done"><CheckCircle />Tài khoản email UIT hợp lệ</span><span className="warning"><Warning />Cần đối chiếu nội dung PDF thủ công</span></div>{error && <p className="review-error" role="alert"><Warning />{error}</p>}{selected.verificationStatus === "PENDING" ? <div className="review-actions"><button className="secondary-button danger" disabled={Boolean(busyAction)} onClick={() => { setError(""); setDecision("REJECT"); }}>Từ chối</button><button className="primary-button" disabled={Boolean(busyAction)} onClick={() => { setError(""); setDecision("VERIFY"); }}><SealCheck />Xác minh hợp lệ</button></div> : <div className="document-review-complete"><ShieldCheck /><span><strong>Quyết định đã hoàn tất</strong><small>Không thể đổi sang trạng thái khác. Chi tiết người xử lý và ghi chú được lưu trong nhật ký hệ thống.</small></span></div>}</Panel></div>}{decision && selected && <StudentDocumentReviewModal document={selected} decision={decision} busy={busyAction === `review:${selected.id}`} error={error} onClose={() => { if (!busyAction) { setDecision(null); setError(""); } }} onSubmit={note => void submitDecision(note)} />}</>;
}

function LiveAdminApplicationReview({ targetApplicationId = null }) {
  const { authorizedRequest } = useAuth();
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [decisionMode, setDecisionMode] = useState(null);
  const selected =
    applications.find((application) => application.id === selectedId) ||
    applications[0] ||
    null;

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest(
        "/uit/applications/review-queue?page=1&pageSize=100",
      );
      setApplications(response.data);
      setSelectedId((current) =>
        response.data.some(
          (application) => application.id === targetApplicationId,
        )
          ? targetApplicationId
          : response.data.some((application) => application.id === current)
            ? current
            : (response.data[0]?.id ?? null),
      );
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [authorizedRequest, targetApplicationId]);

  const downloadApplicationDocument = async (document) => {
    if (!selected || busyDocumentId) return;
    setBusyDocumentId(document.id);
    setError("");
    try {
      const response = await authorizedRequest(
        `/uit/applications/${selected.id}/documents/${document.id}/download`,
        { method: "POST" },
      );
      window.location.assign(response.data.downloadUrl);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyDocumentId("");
    }
  };

  const decide = async (payload) => {
    if (!selected || !decisionMode || busy) return;
    setBusy(true);
    setError("");
    try {
      await authorizedRequest(
        `/uit/applications/${selected.id}/${decisionMode}`,
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          ...(decisionMode === "forward"
            ? {}
            : { body: JSON.stringify(payload) }),
        },
      );
      setApplications((current) =>
        current.filter((application) => application.id !== selected.id),
      );
      setDecisionMode(null);
      setMessage(
        decisionMode === "forward"
          ? "Hồ sơ đã được chuyển đến đúng doanh nghiệp."
          : decisionMode === "reject"
            ? "Hồ sơ đã bị từ chối và sinh viên đã nhận thông báo."
            : "Yêu cầu bổ sung đã được gửi đến sinh viên.",
      );
      window.setTimeout(() => setMessage(""), 3500);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <Panel title="Hồ sơ chờ xử lý">
        <div className="portal-loading" role="status">
          <CircleNotch className="spin" />
          Đang tải hồ sơ chờ kiểm duyệt...
        </div>
      </Panel>
    );
  if (error && !selected)
    return (
      <Panel title="Hồ sơ chờ xử lý">
        <div className="portal-error" role="alert">
          <Warning />
          {error}
          <button className="secondary-button small" onClick={loadQueue}>
            Thử lại
          </button>
        </div>
      </Panel>
    );
  if (!selected)
    return (
      <Panel
        title="Hồ sơ chờ xử lý"
        action={<Status tone="success">0 cần xử lý</Status>}
      >
        <EmptyHint
          title="Đã xử lý hết hàng đợi"
          text="Hiện không có hồ sơ sinh viên nào đang chờ UIT kiểm duyệt."
        />
        {message && (
          <div className="inline-success">
            <CheckCircle />
            {message}
          </div>
        )}
      </Panel>
    );

  const initials = selected.student.fullName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const hasCv = selected.documents.some(
    (document) => document.documentType === "CV",
  );
  return (
    <>
      <div className="review-workspace">
        <Panel
          title="Hồ sơ chờ xử lý"
          action={<Status tone="urgent">{applications.length} hồ sơ</Status>}
          className="review-list-panel"
        >
          <div className="review-filter">
            <button className="active">Cũ nhất trước</button>
            <button onClick={loadQueue}>Làm mới</button>
          </div>
          <div className="review-list application-review-list">
            {applications.map((application) => {
              const itemInitials = application.student.fullName
                .split(" ")
                .filter(Boolean)
                .slice(-2)
                .map((part) => part[0])
                .join("")
                .toUpperCase();
              return (
                <button
                  key={application.id}
                  className={selected.id === application.id ? "selected" : ""}
                  onClick={() => {
                    setSelectedId(application.id);
                    setError("");
                  }}
                >
                  <div className="candidate-initials">{itemInitials}</div>
                  <div>
                    <strong>{application.student.fullName}</strong>
                    <small>
                      {application.student.studentCode} ·{" "}
                      {application.job.title}
                    </small>
                    <p>
                      {application.job.company.name} · Nộp{" "}
                      {formatDate(application.submittedAt)}
                    </p>
                  </div>
                  <Status tone="warning">Chờ UIT</Status>
                </button>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Hồ sơ ứng tuyển"
          action={<Status tone="warning">UIT đang kiểm duyệt</Status>}
          className="review-detail-panel"
        >
          <div className="student-review-heading">
            <div className="large-avatar small">{initials}</div>
            <div>
              <h2>{selected.student.fullName}</h2>
              <p>
                MSSV {selected.student.studentCode} · {selected.student.faculty}
              </p>
              <span>
                Ứng tuyển <strong>{selected.job.title}</strong> tại{" "}
                {selected.job.company.name}
              </span>
            </div>
            <span className="version-label">Phiên bản {selected.version}</span>
          </div>
          <div className="eligibility-grid">
            <article>
              <small>Tình trạng sinh viên</small>
              <strong>
                <CheckCircle />
                {selected.student.academicStatus === "ACTIVE"
                  ? "Đang hoạt động"
                  : selected.student.academicStatus}
              </strong>
            </article>
            <article>
              <small>GPA tích lũy</small>
              <strong>{selected.student.gpa ?? "—"} / 4.0</strong>
            </article>
            <article>
              <small>Khóa / Ngành</small>
              <strong>
                {selected.student.cohort} · {selected.student.major}
              </strong>
            </article>
            <article>
              <small>Email UIT</small>
              <strong>{selected.student.email}</strong>
            </article>
          </div>
          <section className="document-verification">
            <h3>Kiểm tra tài liệu đã nộp ({selected.documents.length})</h3>
            {selected.documents.map((document) => (
              <div key={document.id}>
                <span>
                  <CheckCircle />
                  <div>
                    <strong>{document.fileName}</strong>
                    <small>
                      {document.documentType} · Phiên bản{" "}
                      {document.sourceVersion} ·{" "}
                      {Math.max(1, Math.round(document.fileSizeBytes / 1024))}{" "}
                      KB
                    </small>
                  </div>
                </span>
                <Status tone="success">Đã xác minh</Status>
                <button
                  title={`Mở ${document.fileName}`}
                  aria-label={`Mở ${document.fileName}`}
                  disabled={Boolean(busyDocumentId)}
                  onClick={() => void downloadApplicationDocument(document)}
                >
                  {busyDocumentId === document.id ? (
                    <CircleNotch className="spin" />
                  ) : (
                    <DownloadSimple />
                  )}
                </button>
              </div>
            ))}
          </section>
          <div className="review-checks">
            <span className="done">
              <CheckCircle />
              Tài khoản sinh viên hợp lệ
            </span>
            <span className={hasCv ? "done" : "warning"}>
              {hasCv ? <CheckCircle /> : <Warning />}
              {hasCv ? "Có CV ứng tuyển" : "Thiếu CV"}
            </span>
            <span className="done">
              <CheckCircle />
              Đã đồng ý chia sẻ dữ liệu
            </span>
          </div>
          {error && (
            <p className="review-error" role="alert">
              <Warning />
              {error}
            </p>
          )}
          <div className="review-actions">
            <button
              className="secondary-button danger"
              disabled={busy}
              onClick={() => setDecisionMode("reject")}
            >
              Từ chối
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setDecisionMode("request-supplement")}
            >
              <FileText />
              Yêu cầu bổ sung
            </button>
            <button
              className="primary-button"
              disabled={
                busy || !hasCv || selected.student.academicStatus !== "ACTIVE"
              }
              onClick={() => setDecisionMode("forward")}
            >
              <PaperPlaneTilt />
              Duyệt & chuyển doanh nghiệp
            </button>
          </div>
        </Panel>
      </div>
      {message && (
        <div className="toast" role="status">
          <CheckCircle weight="fill" />
          {message}
        </div>
      )}
      {decisionMode && (
        <ApplicationDecisionModal
          mode={decisionMode}
          application={selected}
          busy={busy}
          error={error}
          onClose={() => {
            if (!busy) {
              setDecisionMode(null);
              setError("");
            }
          }}
          onSubmit={(payload) => void decide(payload)}
        />
      )}
    </>
  );
}

function PlacementConfirmationModal({ application, busy, error, close, submit }) {
  const [startDate, setStartDate] = useState(application.recruitmentResult?.startDate || "");
  const [note, setNote] = useState("");
  return <div className="modal-backdrop" onMouseDown={() => !busy && close()}><div className="modal portal-modal placement-confirm-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" disabled={busy} onClick={close}><X /></button><span className="modal-icon"><GraduationCap /></span><h2>Xác nhận nơi thực tập</h2><p>Xác nhận <strong>{application.student.fullName}</strong> nhận vị trí <strong>{application.job.title}</strong> tại {application.job.company.name}.</p><div className="placement-impact"><Warning /><span><strong>Thao tác ảnh hưởng nhiều đơn</strong><small>Các đơn khác còn hoạt động của sinh viên sẽ tự chuyển sang Đã rút với lý do “Đã chọn nơi thực tập khác”. Lịch phỏng vấn liên quan cũng được hủy.</small></span></div><div className="modal-form"><label><span>Ngày bắt đầu chính thức *</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label><span>Ghi chú xác nhận</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: Đã đối chiếu offer và xác nhận với sinh viên..." maxLength={500} /></label></div>{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={close}>Hủy</button><button className="primary-button" disabled={busy || !startDate} onClick={() => submit({ startDate, ...(note.trim() ? { note: note.trim() } : {}) })}>{busy ? <CircleNotch className="spin" /> : <CheckCircle />}Xác nhận & đóng đơn khác</button></div></div></div>;
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
  const [offerDocumentBusy, setOfferDocumentBusy] = useState(false);
  const [offerDocumentError, setOfferDocumentError] = useState("");
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
      window.dispatchEvent(new CustomEvent("uit:placement-updated"));
      window.setTimeout(() => setMessage(""), 4500);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const openOfferDocument = async () => {
    if (!selected || offerDocumentBusy) return;
    setOfferDocumentBusy(true);
    setOfferDocumentError("");
    try {
      const response = await authorizedRequest(
        `/uit/applications/${selected.id}/offer-document/download`,
        { method: "POST" },
      );
      window.location.assign(response.data.downloadUrl);
    } catch (requestError) {
      setOfferDocumentError(getApiError(requestError));
    } finally {
      setOfferDocumentBusy(false);
    }
  };

  return <>{message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}<div className="metric-grid four"><MetricCard label="Chờ UIT xác nhận" value={items.length} helper="Sinh viên đã nhận offer" Icon={UserCheck} tone="green"/><MetricCard label="Bắt đầu trong 30 ngày" value={startSoon} helper="Cần hoàn tất đối chiếu" Icon={CalendarCheck}/><MetricCard label="Doanh nghiệp liên quan" value={companies} helper="Đối tác đang chờ phản hồi" Icon={Buildings} tone="purple"/><MetricCard label="Chờ quá 3 ngày" value={overdue} helper="Cần ưu tiên xử lý" Icon={Warning} tone="amber"/></div>{loading ? <Panel title="Xác nhận nơi thực tập"><div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải hàng đợi xác nhận...</div></Panel> : error && !selected ? <Panel title="Xác nhận nơi thực tập"><div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={() => void load()}>Thử lại</button></div></Panel> : !selected ? <Panel title="Xác nhận nơi thực tập" action={<Status tone="success">0 cần xử lý</Status>}><EmptyHint title="Đã xử lý hết hàng đợi" text="Hiện không có sinh viên đã nhận offer đang chờ UIT xác nhận." /></Panel> : <div className="review-workspace placement-workspace"><Panel title="Chờ xác nhận" action={<Status tone="warning">{items.length} sinh viên</Status>} className="review-list-panel"><div className="review-filter"><button className="active">Chờ lâu nhất</button><button onClick={() => void load()}>Làm mới</button></div><div className="review-list application-review-list">{items.map(item => <button key={item.id} className={selected.id === item.id ? "selected" : ""} onClick={() => { setSelectedId(item.id); setError(""); setOfferDocumentError(""); }}><div className="candidate-initials">{userInitials(item.student.fullName)}</div><div><strong>{item.student.fullName}</strong><small>{item.student.studentCode} · {item.job.title}</small><p>{item.job.company.name} · Nhận offer {formatSubmitted(item.lastTransitionAt)}</p></div><Status tone="success">Đã nhận offer</Status></button>)}</div></Panel><Panel title="Đối chiếu placement" action={<Status tone="success">Chờ UIT xác nhận</Status>} className="review-detail-panel"><div className="student-review-heading"><div className="large-avatar small">{userInitials(selected.student.fullName)}</div><div><h2>{selected.student.fullName}</h2><p>MSSV {selected.student.studentCode} · {selected.student.faculty}</p><span>Đã nhận offer <strong>{selected.job.title}</strong> tại {selected.job.company.name}</span></div><span className="version-label">Phiên bản {selected.version}</span></div><div className="eligibility-grid placement-offer-grid"><article><small>Quyết định sinh viên</small><strong><CheckCircle />Đã nhận offer</strong></article><article><small>Ngày bắt đầu đề xuất</small><strong>{formatDate(selected.recruitmentResult?.startDate)}</strong></article><article><small>Doanh nghiệp</small><strong>{selected.job.company.name}</strong></article><article><small>Email sinh viên</small><strong>{selected.student.email}</strong></article></div>{selected.recruitmentResult?.offerDocument ? <div className="placement-offer-document"><OfferDocumentCard document={selected.recruitmentResult.offerDocument} startDate={selected.recruitmentResult.startDate} busy={offerDocumentBusy} error={offerDocumentError} onOpen={() => void openOfferDocument()} /></div> : <div className="placement-offer-missing"><Info /><span><strong>Offer không có tệp PDF</strong><small>Doanh nghiệp đã ghi nhận kết quả trực tiếp trên hệ thống. UIT vẫn có thể tiếp tục đối chiếu thông tin.</small></span></div>}<div className="placement-confirmation-card"><ShieldCheck /><span><strong>Đủ điều kiện xác nhận</strong><small>Offer có kết quả PASS và sinh viên đã phản hồi ACCEPTED. Sau khi xác nhận, đơn này thành Đã nhận việc.</small></span></div><div className="placement-impact inline"><Info /><span><strong>Quy tắc nhiều đơn</strong><small>Chỉ bước xác nhận của UIT mới đóng các đơn khác. Mỗi đơn tự đóng đều có history, lý do và thông báo đến doanh nghiệp liên quan.</small></span></div>{error && <p className="review-error" role="alert"><Warning />{error}</p>}<div className="review-actions"><button className="secondary-button" onClick={() => void load()} disabled={busy}>Làm mới dữ liệu</button><button className="primary-button" onClick={() => setConfirming(true)} disabled={busy}><GraduationCap />Xác nhận nơi thực tập</button></div></Panel></div>}{confirming && selected && <PlacementConfirmationModal application={selected} busy={busy} error={error} close={() => { if (!busy) { setConfirming(false); setError(""); } }} submit={payload => void confirm(payload)} />}</>;
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
  const activeRoute = titles[route] ? route : 'company-dashboard';
  const [title,description]=titles[activeRoute];
  const pageAction = activeRoute === 'company-interviews'
    ? <button className="primary-button" onClick={() => navigate('company-candidates')}><Users />Mở danh sách ứng viên</button>
    : undefined;
  const action = activeRoute === 'company-jobs' ? <button className="primary-button" onClick={() => setModal('job')}><Plus />Tạo tin tuyển dụng</button> : null;
  return <WorkspaceShell role="company" route={activeRoute} navigate={navigate} title={title} description={description} actions={pageAction || action} user={user} onLogout={onLogout}>
    {activeRoute==='company-dashboard'&&<LiveCompanyDashboard navigate={navigate}/>} {activeRoute==='company-profile'&&<CompanyProfileManagement/>} {activeRoute==='company-jobs'&&<LiveCompanyJobs refreshKey={jobsVersion} onCreate={()=>setModal({ type: 'job', job: null })} onEdit={job=>setModal({ type: 'job', job })}/>} {activeRoute==='company-candidates'&&<CompanyCandidates targetApplicationId={navigationPayload?.notification?.resourceId}/>} {activeRoute==='company-interviews'&&<LiveCompanyInterviews navigate={navigate}/>} {activeRoute==='company-notifications'&&<CompanyNotifications navigate={navigate}/>}
    {modal?.type === 'job' && <JobPostModal job={modal.job} close={() => setModal(null)} onComplete={() => { setJobsVersion(value => value + 1); setModal(null); }} />}
    {modal === 'job' && <JobPostModal close={() => setModal(null)} onComplete={() => { setJobsVersion(value => value + 1); setModal(null); }} />}
  </WorkspaceShell>;
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

  return <Panel title="Danh sách tin" action={<div className="segmented-filter job-filters">{filters.map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>}>{loading ? <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải danh sách tin...</div> : error ? <div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={loadJobs}>Thử lại</button></div> : <><div className="simple-table company-jobs-table live-job-table"><div className="table-head"><span>Vị trí</span><span>Loại hình</span><span>Hạn nộp</span><span>Số lượng</span><span>Hình thức</span><span>Trạng thái</span><span /></div>{rows.map(job => { const [label, tone] = jobStatusCopy[job.status] || [job.status, "neutral"]; const editable = ["DRAFT", "REVISION_REQUIRED"].includes(job.status); return <button key={job.id} onClick={() => editable && onEdit(job)} className={editable ? "editable-row" : ""}><strong>{job.title}{job.latestReview?.note && job.status === "REVISION_REQUIRED" ? <small className="revision-note">UIT: {job.latestReview.note}</small> : null}</strong><span>{opportunityCopy[job.opportunityType]}</span><span>{formatDate(job.deadline)}</span><span>{job.positions}</span><span>{workModeCopy[job.workMode]}</span><span><Status tone={tone}>{label}</Status></span>{editable ? <PencilSimple /> : <DotsThree />}</button>; })}</div>{!rows.length && <EmptyHint title="Chưa có tin phù hợp" text={jobs.length ? "Hãy chọn trạng thái khác." : "Tạo tin đầu tiên để bắt đầu quy trình kiểm duyệt với UIT."} />}{!jobs.length && <div className="empty-action"><button className="primary-button" onClick={onCreate}><Plus />Tạo tin tuyển dụng</button></div>}</>}</Panel>;
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
  return <div className="modal-backdrop" onMouseDown={() => !busy && close()}><div className="modal portal-modal job-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" disabled={busy} onClick={close}><X /></button><span className="modal-icon"><Briefcase /></span><h2>{job ? "Chỉnh sửa tin tuyển dụng" : "Tạo tin tuyển dụng"}</h2><p>{isRevision ? "Cập nhật nội dung theo phản hồi của UIT rồi gửi lại để kiểm duyệt." : "Lưu bản nháp để hoàn thiện sau hoặc gửi ngay đến UIT khi nội dung đã đầy đủ."}</p>{isRevision && job.latestReview?.note && <p className="revision-callout"><Warning /><span><strong>Phản hồi từ UIT</strong>{job.latestReview.note}</span></p>}<div className="modal-form two-cols job-form"><label className="full"><span>Tên vị trí *</span><input value={form.title} onChange={event => update("title", event.target.value)} placeholder="Ví dụ: Thực tập sinh Backend" maxLength={180} /></label><label><span>Loại cơ hội *</span><select value={form.opportunityType} onChange={event => update("opportunityType", event.target.value)}><option value="INTERNSHIP">Thực tập</option><option value="FRESHER">Fresher</option><option value="FULL_TIME">Toàn thời gian</option><option value="PART_TIME">Bán thời gian</option></select></label><label><span>Hình thức làm việc *</span><select value={form.workMode} onChange={event => update("workMode", event.target.value)}><option value="ONSITE">Tại văn phòng</option><option value="HYBRID">Kết hợp</option><option value="REMOTE">Từ xa</option></select></label><label className="full"><span>Địa điểm *</span><input value={form.location} onChange={event => update("location", event.target.value)} placeholder="Quận/Thành phố hoặc địa chỉ làm việc" maxLength={255} /></label><label><span>Số lượng tuyển *</span><input type="number" min="1" max="1000" value={form.positions} onChange={event => update("positions", event.target.value)} /></label><label><span>Hạn ứng tuyển *</span><input type="date" value={form.deadline} onChange={event => update("deadline", event.target.value)} /></label><label className="full"><span>Mô tả công việc *</span><textarea value={form.description} onChange={event => update("description", event.target.value)} placeholder="Nhiệm vụ, phạm vi công việc và cách phối hợp..." maxLength={20000} /></label><label className="full"><span>Yêu cầu ứng viên *</span><textarea value={form.requirements} onChange={event => update("requirements", event.target.value)} placeholder="Kiến thức, kỹ năng, thời gian có thể làm việc..." maxLength={20000} /></label><label className="full"><span>Quyền lợi</span><textarea value={form.benefits} onChange={event => update("benefits", event.target.value)} placeholder="Trợ cấp, mentor, môi trường và cơ hội phát triển..." maxLength={10000} /></label></div>{error && <p className="form-error" role="alert"><Warning />{error}</p>}<div className="modal-actions split-actions"><button className="secondary-button" disabled={busy} onClick={close}>Hủy</button><span /><button className="secondary-button" disabled={busy || !valid} onClick={() => void save(false)}>{busy ? <CircleNotch className="spin" /> : <FileText />}Lưu bản nháp</button><button className="primary-button" disabled={busy || !valid} onClick={() => void save(true)}>{busy ? <CircleNotch className="spin" /> : <PaperPlaneTilt />}Lưu & gửi UIT duyệt</button></div></div></div>;
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

function CompanyCandidateDetailModal({
  application,
  busyDocumentId,
  documentError,
  offerDocumentBusy,
  offerDocumentError,
  close,
  downloadDocument,
  downloadOfferDocument,
}) {
  const status = companyCandidateStatusCopy[application.status] || [
    application.status,
    "neutral",
  ];
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="modal portal-modal candidate-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Đóng" onClick={close} disabled={Boolean(busyDocumentId) || offerDocumentBusy}>
          <X />
        </button>
        <div className="candidate-modal-heading">
          <span className="large-avatar small">
            {userInitials(application.student.fullName)}
          </span>
          <div>
            <h2 id="candidate-detail-title">{application.student.fullName}</h2>
            <p>
              {application.student.studentCode} · {application.student.major}
            </p>
          </div>
          <Status tone={status[1]}>{status[0]}</Status>
        </div>
        <div className="eligibility-grid candidate-detail-grid">
          <article>
            <small>Vị trí</small>
            <strong>{application.job.title}</strong>
          </article>
          <article>
            <small>GPA</small>
            <strong>{application.student.gpa ?? "—"} / 4.0</strong>
          </article>
          <article>
            <small>Email UIT</small>
            <strong>{application.student.email}</strong>
          </article>
          <article>
            <small>Nhận từ UIT</small>
            <strong>{formatSubmitted(application.submittedAt)}</strong>
          </article>
        </div>
        <section className="candidate-documents">
          <h3>Hồ sơ được UIT chuyển ({application.documents.length})</h3>
          {application.documents.map((document) => (
            <div key={document.id}>
              <FileText />
              <span>
                <strong>{document.fileName}</strong>
                <small>
                  {document.documentType} · Phiên bản {document.sourceVersion} ·{" "}
                  {Math.max(1, Math.round(document.fileSizeBytes / 1024))} KB
                </small>
              </span>
              <Status tone="success">Đã xác minh</Status>
              <button
                className="document-download-button"
                title={`Mở ${document.fileName}`}
                aria-label={`Mở ${document.fileName}`}
                disabled={Boolean(busyDocumentId)}
                onClick={() => void downloadDocument(document)}
              >
                {busyDocumentId === document.id ? (
                  <CircleNotch className="spin" />
                ) : (
                  <DownloadSimple />
                )}
              </button>
            </div>
          ))}
          {documentError && (
            <p className="review-error" role="alert">
              <Warning />
              {documentError}
            </p>
          )}
        </section>
        {application.recruitmentResult?.outcome === "PASS" && (
          <section className="candidate-offer-document">
            <h3>Kết quả & offer</h3>
            {application.recruitmentResult.offerDocument ? (
              <OfferDocumentCard
                compact
                document={application.recruitmentResult.offerDocument}
                startDate={application.recruitmentResult.startDate}
                busy={offerDocumentBusy}
                error={offerDocumentError}
                onOpen={() => void downloadOfferDocument(application)}
              />
            ) : (
              <p className="candidate-offer-empty">Kết quả đạt được ghi nhận không kèm tệp PDF offer.</p>
            )}
          </section>
        )}
        {application.status === "HIRED" && <InternshipEvaluationPanel role="company" applicationId={application.id} />}
        <section className="candidate-timeline">
          <h3>Lịch sử xử lý</h3>
          {application.timeline.map((event, index) => {
            const copy =
              companyCandidateStatusCopy[event.toStatus]?.[0] || event.toStatus;
            return (
              <div key={`${event.createdAt}-${index}`}>
                <span />
                <div>
                  <strong>{copy}</strong>
                  <small>
                    {formatSubmitted(event.createdAt)} · {event.actorType}
                  </small>
                  {event.note && <p>{event.note}</p>}
                </div>
              </div>
            );
          })}
        </section>
        <button className="primary-button full" onClick={close}>
          Đóng
        </button>
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
  const [offerFile, setOfferFile] = useState(null);
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
        payload: {
          outcome: "PASS",
          startDate: date,
          ...(note.trim() ? { internalNote: note.trim() } : {}),
        },
        offerFile,
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
      <div className="modal portal-modal candidate-decision-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <button className="modal-close" aria-label="Đóng" disabled={busy} onClick={close}><X /></button>
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
            <label className="offer-file-picker"><span>PDF offer (không bắt buộc)</span><input type="file" accept="application/pdf,.pdf" onChange={event => setOfferFile(event.target.files?.[0] || null)} /><small>{offerFile ? `${offerFile.name} · ${formatBytes(offerFile.size)}` : "Tối đa 10 MB. Tệp được lưu riêng tư trên Cloudflare R2."}</small></label>
            <label className="full"><span>Ghi chú nội bộ</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Thông tin chỉ doanh nghiệp lưu nội bộ..." maxLength={2000} /></label>
          </div>
        ) : (
          <label className="review-note"><span>Lý do chi tiết *</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Nêu lý do ngắn gọn, chuyên nghiệp..." maxLength={2000} /></label>
        )}
        {error && <p className="form-error" role="alert"><Warning />{error}</p>}
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
  const [busyDocumentId, setBusyDocumentId] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [busyOfferApplicationId, setBusyOfferApplicationId] = useState("");
  const [offerDocumentError, setOfferDocumentError] = useState("");
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
  const downloadApplicationDocument = async document => {
    if (!detail || busyDocumentId) return;
    setBusyDocumentId(document.id);
    setDocumentError("");
    try {
      const response = await authorizedRequest(
        `/companies/me/applications/${detail.id}/documents/${document.id}/download`,
        { method: "POST" },
      );
      window.location.assign(response.data.downloadUrl);
    } catch (requestError) {
      setDocumentError(getApiError(requestError));
    } finally {
      setBusyDocumentId("");
    }
  };
  const downloadOfferDocument = async application => {
    if (busyOfferApplicationId) return;
    setBusyOfferApplicationId(application.id);
    setOfferDocumentError("");
    try {
      const response = await authorizedRequest(
        `/companies/me/applications/${application.id}/offer-document/download`,
        { method: "POST" },
      );
      window.location.assign(response.data.downloadUrl);
    } catch (requestError) {
      setOfferDocumentError(getApiError(requestError));
    } finally {
      setBusyOfferApplicationId("");
    }
  };
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
  const decide = async submission => {
    const application = decision.application;
    const payload = submission?.payload ?? submission;
    const offerFile = submission?.offerFile ?? null;
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
        if (decision.mode === "result-pass" && offerFile) {
          if (offerFile.type !== "application/pdf" || !offerFile.name.toLowerCase().endsWith(".pdf")) {
            throw new Error("Chỉ chấp nhận tệp offer định dạng PDF.");
          }
          if (offerFile.size <= 0 || offerFile.size > 10 * 1024 * 1024) {
            throw new Error("Tệp offer phải có dung lượng từ 1 byte đến 10 MB.");
          }
          const intent = await authorizedRequest(
            `/companies/me/applications/${application.id}/offer-document/uploads`,
            {
              method: "POST",
              body: JSON.stringify({
                fileName: offerFile.name,
                mimeType: "application/pdf",
                fileSizeBytes: offerFile.size,
              }),
            },
          );
          const uploadResponse = await fetch(intent.data.uploadUrl, {
            method: intent.data.method,
            headers: intent.data.headers,
            body: offerFile,
          });
          if (!uploadResponse.ok) {
            throw new Error("Không thể tải PDF offer lên kho lưu trữ. Vui lòng thử lại.");
          }
          await authorizedRequest(
            `/companies/me/applications/${application.id}/offer-document/uploads/${intent.data.uploadId}/complete`,
            { method: "POST" },
          );
          payload.offerUploadId = intent.data.uploadId;
        }
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
      {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
      <div className="portal-toolbar">
        <label className="portal-search"><MagnifyingGlass /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm ứng viên, MSSV, vị trí..." /></label>
        <label className="candidate-job-filter"><FunnelSimple /><select value={jobId} onChange={event => setJobId(event.target.value)}><option value="">Vị trí: Tất cả</option>{jobs.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? <CircleNotch className="spin" /> : <ListBullets />}Làm mới</button>
      </div>
      {error && !decision && <p className="review-error" role="alert"><Warning />{error}</p>}
      {loading ? <div className="loading-state"><CircleNotch className="spin" />Đang tải hồ sơ ứng viên...</div> : (
        <div className="candidate-board live-candidate-board">
          {columns.map(column => {
            const candidatesInStage = filtered.filter(item => companyCandidateStage(item.status) === column.key);
            return <section key={column.key}><header><h2>{column.label}</h2><span>{candidatesInStage.length}</span></header><div>{!candidatesInStage.length && <p className="candidate-empty">Chưa có hồ sơ</p>}{candidatesInStage.map(application => {
              const status = companyCandidateStatusCopy[application.status] || [application.status, "neutral"];
              const busy = busyId === application.id;
              return <article key={application.id}><div className="candidate-card-heading"><span className="candidate-initials">{userInitials(application.student.fullName)}</span><div><strong>{application.student.fullName}</strong><small>{application.student.studentCode} · {application.student.major}</small></div></div><p>{application.job.title}</p><div className="candidate-meta"><span>GPA <b>{application.student.gpa ?? "—"}</b></span><Status tone={status[1]}>{status[0]}</Status></div><small className="candidate-received">Cập nhật {formatSubmitted(application.lastTransitionAt)}</small><div className={`candidate-card-actions ${application.status === "INTERVIEW_INVITED" ? "result-actions" : ""}`}><button onClick={() => { setDocumentError(""); setOfferDocumentError(""); setDetail(application); }}><Eye />Xem</button>{application.status === "FORWARDED_TO_COMPANY" && <button className="primary wide" disabled={busy} onClick={() => void startReview(application)}>{busy ? <CircleNotch className="spin" /> : <ArrowRight />}Bắt đầu xem</button>}{application.status === "COMPANY_REVIEWING" && <><button className="reject" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "reject", application }); }}>Không phù hợp</button><button className="primary" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "interview", application }); }}><CalendarCheck />Mời PV</button></>}{application.status === "INTERVIEW_INVITED" && <><button className="reject" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "result-fail", application }); }}>Không đạt</button><button className="primary" disabled={busy} onClick={() => { setError(""); setDecision({ mode: "result-pass", application }); }}><CheckCircle />Đạt & offer</button></>}</div></article>;
            })}</div></section>;
          })}
        </div>
      )}
      {detail && <CompanyCandidateDetailModal application={detail} busyDocumentId={busyDocumentId} documentError={documentError} offerDocumentBusy={busyOfferApplicationId === detail.id} offerDocumentError={offerDocumentError} downloadDocument={downloadApplicationDocument} downloadOfferDocument={downloadOfferDocument} close={() => { if (!busyDocumentId && !busyOfferApplicationId) { setDetail(null); setDocumentError(""); setOfferDocumentError(""); } }} />}
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

  if (loading) return <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải lịch phỏng vấn...</div>;
  return <><div className="portal-toolbar"><span className="panel-count">{interviews.length} lịch phỏng vấn</span><button className="secondary-button" onClick={() => setRefreshKey(value => value + 1)}><ListBullets />Làm mới</button></div>{error && <p className="review-error" role="alert"><Warning />{error}</p>}<div className="portal-two-column wide-left"><Panel title={`Lịch sắp tới (${upcoming.length})`}><div className="interview-agenda">{upcoming.length === 0 ? <EmptyHint icon={CalendarBlank} title="Chưa có lịch sắp tới" text="Mở bảng ứng viên để tạo lịch từ hồ sơ đang sàng lọc." /> : upcoming.map(interview => { const timing = interviewTiming(interview.scheduledAt); const status = interviewStatusCopy[interview.status] || [interview.status, "neutral"]; return <article key={interview.id}><div className="agenda-date"><strong>{timing.day}</strong><small>{timing.month}</small></div><time>{timing.time}</time><div><strong>{interview.student.fullName}</strong><small>{interview.job.title} · {interviewPlace(interview)}</small></div><Status tone={status[1]}>{status[0]}</Status><button className="agenda-action" aria-label={`Mở hồ sơ ${interview.student.fullName}`} onClick={() => navigate("company-candidates", { notification: { resourceId: interview.applicationId } })}><ArrowRight /></button></article>; })}</div></Panel><div><Panel title={`Kết quả cần cập nhật (${awaitingResults.length})`}><div className="result-list">{awaitingResults.length === 0 ? <EmptyHint icon={CheckCircle} title="Không có kết quả tồn" text="Các buổi đã qua cần xử lý sẽ xuất hiện tại đây." /> : awaitingResults.map(interview => <div key={interview.id}><span className="candidate-initials">{userInitials(interview.student.fullName)}</span><div><strong>{interview.student.fullName}</strong><small>{interview.job.title} · {interviewTiming(interview.scheduledAt).date}</small></div><button className="secondary-button small" onClick={() => navigate("company-candidates", { notification: { resourceId: interview.applicationId } })}>Cập nhật</button></div>)}</div></Panel><button className="primary-button full" onClick={() => navigate("company-candidates")}><Users />Tạo lịch từ hồ sơ ứng viên</button></div></div></>;
}

function CompanyNotifications({ navigate }){
  return <NotificationInbox role="company" onOpen={(notification, destination) => navigate(destination, { notification })} />;
}
