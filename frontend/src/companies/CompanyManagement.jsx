import { useEffect, useMemo, useState } from "react";
import {
  Buildings,
  CheckCircle,
  CircleNotch,
  Copy,
  DotsThree,
  Eye,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SealCheck,
  UserPlus,
  Warning,
  X,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";

const statusCopy = {
  ACTIVE: ["Đang hoạt động", "success"],
  PENDING: ["Chờ xác minh", "warning"],
  SUSPENDED: ["Tạm ngưng", "urgent"],
  ENDED: ["Đã kết thúc", "neutral"],
  PENDING_ACTIVATION: ["Chờ kích hoạt", "warning"],
  LOCKED: ["Bị khóa", "urgent"],
};

const emptyCompany = {
  code: "",
  name: "",
  legalName: "",
  taxCode: "",
  industry: "",
  companySize: "",
  description: "",
  website: "",
  address: "",
};

function apiError(error) {
  return error?.message || "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
}

function nullable(value) {
  const result = value?.trim();
  return result ? result : null;
}

function companyPayload(form) {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    legalName: nullable(form.legalName),
    taxCode: nullable(form.taxCode),
    industry: nullable(form.industry),
    companySize: nullable(form.companySize),
    description: nullable(form.description),
    website: nullable(form.website),
    address: nullable(form.address),
  };
}

function activationUrl(token) {
  return `${window.location.origin}/?activationToken=${encodeURIComponent(token)}`;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value)) : "—";
}

function initials(value = "") {
  return value.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "DN";
}

function Status({ value }) {
  const [label, tone] = statusCopy[value] || [value, "neutral"];
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function Panel({ title, action, children }) {
  return <section className="portal-panel"><header><h2>{title}</h2>{action}</header>{children}</section>;
}

function Loading({ text = "Đang tải dữ liệu..." }) {
  return <div className="portal-loading"><CircleNotch className="spin" />{text}</div>;
}

function ErrorBox({ message, retry }) {
  return <div className="portal-error"><Warning />{message}{retry && <button className="secondary-button small" onClick={retry}>Thử lại</button>}</div>;
}

function ActivationLink({ token, expiresAt }) {
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => activationUrl(token), [token]);
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return <div className="activation-link-box"><div><strong>Liên kết kích hoạt một lần</strong><small>Hiệu lực đến {formatDate(expiresAt)}. Hệ thống chưa gửi email; UIT sao chép và gửi thủ công cho người phụ trách.</small></div><code>{link}</code><button className="primary-button" onClick={copy}><Copy />{copied ? "Đã sao chép" : "Sao chép link"}</button></div>;
}

export function AdminCompanyManagement({ refreshKey = 0, onCreate }) {
  const { authorizedRequest } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], meta: { totalItems: 0, totalPages: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [version, setVersion] = useState(0);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (query.trim()) params.set("query", query.trim());
      if (status) params.set("status", status);
      setResult(await authorizedRequest(`/uit/companies?${params}`));
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [authorizedRequest, page, query, status, refreshKey, version]);

  return <>
    <Panel title="Danh sách đối tác" action={<span className="panel-count">{result.meta.totalItems} doanh nghiệp</span>}>
      <div className="portal-toolbar inside company-management-toolbar">
        <label className="portal-search"><MagnifyingGlass size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm theo tên, mã hoặc mã số thuế..." /></label>
        <select className="management-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="SUSPENDED">Tạm ngưng</option><option value="PENDING">Chờ xác minh</option><option value="ENDED">Đã kết thúc</option>
        </select>
        <button className="primary-button" onClick={onCreate}><UserPlus />Thêm doanh nghiệp</button>
      </div>
      {loading ? <Loading text="Đang tải doanh nghiệp đối tác..." /> : error ? <ErrorBox message={error} retry={load} /> : <>
        <div className="simple-table admin-company-table live-company-table">
          <div className="table-head"><span>Doanh nghiệp</span><span>Lĩnh vực</span><span>Tin đang tuyển</span><span>Tài khoản</span><span>Trạng thái</span><span>Cập nhật</span><span /></div>
          {result.data.map((company) => <button key={company.id} onClick={() => setSelectedId(company.id)}>
            <strong><span className="mini-company-mark">{initials(company.name)}</span><span>{company.name}<small>{company.code}{company.taxCode ? ` · MST ${company.taxCode}` : ""}</small></span></strong>
            <span>{company.industry || "Chưa cập nhật"}</span><span>{company.recruitingJobCount}</span><span>{company.activeRecruiterCount}/{company.recruiterCount}</span><span><Status value={company.partnerStatus} /></span><span>{formatDate(company.updatedAt)}</span><Eye size={18} />
          </button>)}
        </div>
        {!result.data.length && <div className="management-empty"><Buildings size={34} /><strong>Chưa có doanh nghiệp phù hợp</strong><span>Thử đổi từ khóa hoặc tạo hồ sơ đối tác mới.</span></div>}
        <div className="table-footer"><span>Trang {page} / {Math.max(result.meta.totalPages, 1)}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trước</button><button className="active">{page}</button><button disabled={page >= result.meta.totalPages} onClick={() => setPage((value) => value + 1)}>Sau</button></div></div>
      </>}
    </Panel>
    {selectedId && <CompanyDetailModal companyId={selectedId} close={() => setSelectedId(null)} onChanged={() => setVersion((value) => value + 1)} />}
  </>;
}

export function CompanyCreatePartnerModal({ close, onComplete }) {
  const { authorizedRequest } = useAuth();
  const [form, setForm] = useState({ ...emptyCompany, recruiterEmail: "", recruiterName: "", recruiterTitle: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const valid = form.code.trim().length >= 2 && form.name.trim().length >= 2 && form.recruiterEmail.includes("@") && form.recruiterName.trim().length >= 2;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest("/uit/companies", {
        method: "POST",
        body: JSON.stringify({
          ...companyPayload(form),
          primaryRecruiter: {
            email: form.recruiterEmail.trim().toLowerCase(),
            fullName: form.recruiterName.trim(),
            title: nullable(form.recruiterTitle),
          },
        }),
      });
      setCreated(response.data);
      onComplete?.();
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={() => !busy && close()}><div className="modal portal-modal company-create-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" disabled={busy} onClick={close}><X /></button>
    {created ? <div className="modal-success company-created-result"><CheckCircle size={52} weight="fill" /><h2>Đã tạo doanh nghiệp đối tác</h2><p><strong>{created.company.name}</strong> đang hoạt động; tài khoản {created.company.recruiters[0]?.email} đang chờ kích hoạt.</p><ActivationLink {...created.activation} /><button className="primary-button full" onClick={close}>Hoàn tất</button></div> : <>
      <span className="modal-icon"><Buildings /></span><h2>Thêm doanh nghiệp đối tác</h2><p>Tạo hồ sơ đã xác minh và tài khoản phụ trách chính. Không gửi email tự động ở giai đoạn hiện tại.</p>
      <div className="modal-form two-cols company-form">
        <label><span>Mã doanh nghiệp *</span><input value={form.code} onChange={(event) => update("code", event.target.value.toUpperCase())} placeholder="VD: KMS" maxLength={30} /></label>
        <label><span>Mã số thuế</span><input value={form.taxCode} onChange={(event) => update("taxCode", event.target.value)} maxLength={50} /></label>
        <label className="full"><span>Tên hiển thị *</span><input value={form.name} onChange={(event) => update("name", event.target.value)} maxLength={180} /></label>
        <label className="full"><span>Tên pháp lý</span><input value={form.legalName} onChange={(event) => update("legalName", event.target.value)} maxLength={255} /></label>
        <label><span>Lĩnh vực</span><input value={form.industry} onChange={(event) => update("industry", event.target.value)} /></label>
        <label><span>Quy mô</span><input value={form.companySize} onChange={(event) => update("companySize", event.target.value)} placeholder="VD: 100-499" /></label>
        <label><span>Website</span><input value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="https://..." /></label>
        <label><span>Địa chỉ</span><input value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
        <label className="full"><span>Giới thiệu</span><textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
        <div className="form-divider full"><strong>Tài khoản phụ trách chính</strong><small>Người này nhận link kích hoạt và quản lý tuyển dụng cho doanh nghiệp.</small></div>
        <label><span>Họ tên *</span><input value={form.recruiterName} onChange={(event) => update("recruiterName", event.target.value)} /></label>
        <label><span>Chức danh</span><input value={form.recruiterTitle} onChange={(event) => update("recruiterTitle", event.target.value)} /></label>
        <label className="full"><span>Email *</span><input type="email" value={form.recruiterEmail} onChange={(event) => update("recruiterEmail", event.target.value)} /></label>
      </div>
      {error && <p className="form-error"><Warning />{error}</p>}
      <div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={close}>Hủy</button><button className="primary-button" disabled={busy || !valid} onClick={submit}>{busy ? <CircleNotch className="spin" /> : <UserPlus />}Tạo hồ sơ & link kích hoạt</button></div>
    </>}
  </div></div>;
}

function CompanyDetailModal({ companyId, close, onChanged }) {
  const { authorizedRequest } = useAuth();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(emptyCompany);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [recruiter, setRecruiter] = useState({ email: "", fullName: "", title: "" });
  const [activation, setActivation] = useState(null);

  const applyCompany = (value) => {
    setCompany(value);
    setForm(Object.fromEntries(Object.keys(emptyCompany).map((key) => [key, value[key] || ""])));
  };
  const load = async () => {
    setLoading(true);
    setError("");
    try { applyCompany((await authorizedRequest(`/uit/companies/${companyId}`)).data); }
    catch (requestError) { setError(apiError(requestError)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [authorizedRequest, companyId]);

  const execute = async (path, options, selectCompany = (data) => data) => {
    setBusy(true); setError(""); setActivation(null);
    try {
      const response = await authorizedRequest(path, options);
      applyCompany(selectCompany(response.data));
      if (response.data.activation) setActivation(response.data.activation);
      setReason(""); onChanged();
      return true;
    } catch (requestError) { setError(apiError(requestError)); return false; }
    finally { setBusy(false); }
  };

  const save = () => execute(`/uit/companies/${companyId}`, { method: "PATCH", body: JSON.stringify({ ...companyPayload(form), expectedVersion: company.version }) });
  const changeCompanyState = () => execute(`/uit/companies/${companyId}/${company.partnerStatus === "ACTIVE" ? "suspend" : "reactivate"}`, { method: "POST", body: JSON.stringify({ expectedVersion: company.version, reason: reason.trim() }) });
  const addRecruiter = async () => {
    const saved = await execute(`/uit/companies/${companyId}/recruiters`, { method: "POST", body: JSON.stringify({ email: recruiter.email.trim().toLowerCase(), fullName: recruiter.fullName.trim(), title: nullable(recruiter.title) }) }, (data) => data.company);
    if (saved) setRecruiter({ email: "", fullName: "", title: "" });
  };
  const recruiterAction = (user, action) => execute(`/uit/companies/${companyId}/recruiters/${user.userId}/${action}`, { method: "POST", body: JSON.stringify({ reason: reason.trim() || `UIT ${action === "suspend" ? "tạm ngưng" : "kích hoạt lại"} tài khoản.` }) });
  const regenerate = (userId) => execute(`/uit/companies/${companyId}/recruiters/${userId}/activation-link`, { method: "POST" }, (data) => data.company);

  return <div className="modal-backdrop" onMouseDown={() => !busy && close()}><div className="modal portal-modal company-detail-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" disabled={busy} onClick={close}><X /></button>
    {loading ? <Loading /> : !company ? <ErrorBox message={error} retry={load} /> : <>
      <div className="company-detail-heading"><span className="company-logo large">{initials(company.name)}</span><div><Status value={company.partnerStatus} /><h2>{company.name}</h2><p>{company.code} · phiên bản {company.version}</p></div></div>
      <div className="company-detail-columns">
        <section><h3>Thông tin đối tác</h3><div className="modal-form two-cols company-form compact">
          {Object.entries({ code: "Mã doanh nghiệp", name: "Tên hiển thị", legalName: "Tên pháp lý", taxCode: "Mã số thuế", industry: "Lĩnh vực", companySize: "Quy mô", website: "Website", address: "Địa chỉ" }).map(([field, label]) => <label key={field} className={["name", "legalName", "address"].includes(field) ? "full" : ""}><span>{label}</span><input value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
          <label className="full"><span>Giới thiệu</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
        </div><button className="primary-button management-save" disabled={busy} onClick={save}>{busy ? <CircleNotch className="spin" /> : <PencilSimple />}Lưu thay đổi</button></section>
        <aside><h3>Trạng thái hợp tác</h3><p>Thay đổi trạng thái sẽ được lưu vào audit log. Tạm ngưng sẽ đăng xuất các tài khoản doanh nghiệp.</p><textarea className="management-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do (ít nhất 5 ký tự)..." />
          {company.partnerStatus !== "ENDED" && <button className={`secondary-button full ${company.partnerStatus === "ACTIVE" ? "danger" : ""}`} disabled={busy || reason.trim().length < 5} onClick={changeCompanyState}>{company.partnerStatus === "ACTIVE" ? "Tạm ngưng doanh nghiệp" : "Kích hoạt lại doanh nghiệp"}</button>}
          <div className="company-stats"><span><strong>{company.recruitingJobCount}</strong>Tin đang tuyển</span><span><strong>{company.activeRecruiterCount}</strong>Tài khoản khả dụng</span></div>
        </aside>
      </div>
      <section className="recruiter-management"><h3>Tài khoản tuyển dụng</h3><div className="recruiter-list management-recruiters">{company.recruiters.map((user) => <div key={user.userId}><span>{initials(user.fullName)}</span><div><strong>{user.fullName}{user.isPrimary && <em>Chính</em>}</strong><small>{user.email} · {user.title || "Nhà tuyển dụng"}</small></div><Status value={user.status} /><div className="recruiter-actions">{user.status === "PENDING_ACTIVATION" && <button title="Tạo lại link" onClick={() => regenerate(user.userId)}><Copy /></button>}{["ACTIVE", "PENDING_ACTIVATION"].includes(user.status) && <button title="Tạm ngưng" onClick={() => recruiterAction(user, "suspend")}><X /></button>}{user.status === "SUSPENDED" && <button title="Kích hoạt lại" onClick={() => recruiterAction(user, "reactivate")}><CheckCircle /></button>}</div></div>)}</div>
        {company.partnerStatus === "ACTIVE" && <div className="add-recruiter-row"><input placeholder="Họ tên" value={recruiter.fullName} onChange={(event) => setRecruiter((current) => ({ ...current, fullName: event.target.value }))} /><input type="email" placeholder="Email" value={recruiter.email} onChange={(event) => setRecruiter((current) => ({ ...current, email: event.target.value }))} /><input placeholder="Chức danh" value={recruiter.title} onChange={(event) => setRecruiter((current) => ({ ...current, title: event.target.value }))} /><button className="primary-button" disabled={busy || recruiter.fullName.trim().length < 2 || !recruiter.email.includes("@")} onClick={addRecruiter}><Plus />Thêm tài khoản</button></div>}
      </section>
      {activation && <ActivationLink {...activation} />}{error && <p className="form-error"><Warning />{error}</p>}
    </>}
  </div></div>;
}

export function CompanyProfileManagement() {
  const { authorizedRequest } = useAuth();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({ name: "", industry: "", companySize: "", description: "", website: "", address: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const applyCompany = (value) => {
    setCompany(value);
    setForm(Object.fromEntries(Object.keys(form).map((key) => [key, value[key] || ""])));
  };
  const load = async () => {
    setLoading(true); setError("");
    try { applyCompany((await authorizedRequest("/companies/me/profile")).data); }
    catch (requestError) { setError(apiError(requestError)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [authorizedRequest]);
  const save = async () => {
    setBusy(true); setError("");
    try {
      const response = await authorizedRequest("/companies/me/profile", { method: "PATCH", body: JSON.stringify({ name: form.name.trim(), industry: nullable(form.industry), companySize: nullable(form.companySize), description: nullable(form.description), website: nullable(form.website), address: nullable(form.address), expectedVersion: company.version }) });
      applyCompany(response.data); setEditing(false);
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setBusy(false); }
  };
  if (loading) return <Panel title="Hồ sơ doanh nghiệp"><Loading /></Panel>;
  if (!company) return <Panel title="Hồ sơ doanh nghiệp"><ErrorBox message={error} retry={load} /></Panel>;
  return <div className="company-profile-layout"><Panel title="Hồ sơ hiển thị" action={<button className="secondary-button small" disabled={busy || company.partnerStatus !== "ACTIVE"} onClick={() => editing ? save() : setEditing(true)}>{busy ? <CircleNotch className="spin" /> : <PencilSimple />}{editing ? "Lưu thay đổi" : "Chỉnh sửa"}</button>}><div className="company-cover"><div className="company-logo large">{initials(company.name)}</div><div><h2>{company.name}</h2><p><SealCheck weight="fill" />Đối tác UIT đã xác thực · {company.code}</p></div></div><div className="company-profile-fields">{Object.entries({ name: "Tên doanh nghiệp", website: "Website", industry: "Lĩnh vực", companySize: "Quy mô", address: "Địa chỉ" }).map(([field, label]) => <label className={field === "address" ? "full" : ""} key={field}><span>{label}</span><input disabled={!editing} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} /></label>)}<label className="full"><span>Giới thiệu</span><textarea disabled={!editing} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label></div>{error && <p className="form-error"><Warning />{error}</p>}</Panel><div><Panel title="Trạng thái hợp tác"><div className="partnership-state"><CheckCircle size={36} /><Status value={company.partnerStatus} /><p>Hồ sơ phiên bản {company.version}</p><small>Cập nhật lần cuối: {formatDate(company.updatedAt)}</small></div></Panel><Panel title="Tài khoản tuyển dụng"><div className="recruiter-list">{company.recruiters.map((user) => <div key={user.userId}><span>{initials(user.fullName)}</span><div><strong>{user.fullName}</strong><small>{user.email} · {user.title || "Nhà tuyển dụng"}</small></div><Status value={user.status} /></div>)}</div></Panel></div></div>;
}
